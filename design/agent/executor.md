# Executor 设计

## 1. 概述

Executor 是三层架构的**执行层**，负责具体任务的执行。它由 Orchestrator 启动，拥有独立的进程空间，通过 IPC 通信向 Orchestrator 汇报执行进度。

**核心特点**：
- **具备 ReAct 循环**：Executor 需要根据任务目标自主决策执行步骤
- **独立进程空间**：与 Orchestrator 进程隔离
- **IPC 进度汇报**：向 Orchestrator 报告执行进度和结果

### 1.1 核心定位

```
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator 层                              │
│  └── 任务编排 → 启动 Executor                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (启动)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Executor 层                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  职责：具体任务执行（具备 ReAct 循环）                     │   │
│  │                                                         │   │
│  │  ReAct 循环：                                            │   │
│  │  Thought → Action (Tool/Skill) → Observation            │   │
│  │       ↑________________________↓                         │   │
│  │              (自循环直到完成)                             │   │
│  │                                                         │   │
│  │  输入：                                                  │   │
│  │  ├── 明确的任务目标                                      │   │
│  │  ├── Worktask ID（用于进度汇报）                         │   │
│  │  └── 执行参数                                            │   │
│  │                                                         │   │
│  │  输出：                                                  │   │
│  │  ├── 执行结果                                            │   │
│  │  └── 进度报告（IPC → Orchestrator）                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 ReAct 循环的必要性

```
为什么 Executor 需要 ReAct 循环？

场景示例：查询数据库并生成报告

Step 1: Thought - 需要先查询用户数据
        Action  - 调用 db_query 工具
        Obs     - 返回 100 条用户记录

Step 2: Thought - 数据量较大，需要筛选活跃用户
        Action  - 调用 data_filter 工具
        Obs     - 筛选出 20 条活跃用户

Step 3: Thought - 现在可以生成报告了
        Action  - 调用 report_generate 工具
        Obs     - 报告生成成功

Step 4: Thought - 任务完成
        Action  - 返回最终结果

结论：Executor 需要根据中间结果自主决策下一步
```

### 1.3 与 Orchestrator 的 ReAct 区别

| 维度 | Orchestrator ReAct | Executor ReAct |
|------|-------------------|----------------|
| **目标** | 任务编排、规划 | 任务执行、工具调用 |
| **Action** | 启动 Executor | 调用 Tool/Skill |
| **上下文** | 最小上下文 | 执行上下文 |
| **决策** | 任务分解、重排 | 执行步骤决策 |
| **粒度** | 任务级 | 步骤级 |

### 1.4 与 OpenClaw 的映射关系

| Cradle Executor | OpenClaw 对应 | 说明 |
|-----------------|---------------|------|
| Executor 进程 | SubAgent (depth = max) | 叶子执行节点 |
| ReAct 循环 | SubAgent ReAct | 完整循环能力 |
| Worktask ID | runId | 执行记录标识 |
| IPC 通信 | announce | 进度汇报 |
| 执行结果 | SubAgentResult | 返回结果 |

## 2. 核心职责

### 2.1 职责边界

```
┌─────────────────────────────────────────────────────────────────┐
│                      Executor 职责清单                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 负责：                                                       │
│  ├── 执行明确任务目标                                            │
│  ├── ReAct 循环（步骤级决策）                                    │
│  ├── 工具调用                                                    │
│  ├── Skill 命令执行                                              │
│  ├── IPC 通信向 Orchestrator 汇报进度                            │
│  └── 返回执行结果                                                │
│                                                                 │
│  ❌ 不负责：                                                     │
│  ├── 任务编排（Orchestrator 负责）                               │
│  ├── 任务分解（Orchestrator 负责）                               │
│  ├── 创建子任务（Executor 不能 spawn）                           │
│  ├── 用户交互（Agent 负责）                                      │
│  └── 上下文管理（Agent/Orchestrator 负责）                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 执行上下文

```typescript
interface ExecutorContext {
  executorId: string;
  worktaskId: string;
  orchestratorId: string;
  
  task: string;
  
  skills: {
    slug: string;
    commands: SkillCommand[];
  }[];
  
  tools: Tool[];
  
  constraints: {
    timeout?: number;
    maxIterations?: number;  // ReAct 最大迭代次数
    maxRetries?: number;
  };
}
```

