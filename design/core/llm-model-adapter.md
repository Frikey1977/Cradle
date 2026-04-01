# LLM 模型适配器架构设计

## 1. 架构概述

### 1.1 设计目标

- **统一接口**：所有模型通过统一接口调用，上层无需关心具体实现
- **模型差异封装**：不同模型的特殊格式要求封装在适配器内部
- **易于扩展**：新增模型只需实现适配器接口，无需修改上层代码
- **工厂模式管理**：自动根据模型类型选择合适的适配器

### 1.2 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        上层调用层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ AgentRuntime │  │ LLMService   │  │ 其他服务      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          │                 │ 统一接口调用     │
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      模型适配器层                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    IModelAdapter (接口)                  │   │
│  │  • chatCompletion()                                      │   │
│  │  • streamChatCompletion()                                │   │
│  │  • multimodalChat()                                      │   │
│  │  • speechToText()                                        │   │
│  │  • textToSpeech()                                        │   │
│  │  • createRealtimeSession()                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ BaseModel    │   │ OpenAICompat │   │ QwenOmni     │        │
│  │ Adapter      │   │ Adapter      │   │ Adapter      │        │
│  │ (抽象基类)    │   │ (通用文本)    │   │ (全模态)      │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│          │                   │                   │              │
│          │           ┌───────┴───────┐          │              │
│          │           │               │          │              │
│          ▼           ▼               ▼          ▼              │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Realtime     │ │ Speech   │ │ TTS      │ │ Custom   │      │
│  │ Speech       │ │ Recogni- │ │ Adapter  │ │ Adapter  │      │
│  │ Adapter      │ │ tion     │ │          │ │          │      │
│  │ (WebSocket)  │ │ Adapter  │ │          │ │          │      │
│  └──────────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ AdapterFactory
                            │ (自动创建适配器)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      模型提供商 API                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ OpenAI   │ │ Alibaba  │ │ Azure    │ │ Other    │           │
│  │ API      │ │ DashScope│ │ OpenAI   │ │ Providers│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 适配器类型

### 2.1 适配器分类

| 适配器类型 | 适用模型 | 特殊处理 | 能力 |
|-----------|---------|---------|------|
| **OpenAICompatibleAdapter** | GPT-4, GPT-3.5, Qwen-Text 等 | 标准 OpenAI API 格式 | textGeneration |
| **QwenOmniAdapter** | Qwen-Omni 系列 | 特殊 audio 格式 (data URL) | textGeneration, visualComprehension, speechRecognition |
| **RealtimeSpeechAdapter** | Qwen-Realtime, GPT-4o Realtime | WebSocket 连接 | realtimeSpeech |
| **SpeechRecognitionAdapter** | Paraformer, Whisper | multipart/form-data | speechRecognition |
| **TTSAdapter** | CosyVoice 等 | 音频流处理 | speechSynthesis |

### 2.2 模型类型检测规则

```typescript
// AdapterFactory 自动检测逻辑
function determineAdapterType(config: AdapterConfig): string {
  const modelName = config.modelName.toLowerCase();
  
  // 1. 实时语音模型
  if (modelName.includes("realtime") || modelName.includes("live")) {
    return "realtime";
  }
  
  // 2. 专用 ASR 模型
  if (modelName.includes("paraformer") || modelName.includes("whisper")) {
    return "speech-recognition";
  }
  
  // 3. Qwen-Omni 模型
  if (modelName.includes("qwen") && modelName.includes("omni")) {
    return "qwen-omni";
  }
  
  // 4. 默认 OpenAI 兼容
  return "openai-compatible";
}
```

## 3. 核心接口

### 3.1 IModelAdapter 接口

