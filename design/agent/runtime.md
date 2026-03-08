# Agent 运行时层设计

## 1. 概述

Agent 运行时层是整个系统的**智能核心**，运行在独立的 Worker 进程中，由**多维度画像系统**驱动，整合用户、公司、部门、岗位、Agent自身及双向关系等多维度信息，赋予每个 Agent 独特的企业身份、岗位能力、个性风格和用户理解能力。

> **架构原则**：1 Worker = 1 AgentManager = 1 AgentRuntime

## 2. 核心定位

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Agent 运行时层                                 │
│                    【运行在独立 Worker 进程中】                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      AgentRuntime (单例)                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ContextManager│  │ LLMService  │  │HeartbeatSched│             │   │
│  │  │ (上下文管理)│  │  (LLM调用)  │  │  (心跳调度)  │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              多维度画像 + 四层记忆架构                    │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │   │
│  │  │  │用户画像 │ │公司画像 │ │部门画像 │ │岗位画像 │       │   │   │
│  │  │  ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤       │   │   │
│  │  │  │Agent画像│ │关系画像 │ │场景画像 │ │         │       │   │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        核心能力                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │  ReAct自循环  │  │  主-子Agent  │  │  上下文管理   │          │   │
│  │  │ (Auto-loop)  │  │ (Spawn-loop)│  │  (Context)   │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. 进程与对象关系

### 3.1 Worker 进程内结构

```
Worker 进程 (独立进程)
    ↓
AgentManager (入口对象)
    ↓
AgentRuntime (核心对象)
    ├── ContextManager (上下文管理：构建、压缩、记忆、Todo管理)
    ├── LLMService/LLMClient (LLM 调用，通过 IPC 与 Master 通信)
    ├── HeartbeatScheduler (心跳调度)
    └── RuntimeState (运行时状态)
```

### 3.2 对象职责

| 对象 | 类型 | 职责 |
|------|------|------|
| **AgentManager** | 单例 | Worker 入口，管理单个 Agent 生命周期 |
| **AgentRuntime** | 单例 | Agent 核心运行时，处理消息和心跳 |
| **ContextManager** | 成员 | 上下文管理中心：构建、压缩、记忆管理、ReAct Todo管理、子Agent任务协调 |
| **LLMService** | 成员(Master) | 直接调用 UnifiedLLMService 进行推理 |
| **LLMClient** | 成员(Worker) | 通过 IPC 与 Master 的 LLMServiceManager 通信 |
| **HeartbeatScheduler** | 成员 | 管理 Agent 心跳调度 |

## 4. AgentRuntime 核心设计

### 4.1 类结构

```typescript
class AgentRuntime {
  // 基础信息（来自 t_agents 表）
  readonly id: string;
  readonly name: string;
  private config: AgentConfig;
  private profile: AgentProfile;
  private heartbeatConfig?: HeartbeatConfig;
  
  // 运行时状态（内存中，不持久化）
  private runtime: RuntimeState;
  
  // 依赖服务
  private contextModule: ContextManager;
  private llmService: LLMServiceInterface;  // 通过接口解耦，支持 LLMService 或 LLMClient
  private heartbeatScheduler?: HeartbeatScheduler;
  
  // 缓存
  private cache: {
    skills?: any[];
    tools?: any[];
  } = {};
  
  constructor(
    data: AgentData,
    contextModule: ContextManager,
    llmService: LLMServiceInterface,
  ) {
    this.id = data.sid;
    this.name = data.name;
    this.config = data.config;
    this.profile = data.profile;
    this.heartbeatConfig = data.heartbeat;
    this.contextModule = contextModule;
    this.llmService = llmService;
    this.runtime = {
      status: 'idle',
      lastHeartbeat: new Date(),
      nextHeartbeat: new Date(),
      consecutiveErrors: 0,
    };
  }
}
```

### 4.2 生命周期

```
初始化 (initialize)
    ↓
加载配置 (t_agents 表)
    ↓
初始化 ContextManager
    ↓
启动心跳 (startHeartbeat)
    ↓
运行中 (handleMessage / executeHeartbeat)
    ↓
停止 (stop)
```

