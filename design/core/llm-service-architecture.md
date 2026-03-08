# LLM 服务架构设计

## 1. 架构概述

### 1.1 设计目标

- **统一服务接口**: 提供一致的 LLM 调用接口，支持文本、多模态、语音等多种能力
- **智能路由**: 根据任务类型（文本/语音/图像）自动路由到合适的模型实例
- **高可用性**: 连接池、断路器、请求队列确保服务稳定
- **多模型协作**: 支持语音场景下的多模型协作（STT + LLM + TTS）
- **灵活适配**: 适配器模式支持多种模型提供商

### 1.2 核心架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Master Process                                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    UnifiedLLMService                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ ConfigLoader│  │Capability   │  │   ConnectionPool        │  │   │
│  │  │             │  │   Router    │  │  ┌─────┐ ┌─────┐ ┌────┐ │  │   │
│  │  │ • 实例配置   │  │             │  │  │Conn1│ │Conn2│ │... │ │  │   │
│  │  │ • 模型能力   │  │ • 能力匹配   │  │  └──┬──┘ └──┬──┘ └─┬──┘ │  │   │
│  │  │ • 配额管理   │  │ • 负载均衡   │  │     └───────┴──────┘    │  │   │
│  │  └─────────────┘  │ • 故障转移   │  └─────────────────────────┘  │   │
│  │                   └─────────────┘                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │RequestQueue │  │CircuitBreaker│  │   AdapterFactory        │   │   │
│  │  │             │  │             │  │  ┌─────────────────┐    │   │   │
│  │  │ • 并发控制   │  │ • 故障检测   │  │  │ OpenAICompatible│    │   │   │
│  │  │ • 队列管理   │  │ • 自动恢复   │  │  │ QwenOmni        │    │   │   │
│  │  │ • 优先级    │  │             │  │  │ RealtimeSpeech  │    │   │   │
│  │  └─────────────┘  └─────────────┘  │  │ SpeechRecognition│    │   │   │
│  │                                    │  └─────────────────┘    │   │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │   │
│  │  │              RealtimeSpeechService                      │  │   │   │
│  │  │         (WebSocket 实时语音对话服务)                     │  │   │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   LLMServiceManager (IPC 服务)                   │   │
│  │         处理来自 Worker 进程的 LLM 请求                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Worker Process Pool                            │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │  Worker 1   │  │  Worker 2   │  │  Worker N   │                      │
│  │             │  │             │  │             │                      │
│  │ • Agent     │  │ • Agent     │  │ • Agent     │                      │
│  │   Runtime   │  │   Runtime   │  │   Runtime   │                      │
│  │ • LLMClient │  │ • LLMClient │  │ • LLMClient │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心组件详解

### 2.1 UnifiedLLMService

统一 LLM 服务，整合所有子组件，提供高可用的 LLM 调用接口。

```typescript
export class UnifiedLLMService {
  private configLoader: LLMConfigLoader;
  private router: CapabilityRouter;
  private connectionPool: LLMConnectionPool;
  private requestQueue: LLMRequestQueue;
  private realtimeService: RealtimeSpeechService;
  
  async initialize(): Promise<void> {
    // 1. 加载数据库配置
    await this.configLoader.loadFromDatabase();
    
    // 2. 初始化连接池
    await this.connectionPool.initialize(this.configLoader);
    
    // 3. 查找并设置实时语音实例
    const realtimeInstances = this.configLoader.selectInstancesForCapability(
      "realtimeSpeech", { maxInstances: 1 }
    );
    if (realtimeInstances.length > 0) {
      this.realtimeService.setInstance(realtimeInstances[0]);
    }
  }
  
  // 文本生成
  async generateText(messages: ConversationMessage[], options: ChatOptions): Promise<LLMResponse>
  
  // 多模态对话
  async multimodalChat(prompt: string, options: MultimodalOptions): Promise<LLMResponse>
  
  // 语音识别
  async transcribeAudio(audioData: string, options: STTOptions): Promise<{ text: string }>
  
  // 语音合成
  async synthesizeSpeech(text: string, options: SpeechSynthesisOptions): Promise<{ audio: string }>
  
  // 嵌入生成
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>
  
  // 实时语音会话
  createRealtimeSession(config: RealtimeSessionConfig): Promise<RealtimeSpeechSession>
}
```

### 2.2 配置加载器 (LLMConfigLoader)

从数据库加载实例和模型配置，构建能力索引。

