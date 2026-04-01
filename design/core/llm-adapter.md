# 大模型对接模块设计

## 1. 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           前端模型配置模块                                    │
│                   (用户选择供应商 → 查询模型 → 完成配置)                       │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼ 调用 Web API
┌─────────────────────────────────────────────────────────────────────────────┐
│                           route (Web API 层)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  GET  /api/llm/providers              → 获取供应商列表                        │
│  GET  /api/llm/providers/:id/models   → 查询 SDK 提供的模型信息               │
│  POST /api/llm/configs                → 创建配置 (模板)                       │
│  GET  /api/llm/configs/:id/instances  → 获取配置下的 Key 实例                 │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼ 调用 SDK
┌─────────────────────────────────────────────────────────────────────────────┐
│                        llm_adapter (SDK 适配器层)                            │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│ 阿里云      │ 智谱 AI     │ OpenAI      │ Anthropic   │ Google              │
│ @alicloud/  │ @zhipuai/   │ openai      │ @anthropic- │ @google/            │
│ dashscope   │ sdk         │             │ ai/sdk      │ generative-ai       │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
                                          │
                                          ▼ 数据存储
┌─────────────────────────────────────────────────────────────────────────────┐
│                        数据层                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   t_llm_provider (供应商定义)                                               │
│   ├── t_llm_config (配置模板) ←── 用户通过前端创建                           │
│   │       ├── baseUrl, apiType, apiVersion                                  │
│   │       └── 关联 SDK 获取的模型列表                                        │
│   │                                                                         │
│   └── t_llm_instance (Key 实例) ←── 与 config 组合成 runtime                 │
│           ├── apiKey, dailyQuota, weight                                    │
│           └── 运行时选择 Key 调用 LLM                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 运行时对象构成

```
runtime = config (模板) + instance (Key)
        = { baseUrl, apiType, model, ... } + { apiKey, ... }
        → 可调用 LLM API
```

### 1.3 数据流向

```
用户请求 → route → llm_adapter → SDK → 厂商 API
              ↑                        ↓
              └──────── 响应结果 ←───────┘
                        ↓
              计费/审计记录
```

---

## 2. SDK 模型信息分析

### 2.1 各 SDK 模型列表能力对比

| SDK | 模型列表接口 | 上下文窗口 | 功能特性 | 定价信息 | 实现策略 |
|-----|-------------|-----------|---------|---------|---------|
| **OpenAI** | ✅ 支持 | ❌ | ❌ | ❌ | SDK获取 + 硬编码补充 |
| **Anthropic** | ❌ 不支持 | ❌ | ❌ | ❌ | 完全硬编码 |
| **Google** | ❌ 不支持 | ❌ | ❌ | ❌ | 完全硬编码 |
| **阿里云** | ✅ 支持 | ✅ | ✅ | ✅ | 直接调用 SDK |
| **智谱 AI** | ❌ 不支持 | ❌ | ❌ | ❌ | 完全硬编码 |
| **MiniMax** | ❌ 无 SDK | ❌ | ❌ | ❌ | HTTP API + 硬编码 |

### 2.2 统一模型信息结构

```typescript
interface UnifiedModelInfo {
  // 基础信息（所有 SDK 都有）
  id: string;                    // 模型唯一标识，如 "gpt-4o"
  name: string;                  // 显示名称，如 "GPT-4o"
  provider: string;              // 提供商，如 "openai"
  
  // 能力信息（部分 SDK 提供，其他硬编码）
  contextWindow?: number;        // 上下文窗口大小，如 128000
  maxTokens?: number;            // 最大输出 token，如 4096
  capabilities?: {
    vision?: boolean;            // 视觉理解
    functionCall?: boolean;      // 函数调用
    jsonMode?: boolean;          // JSON 模式
    streaming?: boolean;         // 流式输出
    embeddings?: boolean;        // 嵌入向量
    audio?: boolean;             // 音频处理
  };
  
  // 定价信息（部分 SDK 提供）
  pricing?: {
    input: number;               // 输入价格
    output: number;              // 输出价格
    unit: string;                // 计价单位，如 "1K tokens"
    currency: string;            // 货币，如 "USD" / "CNY"
  };
  
  // 元数据
  metadata?: {
    description?: string;        // 描述
    version?: string;            // 版本
    supportedLanguages?: string[];
  };
}
```

