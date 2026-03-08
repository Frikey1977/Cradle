# Agent 实例化与运行时架构设计

## 1. 架构概述

### 1.1 核心设计原则

**1 Worker = 1 AgentManager = 1 Agent**

每个 Agent 运行在独立的 Worker 进程中，实现完全隔离，避免资源竞争和协调复杂性。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Master 进程                              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ CradleChan  │  │DingTalkChan │  │  OtherChan  │             │
│  │  (身份识别)  │  │  (身份识别)  │  │  (身份识别)  │             │
│  │  (路由决策)  │  │  (路由决策)  │  │  (路由决策)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
│                    根据 agentId 路由                            │
│                    找到对应的 Worker                            │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│  Worker-1 (Agent-A)    Worker-2 (Agent-B)    Worker-3 (Agent-C) │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐   │
│  │AgentManager │       │AgentManager │       │AgentManager │   │
│  │  (单 Agent) │       │  (单 Agent) │       │  (单 Agent) │   │
│  │             │       │             │       │             │   │
│  │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │   │
│  │ │AgentRun │ │       │ │AgentRun │ │       │ │AgentRun │ │   │
│  │ │time (A) │ │       │ │time (B) │ │       │ │time (C) │ │   │
│  │ │         │ │       │ │         │ │       │ │         │ │   │
│  │ │- 心跳   │ │       │ │- 心跳   │ │       │ │- 心跳   │ │   │
│  │ │- Context│ │       │ │- Context│ │       │ │- Context│ │   │
│  │ │- LLM    │ │       │ │- LLM    │ │       │ │- LLM    │ │   │
│  │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │   │
│  └─────────────┘       └─────────────┘       └─────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 架构优势

| 优势 | 说明 |
|------|------|
| **完全隔离** | 每个 Agent 独立进程，互不影响 |
| **无协调问题** | 无需分布式锁或 Leader 选举 |
| **水平扩展** | 新增 Agent 只需新增 Worker |
| **资源独立** | 每个 Agent 有自己的内存和 CPU 配额 |
| **故障隔离** | 一个 Agent 崩溃不影响其他 Agent |
| **心跳简化** | 每个 Worker 只管理一个心跳，无重复问题 |

## 2. 进程与对象关系

### 2.1 进程层次

| 组件 | 类型 | 数量 | 职责 |
|------|------|------|------|
| **Master** | 进程 | 1 | 端口监听、Channel 插件管理、消息路由 |
| **Worker** | 进程 | N (每个 Agent 一个) | 业务处理、Agent 运行时、心跳执行 |

### 2.2 对象层次（每个 Worker 内）

| 组件 | 类型 | 数量 | 职责 |
|------|------|------|------|
| **AgentManager** | 对象 | 1 | Worker 入口，管理单个 Agent |
| **AgentRuntime** | 对象 | 1 | Agent 核心运行时 |
| **ContextModule** | 对象 | 1 | 上下文构建（五重画像、记忆等） |
| **HeartbeatScheduler** | 对象 | 1 | 心跳调度（仅管理一个 Agent） |
| **LLMService** | 对象 | 1 | LLM 调用服务 |

## 3. 消息处理流程

### 3.1 完整流程

```
用户发送消息
    ↓
Channel Plugin (Master 进程)
    - WebSocket 接收
    - 身份识别 (token → employee_id → contact_id)
    - 路由决策 (查询 t_relationship 确定目标 Agent)
    ↓ IPC
Master 根据 agentId 找到对应的 Worker
    ↓
Worker 接收消息
    ↓
AgentManager.handleMessage()
    ↓
AgentRuntime.handleMessage()
    ├─ 1. ContextModule.buildContext() → 五重画像、历史、记忆、技能
    ├─ 2. LLMService.generate() → 调用 LLM Instance
    └─ 3. 返回响应
    ↓
Worker 发送响应给 Master
    ↓
Channel Plugin 投递给用户
```

### 3.2 Channel Plugin 职责

Channel Plugin 在 **Master 进程** 中运行：

1. **连接管理**：WebSocket/HTTP 连接维护
2. **身份识别**：
   - 解析 token 获取 employee_id
   - 查询 t_employees → t_contacts 获取 contact_id
3. **路由决策**：
   - 查询 t_relationship 获取 Contact 绑定的 Agent
   - 确定目标 agentId
4. **消息封装**：构建 InboundMessageContext
5. **消息投递**：通过 IPC 发送给对应 Worker

### 3.3 Worker 职责

Worker 作为 **独立进程** 运行：

1. **Agent 管理**：加载并管理单个 Agent
2. **消息处理**：接收 Master 消息，交给 Agent 处理
3. **心跳执行**：独立执行 Agent 心跳
4. **响应返回**：将 Agent 响应发回 Master

### 3.4 AgentRuntime 职责

AgentRuntime 是 **核心对象**：

