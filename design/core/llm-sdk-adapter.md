# 大模型 SDK 适配器设计

## 概述

本文档定义大模型对接的 SDK 适配器模式，支持两种调用方式：

1. **HTTP API 模式**: 通过标准 OpenAI 兼容接口调用
2. **SDK 组件模式**: 通过官方 SDK 调用，获取更丰富的模型信息

## 架构设计

### 调用方式对比

| 特性 | HTTP API 模式 | SDK 组件模式 |
|------|--------------|-------------|
| 实现复杂度 | 低 | 中 |
| 模型信息丰富度 | 基础 | 丰富 |
| 自动模型发现 | ❌ | ✅ |
| 高级功能支持 | 有限 | 完整 |
| 依赖管理 | 简单 | 需引入 SDK |
| 维护成本 | 低 | 需跟进 SDK 更新 |

### 混合架构

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (Agent/Skill)                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
│                   │   LLM Service     │
│                   │   (统一接口层)     │
│                   └─────────┬─────────┘
│                             │
│         ┌───────────────────┼───────────────────┐
│         │                   │                   │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
│  │ HTTP Adapter│    │  SDK Adapter│    │ Local Adapter│
│  │             │    │             │    │              │
│  │ • OpenAI    │    │ • Alibaba   │    │ • Ollama     │
│  │ • Anthropic │    │ • Google    │    │ • vLLM       │
│  │ • Moonshot  │    │ • AWS       │    │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
│         │                   │                   │
│         ▼                   ▼                   ▼
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  │ REST API     │   │ @alicloud/   │   │ Local HTTP   │
│  │              │   │ dashscope    │   │ Server       │
│  └──────────────┘   └──────────────┘   └──────────────┘
└─────────────────────────────────────────────────────────────┘
```

## 适配器接口设计

### 基础适配器接口

```typescript
// 基础适配器接口
interface LLMAdapter {
  // 生成文本
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  
  // 流式生成
  generateStream(request: GenerateRequest): AsyncIterable<StreamChunk>;
  
  // 列出可用模型
  listModels(): Promise<ModelInfo[]>;
  
  // 获取模型详情
  getModelInfo(modelId: string): Promise<ModelInfo | null>;
  
  // 验证配置
  validateConfig(): Promise<boolean>;
}

// 模型信息
interface ModelInfo {
  id: string;                    // 模型ID
  name: string;                  // 显示名称
  description?: string;          // 描述
  contextWindow: number;         // 上下文窗口
  maxTokens: number;             // 最大输出token
  capabilities: ModelCapability; // 能力
  pricing?: ModelPricing;        // 价格信息
  metadata?: Record<string, any>;// 元数据
}

// 模型能力
interface ModelCapability {
  vision: boolean;           // 视觉输入
  function: boolean;         // 函数调用
  json: boolean;             // JSON模式
  streaming: boolean;        // 流式输出
  embeddings: boolean;       // 嵌入
  audio: boolean;            // 音频
}

// 模型价格
interface ModelPricing {
  input: number;             // 输入价格
  output: number;            // 输出价格
  unit: string;              // 单位: 1M_tokens, 1K_tokens
  currency: string;          // 货币: USD, CNY
}
```

## API Key 注入机制

### 问题：SDK 需要 API Key，但 Key 存储在数据库中

**解决方案**：运行时从数据库读取并注入 SDK

### 注入时机

```
┌─────────────────────────────────────────────────────────────┐
│  1. 请求发起                                                │
│     Agent/Skill 调用 LLM Service                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  2. 选择配置                                                │
│     从 t_llm_config 获取配置信息                            │
│     (baseUrl, apiType, connectionMode)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  3. 选择 Key                                                │
│     从 t_llm_instance 轮询获取可用 API Key                  │
│     (考虑权重、配额、冷却状态)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  4. 创建适配器（注入 Key）                                  │
│     new QwenSDKAdapter({ apiKey, baseUrl, ... })            │
│     ★ 每次请求都创建新实例，Key 从数据库实时获取            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  5. 执行调用                                                │
│     adapter.generate(request)                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  6. 销毁适配器                                              │
│     请求完成，适配器实例销毁                                │
│     Key 不保留在内存中                                      │
└─────────────────────────────────────────────────────────────┘
```

### 适配器生命周期管理

```typescript
// 适配器池（管理适配器生命周期）
export class AdapterPool {
  private instanceRepository: InstanceRepository;
  private configRepository: ConfigRepository;