---

## 3. Adapter 接口设计

### 3.1 统一 Adapter 接口

```typescript
interface LLMProviderAdapter {
  /**
   * 获取模型列表
   * - 支持列表的 SDK：直接调用
   * - 不支持的 SDK：返回硬编码列表
   */
  listModels(): Promise<UnifiedModelInfo[]>;
  
  /**
   * 获取特定模型信息
   */
  getModelInfo(modelId: string): Promise<UnifiedModelInfo | null>;
  
  /**
   * 创建聊天完成
   */
  chatCompletion(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * 流式聊天完成
   */
  chatCompletionStream(request: ChatRequest): AsyncIterable<StreamChunk>;
  
  /**
   * 验证 API Key 是否有效
   */
  validateApiKey(): Promise<boolean>;
}

// 请求参数
interface ChatRequest {
  model: string;                 // 模型 ID
  messages: Message[];           // 消息列表
  temperature?: number;          // 温度
  maxTokens?: number;            // 最大 token
  stream?: boolean;              // 是否流式
  tools?: Tool[];                // 工具/函数
}

// 响应结果
interface ChatResponse {
  content: string;               // 生成的内容
  model: string;                 // 实际使用的模型
  usage: {
    input: number;               // 输入 token
    output: number;              // 输出 token
    total: number;               // 总计
  };
}
```

### 3.2 各厂商 Adapter 实现

```typescript
// OpenAI Adapter
class OpenAIAdapter implements LLMProviderAdapter {
  private client: OpenAI;
  
  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.client = new OpenAI(config);
  }
  
  async listModels(): Promise<UnifiedModelInfo[]> {
    // 1. 调用 SDK 获取基础列表
    const sdkModels = await this.client.models.list();
    
    // 2. 合并硬编码的详细信息
    return sdkModels.data.map(model => ({
      id: model.id,
      name: this.getModelDisplayName(model.id),
      provider: 'openai',
      // 从硬编码配置补充详细信息
      ...OPENAI_MODEL_DETAILS[model.id],
    }));
  }
  
  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    });
    
    return {
      content: response.choices[0].message.content || '',
      model: response.model,
      usage: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }
  
  // ... 其他方法
}

// Anthropic Adapter
class AnthropicAdapter implements LLMProviderAdapter {
  async listModels(): Promise<UnifiedModelInfo[]> {
    // 完全返回硬编码列表
    return ANTHROPIC_MODELS.map(model => ({
      id: model.id,
      name: model.name,
      provider: 'anthropic',
      ...model.details,
    }));
  }
  
  // ... 其他方法
}

// 阿里云 DashScope Adapter
class DashScopeAdapter implements LLMProviderAdapter {
  async listModels(): Promise<UnifiedModelInfo[]> {
    // 直接调用 SDK，信息最完整
    const models = await dashscope.models.list();
    return models.data.map(this.normalizeModelInfo);
  }
  
  // ... 其他方法
}
```

---

## 4. 表结构关系

```
t_llm_provider (1) ────< (N) t_llm_config
                              │
                              ├──< (N) t_llm_instance (Key池)
                              │
                              └──< (N) t_llm_model (模型)
```

### 关系说明

| 关系 | 说明 |
|------|------|
| provider → config | 一个提供商可以有多个配置（如默认配置、国内代理） |
| config → instance | 一个配置可以有多个API Key（轮询/负载均衡） |
| config → model | 一个配置下可以有多个模型（如gpt-4o、gpt-4o-mini） |

---

## 5. 数据库表

### 5.1 核心表