1. **上下文构建**：调用 ContextModule 获取五重画像、记忆等
2. **LLM 调用**：调用 LLMService 进行推理
3. **心跳处理**：执行心跳任务，检查事项
4. **响应生成**：处理 LLM 输出，生成最终响应

## 4. Master 路由设计

### 4.1 Agent-Worker 映射

```typescript
interface WorkerInfo {
  workerId: string;
  process: ChildProcess;
  agentId: string;
}

class Master {
  private agentWorkerMap = new Map<string, WorkerInfo>();
  
  // Agent 注册时创建专属 Worker
  async registerAgent(agentId: string): Promise<void> {
    const worker = fork('./worker-entry.js', [], {
      env: { AGENT_ID: agentId }
    });
    
    this.agentWorkerMap.set(agentId, {
      workerId: `worker-${agentId}`,
      process: worker,
      agentId,
    });
  }
  
  // 根据 agentId 路由消息
  async routeMessage(message: AgentMessage): Promise<void> {
    const workerInfo = this.agentWorkerMap.get(message.agentId);
    if (!workerInfo) {
      throw new Error(`Agent ${message.agentId} not found`);
    }
    
    workerInfo.process.send({
      type: 'inbound',
      payload: message,
    });
  }
}
```

### 4.2 动态扩缩容

```typescript
// 新增 Agent
async addAgent(agentId: string): Promise<void> {
  await this.registerAgent(agentId);
  console.log(`Agent ${agentId} registered with dedicated worker`);
}

// 移除 Agent
async removeAgent(agentId: string): Promise<void> {
  const workerInfo = this.agentWorkerMap.get(agentId);
  if (workerInfo) {
    workerInfo.process.kill();
    this.agentWorkerMap.delete(agentId);
    console.log(`Agent ${agentId} removed`);
  }
}
```

## 5. Worker 设计

### 5.1 Worker 初始化

```typescript
class Worker {
  private agentId: string;
  private agent: AgentRuntime;
  
  constructor() {
    // 从环境变量获取 Agent ID
    this.agentId = process.env.AGENT_ID!;
    if (!this.agentId) {
      throw new Error('AGENT_ID environment variable is required');
    }
  }
  
  async initialize(): Promise<void> {
    console.log(`[Worker] Initializing for Agent ${this.agentId}`);
    
    // 创建 AgentRuntime
    this.agent = new AgentRuntime(this.agentId);
    await this.agent.initialize();
    
    // 启动心跳
    this.agent.startHeartbeat();
    
    // 设置 IPC 监听
    process.on('message', (msg) => this.handleMasterMessage(msg));
    
    // 通知 Master 就绪
    process.send!({ type: 'worker-ready', agentId: this.agentId });
  }
  
  // 处理 Master 消息
  private async handleMasterMessage(message: IPCMessage): Promise<void> {
    if (message.type === 'inbound') {
      const response = await this.agent.handleMessage(message.payload);
      
      process.send!({
        type: 'outbound',
        payload: response,
      });
    }
  }
}
```

### 5.2 Worker 生命周期

```
启动
  ↓
读取 AGENT_ID 环境变量
  ↓
创建 AgentRuntime
  ↓
加载 Agent 配置（t_agents 表）
  ↓
初始化 ContextModule
  ↓
启动心跳调度
  ↓
通知 Master 就绪
  ↓
等待消息...
```

## 6. AgentRuntime 设计

### 6.1 核心结构

```typescript
class AgentRuntime {
  private id: string;
  private config: AgentConfig;
  private heartbeatTimer?: NodeJS.Timeout;
  private contextModule: ContextModule;
  private llmService: LLMService;
  
  // 运行时状态（内存中，不持久化）
  private runtime: {
    status: 'idle' | 'running' | 'error' | 'paused';
    lastHeartbeat: Date;
    nextHeartbeat: Date;
    consecutiveErrors: number;
  };
  
  constructor(agentId: string) {
    this.id = agentId;
    this.contextModule = new ContextModule(agentId);
    this.llmService = new LLMService();
    this.runtime = {
      status: 'idle',
      lastHeartbeat: new Date(),
      nextHeartbeat: new Date(),
      consecutiveErrors: 0,
    };
  }
}
```

### 6.2 消息处理

```typescript
async handleMessage(message: AgentMessage): Promise<AgentResponse> {
  this.runtime.status = 'running';
  
  try {
    // 1. 构建上下文（调用 ContextModule）
    const context = await this.contextModule.build({
      agentId: this.id,
      contactId: message.contactId,
      content: message.content,
      conversationId: message.conversationId,
      isHeartbeat: message.isHeartbeat || false,
    });
    
    // 2. 调用 LLM
    const llmResponse = await this.llmService.generate({
      model: context.modelConfig,
      messages: this.buildMessages(context, message),
      tools: context.availableTools,
    });
    
    // 3. 处理响应
    const response = this.processResponse(llmResponse, message);
    
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

### 6.3 心跳处理

```typescript
startHeartbeat(): void {
  if (!this.config.heartbeat?.enabled) {
    console.log(`[Agent ${this.id}] Heartbeat disabled`);
    return;
  }
  
  this.scheduleNextHeartbeat();
}