```typescript
export class LLMConfigLoader {
  private instances: Map<string, LLMInstanceConfig> = new Map();
  private models: Map<string, LLMModelCapability> = new Map();
  private capabilityIndex: Map<string, string[]> = new Map();
  
  async loadFromDatabase(): Promise<void> {
    // 从 t_llm_instances 和 t_llm_configs 加载实例
    // 构建实例索引和能力索引
  }
  
  // 根据能力筛选实例
  selectInstancesForCapability(
    capability: LLMCapability, 
    options?: { maxInstances?: number }
  ): LLMInstanceConfig[]
  
  // 获取实例配置
  getInstance(id: string): LLMInstanceConfig | undefined
  
  // 获取模型能力
  getModelCapabilities(configId: string): LLMModelCapability | undefined
}
```

**数据模型**:

```typescript
interface LLMInstanceConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  configId: string;
  apiKey: string;           // 解密后的 API key
  timeout: number;
  maxRetries: number;
  priority: number;
  status: "enabled" | "disabled";
  baseUrl: string;
}

interface LLMModelCapability {
  modelId: string;
  modelName: string;
  capabilities: LLMCapability[];
  maxTokens: number;
  billingType: "usage" | "time" | "prepaid";
  baseUrl: string;
}

type LLMCapability =
  | "textGeneration"
  | "textEmbedding"
  | "deepThinking"
  | "visualComprehension"
  | "speechSynthesis"
  | "speechRecognition"
  | "realtimeSpeech"
  | "imageGeneration"
  | "multiEmbedding";
```

### 2.3 能力路由器 (CapabilityRouter)

根据任务类型智能选择最佳 LLM 实例。

```typescript
export class CapabilityRouter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  
  // 核心路由方法
  async route(task: RoutingTask): Promise<RoutingDecision> {
    // 1. 获取支持该能力的所有实例
    const instances = this.configLoader.selectInstancesForCapability(task.capability);
    
    // 2. 过滤健康实例（断路器状态）
    const healthyInstances = instances.filter(inst => {
      const breaker = this.getCircuitBreaker(inst.id);
      return breaker.getState() !== "OPEN";
    });
    
    // 3. 根据任务特性选择
    if (task.requireRealtime) {
      return this.selectRealtimeInstance(healthyInstances);
    }
    if (task.capability === "speechRecognition") {
      return this.selectSpeechRecognitionInstance(healthyInstances);
    }
    if (task.capability === "speechSynthesis") {
      return this.selectSpeechSynthesisInstance(healthyInstances);
    }
    if (task.complexity === "high") {
      return this.selectHighCapacityInstance(healthyInstances);
    }
    
    // 4. 默认：负载均衡
    return this.loadBalance(healthyInstances);
  }
  
  // 记录成功/失败用于负载均衡
  recordSuccess(instanceId: string, latency: number): void
  recordFailure(instanceId: string): void
  incrementLoad(instanceId: string): void
}
```

### 2.4 连接池 (ConnectionPool)

管理 LLM 适配器连接，支持连接复用。

```typescript
export class LLMConnectionPool {
  private pools: Map<string, ConnectionPool> = new Map();
  private adapterFactory: AdapterFactory;
  
  async initialize(configLoader: LLMConfigLoader): Promise<void> {
    // 为每个启用的实例创建连接池
    for (const [id, config] of configLoader.getAllInstances()) {
      const adapter = this.adapterFactory.createAdapter({
        modelName: config.modelName,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });
      
      await adapter.initialize();
      
      this.pools.set(id, new ConnectionPool({
        adapter,
        maxConnections: 20,
        minConnections: 5,
      }));
    }
  }
  
  // 获取连接
  async acquire(instanceId: string): Promise<PooledConnection>
  
  // 释放连接
  release(connection: PooledConnection): void
  
  // 健康检查
  async healthCheck(): Promise<Map<string, boolean>>
}
```

### 2.5 请求队列 (RequestQueue)

管理并发请求，防止过载。

```typescript
export class LLMRequestQueue {
  private queue: QueuedRequest[] = [];
  private running = 0;
  private maxConcurrent: number;
  private maxQueueSize: number;
  
  async enqueue<T>(
    request: LLMRequest,
    processor: (req: LLMRequest) => Promise<T>
  ): Promise<T> {
    // 队列满时拒绝
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error("Request queue is full");
    }
    
    // 并发控制
    if (this.running >= this.maxConcurrent) {
      // 等待队列
      return new Promise((resolve, reject) => {
        this.queue.push({ request, processor, resolve, reject });
      });
    }
    
    // 直接执行
    this.running++;
    try {
      return await processor(request);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}
```