  constructor(
    instanceRepo: InstanceRepository,
    configRepo: ConfigRepository
  ) {
    this.instanceRepository = instanceRepo;
    this.configRepository = configRepo;
  }

  /**
   * 获取适配器（运行时注入 API Key）
   */
  async getAdapter(configId: string): Promise<LLMAdapter> {
    // 1. 获取配置
    const config = await this.configRepository.findById(configId);
    if (!config) {
      throw new Error(`Config not found: ${configId}`);
    }

    // 2. 从数据库选择可用的 API Key
    const instance = await this.selectAvailableInstance(configId);
    if (!instance) {
      throw new Error(`No available API key for config: ${configId}`);
    }

    // 3. 解密 API Key（如果加密存储）
    const apiKey = await this.decryptApiKey(instance.apiKey);

    // 4. 创建适配器（注入 Key）
    const adapterConfig: AdapterConfig = {
      provider: config.providerId,
      baseUrl: config.baseUrl,
      apiKey: apiKey,  // ★ 从数据库注入
      connectionMode: config.connectionMode,
      timeout: config.timeout,
      retries: config.retries,
    };

    return LLMAdapterFactory.create(adapterConfig);
  }

  /**
   * 选择可用的 API Key 实例
   */
  private async selectAvailableInstance(configId: string): Promise<Instance | null> {
    // 考虑：权重、配额、冷却状态
    const instances = await this.instanceRepository.findAvailable(configId);
    
    if (instances.length === 0) {
      return null;
    }

    // 加权随机选择
    return this.weightedRandomSelect(instances);
  }

  /**
   * 解密 API Key
   */
  private async decryptApiKey(encryptedKey: string): Promise<string> {
    // 使用系统密钥解密
    return await EncryptionService.decrypt(encryptedKey);
  }

  /**
   * 加权随机选择
   */
  private weightedRandomSelect(instances: Instance[]): Instance {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0];
  }
}
```

### Key 缓存策略

```typescript
// 可选：短期缓存以提高性能
export class CachedAdapterPool extends AdapterPool {
  private keyCache: Map<string, { key: string; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取 API Key（带缓存）
   */
  async getApiKey(instanceId: string): Promise<string> {
    const cached = this.keyCache.get(instanceId);
    
    // 缓存有效，直接返回
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    // 缓存过期，从数据库读取
    const instance = await this.instanceRepository.findById(instanceId);
    const apiKey = await this.decryptApiKey(instance.apiKey);

    // 更新缓存
    this.keyCache.set(instanceId, {
      key: apiKey,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return apiKey;
  }

  /**
   * 清除缓存（Key 更新时调用）
   */
  clearCache(instanceId?: string): void {
    if (instanceId) {
      this.keyCache.delete(instanceId);
    } else {
      this.keyCache.clear();
    }
  }
}
```

## 千问 SDK 适配器示例

### 1. SDK 引入

```bash
npm install @alicloud/dashscope
```

### 2. 适配器实现（支持运行时 Key 注入）

```typescript
import * as dashscope from '@alicloud/dashscope';
import type { LLMAdapter, ModelInfo, GenerateRequest, GenerateResponse } from './types';

export class QwenSDKAdapter implements LLMAdapter {
  private client: dashscope.DashScopeClient;
  private config: QwenConfig;

  /**
   * 构造函数接收配置（包含从数据库注入的 API Key）
   */
  constructor(config: QwenConfig) {
    this.config = config;
    
    // ★ API Key 从参数传入，不从 env 读取
    this.client = new dashscope.DashScopeClient({
      apiKey: config.apiKey,  // 运行时注入
      baseURL: config.baseUrl,
    });
  }

  /**
   * 列出所有可用模型
   */
  async listModels(): Promise<ModelInfo[]> {
    const models = await this.client.models.list();
    
    return models.data.map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextWindow: model.context_window,
      maxTokens: model.max_tokens,
      capabilities: {
        vision: model.capabilities.vision || false,
        function: model.capabilities.function_call || false,
        json: model.capabilities.json_mode || false,
        streaming: true,
        embeddings: model.id.includes('embedding'),
        audio: model.capabilities.audio || false,
      },
      pricing: {
        input: model.pricing.input,
        output: model.pricing.output,
        unit: model.pricing.unit,
        currency: model.pricing.currency,
      },
    }));
  }