## 3. 执行流程

### 3.1 执行生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                    Executor 生命周期                             │
│                                                                 │
│  Orchestrator 启动 Executor                                     │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ created │  Executor 创建                                     │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │  init   │  初始化（加载工具、Skill）                          │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ running │  执行任务                                          │
│  └────┬────┘                                                    │
│       │                                                         │
│       ├── 成功 ─────────────────┐                               │
│       │                         │                               │
│       │                         ▼                               │
│       │                  ┌───────────┐                          │
│       │                  │ completed │  完成                    │
│       │                  └───────────┘                          │
│       │                                                         │
│       └── 失败/超时 ────────────┐                               │
│                                │                                │
│                                ▼                                │
│                         ┌───────────┐                           │
│                         │  failed   │  失败                     │
│                         └───────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 执行流程详细

```
Orchestrator                    Executor                     Tools/Skills
     │                              │                              │
     │  spawn(executorParams)       │                              │
     │─────────────────────────────>│                              │
     │                              │  loadTools()                 │
     │                              │─────────────────────────────>│
     │                              │  loadSkills()                │
     │                              │─────────────────────────────>│
     │                              │                              │
     │  progress: started           │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │                              │  execute(task)               │
     │                              │─────────────────────────────>│
     │                              │                              │
     │  progress: step_1            │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │                              │  tool.call()                 │
     │                              │─────────────────────────────>│
     │                              │<─────────────────────────────│
     │                              │                              │
     │  progress: step_2            │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │                              │  ... more steps ...          │
     │                              │                              │
     │  result: completed           │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
```

## 4. Executor 实现

### 4.1 核心类