## 5. 消息处理流程

### 5.1 普通消息处理

```typescript
async handleMessage(message: AgentMessage): Promise<AgentResponse> {
  const isHeartbeat = message.isHeartbeat || false;
  
  // 1. 更新状态
  this.runtime.status = 'running';
  
  try {
    // 2. 初始化记忆管理器（如果不是心跳消息）
    if (!isHeartbeat && message.contactId) {
      await this.contextModule.initializeMemoryManager(
        message.contactId, 
        message.conversationId
      );
    }
    
    // 3. 构建上下文（调用 ContextManager）
    const context = await this.contextModule.build({
      agentId: this.id,
      contactId: message.contactId,
      content: message.content,
      conversationId: message.conversationId,
      isHeartbeat: isHeartbeat,
      metadata: message.metadata,
    });
    
    // 4. 覆盖 modelConfig 为 Agent 配置中的模型配置
    context.modelConfig = {
      ...context.modelConfig,
      ...this.config.model,
    };
    
    // 5. 处理多模态消息（音频/图片）
    let llmResponse: LLMResponse;
    
    if (message.audio && !message.images) {
      // 纯语音输入 - 多模型协作模式
      llmResponse = await this.handleAudioInput(message, context);
    } else if (message.images) {
      // 图片输入
      llmResponse = await this.handleImageInput(message, context);
    } else {
      // 纯文本输入
      llmResponse = await this.llmService.generate({
        model: context.modelConfig,
        messages: context.messages,
        tools: context.availableTools,
      });
    }
    
    // 6. 处理响应
    const response = this.processResponse(llmResponse);
    
    // 7. 更新状态
    this.runtime.status = 'idle';
    this.runtime.consecutiveErrors = 0;
    
    return response;
    
  } catch (error) {
    this.runtime.status = 'error';
    this.runtime.consecutiveErrors++;
    throw error;
  }
}
```

### 5.2 多模型协作语音处理

```typescript
private async handleAudioInput(
  message: AgentMessage, 
  context: EnhancedContext
): Promise<LLMResponse> {
  const useMultiModelCollaboration = this.config.multiModelCollaboration?.enabled ?? false;
  
  if (useMultiModelCollaboration && this.llmService.transcribeAudio) {
    // ===== 多模型协作模式 =====
    // 1. 语音识别 (STT)
    const transcription = await this.llmService.transcribeAudio(
      message.audio.data,
      {
        format: message.audio.format,
        instanceId: this.config.multiModelCollaboration?.speechRecognitionInstanceId,
      }
    );
    
    // 2. 更新消息内容为识别结果
    const textMessage = {
      ...message,
      content: transcription.text,
      audio: undefined,
    };
    
    // 3. 重新构建上下文
    const newContext = await this.contextModule.build({
      agentId: this.id,
      contactId: message.contactId,
      content: transcription.text,
      conversationId: message.conversationId,
    });
    
    // 4. 主模型对话
    return this.llmService.generate({
      model: newContext.modelConfig,
      messages: newContext.messages,
    });
  } else {
    // ===== 单模型端到端模式 =====
    return this.llmService.multimodalChat(message.content, {
      audio: [message.audio.data],
      audioFormat: message.audio.format,
    });
  }
}
```

### 5.3 心跳消息处理

```typescript
async executeHeartbeat(): Promise<void> {
  // 检查活跃时间窗
  if (!this.isWithinActiveHours()) {
    this.scheduleNextHeartbeat();
    return;
  }
  
  // 检查是否正在处理消息
  if (this.runtime.status === 'running') {
    console.log(`[Agent ${this.id}] Busy, skipping heartbeat`);
    this.scheduleNextHeartbeat();
    return;
  }
  
  // 构建心跳消息
  const heartbeatMessage: AgentMessage = {
    agentId: this.id,
    contactId: 'system',
    content: this.heartbeatConfig?.prompt || '检查当前事项',
    isHeartbeat: true,
  };
  
  // 执行心跳
  const response = await this.handleMessage(heartbeatMessage);
  
  // HEARTBEAT_OK 抑制
  if (!this.shouldSuppress(response)) {
    await this.deliverResponse(response);
  }
  
  // 调度下一次心跳
  this.scheduleNextHeartbeat();
}
```