```typescript
interface IModelAdapter {
  // 配置信息
  readonly config: AdapterConfig;
  readonly modelType: ModelType;
  readonly capabilities: ModelCapability[];
  
  // 基础对话
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk>;
  
  // 多模态对话
  multimodalChat(input: MultimodalInput): Promise<ChatCompletionResponse>;
  streamMultimodalChat(input: MultimodalInput): AsyncGenerator<StreamChunk>;
  
  // 语音专用
  speechToText?(options: STTOptions): Promise<string>;
  textToSpeech?(options: TTSOptions): Promise<Buffer>;
  
  // 实时语音
  createRealtimeSession?(config: RealtimeSessionConfig): Promise<IRealtimeSession>;
  
  // 生命周期
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

### 3.2 多模态输入格式

```typescript
interface MultimodalInput {
  prompt?: string;           // 文本提示
  images?: string[];         // 图像 (Base64 或 URL)
  audio?: string[];          // 音频 (Base64)
  audioFormat?: string;      // 音频格式: wav, mp3, webm
  sampleRate?: number;       // 采样率 (某些模型需要)
}
```

## 4. 适配器实现示例

### 4.1 Qwen-Omni 适配器

```typescript
export class QwenOmniAdapter extends BaseModelAdapter {
  readonly modelType = "omni";
  readonly capabilities = [
    "textGeneration",
    "visualComprehension", 
    "speechRecognition",
    "speechSynthesis"
  ];
  
  protected buildMultimodalMessages(input: MultimodalInput): any[] {
    const content: any[] = [];
    
    // 文本
    if (input.prompt) {
      content.push({ type: "text", text: input.prompt });
    }
    
    // 图像
    if (input.images) {
      for (const image of input.images) {
        content.push({
          type: "image_url",
          image_url: { url: image }
        });
      }
    }
    
    // 音频 - Qwen-Omni 特殊格式
    if (input.audio) {
      for (const audio of input.audio) {
        const audioData = audio.startsWith("data:")
          ? audio  // 已是 data URL
          : `data:audio/${input.audioFormat};base64,${audio}`;
        
        content.push({
          type: "input_audio",
          input_audio: {
            data: audioData,  // 必须是完整 data URL
            format: input.audioFormat || "wav"
          }
        });
      }
    }
    
    return [{ role: "user", content }];
  }
}
```

### 4.2 实时语音适配器

```typescript
export class RealtimeSpeechAdapter extends BaseModelAdapter {
  readonly modelType = "realtime";
  readonly capabilities = ["realtimeSpeech"];
  
  async createRealtimeSession(config: RealtimeSessionConfig): Promise<IRealtimeSession> {
    // 建立 WebSocket 连接
    const ws = new WebSocket(this.wsUrl, {
      headers: { "Authorization": `Bearer ${this.config.apiKey}` }
    });
    
    // 等待连接
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    
    return new RealtimeSpeechSession(ws);
  }
}

class RealtimeSpeechSession implements IRealtimeSession {
  async sendAudio(audioData: Buffer): Promise<void> {
    this.ws.send(JSON.stringify({
      type: "audio",
      data: audioData.toString("base64")
    }));
  }
  
  on(event: "audio" | "text", callback: (data: any) => void): void {
    this.eventHandlers.set(event, callback);
  }
}
```

### 4.3 语音识别适配器

```typescript
export class SpeechRecognitionAdapter extends BaseModelAdapter {
  readonly modelType = "speech2text";
  readonly capabilities = ["speechRecognition"];
  