```typescript
class Executor extends EventEmitter {
  readonly id: string;
  readonly worktaskId: string;
  readonly task: string;
  
  private tools: Map<string, Tool>;
  private skills: Map<string, Skill>;
  private context: ExecutorContext;
  private ipc: ExecutorIPC;
  private llmService: LLMService;
  
  private state: ExecutorState = {
    status: 'created',
    iteration: 0,
    startTime: null,
    endTime: null,
    steps: [],
  };
  
  private maxIterations: number = 20;
  
  constructor(options: ExecutorOptions) {
    super();
    this.id = options.id;
    this.worktaskId = options.worktaskId;
    this.task = options.task;
    this.tools = new Map(options.tools.map(t => [t.name, t]));
    this.skills = new Map(options.skills.map(s => [s.slug, s]));
    this.context = options.context;
    this.ipc = new ExecutorIPC(options.orchestratorChannel);
    this.llmService = options.llmService;
    this.maxIterations = options.context.constraints.maxIterations || 20;
  }
  
  async execute(): Promise<ExecutorResult> {
    this.state.status = 'running';
    this.state.startTime = Date.now();
    
    this.ipc.reportProgress({
      executorId: this.id,
      worktaskId: this.worktaskId,
      status: 'running',
      message: '开始执行任务',
    });
    
    try {
      const result = await this.runWithTimeout();
      
      this.state.status = 'completed';
      this.state.endTime = Date.now();
      
      this.ipc.reportCompleted({
        executorId: this.id,
        worktaskId: this.worktaskId,
        result,
      });
      
      return result;
      
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      
      this.ipc.reportFailed({
        executorId: this.id,
        worktaskId: this.worktaskId,
        error: {
          code: error.code || 'EXECUTION_FAILED',
          message: error.message,
        },
      });
      
      throw error;
    }
  }
  
  private async runWithTimeout(): Promise<ExecutorResult> {
    const timeout = this.context.constraints.timeout || 300000;
    
    return Promise.race([
      this.runReActLoop(),
      this.createTimeoutPromise(timeout),
    ]);
  }
  
  private async runReActLoop(): Promise<ExecutorResult> {
    const messages: Message[] = this.buildInitialMessages();
    
    while (this.state.iteration < this.maxIterations) {
      this.state.iteration++;
      
      this.ipc.reportProgress({
        executorId: this.id,
        worktaskId: this.worktaskId,
        status: 'running',
        iteration: this.state.iteration,
        maxIterations: this.maxIterations,
        message: `ReAct 迭代 ${this.state.iteration}`,
      });
      
      const response = await this.llmService.generate({
        messages,
        tools: this.getToolDefinitions(),
      });
      
      const thought = this.extractThought(response);
      const action = this.parseAction(response);
      
      let observation: string;
      
      switch (action.type) {
        case 'tool_call':
          observation = await this.executeToolCall(action);
          break;
          
        case 'skill_call':
          observation = await this.executeSkillCall(action);
          break;
          
        case 'complete':
          return this.buildSuccessResult(action.content, this.state.steps);
          
        case 'error':
          observation = `执行错误: ${action.message}`;
          break;
          
        default:
          observation = `未知动作类型: ${action.type}`;
      }
      
      const step: ReActStep = {
        iteration: this.state.iteration,
        thought,
        action,
        observation,
        timestamp: Date.now(),
      };
      this.state.steps.push(step);
      
      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: `Observation: ${observation}` }
      );
      
      this.ipc.reportProgress({
        executorId: this.id,
        worktaskId: this.worktaskId,
        status: 'running',
        step: this.state.iteration,
        thought,
        action: action.type,
        observation,
      });
    }
    
    return this.buildMaxIterationsResult();
  }
  
  private async executeToolCall(action: ToolAction): Promise<string> {
    const tool = this.tools.get(action.toolName);
    if (!tool) {
      return `错误: 工具 '${action.toolName}' 不存在`;
    }
    
    try {
      const result = await tool.execute(action.parameters);
      return JSON.stringify(result);
    } catch (error) {
      return `错误: ${error.message}`;
    }
  }
  
  private async executeSkillCall(action: SkillAction): Promise<string> {
    const skill = this.skills.get(action.skillSlug);
    if (!skill) {
      return `错误: Skill '${action.skillSlug}' 不存在`;
    }
    
    try {
      const result = await skill.executeCommand(action.command, action.parameters);
      return JSON.stringify(result);
    } catch (error) {
      return `错误: ${error.message}`;
    }
  }
  
  private buildSuccessResult(output: string, steps: ReActStep[]): ExecutorResult {
    return {
      success: true,
      output,
      steps,
      iterations: this.state.iteration,
    };
  }
  
  private buildMaxIterationsResult(): ExecutorResult {
    return {
      success: false,
      output: '达到最大迭代次数',
      steps: this.state.steps,
      iterations: this.state.iteration,
      error: {
        code: 'MAX_ITERATIONS_REACHED',
        message: `ReAct 循环达到最大迭代次数 ${this.maxIterations}`,
      },
    };
  }
}
```

### 4.2 ReAct 数据结构

```typescript
interface ReActStep {
  iteration: number;
  thought: string;
  action: ReActAction;
  observation: string;
  timestamp: number;
}

type ReActAction = 
  | { type: 'tool_call'; toolName: string; parameters: Record<string, any> }
  | { type: 'skill_call'; skillSlug: string; command: string; parameters: Record<string, any> }
  | { type: 'complete'; content: string }
  | { type: 'error'; message: string };

interface ExecutorOptions {
  id: string;
  worktaskId: string;
  orchestratorId: string;
  task: string;
  tools: Tool[];
  skills: Skill[];
  context: ExecutorContext;
  orchestratorChannel: IPCChannel;
  llmService: LLMService;
}

interface ExecutorState {
  status: 'created' | 'running' | 'completed' | 'failed' | 'timeout';
  iteration: number;
  startTime: number | null;
  endTime: number | null;
  steps: ReActStep[];
}

interface ExecutorResult {
  success: boolean;
  output: string;
  steps: ReActStep[];
  iterations: number;
  error?: {
    code: string;
    message: string;
  };
}
```

## 5. IPC 通信

### 5.1 通信协议

