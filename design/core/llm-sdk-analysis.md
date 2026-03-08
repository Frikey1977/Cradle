# LLM SDK 模型信息分析

## 各 SDK 模型列表能力对比

### 1. OpenAI SDK (`openai`)

```typescript
// 模型列表接口
const models = await openai.models.list();

// 返回结构
interface OpenAIModel {
  id: string;           // 模型 ID，如 "gpt-4o"
  object: "model";
  created: number;      // 创建时间戳
  owned_by: string;     // 所有者，如 "openai"
}
```

**提供信息：**
- ✅ 模型 ID (id)
- ✅ 创建时间 (created)
- ✅ 所有者 (owned_by)
- ❌ 上下文窗口大小
- ❌ 功能特性 (vision/function_call)
- ❌ 定价信息

**获取详细模型信息：** 需要硬编码维护

---

### 2. Anthropic SDK (`@anthropic-ai/sdk`)

```typescript
// Anthropic 没有 models.list() 接口
// 模型信息需要硬编码或从文档获取
```

**提供信息：**
- ❌ 无模型列表接口
- 需要手动维护模型列表

**常用模型：**
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307
- claude-3-5-sonnet-20240620

---

### 3. Google Generative AI SDK (`@google/generative-ai`)

```typescript
// Google SDK 没有 models.list() 接口
// 需要硬编码模型名称
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
```

**提供信息：**
- ❌ 无模型列表接口
- 需要手动维护模型列表

**常用模型：**
- gemini-1.5-pro
- gemini-1.5-flash
- gemini-1.0-pro

---

### 4. 阿里云 DashScope SDK (`@alicloud/dashscope`)

```typescript
// DashScope 提供模型列表接口
const models = await dashscope.models.list();

// 返回结构（根据文档推测）
interface DashScopeModel {
  id: string;                    // 模型 ID
  name: string;                  // 模型名称
  description?: string;          // 描述
  context_window?: number;       // 上下文窗口
  max_tokens?: number;           // 最大 token
  capabilities?: {
    vision?: boolean;            // 视觉能力
    function_call?: boolean;     // 函数调用
    json_mode?: boolean;         // JSON 模式
    streaming?: boolean;         // 流式输出
  };
  pricing?: {
    input: number;               // 输入价格
    output: number;              // 输出价格
    unit: string;                // 计价单位
    currency: string;            // 货币
  };
}
```

**提供信息（推测）：**
- ✅ 模型 ID
- ✅ 模型名称
- ✅ 描述
- ✅ 上下文窗口
- ✅ 最大 token
- ✅ 功能特性
- ✅ 定价信息

---

### 5. 智谱 AI SDK (`@zhipuai/sdk`)

```typescript
// 智谱 AI SDK 模型信息需要硬编码
// 官方文档提供模型列表
```

**提供信息：**
- ❌ 无模型列表接口
- 需要手动维护模型列表

**常用模型：**
- glm-4
- glm-4v
- glm-3-turbo
- glm-3-turbo-128k

---

### 6. MiniMax

```typescript
// MiniMax 无官方 SDK
// 使用 OpenAI 兼容的 HTTP API
// 模型列表需要硬编码
```

**提供信息：**
- ❌ 无 SDK
- ❌ 无模型列表接口
- 需要手动维护模型列表

**常用模型：**
- abab6.5s-chat
- abab6.5-chat
- abab6-chat
- abab5.5-chat

---

## SDK 模型信息对比总结

| SDK | 模型列表接口 | 上下文窗口 | 功能特性 | 定价信息 | 备注 |
|-----|-------------|-----------|---------|---------|------|
| OpenAI | ✅ | ❌ | ❌ | ❌ | 需硬编码补充 |
| Anthropic | ❌ | ❌ | ❌ | ❌ | 完全硬编码 |
| Google | ❌ | ❌ | ❌ | ❌ | 完全硬编码 |
| 阿里云 | ✅ | ✅ | ✅ | ✅ | 信息最完整 |
| 智谱 AI | ❌ | ❌ | ❌ | ❌ | 完全硬编码 |
| MiniMax | ❌ | ❌ | ❌ | ❌ | HTTP API |

---

## Adapter 设计建议

### 1. 统一模型信息结构

```typescript
interface UnifiedModelInfo {
  // 基础信息（所有 SDK 都有）
  id: string;                    // 模型唯一标识
  name: string;                  // 显示名称
  provider: string;              // 提供商
  
  // 能力信息（部分 SDK 提供，其他硬编码）
  contextWindow?: number;        // 上下文窗口大小
  maxTokens?: number;            // 最大输出 token
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
    unit: string;                // 计价单位 (1K tokens / 1M tokens)
    currency: string;            // 货币 (USD / CNY)
  };
  
  // 元数据
  metadata?: {
    description?: string;        // 描述
    version?: string;            // 版本
    supportedLanguages?: string[];
  };
}
```

### 2. Adapter 接口设计

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
```

### 3. 各厂商 Adapter 实现策略

```typescript
// OpenAI Adapter
class OpenAIAdapter implements LLMProviderAdapter {
  async listModels(): Promise<UnifiedModelInfo[]> {
    // 1. 调用 SDK 获取基础列表
    const sdkModels = await this.client.models.list();
    
    // 2. 合并硬编码的详细信息
    return sdkModels.data.map(model => ({
      id: model.id,
      name: this.getModelDisplayName(model.id),
      provider: 'openai',
      // 从硬编码配置补充
      ...MODEL_DETAILS[model.id],
    }));
  }
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
}

// 阿里云 Adapter
class DashScopeAdapter implements LLMProviderAdapter {
  async listModels(): Promise<UnifiedModelInfo[]> {
    // 直接调用 SDK，信息最完整
    const models = await dashscope.models.list();
    return models.data.map(this.normalizeModelInfo);
  }
}
```

### 4. 硬编码配置建议

对于不支持模型列表的 SDK，维护一个配置文件：

```typescript
// config/models/openai-models.ts
export const OPENAI_MODELS: Record<string, UnifiedModelInfo> = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
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
  // ... 其他模型
};

// config/models/anthropic-models.ts
export const ANTHROPIC_MODELS: UnifiedModelInfo[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    // ...
  },
  // ...
];
```

---

## 前端配置流程

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