  /**
   * 列出所有可用模型
   * SDK 提供完整的模型信息，包括能力、价格等
   */
  async listModels(): Promise<ModelInfo[]> {
    // 使用 SDK 获取模型列表
    const models = await this.client.models.list();
    
    return models.data.map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextWindow: model.context_window,
      maxTokens: model.max_tokens,
      capabilities: {
        vision: model.capabilities.vision || false,
        function: model.capabilities.function_call || false,
        json: model.capabilities.json_mode || false,
        streaming: true,
        embeddings: model.id.includes('embedding'),
        audio: model.capabilities.audio || false,
      },
      pricing: {
        input: model.pricing.input,
        output: model.pricing.output,
        unit: model.pricing.unit,
        currency: model.pricing.currency,
      },
      metadata: {
        provider: 'alibaba',
        version: model.version,
        supportedLanguages: model.languages,
      },
    }));
  }

  /**
   * 获取模型详细信息
   */
  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    try {
      const model = await this.client.models.retrieve(modelId);
      return {
        id: model.id,
        name: model.name,
        description: model.description,
        contextWindow: model.context_window,
        maxTokens: model.max_tokens,
        capabilities: {
          vision: model.capabilities.vision || false,
          function: model.capabilities.function_call || false,
          json: model.capabilities.json_mode || false,
          streaming: true,
          embeddings: model.id.includes('embedding'),
          audio: model.capabilities.audio || false,
        },
        pricing: {
          input: model.pricing.input,
          output: model.pricing.output,
          unit: model.pricing.unit,
          currency: model.pricing.currency,
        },
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 生成文本
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    });

    return {
      content: response.choices[0].message.content,
      model: response.model,
      usage: {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
        total: response.usage.total_tokens,
      },
    };
  }

  /**
   * 流式生成
   */
  async *generateStream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        content: chunk.choices[0]?.delta?.content || '',
        model: chunk.model,
        usage: chunk.usage ? {
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
          total: chunk.usage.total_tokens,
        } : undefined,
      };
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list({ limit: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 3. 千问 SDK 特有功能

```typescript
// 千问 SDK 提供的额外功能
interface QwenSDKFeatures {
  // 1. 模型能力查询
  getModelCapabilities(modelId: string): Promise<{
    vision: boolean;
    function_call: boolean;
    json_mode: boolean;
    audio: boolean;
    code: boolean;
    reasoning: boolean;
  }>;

  // 2. 批量推理
  createBatchJob(requests: BatchRequest[]): Promise<BatchJob>;
  
  // 3. 文件上传（用于长文本/多模态）
  uploadFile(file: File): Promise<FileObject>;
  
  // 4. 微调任务
  createFineTuningJob(params: FineTuningParams): Promise<FineTuningJob>;
  
  // 5. 实时价格查询
  getRealtimePricing(modelId: string): Promise<{
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
    unit: string;
    currency: string;
    effective_date: string;
  }>;
  
  // 6. 用量统计
  getUsageStats(params: {
    startDate: string;
    endDate: string;
    modelId?: string;
  }): Promise<{
    total_tokens: number;
    total_requests: number;
    total_cost: number;
    breakdown: Array<{
      date: string;
      tokens: number;
      cost: number;
    }>;
  }>;
}
```

## 适配器工厂

```typescript
// 适配器工厂，根据配置创建对应适配器
export class LLMAdapterFactory {
  static create(config: ProviderConfig): LLMAdapter {
    const { provider, connectionMode } = config;
    
    // 根据连接模式选择适配器
    switch (connectionMode) {
      case 'sdk':
        return this.createSDKAdapter(provider, config);
      case 'http':
      default:
        return this.createHTTPAdapter(provider, config);
    }
  }

  private static createSDKAdapter(provider: string, config: ProviderConfig): LLMAdapter {
    switch (provider) {
      case 'alibaba':
        return new QwenSDKAdapter(config);
      case 'google':
        return new GeminiSDKAdapter(config);
      case 'aws':
        return new BedrockSDKAdapter(config);
      default:
        throw new Error(`Provider ${provider} does not support SDK mode`);
    }
  }

  private static createHTTPAdapter(provider: string, config: ProviderConfig): LLMAdapter {
    switch (provider) {
      case 'openai':
        return new OpenAIHTTPAdapter(config);
      case 'anthropic':
        return new AnthropicHTTPAdapter(config);
      case 'alibaba':
      case 'moonshot':
      case 'baidu':
      case 'minimax':
        return new OpenAICompatibleHTTPAdapter(config);
      default:
        return new GenericHTTPAdapter(config);
    }
  }
}
```

## 配置扩展

### t_llm_config 表扩展

```sql
-- 在 t_llm_config 表中增加连接模式字段
ALTER TABLE t_llm_config ADD COLUMN connection_mode VARCHAR(20) DEFAULT 'http' 
COMMENT '连接模式: http/sdk';

-- 增加 SDK 配置字段（JSON格式）
ALTER TABLE t_llm_config ADD COLUMN sdk_config JSON 
COMMENT 'SDK 特有配置';
```

### 配置示例

```json
{
  "provider": {
    "name": "alibaba",
    "displayName": "阿里百炼"
  },
  "config": {
    "name": "SDK配置",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiType": "openai",
    "authMode": "api-key",
    "connectionMode": "sdk",
    "sdkConfig": {
      "package": "@alicloud/dashscope",
      "version": "^2.0.0",
      "features": [
        "autoModelDiscovery",
        "batchInference",
        "fileUpload",
        "usageStats"
      ]
    }
  }
}
```

## 模型自动发现

### SDK 模式自动发现流程

```typescript
// 使用 SDK 自动发现和同步模型
export class ModelDiscoveryService {
  constructor(
    private adapter: LLMAdapter,
    private modelRepository: ModelRepository
  ) {}

  /**
   * 自动发现并同步模型
   */
  async syncModels(configId: string): Promise<SyncResult> {
    // 1. 从 SDK 获取模型列表
    const sdkModels = await this.adapter.listModels();
    
    // 2. 获取数据库中的模型
    const dbModels = await this.modelRepository.findByConfigId(configId);
    
    const result: SyncResult = {
      added: [],
      updated: [],
      removed: [],
      unchanged: [],
    };

    // 3. 对比并同步
    for (const sdkModel of sdkModels) {
      const existing = dbModels.find(m => m.modname === sdkModel.id);
      
      if (!existing) {
        // 新增模型
        await this.modelRepository.create({
          configId,
          modname: sdkModel.id,
          name: sdkModel.name,
          description: sdkModel.description,
          contextWindow: sdkModel.contextWindow,
          maxTokens: sdkModel.maxTokens,
          supportsVision: sdkModel.capabilities.vision,
          supportsFunction: sdkModel.capabilities.function,
          supportsJson: sdkModel.capabilities.json,
        });
        result.added.push(sdkModel.id);
      } else {
        // 检查是否需要更新
        const needsUpdate = this.checkNeedsUpdate(existing, sdkModel);
        if (needsUpdate) {
          await this.modelRepository.update(existing.sid, {
            name: sdkModel.name,
            contextWindow: sdkModel.contextWindow,
            maxTokens: sdkModel.maxTokens,
            supportsVision: sdkModel.capabilities.vision,
            supportsFunction: sdkModel.capabilities.function,
            supportsJson: sdkModel.capabilities.json,
          });
          result.updated.push(sdkModel.id);
        } else {
          result.unchanged.push(sdkModel.id);
        }
      }
    }

    // 4. 标记已删除的模型
    const sdkModelIds = new Set(sdkModels.map(m => m.id));
    for (const dbModel of dbModels) {
      if (!sdkModelIds.has(dbModel.modname)) {
        await this.modelRepository.markAsDeleted(dbModel.sid);
        result.removed.push(dbModel.modname);
      }
    }

    return result;
  }

  private checkNeedsUpdate(dbModel: any, sdkModel: ModelInfo): boolean {
    return (
      dbModel.name !== sdkModel.name ||
      dbModel.context_window !== sdkModel.contextWindow ||
      dbModel.max_tokens !== sdkModel.maxTokens ||
      dbModel.supports_vision !== sdkModel.capabilities.vision ||
      dbModel.supports_function !== sdkModel.capabilities.function ||
      dbModel.supports_json !== sdkModel.capabilities.json
    );
  }
}
```

## 推荐策略

### 供应商连接模式建议

| 供应商 | 推荐模式 | 理由 |
|--------|---------|------|
| **OpenAI** | HTTP | 标准 OpenAI 接口，无需 SDK |
| **Anthropic** | HTTP | 标准接口，文档完善 |
| **Google** | SDK | Gemini SDK 提供更完整功能 |
| **阿里千问** | SDK | SDK 提供模型自动发现、批量推理等 |
| **Azure** | HTTP | OpenAI 兼容接口 |
| **AWS** | SDK | Bedrock SDK 处理签名等复杂逻辑 |
| **Moonshot** | HTTP | OpenAI 兼容接口 |
| **百度** | HTTP | OpenAI 兼容接口 |
| **MiniMax** | HTTP | OpenAI 兼容接口 |
| **Ollama** | HTTP | 本地 OpenAI 兼容接口 |

### 混合使用场景

```typescript
// 场景1: 主要使用 HTTP，特定功能使用 SDK
const httpAdapter = LLMAdapterFactory.create({
  provider: 'alibaba',
  connectionMode: 'http'
});

const sdkAdapter = LLMAdapterFactory.create({
  provider: 'alibaba', 
  connectionMode: 'sdk'
});

// 日常使用 HTTP 适配器（更轻量）
const response = await httpAdapter.generate(request);

// 需要自动发现模型时使用 SDK 适配器
const models = await sdkAdapter.listModels();
await modelDiscoveryService.syncModels(configId);

// 场景2: 根据功能自动选择
class SmartAdapter implements LLMAdapter {
  private httpAdapter: LLMAdapter;
  private sdkAdapter?: LLMAdapter;

  async listModels(): Promise<ModelInfo[]> {
    // 优先使用 SDK 获取完整信息
    if (this.sdkAdapter) {
      return this.sdkAdapter.listModels();
    }
    return this.httpAdapter.listModels();
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // 生成使用 HTTP（更快）
    return this.httpAdapter.generate(request);
  }
}
```

## 总结

1. **HTTP 模式**: 通用、轻量、适合大多数场景
2. **SDK 模式**: 功能丰富、自动发现、适合需要完整功能的场景
3. **混合模式**: 根据需求灵活选择，兼顾性能和功能