### 2.6 断路器 (CircuitBreaker)

防止故障扩散，自动恢复。

```typescript
export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = "CLOSED";
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = "OPEN";
    }
  }
}
```

## 3. 适配器层

### 3.1 适配器架构

```
┌─────────────────────────────────────────────────────────┐
│                    AdapterFactory                        │
│              (根据模型类型创建对应适配器)                 │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│OpenAICompatible │ │ QwenOmni    │ │ RealtimeSpeech  │
│    Adapter      │ │   Adapter   │ │    Adapter      │
├─────────────────┤ ├─────────────┤ ├─────────────────┤
│• 标准 OpenAI    │ │• 通义千问    │ │• WebSocket     │
│  兼容接口       │ │   Omni 模型 │ │  实时语音       │
│• 支持 GPT/     │ │• 音视频理解  │ │• 实时对话       │
│  Claude 等     │ │• 语音合成    │ │• 流式传输       │
└─────────────────┘ └─────────────┘ └─────────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SpeechRecognitionAdapter                    │
│              (语音识别专用适配器)                         │
│  • 支持 Whisper 等 STT 模型                              │
│  • 音频转文本                                            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 适配器接口

```typescript
interface IModelAdapter {
  readonly config: AdapterConfig;
  readonly modelType: ModelType;
  readonly capabilities: ModelCapability[];
  
  // 初始化
  initialize(): Promise<void>;
  
  // 对话完成
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk>;
  
  // 多模态对话
  multimodalChat(input: MultimodalInput): Promise<ChatCompletionResponse>;
  streamMultimodalChat(input: MultimodalInput): AsyncGenerator<StreamChunk>;
  
  // 嵌入
  createEmbedding(text: string): Promise<number[]>;
  
  // 语音合成
  synthesizeSpeech(options: TTSOptions): Promise<{ audio: string; format: string }>;
  
  // 语音识别
  transcribeAudio(options: STTOptions): Promise<{ text: string }>;
  
  // 实时语音会话（仅Realtime适配器）
  createRealtimeSession?(config: RealtimeSessionConfig): Promise<IRealtimeSession>;
}
```

### 3.3 适配器工厂

```typescript
export class AdapterFactory {
  private adapterCache = new Map<string, IModelAdapter>();
  
  createAdapter(config: AdapterConfig, options?: AdapterFactoryOptions): IModelAdapter {
    const cacheKey = this.getCacheKey(config);
    if (this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey)!;
    }
    
    const adapterType = this.determineAdapterType(config, options);
    let adapter: IModelAdapter;
    
    switch (adapterType) {
      case "qwen-omni":
        adapter = new QwenOmniAdapter(config);
        break;
      case "realtime":
        adapter = new RealtimeSpeechAdapter(config);
        break;
      case "speech-recognition":
        adapter = new SpeechRecognitionAdapter(config);
        break;
      case "openai-compatible":
      default:
        adapter = new OpenAICompatibleAdapter(config);
        break;
    }
    
    this.adapterCache.set(cacheKey, adapter);
    return adapter;
  }
  
  private determineAdapterType(config: AdapterConfig): string {
    const modelName = config.modelName.toLowerCase();
    const provider = config.provider?.toLowerCase() || "";
    
    // 检测实时语音模型
    if (modelName.includes("realtime") || provider.includes("realtime")) {
      return "realtime";
    }
    
    // 检测语音识别模型
    if (modelName.includes("whisper") || 
        modelName.includes("sensevoice") ||
        modelName.includes("paraformer")) {
      return "speech-recognition";
    }
    
    // 检测 Qwen-Omni
    if (modelName.includes("qwen") && modelName.includes("omni")) {
      return "qwen-omni";
    }
    
    return "openai-compatible";
  }
}
```

## 4. IPC 通信协议

### 4.1 消息类型

```typescript
// 请求类型
type LLMRequestType = 
  | "llm:chat"           // 普通对话
  | "llm:stream-chat"    // 流式对话
  | "llm:multimodal"     // 多模态对话
  | "llm:transcribe"     // 语音识别
  | "llm:synthesize"     // 语音合成
  | "llm:embed"          // 嵌入生成
  | "llm:route";         // 路由查询

// 响应类型
type LLMResponseType =
  | "llm:response"       // 完整响应
  | "llm:stream-chunk"   // 流式块
  | "llm:stream-end"     // 流式结束
  | "llm:error";         // 错误响应