## 6. 上下文管理器 (ContextManager)

### 6.1 职责

ContextManager 是 Agent 的"大脑记忆中心"，负责：

1. **构建完整上下文**: 整合画像、历史、记忆、技能
2. **管理记忆系统**: 协调四层记忆架构
3. **生成系统提示词**: 将画像转换为 Markdown 格式

### 6.2 构建流程

```typescript
async build(params: ContextParams): Promise<EnhancedContext> {
  // 并行获取各类数据
  const [profiles, history, memories, skills, modelConfig] = await Promise.all([
    this.loadProfiles({
      agentId: params.agentId,
      contactId: params.contactId,
      conversationId: params.conversationId,
    }),
    this.getConversationHistory(params.conversationId, params.contactId),
    this.retrieveMemories(params.content),
    this.getAvailableSkills(),
    this.getModelConfig(),
  ]);
  
  // 构建系统提示词
  const systemPrompt = this.promptBuilder.build(profiles, memories);
  
  return {
    systemPrompt,
    messages: history,
    profiles,
    memories,
    availableSkills: skills,
    modelConfig,
    metadata: {
      builtAt: Date.now(),
      profileCount: Object.keys(profiles).length,
      memoryCount: memories.length,
    },
  };
}
```

### 6.3 多维度画像加载

```typescript
async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection> {
  const [contactProfile, agentProfile, relationshipProfile] = await Promise.all([
    this.profileLoader.loadContactProfile(params.contactId),
    this.profileLoader.loadAgentProfile(params.agentId),
    this.profileLoader.loadRelationshipProfile(params.agentId, params.contactId),
  ]);
  
  return {
    contact: contactProfile,
    agent: agentProfile,
    relationship: relationshipProfile,
  };
}
```

## 7. 记忆管理器 (MemoryManager)

### 7.1 四层记忆架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: 短期记忆层 (Short-term Memory)                 │
│  • 存储位置: t_relationship.short_term_memory (JSON)    │
│  • 默认保留: 最近 50 轮对话                              │
│  • 用途: 当前会话上下文                                  │
└─────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────┐
│  Layer 1: 对话日志层 (Conversation Logs)                 │
│  • 存储路径: workspace/{agent_id}/{contact_id}/         │
│  • 存储形式: 平格式文本文件                              │
│  • 用途: 审计追溯、数据恢复                              │
└─────────────────────────────────────────────────────────┘
```

### 7.2 记忆管理器初始化

```typescript
async initializeMemoryManager(
  contactId: string, 
  conversationId?: string,
  config?: Partial<MemoryManagerConfig>
): Promise<void> {
  this.memoryManager = new MemoryManager({
    agentId: this.agentId,
    contactId,
    conversationId,
    layers: {
      shortTermMaxEntries: 50,
      enableConversationLog: false,
      enableLongTermMemory: false,
      ...config?.layers,
    },
    ...config,
  });
  
  await this.memoryManager.initialize();
}
```

## 8. LLM 服务接口 (LLMServiceInterface)

### 8.1 接口定义

```typescript
interface LLMServiceInterface {
  // 文本生成
  generate(request: LLMRequest): Promise<LLMResponse & { routeInfo?: RouteInfo }>;
  streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown>;
  
  // 多模态对话
  multimodalChat(prompt: string, options: MultimodalOptions): Promise<LLMResponse & { routeInfo?: RouteInfo }>;
  streamMultimodalChat(prompt: string, options: MultimodalOptions): AsyncGenerator<string, void, unknown>;
  
  // 语音识别 (STT)
  transcribeAudio(audioData: string, options?: STTOptions): Promise<{ text: string; routeInfo?: RouteInfo }>;
  
