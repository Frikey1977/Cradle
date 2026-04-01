/**
 * LLM 相关 Seed 数据
 * 提供默认的 Provider、Config 和 Instance 模板
 */

import type { IDatabaseAdapter } from "../adapter.js";
import { generateUUID } from "../../shared/utils.js";
import crypto from "crypto";

/**
 * 生成 API Key 的哈希值
 */
function generateApiKeyHash(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * 加密 API Key
 */
function encryptApiKey(apiKey: string): string {
  return Buffer.from(apiKey).toString("base64");
}

/**
 * 初始化 LLM 数据
 */
export async function seedLLMData(db: IDatabaseAdapter): Promise<void> {
  console.log("[Seed] Initializing LLM data...");

  // 1. 创建默认 Provider
  await seedProviders(db);

  // 2. 创建默认 Config
  await seedConfigs(db);

  // 3. 创建默认 Instance（示例，需要用户填写 API Key）
  await seedInstances(db);

  console.log("[Seed] LLM data initialized");
}

/**
 * 创建默认 Provider
 */
async function seedProviders(db: IDatabaseAdapter): Promise<void> {
  const providers = [
    {
      sid: "dashscope",
      name: "dashscope",
      title: "llm.provider.dashscope",
      ename: "阿里云 DashScope",
      description: "阿里云大模型服务平台，提供通义千问等模型",
      icon: "ri:ali-cloud-line",
      color: "#FF6A00",
      sort: 1,
      status: "enabled",
    },
    {
      sid: "openai",
      name: "openai",
      title: "llm.provider.openai",
      ename: "OpenAI",
      description: "OpenAI API，提供 GPT-4、GPT-3.5 等模型",
      icon: "simple-icons:openai",
      color: "#10A37F",
      sort: 2,
      status: "enabled",
    },
    {
      sid: "anthropic",
      name: "anthropic",
      title: "llm.provider.anthropic",
      ename: "Anthropic",
      description: "Anthropic API，提供 Claude 系列模型",
      icon: "simple-icons:anthropic",
      color: "#D4A574",
      sort: 3,
      status: "enabled",
    },
  ];

  for (const provider of providers) {
    const exists = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_llm_providers WHERE sid = ?",
      [provider.sid]
    );

    if (!exists) {
      await db.run(
        `INSERT INTO t_llm_providers 
         (sid, name, title, ename, description, icon, color, sort, status, deleted, create_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [
          provider.sid,
          provider.name,
          provider.title,
          provider.ename,
          provider.description,
          provider.icon,
          provider.color,
          provider.sort,
          provider.status,
        ]
      );
      console.log(`[Seed] Created provider: ${provider.ename}`);
    }
  }
}

/**
 * 创建默认 Config
 */
async function seedConfigs(db: IDatabaseAdapter): Promise<void> {
  const configs = [
    {
      sid: "qwen-turbo",
      name: "通义千问 Turbo",
      description: "通义千问快速响应版本，适合日常对话",
      provider_id: "dashscope",
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      subscribe_type: "usage",
      model_name: "qwen-turbo",
      model_type: "text",
      context_size: 8192,
      parameters: JSON.stringify({ temperature: 0.7, max_tokens: 2048 }),
      enable_thinking: "disabled",
      stream: "enabled",
      auth_method: "api_key",
      provider_name: "dashscope",
      model_ability: JSON.stringify(["textGeneration", "toolUse"]),
      timeout: 30000,
      retries: 3,
      sort: 1,
      status: "enabled",
    },
    {
      sid: "qwen-max",
      name: "通义千问 Max",
      description: "通义千问最强版本，适合复杂任务",
      provider_id: "dashscope",
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      subscribe_type: "usage",
      model_name: "qwen-max",
      model_type: "text",
      context_size: 32768,
      parameters: JSON.stringify({ temperature: 0.7, max_tokens: 4096 }),
      enable_thinking: "disabled",
      stream: "enabled",
      auth_method: "api_key",
      provider_name: "dashscope",
      model_ability: JSON.stringify(["textGeneration", "toolUse", "reasoning"]),
      timeout: 60000,
      retries: 3,
      sort: 2,
      status: "enabled",
    },
    {
      sid: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "OpenAI GPT-4o Mini，性价比高",
      provider_id: "openai",
      base_url: "https://api.openai.com/v1",
      subscribe_type: "usage",
      model_name: "gpt-4o-mini",
      model_type: "text",
      context_size: 128000,
      parameters: JSON.stringify({ temperature: 0.7, max_tokens: 4096 }),
      enable_thinking: "disabled",
      stream: "enabled",
      auth_method: "api_key",
      provider_name: "openai",
      model_ability: JSON.stringify(["textGeneration", "toolUse", "vision"]),
      timeout: 30000,
      retries: 3,
      sort: 3,
      status: "enabled",
    },
  ];

  for (const config of configs) {
    const exists = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_llm_configs WHERE sid = ?",
      [config.sid]
    );

    if (!exists) {
      await db.run(
        `INSERT INTO t_llm_configs 
         (sid, name, description, provider_id, base_url, subscribe_type, model_name, model_type, 
          context_size, parameters, enable_thinking, stream, auth_method, provider_name, model_ability,
          timeout, retries, sort, status, deleted, create_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [
          config.sid,
          config.name,
          config.description,
          config.provider_id,
          config.base_url,
          config.subscribe_type,
          config.model_name,
          config.model_type,
          config.context_size,
          config.parameters,
          config.enable_thinking,
          config.stream,
          config.auth_method,
          config.provider_name,
          config.model_ability,
          config.timeout,
          config.retries,
          config.sort,
          config.status,
        ]
      );
      console.log(`[Seed] Created config: ${config.name}`);
    }
  }
}

/**
 * 创建默认 Instance（示例）
 * 注意：这些实例的 API Key 为空，需要用户手动配置
 */
async function seedInstances(db: IDatabaseAdapter): Promise<void> {
  // 创建一个示例实例，API Key 为空，状态为 disabled
  const instance = {
    sid: "example-dashscope",
    name: "DashScope 示例实例（请配置 API Key）",
    description: "这是一个示例实例，请编辑此实例并填写您的 DashScope API Key",
    config_id: "qwen-turbo",
    api_key: encryptApiKey(""),
    api_key_hash: generateApiKeyHash("placeholder"),
    billing_type: "usage",
    weight: 1,
    daily_quota: null,
    daily_used: 0,
    fail_count: 0,
    sort: 1,
    status: "disabled", // 默认禁用，需要用户配置后启用
  };

  const exists = await db.queryOne<{ sid: string }>(
    "SELECT sid FROM t_llm_instances WHERE sid = ?",
    [instance.sid]
  );

  if (!exists) {
    await db.run(
      `INSERT INTO t_llm_instances 
       (sid, name, description, config_id, api_key, api_key_hash, billing_type, weight,
        daily_quota, daily_used, fail_count, sort, status, deleted, create_time, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
      [
        instance.sid,
        instance.name,
        instance.description,
        instance.config_id,
        instance.api_key,
        instance.api_key_hash,
        instance.billing_type,
        instance.weight,
        instance.daily_quota,
        instance.daily_used,
        instance.fail_count,
        instance.sort,
        instance.status,
      ]
    );
    console.log(`[Seed] Created example instance: ${instance.name}`);
  }
}