```typescript
interface ExecutorIPCMessage {
  type: ExecutorMessageType;
  executorId: string;
  worktaskId: string;
  timestamp: Date;
  payload: any;
}

type ExecutorMessageType =
  | 'executor:started'
  | 'executor:progress'
  | 'executor:step_completed'
  | 'executor:completed'
  | 'executor:failed'
  | 'executor:timeout';

interface ExecutorProgressPayload {
  executorId: string;
  worktaskId: string;
  status: string;
  step?: number;
  total?: number;
  message: string;
}

interface ExecutorCompletedPayload {
  executorId: string;
  worktaskId: string;
  result: ExecutorResult;
  duration: number;
}
```

### 5.2 IPC 实现

```typescript
class ExecutorIPC {
  constructor(private channel: IPCChannel) {}
  
  reportProgress(payload: ExecutorProgressPayload): void {
    this.channel.send({
      type: 'executor:progress',
      executorId: payload.executorId,
      worktaskId: payload.worktaskId,
      timestamp: new Date(),
      payload,
    });
  }
  
  reportCompleted(payload: ExecutorCompletedPayload): void {
    this.channel.send({
      type: 'executor:completed',
      executorId: payload.executorId,
      worktaskId: payload.worktaskId,
      timestamp: new Date(),
      payload,
    });
  }
  
  reportFailed(payload: {
    executorId: string;
    worktaskId: string;
    error: { code: string; message: string };
  }): void {
    this.channel.send({
      type: 'executor:failed',
      executorId: payload.executorId,
      worktaskId: payload.worktaskId,
      timestamp: new Date(),
      payload,
    });
  }
}
```

## 6. 与 OpenClaw 兼容性

### 6.1 复用 OpenClaw 组件

```typescript
import {
  runEmbeddedPiAgent,
  type EmbeddedPiRunResult,
} from 'openclaw/agents/pi-embedded-runner';

class Executor {
  async executeWithOpenClaw(): Promise<ExecutorResult> {
    const result: EmbeddedPiRunResult = await runEmbeddedPiAgent({
      sessionId: `executor:${this.id}`,
      sessionKey: `agent:${this.orchestratorId}:worktask:${this.worktaskId}:executor:${this.id}`,
      prompt: this.task,
      skills: this.skills.map(s => s.slug),
      tools: this.tools.map(t => t.name),
    });
    
    return {
      success: result.ok,
      output: result.assistantMessage || '',
      steps: this.convertSteps(result),
      error: result.ok ? undefined : {
        code: 'OPENCLAW_ERROR',
        message: result.errorMessage || 'Unknown error',
      },
    };
  }
}
```

### 6.2 映射关系

| Cradle 概念 | OpenClaw 概念 | 说明 |
|-------------|---------------|------|
| Executor | SubAgent (leaf) | 叶子执行节点 |
| worktaskId | runId | 执行记录标识 |
| IPC 进度报告 | announce | 完成通知 |
| 执行结果 | EmbeddedPiRunResult | 返回结果 |

## 7. 错误处理

### 7.1 错误类型

```typescript
enum ExecutorErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  MAX_STEPS_REACHED = 'MAX_STEPS_REACHED',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

interface ExecutorError extends Error {
  code: ExecutorErrorCode;
  executorId: string;
  worktaskId: string;
  step?: number;
  details?: Record<string, any>;
}
```

### 7.2 错误处理策略

```typescript
class ExecutorErrorHandler {
  handle(error: ExecutorError): ExecutorResult {
    switch (error.code) {
      case ExecutorErrorCode.TIMEOUT:
        return this.handleTimeout(error);
        
      case ExecutorErrorCode.TOOL_NOT_FOUND:
        return this.handleToolNotFound(error);
        
      case ExecutorErrorCode.EXECUTION_FAILED:
        return this.handleExecutionFailed(error);
        
      default:
        return this.handleUnknownError(error);
    }
  }
  
  private handleTimeout(error: ExecutorError): ExecutorResult {
    return {
      success: false,
      output: '执行超时',
      steps: [],
      error: {
        code: 'TIMEOUT',
        message: `Executor ${error.executorId} 执行超时`,
      },
    };
  }
}
```

## 8. 关联文档

- [Agent 运行时设计](./runtime.md)
- [Orchestrator 设计](./orchestrator.md)
- [Worktask 设计](./worktask.md)
- [任务编排设计](./task-orchestration.md)