  // 语音合成 (TTS)
  synthesizeSpeech(text: string, options?: TTSOptions): Promise<{ audio: string; format: string }>;
  
  // 嵌入生成
  generateEmbedding(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
  
  // 图像分析
  analyzeImage(imageBase64: string, prompt: string): Promise<string>;
  
  // 路由信息
  getRouteInfo(options: { capability: string; complexity?: 'low' | 'medium' | 'high' }): Promise<RouteInfo>;
  getInstanceInfo(instanceId: string): { modelName: string; provider: string } | undefined;
}
```

### 8.2 两种实现模式

| 模式 | 类 | 使用场景 | 通信方式 |
|------|-----|---------|---------|
| **Master 模式** | LLMService | Master 进程 | 直接调用 UnifiedLLMService |
| **Worker 模式** | LLMClient | Worker 进程 | 通过 IPC 与 Master 通信 |

## 9. 系统提示词构建器 (SystemPromptBuilder)

### 9.1 构建原则

1. 使用 Markdown 格式，大模型理解性好
2. 去掉 JSON 结构化标记，节省 token
3. 完整的 profile 内容，不只是 facts
4. 包含信任级别和关系特异性

### 9.2 提示词结构

```markdown
## 【你的自我认知】
灵魂底色：...
特质解读：...
表达风格：...
对话风格：...

## 【回复文本规范】
1. 使用 Markdown 标题
2. 使用 **加粗** 强调重要概念
3. 使用列表创建结构化内容
4. 保持段落分明

## 【礼仪规范】
1. 尊重员工隐私
2. 对直属上级称呼*总
3. 对高层领导称姓氏加职位

## 【身份设定】
### Agent 画像
...

### 用户画像
...

### 关系画像
...
```

## 10. 关键流程时序图

### 10.1 消息处理完整流程

```
Worker                    AgentRuntime              ContextManager           LLMClient/LLMService
  │                           │                          │                           │
  │  handleMessage()          │                          │                           │
  │──────────────────────────>│                          │                           │
  │                           │  initializeMemoryManager │                           │
  │                           │─────────────────────────>│                           │
  │                           │  build()                 │                           │
  │                           │─────────────────────────>│                           │
  │                           │                          │  loadProfiles()           │
  │                           │                          │  getConversationHistory() │
  │                           │                          │  retrieveMemories()       │
  │                           │<─────────────────────────│                           │
  │                           │  generate()              │                           │
  │                           │─────────────────────────────────────────────────────>│
  │                           │                          │                           │  IPC/direct call
  │                           │                          │                           │  to UnifiedLLMService
  │                           │<─────────────────────────────────────────────────────│
  │<──────────────────────────│  AgentResponse           │                           │
  │                           │                          │                           │
```

## 11. 错误处理与重试

### 11.1 运行时错误处理

```typescript
async handleMessage(message: AgentMessage): Promise<AgentResponse> {
  try {
    // ... 处理逻辑
  } catch (error) {
    this.runtime.status = 'error';
    this.runtime.consecutiveErrors++;
    
    // 连续错误超过阈值，暂停 Agent
    if (this.runtime.consecutiveErrors >= 5) {
      this.runtime.status = 'paused';
      await this.notifyAdmin(`Agent ${this.id} 连续错误超过阈值，已暂停`);
    }
    
    throw error;
  }
}
```

## 12. 配置参考

### 12.1 AgentConfig 完整结构

```typescript
interface AgentConfig {
  model: ModelConfig;
  runtime?: RuntimeConfig;
  multiModelCollaboration?: MultiModelCollaborationConfig;
}

interface ModelConfig {
  instanceId?: string;      // 优先使用，直接指定LLM实例
  provider?: string;        // 与model配合使用
  model?: string;           // 模型名称
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  parameters?: Record<string, any>;
}

interface RuntimeConfig {
  identity?: {
    emoji?: string;
    displayName?: string;
  };
  behavior?: {
    humanDelay?: {
      enabled: boolean;
      minMs?: number;
      maxMs?: number;
    };
  };
}
```