```

### 4.2 通信流程

```
Worker (LLMClient)                    Master (LLMServiceManager)
       │                                       │
       │  1. llm-request (llm:transcribe)     │
       │ ─────────────────────────────────────>│
       │                                       │
       │  2. 路由到语音识别实例                 │
       │  3. 调用适配器 transcribeAudio        │
       │                                       │
       │  4. llm:response                      │
       │ <─────────────────────────────────────│
```

## 5. 多模型协作流程

### 5.1 语音交互协作

```
用户语音输入
    │
    ▼
┌─────────────────┐
│ 语音识别 (STT)   │◄── 专用 STT 模型实例 (如 Whisper)
│                │    • speechRecognitionInstanceId
└───────┬─────────┘
        │ 文本
        ▼
┌─────────────────┐
│   主模型对话    │◄── 主对话模型实例 (如 DeepSeek)
│                │    • mainModelInstanceId
└───────┬─────────┘
        │ 回复文本
        ▼
┌─────────────────┐
│ 语音合成 (TTS)   │◄── 专用 TTS 模型实例
│                │    • speechSynthesisInstanceId
└───────┬─────────┘
        │ 音频
        ▼
    用户
```

### 5.2 配置示例

```typescript
const agentConfig: AgentConfig = {
  model: {
    instanceId: "deepseek-main",  // 主对话模型
  },
  multiModelCollaboration: {
    enabled: true,
    speechRecognitionInstanceId: "whisper-stt",    // 语音识别
    mainModelInstanceId: "deepseek-main",          // 主对话模型
    speechSynthesisInstanceId: "cosyvoice-tts",    // 语音合成
  }
};
```

## 6. 关键流程时序图

### 6.1 文本生成流程

```
AgentRuntime              LLMService/LLMClient         UnifiedLLMService
    │                              │                            │
    │  generate()                  │                            │
    │─────────────────────────────>│                            │
    │                              │  generateText()            │
    │                              │───────────────────────────>│
    │                              │                            │
    │                              │                            │  route()
    │                              │                            │  ────────>
    │                              │                            │  acquire()
    │                              │                            │  ────────>
    │                              │                            │  chatCompletion()
    │                              │                            │  ────────────────>
    │                              │                            │
    │                              │<───────────────────────────│
    │<─────────────────────────────│                            │
    │                              │                            │
```

### 6.2 语音识别流程

```
AgentRuntime              LLMClient                   LLMServiceManager
    │                          │                              │
    │  transcribeAudio()       │                              │
    │─────────────────────────>│                              │
    │                          │  IPC: llm:transcribe         │
    │                          │─────────────────────────────>│
    │                          │                              │
    │                          │                              │  route("speechRecognition")
    │                          │                              │  ─────────────────────────>
    │                          │                              │  adapter.transcribeAudio()
    │                          │                              │  ────────────────────────>
    │                          │                              │
    │                          │<─────────────────────────────│
    │<─────────────────────────│                              │
    │                          │                              │
```

## 7. 配置参考

### 7.1 数据库表结构

**t_llm_providers** - 提供商配置
| 字段 | 说明 |
|------|------|
| sid | 提供商ID |
| name | 提供商名称 |
| api_base_url | API基础URL |
| api_key | API密钥模板 |

**t_llm_configs** - 模型配置
| 字段 | 说明 |
|------|------|
| sid | 配置ID |
| model_name | 模型名称 |
| model_ability | 能力列表(JSON) |
| parameters | 默认参数(JSON) |
| context_size | 上下文长度 |

**t_llm_instances** - 实例配置
| 字段 | 说明 |
|------|------|
| sid | 实例ID |
| name | 实例名称 |
| provider_name | 提供商 |
| config_id | 关联配置 |
| api_key | API密钥(加密) |
| weight | 优先级权重 |
| status | 状态 |

## 8. 性能优化

### 8.1 连接池配置

```typescript
const connectionPoolConfig = {
  maxConnectionsPerInstance: 20,  // 每个实例最大连接数
  minConnectionsPerInstance: 5,   // 每个实例最小连接数
  connectionTimeout: 30000,       // 连接超时
  idleTimeout: 600000,           // 空闲超时
};
```

### 8.2 请求队列配置

```typescript
const requestQueueConfig = {
  maxConcurrent: 100,   // 最大并发数
  maxQueueSize: 1000,   // 最大队列长度
  timeout: 60000,       // 请求超时
};
```

### 8.3 断路器配置

```typescript
const circuitBreakerConfig = {
  failureThreshold: 5,      // 失败阈值
  resetTimeout: 30000,      // 重置超时
  successThreshold: 3,      // 成功阈值
};
```