| 表名 | 核心字段 | 说明 | 文档 |
|------|---------|------|------|
| **t_llm_provider** | `name` | 提供商定义（openai、anthropic等） | [t_llm_provider.md](./database/t_llm_provider.md) |
| **t_llm_config** | `base_url`, `api_type` | 配置信息（地址、API类型） | [t_llm_config.md](./database/t_llm_config.md) |
| **t_llm_instance** | `api_key` | API Key池（轮询、配额、冷却） | [t_llm_instance.md](./database/t_llm_instance.md) |
| **t_llm_model** | `modname` | 模型定义（上下文、成本、能力） | [t_llm_model.md](./database/t_llm_model.md) |

### 5.2 计费与审计表

| 表名 | 核心字段 | 说明 | 文档 |
|------|---------|------|------|
| **t_llm_pricing** | `pricing_type` | 计费模式 | [t_llm_pricing.md](./database/t_llm_pricing.md) |
| **t_llm_billing** | `request_id` | 计费记录 | [t_llm_billing.md](./database/t_llm_billing.md) |
| **t_llm_audit** | `ttfb_ms` | 响应效率审计 | [t_llm_audit.md](./database/t_llm_audit.md) |

---

## 6. 前端配置流程

```
1. 用户选择供应商 (provider)
   ↓
2. 前端调用 GET /api/llm/providers/:id/models
   ↓
3. 后端通过 Adapter 获取模型列表
   - 支持列表的 SDK：实时获取
   - 不支持的 SDK：返回硬编码列表
   ↓
4. 前端展示模型信息
   - 名称、上下文窗口、能力、定价
   ↓
5. 用户选择模型，填写配置信息
   - baseUrl、apiKey 等
   ↓
6. 前端提交创建配置
   POST /api/llm/configs
   ↓
7. 后端保存配置模板到 t_llm_config
   保存模型信息到 t_llm_model
   保存 Key 到 t_llm_instance
   ↓
8. 配置完成，可开始使用
```

---

## 7. 硬编码模型配置

对于不支持模型列表的 SDK，维护配置文件：

```typescript
// src/llm/models/openai-models.ts
export const OPENAI_MODELS: Record<string, Partial<UnifiedModelInfo>> = {
  'gpt-4o': {
    name: 'GPT-4o',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.005,
      output: 0.015,
      unit: '1K tokens',
      currency: 'USD',
    },
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    contextWindow: 128000,
    maxTokens: 16384,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.00015,
      output: 0.0006,
      unit: '1K tokens',
      currency: 'USD',
    },
  },
  // ... 其他模型
};

// src/llm/models/anthropic-models.ts
export const ANTHROPIC_MODELS: UnifiedModelInfo[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.015,
      output: 0.075,
      unit: '1K tokens',
      currency: 'USD',
    },
  },
  // ... 其他模型
];
```

---

## 8. Web UI 界面

### 8.1 提供商管理
```
┌─────────────────────────────────────────┐
│  模型提供商                              │
├─────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ OpenAI │ │Anthropic│ │阿里千问│  +   │
│  └────────┘ └────────┘ └────────┘      │
└─────────────────────────────────────────┘
```

### 8.2 配置管理
```
┌─────────────────────────────────────────┐
│  OpenAI 配置                             │
├─────────────────────────────────────────┤
│  配置列表:                               │
│  ┌─────────────────────────────────────┐│
│  │ 默认配置 │ https://api.openai.com/v1 ││
│  │ 国内代理 │ https://api.gptapi.us/v1  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### 8.3 Key池管理
```
┌─────────────────────────────────────────┐
│  API Key 池 (默认配置)                   │
├─────────────────────────────────────────┤
│  ┌────────┬──────────┬────────┬────────┐│
│  │ 名称   │ 今日用量  │ 配额   │ 状态   ││
│  ├────────┼──────────┼────────┼────────┤│
│  │ Key-1  │ 1.2M     │ 10M    │ ● 正常 ││
│  │ Key-2  │ 800K     │ 10M    │ ● 正常 ││
│  │ Key-3  │ 冷却中   │ 10M    │ ○ 冷却 ││
│  └────────┴──────────┴────────┴────────┘│
└─────────────────────────────────────────┘
```
