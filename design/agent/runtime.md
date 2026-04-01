# Agent 运行时层设计

## 1. 概述

Agent 运行时层采用**三层架构**设计，实现职责分离和任务编排能力：

- **Agent 层**：用户交互、意图识别、结果汇总
- **Orchestrator 层**：任务编排、ReAct 循环、Worktask 管理
- **Executor 层**：具体任务执行

> **架构原则**：
> - 1 Worker = 1 AgentManager = 1 AgentRuntime
> - Agent 与 Contact 的对话构成会话（对应 OpenClaw 的 session）
> - 运行时使用 Worktask 进行任务隔离

## 2. 三层架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Agent 层                                    │
│                    【运行在独立 Worker 进程中】                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  职责：用户交互、意图识别、结果汇总                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ContextManager│  │ LLMService  │  │HeartbeatSched│             │   │
│  │  │ (上下文管理)│  │  (LLM调用)  │  │  (心跳调度)  │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  │                                                                 │   │
│  │  Context 内容：                                                  │   │
│  │  ├── 三重画像（完整）                                            │   │
│  │  ├── 记忆系统                                                    │   │
│  │  └── Skill 第一级披露（metadata、worktask）                      │   │
│  │                                                                 │   │
│  │  特点：                                                          │   │
│  │  ├── 不支持 ReAct（无自循环）                                    │   │
│  │  ├── 简单任务直接调用 Executor                                   │   │
│  │  ├── 复杂任务启动 Orchestrator                                   │   │
│  │  └── 非阻塞运行                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                    IPC 通信（启动 Orchestrator）                         │
│                              ▼                                          │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Orchestrator 层                                 │
│                    【运行在独立进程空间】                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  职责：任务编排、ReAct 循环、Worktask 管理                        │   │
│  │                                                                 │   │
│  │  Context 内容（最小上下文原则）：                                 │   │
│  │  ├── 三重画像（按需传入）                                        │   │
│  │  ├── 记忆片段（按需传入）                                        │   │
│  │  └── Skill 第二级披露（body）                                    │   │
│  │                                                                 │   │
│  │  核心能力：                                                      │   │
│  │  ├── 任务目标拆解                                                │   │
│  │  ├── 创建临时 Worktask                                           │   │
│  │  ├── 制定串行/并行任务计划                                       │   │
│  │  ├── ReAct 循环（Thought → Action → Observation）               │   │
│  │  ├── 启动 Executor 执行                                          │   │
│  │  ├── 跟踪执行状态、处理超时、任务重排                             │   │
│  │  └── IPC 通信向 Agent 汇报进度                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                    IPC 通信（启动 Executor）                             │
│                              ▼                                          │
┌─────────────────────────────────────────────────────────────────────────┐
│                            Executor 层                                   │
│                    【运行在独立进程空间】                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  职责：具体任务执行                                               │   │
│  │                                                                 │   │
│  │  特点：                                                          │   │
│  │  ├── 明确的任务目标                                               │   │
│  │  ├── 独立进程空间                                                 │   │
│  │  ├── IPC 通信向 Orchestrator 汇报进度                            │   │
│  │  └── 执行完成后返回结果                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. 会话与任务隔离

### 3.1 会话隔离约定

```
OpenClaw                              Cradle
──────────────────────────────────────────────────────
session (会话隔离)              →    Agent + Contact 对话
sessionKey                      →    agentId + contactId
session 记忆                    →    Agent-Contact 关系记忆

架构级约定，不需要额外维护
```

### 3.2 Worktask 运行时隔离

```
┌─────────────────────────────────────────────────────────────────┐
│                      Worktask 隔离模型                           │
│                                                                 │
│  Agent (Worker 进程)                                            │
│  └── Contact 对话 (会话)                                        │
│       └── Worktask 1 (Orchestrator 进程)                        │
│            ├── Executor 1 (进程)                                │
│            ├── Executor 2 (进程)                                │
│            └── Executor 3 (进程)                                │
│       └── Worktask 2 (Orchestrator 进程)                        │
│            └── Executor 4 (进程)                                │
│                                                                 │
│  隔离层级：                                                      │
│  1. 会话级：Agent + Contact (对应 OpenClaw session)             │
│  2. 任务级：Worktask (由 Orchestrator 维护)                     │
│  3. 执行级：Executor (独立进程)                                  │
└─────────────────────────────────────────────────────────────────┘
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

## 10. Skill 系统集成

### 10.1 Skill 加载流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Skill 加载（Agent 层）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  多源加载（优先级从低到高）：                                      │
│  1. bundled skills（内置）                                       │
│  2. ~/.cradle/skills（managed）                                  │
│  3. <workspace>/skills（workspace，最高优先级）                   │
│                                                                 │
│  过滤条件：                                                       │
│  - OS 兼容性 (metadata.openclaw.os)                              │
│  - 二进制依赖 (metadata.openclaw.requires.bins)                  │
│  - 环境变量 (metadata.openclaw.requires.env)                     │
│                                                                 │
│  输出：SkillEntry[]                                              │
│  { name, description, location, filePath, metadata }            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Skill Prompt 构建

```typescript
function buildSkillsPrompt(entries: SkillEntry[]): string {
  const lines = [
    "<available_skills>",
  ];
  
  for (const entry of entries) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(entry.name)}</name>`);
    lines.push(`    <description>${escapeXml(entry.description)}</description>`);
    lines.push(`    <location>${compactPath(entry.filePath)}</location>`);
    lines.push("  </skill>");
  }
  
  lines.push("</available_skills>");
  return lines.join("\n");
}
```

### 10.3 System Prompt 中的 Skill Section

```markdown
## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with `read`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.
Constraints: never read more than one skill up front; only read after selecting.

<available_skills>
  <skill>
    <name>pptx</name>
    <description>Create and edit PowerPoint presentations</description>
    <location>~/.cradle/skills/pptx/SKILL.md</location>
  </skill>
</available_skills>
```

### 10.4 各层 Skill 职责

| 层级 | Skill 相关职责 |
|------|---------------|
| **Agent** | 加载 Skill 列表、注入 System Prompt、不执行具体任务 |
| **Orchestrator** | 任务编排时考虑 Skill 可用性、传递 Skill 信息给 Executor |
| **Executor** | LLM 自主决定是否使用 Skill、通过 read 工具读取 SKILL.md、理解后执行 |

### 10.5 执行流程

```
用户请求: "帮我创建一个PPT"
    │
    ▼
Agent 层：注入 Skill 列表到 System Prompt
    │
    ▼
Orchestrator 层：创建 Worktask，启动 Executor
    │
    ▼
Executor 层：
    │
    ├── LLM 看到 <available_skills> 列表
    │
    ├── LLM 判断: pptx skill 适用
    │
    ├── LLM 调用 read 工具: read("~/.cradle/skills/pptx/SKILL.md")
    │
    ├── LLM 读取完整 Skill 内容（知识 + 示例）
    │
    └── LLM 理解后自主执行（可能调用多个工具）
```

## 11. 关键流程时序图

### 11.1 消息处理完整流程

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
