/**
 * LLM Adapter Pool - 优化版
 *
 * 优化策略：
 * 1. 启动时加载 config 和 instance 到内存缓存
 * 2. 定时刷新缓存（默认5分钟）
 * 3. API Key 加密存储在内存中
 * 4. 写操作（使用量、失败次数）直通数据库
 */

import type { LlmConfig } from "../configs/types.js";
import type { LlmInstance, BillingType } from "../instances/types.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LLMCallResult,
  StreamChunk,
} from "./types.js";
import { query, run } from "../../store/database.js";
import crypto from "crypto";

// 加密/解密函数
const ENCRYPTION_KEY = process.env.LLM_KEY_ENCRYPTION_KEY || "default-key-32-chars-long!!!!!";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY.padEnd(32, " ").slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY.padEnd(32, " ").slice(0, 32)),
    Buffer.from(ivHex, "hex")
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// 缓存的实例数据（API Key 已加密）
interface CachedInstance {
  id: string;
  config: LlmConfig;
  instance: Omit<LlmInstance, "apiKey"> & { encryptedApiKey: string };
  providerName: string;
}

export class LLMAdapter {
  private config: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    timeout: number;
    retries: number;
    headers?: Record<string, string>;
  };

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    timeout: number;
    retries: number;
    headers?: Record<string, string>;
  }) {
    this.config = config;
  }

  /**
   * 执行聊天完成请求
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<LLMCallResult> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };

    const body = {
      ...request,
      model: this.config.modelName,
    };

    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP ${response.status}: ${errorText || response.statusText}`
          );
        }

        const data = (await response.json()) as ChatCompletionResponse;

        const choice = data.choices[0];
        if (!choice) {
          throw new Error("No choice in response");
        }

        return {
          content: choice.message.content || "",
          toolCalls: choice.message.tool_calls,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
          model: data.model,
          finishReason: choice.finish_reason,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`[LLMAdapter] Request error: ${lastError.message}`);
        if (attempt < this.config.retries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[LLMAdapter] Request failed, retrying in ${delayMs}ms... (${
              attempt + 1
            }/${this.config.retries})`
          );
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * 流式聊天完成
   */
  async *streamChatCompletion(
    request: ChatCompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };

    const body = {
      ...request,
      model: this.config.modelName,
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${errorText || response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const chunk: StreamChunk = JSON.parse(trimmed.slice(6));
              yield chunk;
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class AdapterPool {
  private configCache: Map<string, LlmConfig> = new Map();
  private instanceCache: Map<string, CachedInstance> = new Map();
  private refreshInterval: number = 5 * 60 * 1000; // 5分钟
  private refreshTimer?: NodeJS.Timeout;
  private initialized: boolean = false;

  /**
   * 初始化：加载所有配置到缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[AdapterPool] Initializing...");
    await this.loadCache();

    // 启动定时刷新
    this.refreshTimer = setInterval(() => {
      this.loadCache().catch((err) => {
        console.error("[AdapterPool] Failed to refresh cache:", err);
      });
    }, this.refreshInterval);

    this.initialized = true;
    console.log(`[AdapterPool] Initialized with ${this.instanceCache.size} instances`);
  }

  /**
   * 停止：清理缓存和定时器
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.configCache.clear();
    this.instanceCache.clear();
    this.initialized = false;
    console.log("[AdapterPool] Stopped");
  }

  /**
   * 加载缓存
   */
  private async loadCache(): Promise<void> {
    const sql = `
      SELECT
        c.sid as config_id,
        c.name as config_name,
        c.provider_id,
        c.base_url,
        c.subscribe_type,
        c.model_name,
        c.model_type,
        c.context_size,
        c.parameters,
        c.enable_thinking,
        c.stream,
        c.auth_method,
        c.timeout,
        c.retries,
        i.sid as instance_id,
        i.name as instance_name,
        i.api_key,
        i.headers,
        i.weight,
        i.daily_quota,
        i.daily_used,
        i.fail_count,
        i.cooldown_until,
        i.billing_type,
        p.name as provider_name
      FROM t_llm_configs c
      JOIN t_llm_instances i ON c.sid = i.config_id
      JOIN t_llm_providers p ON c.provider_id = p.sid
      WHERE c.deleted = 0
        AND c.status = 'enabled'
        AND i.deleted = 0
        AND i.status = 'enabled'
      ORDER BY c.sort ASC, i.sort ASC
    `;

    const rows = await query<InstanceRow[]>(sql, []);

    const newConfigCache = new Map<string, LlmConfig>();
    const newInstanceCache = new Map<string, CachedInstance>();

    for (const row of rows) {
      const config: LlmConfig = {
        sid: row.config_id,
        name: row.config_name,
        providerId: row.provider_id,
        baseUrl: row.base_url,
        subscribeType: row.subscribe_type,
        modelName: row.model_name,
        modelType: row.model_type,
        contextSize: row.context_size,
        parameters: parseJson(row.parameters),
        enableThinking: row.enable_thinking,
        stream: row.stream,
        authMethod: row.auth_method,
        timeout: row.timeout,
        retries: row.retries,
        status: "enabled",
        deleted: 0,
        sort: 0,
      };

      const instanceId = `${row.config_id}:${row.instance_id}`;

      newConfigCache.set(row.config_id, config);
      newInstanceCache.set(instanceId, {
        id: instanceId,
        config,
        instance: {
          sid: row.instance_id,
          name: row.instance_name,
          providerName: row.provider_name,
          configId: row.config_id,
          encryptedApiKey: encrypt(row.api_key), // 加密存储
          apiKeyHash: "",
          headers: parseJson(row.headers),
          billingType: row.billing_type as BillingType,
          weight: row.weight,
          dailyQuota: row.daily_quota ?? undefined,
          dailyUsed: row.daily_used,
          failCount: row.fail_count,
          cooldownUntil: row.cooldown_until ?? undefined,
          status: "enabled",
          deleted: 0,
          sort: 0,
        },
        providerName: row.provider_name,
      });
    }

    this.configCache = newConfigCache;
    this.instanceCache = newInstanceCache;

    console.log(
      `[AdapterPool] Cache refreshed: ${this.configCache.size} configs, ${this.instanceCache.size} instances`
    );
  }

  /**
   * 手动刷新缓存
   */
  async refresh(): Promise<void> {
    console.log("[AdapterPool] Manual refresh...");
    await this.loadCache();
  }

  /**
   * 获取适配器（从缓存中组装）
   */
  async getAdapter(
    configId?: string,
    providerName?: string,
    modelName?: string
  ): Promise<{ adapter: LLMAdapter; instanceId: string }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 从缓存中选择可用实例
    const cached = this.selectFromCache(configId, providerName, modelName);

    if (!cached) {
      throw new Error(
        `No available LLM instance found` +
          (configId ? ` for config: ${configId}` : "") +
          (providerName ? ` provider: ${providerName}` : "") +
          (modelName ? ` model: ${modelName}` : "")
      );
    }

    // 检查实时状态（冷却、配额）- 这些需要查数据库
    const isAvailable = await this.checkRealtimeStatus(cached.instance.sid);
    if (!isAvailable) {
      // 如果不可用，尝试选择其他实例
      return this.getAdapter(configId, providerName, modelName);
    }

    // 解密 API Key 并创建 Adapter
    const adapter = new LLMAdapter({
      baseUrl: cached.config.baseUrl,
      apiKey: decrypt(cached.instance.encryptedApiKey),
      modelName: cached.config.modelName,
      timeout: cached.config.timeout,
      retries: cached.config.retries,
      headers: cached.instance.headers,
    });

    return { adapter, instanceId: cached.instance.sid };
  }

  /**
   * 从缓存中选择实例
   */
  private selectFromCache(
    configId?: string,
    providerName?: string,
    modelName?: string
  ): CachedInstance | null {
    let candidates = Array.from(this.instanceCache.values());

    if (configId) {
      candidates = candidates.filter((c) => c.config.sid === configId);
    }
    if (providerName) {
      candidates = candidates.filter((c) => c.providerName === providerName);
    }
    if (modelName) {
      candidates = candidates.filter((c) => c.config.modelName === modelName);
    }

    // 过滤掉明显不可用的（本地缓存状态）
    candidates = candidates.filter((c) => {
      const inst = c.instance;
      if (inst.dailyQuota && inst.dailyUsed >= inst.dailyQuota) return false;
      if (inst.cooldownUntil && new Date(inst.cooldownUntil) > new Date())
        return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // 加权随机选择
    return this.weightedRandomSelect(candidates);
  }

  /**
   * 检查实时状态（冷却、配额）
   */
  private async checkRealtimeStatus(instanceId: string): Promise<boolean> {
    const result = await query<
      { daily_used: number; daily_quota: number | null; cooldown_until: Date | null }[]
    >(
      `SELECT daily_used, daily_quota, cooldown_until 
       FROM t_llm_instances WHERE sid = ?`,
      [instanceId]
    );

    if (result.length === 0) return false;

    const row = result[0];
    if (row.daily_quota && row.daily_used >= row.daily_quota) return false;
    if (row.cooldown_until && new Date(row.cooldown_until) > new Date())
      return false;

    return true;
  }

  /**
   * 加权随机选择
   */
  private weightedRandomSelect(candidates: CachedInstance[]): CachedInstance {
    const totalWeight = candidates.reduce(
      (sum, c) => sum + c.instance.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      random -= candidate.instance.weight;
      if (random <= 0) {
        return candidate;
      }
    }

    return candidates[candidates.length - 1];
  }

  /**
   * 记录使用量（直通数据库）
   */
  async recordUsage(instanceId: string, tokens: number): Promise<void> {
    await run(
      `UPDATE t_llm_instances SET daily_used = daily_used + ? WHERE sid = ?`,
      [tokens, instanceId]
    );

    // 更新本地缓存
    for (const cached of this.instanceCache.values()) {
      if (cached.instance.sid === instanceId) {
        cached.instance.dailyUsed += tokens;
        break;
      }
    }
  }

  /**
   * 记录失败（直通数据库）
   */
  async recordFailure(instanceId: string): Promise<void> {
    await run(
      `UPDATE t_llm_instances 
       SET fail_count = fail_count + 1,
           cooldown_until = CASE 
             WHEN fail_count >= 4 THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
             ELSE cooldown_until
           END
       WHERE sid = ?`,
      [instanceId]
    );

    // 更新本地缓存
    for (const cached of this.instanceCache.values()) {
      if (cached.instance.sid === instanceId) {
        cached.instance.failCount++;
        if (cached.instance.failCount >= 5) {
          cached.instance.cooldownUntil = new Date(Date.now() + 5 * 60 * 1000);
        }
        break;
      }
    }
  }

  /**
   * 重置实例状态
   */
  async resetInstance(instanceId: string): Promise<void> {
    await run(
      `UPDATE t_llm_instances 
       SET fail_count = 0, cooldown_until = NULL 
       WHERE sid = ?`,
      [instanceId]
    );

    // 更新本地缓存
    for (const cached of this.instanceCache.values()) {
      if (cached.instance.sid === instanceId) {
        cached.instance.failCount = 0;
        cached.instance.cooldownUntil = undefined;
        break;
      }
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { configs: number; instances: number } {
    return {
      configs: this.configCache.size,
      instances: this.instanceCache.size,
    };
  }
}

// 数据库查询结果类型
interface InstanceRow {
  config_id: string;
  config_name: string;
  provider_id: string;
  base_url: string;
  subscribe_type: string;
  model_name: string;
  model_type: string;
  context_size: number;
  parameters: string | null;
  enable_thinking: string;
  stream: string;
  auth_method: string;
  timeout: number;
  retries: number;
  instance_id: string;
  instance_name: string;
  api_key: string;
  headers: string | null;
  weight: number;
  daily_quota: number | null;
  daily_used: number;
  fail_count: number;
  cooldown_until: Date | null;
  billing_type: string;
  provider_name: string;
}

// 解析 JSON
function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}
