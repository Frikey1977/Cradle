/**
 * LLM Service Manager
 * Master进程中的统一LLM服务管理器
 * 
 * 职责：
 * 1. 全局配置管理（从数据库加载）
 * 2. 配额管理（使用实例配置中的 billingType, dailyQuota, dailyUsed 等）
 * 3. 路由决策（优先使用免费/优惠额度）
 * 4. 通过适配器工厂创建适配器
 * 5. 配额统计和自动切换
 */

import { query, run } from "../../store/database.js";
import type { 
  ChatCompletionRequest, 
  ChatCompletionResponse,
  StreamChunk,
  ToolCall,
  ToolCallDelta
} from "../runtime/types.js";
import type { LlmInstance, BillingType } from "../instances/types.js";
import { AdapterFactory, type IModelAdapter, type AdapterConfig } from "../adapters/index.js";

/**
 * 解密API Key
 */
function decryptApiKey(encryptedApiKey: string): string {
  return Buffer.from(encryptedApiKey, "base64").toString("utf-8");
}

export type LLMCapability =
  | "textGeneration"
  | "textEmbedding"
  | "deepThinking"
  | "visualComprehension"
  | "speechSynthesis"
  | "speechRecognition"
  | "realtimeSpeech"
  | "imageGeneration";

export interface RoutingTask {
  capability: LLMCapability;
  complexity?: "low" | "medium" | "high";
  priority?: number;
  requireRealtime?: boolean;
  instanceId?: string; // 指定特定实例
}

export interface RoutingDecision {
  instanceId: string;
  instanceName: string;
  configId: string;
  modelName: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  billingType: BillingType;
  dailyQuota?: number;
  dailyUsed: number;
  adapter: IModelAdapter;
  modelParams?: Record<string, any>; // 模型特定参数（如音色等）
}

export interface LLMCallOptions {
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  onThinkingMessage?: (message: string) => void; // 思考消息回调
}

// 实例配置（包含配额信息）
interface InstanceWithQuota {
  sid: string;
  name: string;
  providerId: string;
  providerName: string;
  configId: string;
  status: string;
  billingType: BillingType;
  dailyQuota?: number;
  dailyUsed: number;
  failCount: number;
  cooldownUntil?: Date;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deleted: number;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  capabilities: string[];
  headers?: string;
  modelParams?: string;
  sort: number;
  weight: number;
  apiKeyHash: string;
}

export class LLMServiceManager {
  private instances = new Map<string, InstanceWithQuota>();
  private initialized = false;
  private adapterFactory = AdapterFactory.getInstance();

  /**
   * 初始化服务管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[LLMServiceManager] Initializing...");
    await this.loadInstances();
    this.initialized = true;
    console.log(`[LLMServiceManager] Initialized with ${this.instances.size} instances`);
  }

  /**
   * 从数据库加载实例配置
   */
  private async loadInstances(): Promise<void> {
    const rows = await query(`
      SELECT 
        i.sid,
        i.name,
        i.config_id,
        i.api_key,
        i.api_key_hash,
        i.status,
        i.billing_type,
        i.daily_quota,
        i.daily_used,
        i.fail_count,
        i.cooldown_until,
        i.last_used_at,
        i.create_time as created_at,
        i.timestamp as updated_at,
        i.deleted,
        i.sort,
        i.weight,
        c.model_name,
        c.model_type,
        c.base_url,
        c.timeout,
        c.retries,
        c.parameters as model_params,
        c.model_ability,
        c.provider_id,
        p.name as provider_name
      FROM t_llm_instances i
      JOIN t_llm_configs c ON i.config_id = c.sid
      JOIN t_llm_providers p ON c.provider_id = p.sid
      WHERE i.deleted = 0 AND i.status = 'enabled'
    `) as any[];

    for (const row of rows) {
      const instance: InstanceWithQuota = {
        sid: row.sid,
        name: row.name,
        providerId: row.provider_id,
        configId: row.config_id,
        status: row.status,
        billingType: row.billing_type,
        dailyQuota: row.daily_quota,
        dailyUsed: row.daily_used,
        failCount: row.fail_count,
        cooldownUntil: row.cooldown_until,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deleted: row.deleted,
        modelName: row.model_name,
        baseUrl: row.base_url,
        apiKey: decryptApiKey(row.api_key),
        timeout: row.timeout,
        retries: row.retries,
        capabilities: JSON.parse(row.model_ability || "[]"),
        modelParams: row.model_params,
        providerName: row.provider_name,
        sort: row.sort || 0,
        weight: row.weight || 1,
        apiKeyHash: row.api_key_hash || "",
      };

      this.instances.set(instance.sid, instance);
      console.log(`[LLMServiceManager] Loaded instance: ${instance.sid} (${instance.name})`);
    }

    console.log(`[LLMServiceManager] Loaded ${this.instances.size} instances from database`);
    console.log(`[LLMServiceManager] Available instance IDs:`, Array.from(this.instances.keys()));
  }