private scheduleNextHeartbeat(): void {
  const intervalMs = this.parseInterval(this.config.heartbeat.interval);
  const nextDue = new Date(Date.now() + intervalMs);
  this.runtime.nextHeartbeat = nextDue;
  
  this.heartbeatTimer = setTimeout(() => {
    this.executeHeartbeat();
  }, intervalMs);
}

private async executeHeartbeat(): Promise<void> {
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
  
  // 执行心跳
  const heartbeatMessage: AgentMessage = {
    agentId: this.id,
    contactId: 'system',
    content: this.config.heartbeat.prompt || '检查当前事项',
    conversationId: `heartbeat-${Date.now()}`,
    isHeartbeat: true,
    timestamp: Date.now(),
  };
  
  try {
    const response = await this.handleMessage(heartbeatMessage);
    
    // HEARTBEAT_OK 抑制
    if (!this.shouldSuppress(response)) {
      await this.deliverResponse(response);
    }
    
    this.runtime.lastHeartbeat = new Date();
    
  } catch (error) {
    console.error(`[Agent ${this.id}] Heartbeat failed:`, error);
  }
  
  this.scheduleNextHeartbeat();
}
```

## 7. ContextModule 设计

### 7.1 职责

ContextModule 由 **AgentRuntime 调用**，负责构建完整的对话上下文：

1. **五重画像**：组织、岗位、个人、关系、场景
2. **对话历史**：从记忆服务获取
3. **相关记忆**：语义检索
4. **可用技能**：Agent 绑定的技能列表
5. **系统提示词**：整合以上信息

### 7.2 接口

```typescript
interface ContextModule {
  build(params: ContextParams): Promise<EnhancedContext>;
}

interface ContextParams {
  agentId: string;
  contactId: string;
  content: string;
  conversationId?: string;
  isHeartbeat: boolean;
}

interface EnhancedContext {
  systemPrompt: string;
  modelConfig: ModelConfig;
  conversationHistory: Message[];
  memories: Memory[];
  availableTools: Tool[];
  metadata: ContextMetadata;
}
```

## 8. 部署配置

### 8.1 进程管理（PM2）

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'gateway-master',
      script: './dist/gateway/master.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    // 每个 Agent 一个 Worker
    {
      name: 'agent-assistant-zhang',
      script: './dist/gateway/worker.js',
      env: {
        AGENT_ID: 'agent-assistant-zhang',
        NODE_ENV: 'production',
      },
      instances: 1,
      max_memory_restart: '1G',
    },
    {
      name: 'agent-code-helper',
      script: './dist/gateway/worker.js',
      env: {
        AGENT_ID: 'agent-code-helper',
        NODE_ENV: 'production',
      },
      instances: 1,
      max_memory_restart: '1G',
    },
  ],
};
```

### 8.2 动态管理

```bash
# 新增 Agent
pm2 start ecosystem.config.js --name agent-new-agent --env AGENT_ID=agent-new-agent

# 停止 Agent
pm2 stop agent-assistant-zhang

# 重启 Agent
pm2 restart agent-assistant-zhang
```

## 9. 监控与日志

### 9.1 日志规范

```typescript
// Worker 日志
console.log(`[Worker:${agentId}] Message received`);
console.log(`[Agent:${agentId}] Heartbeat executed`);
console.log(`[Agent:${agentId}] LLM call started`);

// 错误日志
console.error(`[Agent:${agentId}] Error: ${error.message}`);
```

### 9.2 监控指标

| 指标 | 说明 |
|------|------|
| `agent_messages_total` | 消息处理总数 |
| `agent_message_duration` | 消息处理耗时 |
| `agent_heartbeats_total` | 心跳执行次数 |
| `agent_llm_calls_total` | LLM 调用次数 |
| `agent_memory_usage` | 内存使用量 |

## 10. 故障处理

### 10.1 Worker 崩溃

```
Worker 崩溃
  ↓
Master 检测到断开
  ↓
自动重启 Worker
  ↓
Worker 重新加载 Agent
  ↓
恢复服务
```

### 10.2 Agent 错误

```typescript
if (this.runtime.consecutiveErrors > 5) {
  // 连续错误超过阈值，暂停 Agent
  this.runtime.status = 'paused';
  this.stopHeartbeat();
  
  // 通知管理员
  await this.alertAdmin(`Agent ${this.id} paused due to consecutive errors`);
}
```

## 11. 相关文档

- [Agent 心跳设计](./heartbeat.md)
- [Agent 运行时层](./runtime.md)
- [五重画像记忆引擎](../memory/five_profiles.md)
- [Gateway 架构](../gateway/ARCHITECTURE.md)