  async speechToText(options: STTOptions): Promise<string> {
    // 使用 multipart/form-data 上传音频
    const formData = new FormData();
    formData.append("file", Buffer.from(options.audio, "base64"));
    formData.append("model", this.config.modelName);
    formData.append("sample_rate", options.sampleRate?.toString());
    
    const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.config.apiKey}` },
      body: formData
    });
    
    const data = await response.json();
    return data.text || data.result;
  }
}
```

## 5. 工厂模式使用

### 5.1 基础使用

```typescript
// 创建适配器
const adapter = AdapterFactory.getInstance().createAdapter({
  modelName: "qwen3-omni-flash",
  provider: "alibaba",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-xxx"
});

// 使用适配器
await adapter.initialize();
const response = await adapter.multimodalChat({
  prompt: "请描述这段音频",
  audio: [audioBase64],
  audioFormat: "wav"
});
```

### 5.2 从数据库配置创建

```typescript
// 从实例配置创建
const adapter = AdapterFactory.getInstance().createFromInstanceConfig({
  sid: "xxx",
  name: "Multimodal Instance",
  providerName: "alibaba",
  modelName: "qwen3-omni-flash",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-xxx",
  headers: '{"X-DashScope-DataInspection": "enable"}'
});
```

### 5.3 强制指定适配器类型

```typescript
// 绕过自动检测，强制使用特定适配器
const adapter = AdapterFactory.getInstance().createAdapter(
  config,
  { forceAdapter: "qwen-omni" }
);
```

## 6. 与 LLMServiceManager 集成

### 6.1 集成方式

```typescript
class LLMServiceManager {
  private adapterFactory = AdapterFactory.getInstance();
  
  async route(task: RoutingTask): Promise<RoutingDecision> {
    // 1. 选择实例
    const instance = await this.selectInstance(task);
    
    // 2. 创建/获取适配器
    const adapter = this.adapterFactory.createFromInstanceConfig(instance);
    await adapter.initialize();
    
    return {
      instanceId: instance.sid,
      instanceName: instance.name,
      adapter,  // 返回适配器实例
      modelName: instance.modelName,
      provider: instance.providerName
    };
  }
  
  async multimodalChat(task, prompt, options) {
    const decision = await this.route(task);
    
    // 使用适配器调用模型
    const response = await decision.adapter.multimodalChat({
      prompt,
      audio: options.audio,
      audioFormat: options.audioFormat
    });
    
    return response;
  }
}
```

### 6.2 调用流程

```
AgentMessage (语音)
       │
       ▼
AgentRuntime.handleMessage()
       │
       ▼
LLMServiceManager.route()
       │
       ├── 选择实例 (基于能力)
       │
       ▼
AdapterFactory.createAdapter()
       │
       ├── 检测模型类型
       ├── 创建对应适配器
       │
       ▼
QwenOmniAdapter.multimodalChat()
       │
       ├── 构建特殊格式消息
       ├── 调用 LLM API
       │
       ▼
返回标准格式响应
```

## 7. 扩展新适配器

### 7.1 步骤

1. **创建适配器类**
```typescript
export class CustomModelAdapter extends BaseModelAdapter {
  readonly modelType = "custom";
  readonly capabilities = ["textGeneration"];
  
  async chatCompletion(request) {
    // 实现特定调用逻辑
  }
  
  async streamChatCompletion(request) {
    // 实现流式调用
  }
}
```

2. **注册到工厂**
```typescript
// 在 adapter-factory.ts 中添加检测规则
if (modelName.includes("custom-model")) {
  return "custom";
}

// 在 createAdapter 中添加 case
case "custom":
  adapter = new CustomModelAdapter(config);
  break;
```

3. **使用新适配器**
```typescript
const adapter = AdapterFactory.getInstance().createAdapter(config);
```

## 8. 最佳实践

### 8.1 错误处理

```typescript
// 适配器内部处理模型特定错误
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    // 转换为标准错误格式
    throw new Error(`[${error.code}] ${error.message}`);
  }
} catch (error) {
  // 记录详细错误日志
  console.error(`[${this.config.modelName}] API Error:`, error);
  throw error;
}
```

### 8.2 格式转换

```typescript
// 在适配器内部处理格式差异
protected normalizeResponse(rawResponse: any): ChatCompletionResponse {
  // 不同提供商的响应格式统一转换
  return {
    id: rawResponse.id || rawResponse.request_id,
    model: rawResponse.model || this.config.modelName,
    choices: rawResponse.choices?.map(c => ({
      message: {
        role: c.message?.role || "assistant",
        content: c.message?.content || c.text || ""
      }
    }))
  };
}
```

### 8.3 缓存管理

```typescript
// 适配器实例缓存
const cacheKey = `${config.provider}:${config.modelName}`;
if (this.adapterCache.has(cacheKey)) {
  return this.adapterCache.get(cacheKey);
}

// 创建新实例并缓存
const adapter = new AdapterClass(config);
this.adapterCache.set(cacheKey, adapter);
```

## 9. 演进计划

### Phase 1: 基础适配器 ✅
- [x] OpenAICompatibleAdapter
- [x] QwenOmniAdapter
- [x] RealtimeSpeechAdapter
- [x] SpeechRecognitionAdapter

### Phase 2: 扩展适配器
- [ ] AzureOpenAIAdapter (Azure 特定功能)
- [ ] ClaudeAdapter (Anthropic API)
- [ ] GeminiAdapter (Google API)
- [ ] LocalModelAdapter (本地模型支持)

### Phase 3: 高级功能
- [ ] 自适应重试策略
- [ ] 响应缓存机制
- [ ] 模型性能监控
- [ ] A/B 测试支持