  /**
   * 路由决策
   * 根据任务需求选择最佳实例
   */
  async route(task: RoutingTask): Promise<RoutingDecision> {
    this.checkInitialized();

    console.log(`[LLMServiceManager] route() called with task:`, {
      capability: task.capability,
      complexity: task.complexity,
      instanceId: task.instanceId,
    });

    // 如果指定了 instanceId，直接使用该实例
    if (task.instanceId) {
      console.log(`[LLMServiceManager] task.instanceId specified: ${task.instanceId}`);
      const instance = this.instances.get(task.instanceId);
      if (!instance) {
        console.error(`[LLMServiceManager] Instance ${task.instanceId} not found in instances map`);
        console.log(`[LLMServiceManager] Available instances:`, Array.from(this.instances.keys()));
        throw new Error(`Instance ${task.instanceId} not found`);
      }
      console.log(`[LLMServiceManager] Using specified instance: ${instance.sid} (${instance.name})`);
      
      // 创建适配器
      let headers = {};
      let modelParams = {};
      try {
        if (instance.headers) {
          headers = JSON.parse(instance.headers);
        }
      } catch (e) {
        console.warn(`[LLMServiceManager] Failed to parse headers for ${instance.sid}`);
      }
      try {
        if (instance.modelParams) {
          if (instance.modelParams === '[object Object]') {
            modelParams = {};
          } else {
            modelParams = JSON.parse(instance.modelParams);
          }
        }
      } catch (e) {
        console.warn(`[LLMServiceManager] Failed to parse modelParams for ${instance.sid}`);
      }
      
      const adapterConfig: AdapterConfig = {
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        headers,
        modelParams,
      };
      const adapter = this.adapterFactory.createAdapter(adapterConfig);
      await adapter.initialize();
      
      return {
        instanceId: instance.sid,
        instanceName: instance.name,
        configId: instance.configId,
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        adapter,
      };
    }

    // 1. 按能力筛选可用实例
    let candidates = Array.from(this.instances.values()).filter(inst => {
      // 检查能力匹配
      const hasCapability = inst.capabilities.includes(task.capability);
      if (!hasCapability) return false;

      // 检查是否在冷却期
      if (inst.cooldownUntil && new Date(inst.cooldownUntil) > new Date()) {
        return false;
      }
      
      // 如果冷却期已过，重置失败次数
      if (inst.cooldownUntil && new Date(inst.cooldownUntil) <= new Date()) {
        inst.failCount = 0;
        inst.cooldownUntil = undefined;
        console.log(`[LLMServiceManager] Instance ${inst.sid} cooldown ended, reset failCount`);
      }

      // 检查配额
      if (inst.dailyQuota && inst.dailyUsed >= inst.dailyQuota) {
        console.warn(`[LLMServiceManager] Instance ${inst.sid} quota exhausted`);
        return false;
      }

      // 检查失败次数
      if (inst.failCount >= 5) {
        console.warn(`[LLMServiceManager] Instance ${inst.sid} has too many failures`);
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      throw new Error(`No available instances for capability: ${task.capability}`);
    }

    // 2. 按 billingType 优先级排序
    const billingTypePriority: Record<BillingType, number> = {
      "free": 1,           // 免费优先
      "prepaid": 2,        // 预付套餐
      "subscription": 3,   // 订阅
      "dedicated": 4,      // 专用
      "privatization": 5,  // 私有化
      "usage": 6,          // 按量付费最后
    };

    candidates.sort((a, b) => {
      // 先按 billingType 排序
      const priorityDiff = billingTypePriority[a.billingType] - billingTypePriority[b.billingType];
      if (priorityDiff !== 0) return priorityDiff;

      // 同优先级按剩余额度排序（多的优先）
      const remainingA = a.dailyQuota ? a.dailyQuota - a.dailyUsed : Infinity;
      const remainingB = b.dailyQuota ? b.dailyQuota - b.dailyUsed : Infinity;
      return remainingB - remainingA;
    });

    const selected = candidates[0];

    console.log(`[LLMServiceManager] Routed to instance ${selected.sid} (${selected.name}), billing: ${selected.billingType}, remaining: ${selected.dailyQuota ? selected.dailyQuota - selected.dailyUsed : 'unlimited'}`);

    // 创建适配器
    let headers: Record<string, string> | undefined;
    let modelParams: Record<string, any> | undefined;
    
    try {
      if (selected.headers && selected.headers !== 'null' && selected.headers !== '') {
        // 如果已经是对象，直接使用
        if (typeof selected.headers === 'object') {
          headers = selected.headers;
        } else if (typeof selected.headers === 'string') {
          // 检查是否是 [object Object] 这种错误的字符串
          if (selected.headers === '[object Object]') {
            console.warn(`[LLMServiceManager] headers is '[object Object]' for ${selected.sid}, using empty object`);
            headers = {};
          } else {
            headers = JSON.parse(selected.headers);
          }
        }
      }
    } catch (e) {
      console.warn(`[LLMServiceManager] Failed to parse headers for ${selected.sid}:`, e);
      headers = {}; // 使用空对象作为默认值
    }
    
    try {
      if (selected.modelParams && selected.modelParams !== 'null' && selected.modelParams !== '') {
        // 如果已经是对象，直接使用
        if (typeof selected.modelParams === 'object') {
          modelParams = selected.modelParams;
        } else if (typeof selected.modelParams === 'string') {
          // 检查是否是 [object Object] 这种错误的字符串
          if (selected.modelParams === '[object Object]') {
            console.warn(`[LLMServiceManager] modelParams is '[object Object]' for ${selected.sid}, using empty object`);
            modelParams = {};
          } else {
            modelParams = JSON.parse(selected.modelParams);
          }
        }
      }
    } catch (e) {
      console.warn(`[LLMServiceManager] Failed to parse modelParams for ${selected.sid}:`, e);
      modelParams = {}; // 使用空对象作为默认值
    }
    
    const adapterConfig: AdapterConfig = {
      modelName: selected.modelName,
      provider: selected.providerName,
      baseUrl: selected.baseUrl,
      apiKey: selected.apiKey,
      headers,
      modelParams,
    };

    const adapter = this.adapterFactory.createAdapter(adapterConfig);
    await adapter.initialize();

    return {
      instanceId: selected.sid,
      instanceName: selected.name,
      configId: selected.configId,
      modelName: selected.modelName,
      provider: selected.providerName,
      baseUrl: selected.baseUrl,
      apiKey: selected.apiKey,
      billingType: selected.billingType,
      dailyQuota: selected.dailyQuota,
      dailyUsed: selected.dailyUsed,
      adapter,
      modelParams,
    };
  }

  /**
   * 执行聊天完成请求
   */
  async chatCompletion(
    task: RoutingTask,
    messages: any[],
    options: LLMCallOptions = {}
  ): Promise<ChatCompletionResponse> {
    const decision = await this.route(task);

    // 发送思考消息（如果提供了回调）
    if (options.onThinkingMessage) {
      const thinkingMessage = [
        `🤖 LLM 调用`,
        `🎯 模型信息:`,
        `   ID: ${decision.instanceId}`,
        `   名称: ${decision.instanceName}`,
        `   模型: ${decision.modelName}`,
        `   提供商: ${decision.provider}`,
      ].join('\n');
      options.onThinkingMessage(thinkingMessage);
    }

    try {
      const request: ChatCompletionRequest = {
        model: decision.modelName,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        tools: options.tools,
        stream: false,
      };

      const response = await decision.adapter.chatCompletion(request);
      
      // 更新配额使用
      const tokens = response.usage?.total_tokens || 0;
      await this.recordUsage(decision.instanceId, tokens);

      return response;
    } catch (error) {
      // 记录错误
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 流式聊天完成
   */
  async *streamChatCompletion(
    task: RoutingTask,
    messages: any[],
    options: LLMCallOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    console.log(`[LLMServiceManager] streamChatCompletion called with task:`, {
      capability: task.capability,
      complexity: task.complexity,
      instanceId: task.instanceId,
    });
    const decision = await this.route(task);
    console.log(`[LLMServiceManager] Routed to instance: ${decision.instanceId} (${decision.instanceName})`);
    
    // 发送思考消息（如果提供了回调）
    if (options.onThinkingMessage) {
      const thinkingMessage = [
        `🤖 LLM 流式调用`,
        `🎯 模型信息:`,
        `   ID: ${decision.instanceId}`,
        `   名称: ${decision.instanceName}`,
        `   模型: ${decision.modelName}`,
        `   提供商: ${decision.provider}`,
      ].join('\n');
      options.onThinkingMessage(thinkingMessage);
    }
    
    let totalTokens = 0;
    let toolCalls: any[] | undefined;
    let hasToolCalls = false;

    try {
      const request: ChatCompletionRequest = {
        model: decision.modelName,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        tools: options.tools,
        stream: true,
      };
      
      console.log(`[LLMServiceManager] Full request being sent to LLM:`);
      console.log(JSON.stringify({
        model: request.model,
        messageCount: request.messages.length,
        hasTools: !!request.tools,
        toolsCount: request.tools?.length || 0,
        toolNames: request.tools?.map(t => t.function?.name),
        stream: request.stream,
      }, null, 2));

      for await (const chunk of decision.adapter.streamChatCompletion(request)) {
        const content = chunk.choices?.[0]?.delta?.content;
        const deltaToolCalls = chunk.choices?.[0]?.delta?.tool_calls as ToolCallDelta[] | undefined;
        
        // 收集 tool_calls（流式响应中可能分散在多个 chunk）
        if (deltaToolCalls && deltaToolCalls.length > 0) {
          hasToolCalls = true;
          if (!toolCalls) toolCalls = [];
          
          // 合并 tool_calls（按 index 合并）
          for (const delta of deltaToolCalls) {
            const index = delta.index || 0;
            if (!toolCalls[index]) {
              toolCalls[index] = delta as ToolCall;
            } else {
              // 合并字段
              if (delta.id) toolCalls[index].id = delta.id;
              if (delta.type) toolCalls[index].type = delta.type;
              if (delta.function?.name) {
                toolCalls[index].function = toolCalls[index].function || { name: "", arguments: "" };
                toolCalls[index].function.name = delta.function.name;
              }
              if (delta.function?.arguments) {
                toolCalls[index].function = toolCalls[index].function || { name: "", arguments: "" };
                toolCalls[index].function.arguments = 
                  (toolCalls[index].function.arguments || "") + delta.function.arguments;
              }
            }
          }
        }
        
        totalTokens += content?.length || 0;
        yield chunk;
      }

      // 如果有 tool_calls，在最后 yield 一个特殊标记
      if (toolCalls && toolCalls.length > 0) {
        console.log(`[LLMServiceManager] Yielding tool_calls marker with ${toolCalls.length} calls`);
        yield {
          id: `tool-calls-${Date.now()}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: decision.modelName,
          choices: [{
            index: 0,
            delta: {
              role: "assistant",
              content: JSON.stringify({ __tool_calls: toolCalls }),
            },
            finish_reason: null,
          }],
        };
      }

      // 记录配额使用（估算）
      await this.recordUsage(decision.instanceId, totalTokens);
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 多模态对话
   */
  async multimodalChat(
    task: RoutingTask,
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      onThinkingMessage?: (message: string) => void;
    } = {}
  ): Promise<ChatCompletionResponse | AsyncGenerator<StreamChunk, void, unknown>> {
    const decision = await this.route(task);

    // 发送思考消息（如果提供了回调）
    if (options.onThinkingMessage) {
      const thinkingMessage = [
        `🤖 多模态 LLM 调用`,
        `🎯 模型信息:`,
        `   ID: ${decision.instanceId}`,
        `   名称: ${decision.instanceName}`,
        `   模型: ${decision.modelName}`,
        `   提供商: ${decision.provider}`,
      ].join('\n');
      options.onThinkingMessage(thinkingMessage);
    }

    try {
      if (options.stream) {
        // 流式多模态对话
        const streamGenerator = async function* (this: LLMServiceManager) {
          let totalTokens = 0;
          
          try {
            for await (const chunk of decision.adapter.streamMultimodalChat!({
              prompt,
              images: options.images,
              audio: options.audio,
              audioFormat: options.audioFormat,
            })) {
              totalTokens += chunk.choices?.[0]?.delta?.content?.length || 0;
              yield chunk;
            }
            
            await this.recordUsage(decision.instanceId, totalTokens);
          } catch (error) {
            await this.recordError(decision.instanceId);
            throw error;
          }
        }.bind(this);
        
        return streamGenerator();
      } else {
        // 非流式多模态对话
        const response = await decision.adapter.multimodalChat!({
          prompt,
          images: options.images,
          audio: options.audio,
          audioFormat: options.audioFormat,
        });
        
        const tokens = response.usage?.total_tokens || 0;
        await this.recordUsage(decision.instanceId, tokens);
        
        return response;
      }
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 语音识别
   */
  async speechToText(
    task: RoutingTask,
    audio: string,
    options: {
      format?: string;
      sampleRate?: number;
      language?: string;
    } = {}
  ): Promise<string> {
    const decision = await this.route(task);

    try {
      if (!decision.adapter.speechToText) {
        throw new Error(`Adapter for ${decision.modelName} does not support speechToText`);
      }

      const text = await decision.adapter.speechToText({
        audio,
        format: options.format || "wav",
        sampleRate: options.sampleRate,
        language: options.language,
      });

      // 记录使用（估算）
      await this.recordUsage(decision.instanceId, audio.length / 4); // 粗略估算

      return text;
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 语音识别（通过多模态模型）
   * 支持指定 instanceId
   */
  async transcribeAudio(
    audioData: string,
    options: {
      format?: string;
      sampleRate?: number;
      language?: string;
      instanceId?: string;
      onThinkingMessage?: (message: string) => void;
    } = {}
  ): Promise<{ text: string; routeInfo: { instanceId: string; modelName: string; provider: string } }> {
    let decision: RoutingDecision;

    if (options.instanceId) {
      // 使用指定实例
      const instance = this.instances.get(options.instanceId);
      if (!instance) {
        throw new Error(`Instance ${options.instanceId} not found`);
      }
      
      // 解析 headers 和 modelParams
      let headers = undefined;
      let modelParams = undefined;
      try {
        if (instance.headers) {
          headers = typeof instance.headers === 'string' ? JSON.parse(instance.headers) : instance.headers;
        }
      } catch (e) {
        console.error(`[LLMServiceManager] Failed to parse headers for instance ${instance.sid}:`, instance.headers);
      }
      try {
        if (instance.modelParams) {
          modelParams = typeof instance.modelParams === 'string' ? JSON.parse(instance.modelParams) : instance.modelParams;
        }
      } catch (e) {
        console.error(`[LLMServiceManager] Failed to parse modelParams for instance ${instance.sid}:`, instance.modelParams);
      }
      
      const adapterConfig: AdapterConfig = {
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        headers,
        modelParams,
      };
      
      const adapter = this.adapterFactory.createAdapter(adapterConfig);
      await adapter.initialize();
      
      decision = {
        instanceId: instance.sid,
        instanceName: instance.name,
        configId: instance.configId,
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        adapter,
        modelParams,
      };
    } else {
      // 通过路由选择
      decision = await this.route({ capability: "speechRecognition" });
    }

    // 发送思考消息（如果提供了回调）
    if (options.onThinkingMessage) {
      const thinkingMessage = [
        `🎤 语音识别`,
        `🎯 识别模型信息:`,
        `   ID: ${decision.instanceId}`,
        `   名称: ${decision.instanceName}`,
        `   模型: ${decision.modelName}`,
        `   提供商: ${decision.provider}`,
      ].join('\n');
      console.log(`[LLMServiceManager] Sending thinking message for speech recognition:`, thinkingMessage);
      options.onThinkingMessage(thinkingMessage);
    } else {
      console.log(`[LLMServiceManager] No onThinkingMessage callback provided`);
    }

    try {
      // 使用多模态模型的语音识别能力
      const audioFormat = options.format || "wav";
      const audioUrl = audioData.startsWith("data:")
        ? audioData
        : `data:audio/${audioFormat};base64,${audioData}`;

      const response = await decision.adapter.multimodalChat!({
        prompt: "请转录这段语音，只返回转录后的文字。重点：不要添加任何解释或回复、不要包含本提示词。",
        audio: [audioUrl],
        audioFormat,
      });

      const text = response.choices[0]?.message?.content || "";

      // 记录使用
      const tokens = response.usage?.total_tokens || 0;
      await this.recordUsage(decision.instanceId, tokens);

      return {
        text,
        routeInfo: {
          instanceId: decision.instanceId,
          modelName: decision.modelName,
          provider: decision.provider,
        },
      };
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 语音合成
   * 支持指定 instanceId
   */
  async synthesizeSpeech(
    text: string,
    options: {
      voice?: string;
      format?: string;
      speed?: number;
      instanceId?: string;
      onThinkingMessage?: (message: string) => void;
    } = {}
  ): Promise<{ audio: string; format: string; routeInfo: { instanceId: string; modelName: string; provider: string } }> {
    let decision: RoutingDecision;

    if (options.instanceId) {
      // 使用指定实例
      const instance = this.instances.get(options.instanceId);
      if (!instance) {
        throw new Error(`Instance ${options.instanceId} not found`);
      }
      
      // 解析 headers 和 modelParams
      let headers = undefined;
      let modelParams = undefined;
      try {
        if (instance.headers) {
          headers = typeof instance.headers === 'string' ? JSON.parse(instance.headers) : instance.headers;
        }
      } catch (e) {
        console.error(`[LLMServiceManager] Failed to parse headers for instance ${instance.sid}:`, instance.headers);
      }
      try {
        if (instance.modelParams) {
          modelParams = typeof instance.modelParams === 'string' ? JSON.parse(instance.modelParams) : instance.modelParams;
        }
      } catch (e) {
        console.error(`[LLMServiceManager] Failed to parse modelParams for instance ${instance.sid}:`, instance.modelParams);
      }
      
      const adapterConfig: AdapterConfig = {
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        headers,
        modelParams,
      };
      
      const adapter = this.adapterFactory.createAdapter(adapterConfig);
      await adapter.initialize();
      
      decision = {
        instanceId: instance.sid,
        instanceName: instance.name,
        configId: instance.configId,
        modelName: instance.modelName,
        provider: instance.providerName,
        baseUrl: instance.baseUrl,
        apiKey: instance.apiKey,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        adapter,
        modelParams,
      };
    } else {
      // 通过路由选择
      decision = await this.route({ capability: "speechSynthesis" });
    }

    // 发送思考消息（如果提供了回调）
    if (options.onThinkingMessage) {
      const thinkingMessage = [
        `🔊 语音合成`,
        `🎯 合成模型信息:`,
        `   ID: ${decision.instanceId}`,
        `   名称: ${decision.instanceName}`,
        `   模型: ${decision.modelName}`,
        `   提供商: ${decision.provider}`,
        `   音色: ${options.voice || decision.modelParams?.voice || "Cherry"}`,
      ].join('\n');
      options.onThinkingMessage(thinkingMessage);
    }

    try {
      // Qwen-Omni 官方文档推荐使用 wav 格式
      const outputFormat = "wav";
      
      // 获取实例配置的默认音色（从 modelParams 中解析）
      let defaultVoice = "Cherry"; // 默认音色
      try {
        if (decision.modelParams?.voice) {
          defaultVoice = decision.modelParams.voice;
        }
      } catch {
        // 解析失败使用默认值
      }
      
      // 优先级：options.voice > 实例配置 > 默认值
      const voice = options.voice || defaultVoice;
      
      console.log(`[LLMServiceManager] Synthesizing speech with model: ${decision.modelName}`);
      console.log(`[LLMServiceManager] Options voice: ${options.voice}, defaultVoice: ${defaultVoice}, final voice: ${voice}`);
      
      // 使用流式响应获取音频（Qwen-Omni 语音合成需要流式模式）
      // 明确提示模型按照文本进行语音合成，而不是对话
      const synthesisPrompt = `请朗读以下文本，不要添加任何其他内容：\n\n${text}`;
      const streamRequest = {
        model: decision.modelName,
        messages: [{ role: "user" as const, content: synthesisPrompt }],
        temperature: 0.7,
        max_tokens: 2048,
        stream: true as const,
        modalities: ["text", "audio"] as ("text" | "audio")[],
        audio: {
          voice: voice,
          format: outputFormat,
        },
      };
      
      console.log(`[LLMServiceManager] Stream request:`, JSON.stringify(streamRequest, null, 2));
      
      // 收集流式响应
      let audioData = "";
      let textContent = "";
      let totalTokens = 0;
      
      for await (const chunk of decision.adapter.streamChatCompletion(streamRequest)) {
        // 处理文本内容
        if (chunk.choices[0]?.delta?.content) {
          textContent += chunk.choices[0].delta.content;
        }
        
        // 处理音频内容 - 在 delta.audio.data 中
        if (chunk.choices[0]?.delta?.audio?.data) {
          audioData += chunk.choices[0].delta.audio.data;
        }
      }
      
      console.log(`[LLMServiceManager] Stream response: text=${textContent.substring(0, 50)}, audioLength=${audioData.length}`);
      console.log(`[LLMServiceManager] Audio data preview: ${audioData.substring(0, 100)}...`);
      
      // 检查是否是有效的 base64
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(audioData);
      console.log(`[LLMServiceManager] Is valid base64: ${isBase64}`);
      
      // 尝试解码前几个字节检查 WAV 头
      try {
        const decoded = Buffer.from(audioData.substring(0, 20), 'base64');
        const header = decoded.toString('hex');
        console.log(`[LLMServiceManager] Decoded header (hex): ${header}`);
      } catch (e) {
        console.log(`[LLMServiceManager] Failed to decode audio data`);
      }

      // 提取音频数据
      if (!audioData || audioData.length < 100) {
        throw new Error("No audio data in response or audio data too short");
      }

      // 检查是否需要添加 WAV 文件头
      // Qwen-Omni 返回的是原始 PCM 数据，需要添加 WAV 头
      const decodedHeader = Buffer.from(audioData.substring(0, 20), 'base64');
      const isWav = decodedHeader.slice(0, 4).toString('ascii') === 'RIFF';
      
      let finalAudioData = audioData;
      if (!isWav) {
        // 添加 WAV 文件头
        const pcmBuffer = Buffer.from(audioData, 'base64');
        const wavBuffer = this.addWavHeader(pcmBuffer, 24000, 16, 1);
        finalAudioData = wavBuffer.toString('base64');
        console.log(`[LLMServiceManager] Added WAV header, original: ${pcmBuffer.length} bytes, final: ${wavBuffer.length} bytes`);
      }

      // 记录使用（估算）
      const tokens = Math.round((textContent.length + audioData.length) / 4);
      await this.recordUsage(decision.instanceId, tokens);

      return {
        audio: finalAudioData,
        format: "wav",
        routeInfo: {
          instanceId: decision.instanceId,
          modelName: decision.modelName,
          provider: decision.provider,
        },
      };
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  /**
   * 记录配额使用
   */
  private async recordUsage(instanceId: string, tokens: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // 更新内存
    instance.dailyUsed += Math.round(tokens);

    // 更新数据库
    await run(
      `UPDATE t_llm_instances SET daily_used = daily_used + ?, last_used_at = NOW() WHERE sid = ?`,
      [Math.round(tokens), instanceId]
    );

    console.log(`[LLMServiceManager] Recorded usage for ${instanceId}: ${Math.round(tokens)} tokens, total: ${instance.dailyUsed}`);
  }

  /**
   * 记录错误
   */
  private async recordError(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // 更新内存
    instance.failCount++;

    // 如果错误过多，设置冷却期
    let cooldownUntil: Date | undefined;
    if (instance.failCount >= 5) {
      cooldownUntil = new Date(Date.now() + 5 * 60 * 1000); // 5分钟冷却
      instance.cooldownUntil = cooldownUntil;
    }

    // 更新数据库
    if (cooldownUntil) {
      await run(
        `UPDATE t_llm_instances SET fail_count = fail_count + 1, cooldown_until = ? WHERE sid = ?`,
        [cooldownUntil, instanceId]
      );
      console.warn(`[LLMServiceManager] Instance ${instanceId} entered cooldown until ${cooldownUntil}`);
    } else {
      await run(
        `UPDATE t_llm_instances SET fail_count = fail_count + 1 WHERE sid = ?`,
        [instanceId]
      );
    }
  }

  /**
   * 添加 WAV 文件头到 PCM 数据
   * @param pcmData PCM 原始数据
   * @param sampleRate 采样率 (Hz)
   * @param bitsPerSample 位深 (8, 16, 24, 32)
   * @param channels 声道数 (1=mono, 2=stereo)
   * @returns 带 WAV 头的 Buffer
   */
  private addWavHeader(pcmData: Buffer, sampleRate: number, bitsPerSample: number, channels: number): Buffer {
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const wavHeader = Buffer.alloc(44);
    let offset = 0;

    // RIFF chunk
    wavHeader.write('RIFF', offset); offset += 4;
    wavHeader.writeUInt32LE(fileSize, offset); offset += 4;
    wavHeader.write('WAVE', offset); offset += 4;

    // fmt chunk
    wavHeader.write('fmt ', offset); offset += 4;
    wavHeader.writeUInt32LE(16, offset); offset += 4; // Subchunk1Size
    wavHeader.writeUInt16LE(1, offset); offset += 2; // AudioFormat (1=PCM)
    wavHeader.writeUInt16LE(channels, offset); offset += 2;
    wavHeader.writeUInt32LE(sampleRate, offset); offset += 4;
    wavHeader.writeUInt32LE(byteRate, offset); offset += 4;
    wavHeader.writeUInt16LE(blockAlign, offset); offset += 2;
    wavHeader.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    wavHeader.write('data', offset); offset += 4;
    wavHeader.writeUInt32LE(dataSize, offset); offset += 4;

    return Buffer.concat([wavHeader, pcmData]);
  }

  /**
   * 获取配额统计
   */
  getQuotaStats(instanceId?: string): any {
    if (instanceId) {
      const instance = this.instances.get(instanceId);
      if (!instance) return null;
      
      return {
        instanceId: instance.sid,
        name: instance.name,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        remaining: instance.dailyQuota ? instance.dailyQuota - instance.dailyUsed : 'unlimited',
        failCount: instance.failCount,
        isCooling: instance.cooldownUntil && new Date(instance.cooldownUntil) > new Date(),
      };
    }

    // 返回所有实例统计
    const stats: any[] = [];
    for (const instance of this.instances.values()) {
      stats.push({
        instanceId: instance.sid,
        name: instance.name,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        remaining: instance.dailyQuota ? instance.dailyQuota - instance.dailyUsed : 'unlimited',
        failCount: instance.failCount,
        isCooling: instance.cooldownUntil && new Date(instance.cooldownUntil) > new Date(),
      });
    }
    return stats;
  }

  /**
   * 获取服务状态
   */
  getStats(): {
    initialized: boolean;
    instanceCount: number;
  } {
    return {
      initialized: this.initialized,
      instanceCount: this.instances.size,
    };
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    // 清理适配器缓存
    await this.adapterFactory.clearCache();
    
    this.initialized = false;
    this.instances.clear();
    console.log("[LLMServiceManager] Stopped");
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error("LLMServiceManager not initialized. Call initialize() first.");
    }
  }
}
