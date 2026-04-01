# Orchestrator 设计

## 1. 概述

Orchestrator 是三层架构的**中间层**，负责复杂任务的编排与协调。它由 Agent 根据用户意图启动，拥有独立的进程空间，通过 IPC 通信与 Agent 和 Executor 交互。

### 1.1 核心定位

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent 层                                  │
│  └── 意图识别 → 启动 Orchestrator                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC (启动)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator 层                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  职责：任务编排、ReAct 循环、Worktask 管理               │   │
│  │                                                         │   │
│  │  输入：                                                  │   │
│  │  ├── 任务目标（来自 Agent）                              │   │
│  │  ├── 最小上下文（画像、记忆片段）                        │   │
│  │  └── Skill 第二级披露（body）                            │   │
│  │                                                         │   │
│  │  输出：                                                  │   │
│  │  ├── Worktask 执行记录                                   │   │
│  │  ├── 任务结果汇总                                        │   │
│  │  └── 进度报告（IPC → Agent）                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ IPC (启动 Executor)              │
│                              ▼                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 与 OpenClaw 的映射关系

| Cradle Orchestrator | OpenClaw 对应 | 说明 |
|---------------------|---------------|------|
| Orchestrator 进程 | SubAgent (depth < max) | 可 spawn 子代理 |
| Worktask | SubAgent Run | 任务执行记录 |
| IPC 通信 | sessions_spawn / announce | 进程间通信 |
| Skill Body 披露 | Skill Commands | 命令定义 |

## 2. 核心职责

### 2.1 职责边界

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator 职责清单                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 负责：                                                       │
│  ├── 任务目标拆解                                                │
│  ├── 创建临时 Worktask                                           │
│  ├── 制定串行/并行任务计划                                       │
│  ├── ReAct 循环（Thought → Action → Observation）               │
│  ├── 加载 Skill 第二级披露（body）                               │
│  ├── 启动 Executor 执行                                          │
│  ├── 跟踪 Executor 执行状态                                      │
│  ├── 处理超时、任务重排                                          │
│  ├── IPC 通信向 Agent 汇报进度                                   │
│  └── 汇总执行结果                                                │
│                                                                 │
│  ❌ 不负责：                                                     │
│  ├── 用户交互（Agent 负责）                                      │
│  ├── 完整上下文管理（Agent 负责）                                │
│  ├── 具体工具调用（Executor 负责）                               │
│  └── Skill 第一级披露（Agent 负责）                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 最小上下文原则

Orchestrator 遵循**最小上下文原则**，只接收任务所需的最小信息：

```typescript
interface OrchestratorContext {
  worktaskId: string;
  task: string;
  
  profiles: {
    contact?: Partial<ContactProfile>;
    agent?: Partial<AgentProfile>;
    relationship?: Partial<RelationshipProfile>;
  };
  
  memoryFragments: MemoryFragment[];
  
  skillBody: {
    slug: string;
    commands: SkillCommand[];
    parameters: Record<string, any>;
  }[];
  
  constraints: {
    timeout?: number;
    maxExecutors?: number;
    allowedTools?: string[];
  };
}
```

## 3. Worktask 管理

### 3.1 Worktask 生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                    Worktask 生命周期                             │
│                                                                 │
│  Agent 启动 Orchestrator                                        │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ created │  Worktask 创建                                     │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ planning│  任务拆解、制定计划                                 │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ running │  执行中（启动 Executor）                            │
│  └────┬────┘                                                    │
│       │                                                         │
│       ├── Executor 完成 ──────────────────┐                     │
│       │                                   │                     │
│       ▼                                   ▼                     │
│  ┌─────────┐                         ┌─────────┐               │
│  │ paused  │  暂停（等待资源/用户）    │completed│  完成         │
│  └────┬────┘                         └─────────┘               │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ resumed │  恢复执行                                           │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ failed  │  失败                                               │
│  └─────────┘                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Worktask 数据结构

```typescript
interface Worktask {
  id: string;
  
  agentId: string;
  contactId: string;
  conversationId: string;
  
  task: string;
  status: WorktaskStatus;
  
  plan: TaskPlan;
  executors: ExecutorRecord[];
  
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  
  result?: WorktaskResult;
  
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

type WorktaskStatus = 
  | 'created'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

interface TaskPlan {
  steps: PlanStep[];
  strategy: 'serial' | 'parallel' | 'hybrid';
}

interface PlanStep {
  id: string;
  description: string;
  dependencies: string[];
  executor?: ExecutorRecord;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface ExecutorRecord {
  id: string;
  worktaskId: string;
  stepId: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: string;
  startedAt?: Date;
  completedAt?: Date;
}
```

### 3.3 Worktask 与 Todo 列表集成

Orchestrator 维护 Worktask 的 Todo 列表，用于跟踪执行进度：

```typescript
interface WorktaskTodo {
  id: string;
  worktaskId: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  executorId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

class WorktaskManager {
  private todos: Map<string, WorktaskTodo[]> = new Map();
  
  createTodoList(worktaskId: string, steps: PlanStep[]): void {
    const todos = steps.map((step, index) => ({
      id: generateId(),
      worktaskId,
      content: step.description,
      status: 'pending' as const,
      order: index,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    this.todos.set(worktaskId, todos);
  }
  
  updateTodoStatus(worktaskId: string, todoId: string, status: WorktaskTodo['status']): void {
    const todos = this.todos.get(worktaskId);
    if (todos) {
      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        todo.status = status;
        todo.updatedAt = new Date();
      }
    }
  }
  
  getTodoList(worktaskId: string): WorktaskTodo[] {
    return this.todos.get(worktaskId) || [];
  }
}
```

## 4. ReAct 循环

### 4.1 两层 ReAct 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    两层 ReAct 架构                               │
│                                                                 │
│  Orchestrator ReAct (任务级)                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Thought: 分析任务进度，决定下一步编排                    │   │
│  │  Action:  启动 Executor / 加载 Skill Body / 汇总结果     │   │
│  │  Obs:     Executor 执行结果 / Skill 加载状态             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ spawn Executor                   │
│                              ▼                                  │
│  Executor ReAct (步骤级)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Thought: 分析执行状态，决定下一步操作                    │   │
│  │  Action:  调用 Tool / 调用 Skill / 返回结果              │   │
│  │  Obs:     Tool 执行结果 / Skill 执行结果                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Orchestrator ReAct 流程

```
┌─────────────────────────────────────────────────────────────────┐
│                Orchestrator ReAct (任务级)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Thought (思考)                        │   │
│  │  分析任务进度，决定下一步编排策略                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Action (行动)                         │   │
│  │  ├── spawn_executor: 启动 Executor 执行子任务            │   │
│  │  ├── load_skill_body: 加载 Skill 第二级披露              │   │
│  │  ├── update_plan: 更新任务计划                           │   │
│  │  ├── ask_agent: 向 Agent 请求更多信息                    │   │
│  │  └── complete: 任务完成，返回结果                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Observation (观察)                      │   │
│  │  获取 Executor 执行结果，更新 Worktask 状态               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                         │
│                    │  任务完成？      │                         │
│                    └────────┬────────┘                         │
│                             │                                   │
│              ┌──────────────┴──────────────┐                   │
│              │                             │                   │
│              ▼                             ▼                   │
│        ┌─────────┐                  ┌─────────────┐           │
│        │   是    │                  │     否      │           │
│        └────┬────┘                  └──────┬──────┘           │
│             │                              │                   │
│             ▼                              └───────────────────┘
│      ┌─────────────┐                              │
│      │ 返回结果    │                              ▼
│      └─────────────┘                      返回 Thought
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 两层 ReAct 对比

| 维度 | Orchestrator ReAct | Executor ReAct |
|------|-------------------|----------------|
| **层级** | 任务级 | 步骤级 |
| **目标** | 任务编排、规划 | 任务执行、工具调用 |
| **Thought** | 分析任务进度 | 分析执行状态 |
| **Action** | spawn_executor, load_skill_body, complete | tool_call, skill_call, complete |
| **Observation** | Executor 结果 | Tool/Skill 结果 |
| **上下文** | 最小上下文（画像、记忆片段） | 执行上下文（工具、Skill） |
| **决策** | 任务分解、重排、汇总 | 执行步骤决策 |
| **最大迭代** | 20 次（可配置） | 20 次（可配置） |

### 4.4 Orchestrator ReAct 实现

```typescript
class OrchestratorReAct {
  private maxIterations: number = 20;
  private iteration: number = 0;
  private steps: OrchestratorStep[] = [];
  
  async run(context: OrchestratorContext): Promise<WorktaskResult> {
    while (this.iteration < this.maxIterations) {
      this.iteration++;
      
      const thought = await this.generateThought(context);
      const action = await this.decideAction(thought);
      
      let observation: string;
      
      switch (action.type) {
        case 'spawn_executor':
          observation = await this.spawnExecutor(action);
          break;
          
        case 'load_skill_body':
          observation = await this.loadSkillBody(action);
          break;
          
        case 'update_plan':
          observation = await this.updatePlan(action);
          break;
          
        case 'ask_agent':
          observation = await this.askAgent(action.question);
          break;
          
        case 'complete':
          return this.buildResult(action.content);
          
        default:
          observation = `未知动作类型: ${action.type}`;
      }
      
      this.steps.push({ thought, action, observation });
      this.reportProgress(context.worktaskId);
    }
    
    return this.buildMaxIterationsResult();
  }
  
  private async spawnExecutor(action: SpawnExecutorAction): Promise<string> {
    const executor = await this.executorFactory.create({
      worktaskId: this.worktaskId,
      task: action.task,
      skillSlugs: action.skillSlugs,
      context: this.buildExecutorContext(action),
    });
    
    const result = await executor.execute();
    return JSON.stringify(result);
  }
}

type OrchestratorAction = 
  | { type: 'spawn_executor'; task: string; skillSlugs: string[] }
  | { type: 'load_skill_body'; skillSlug: string }
  | { type: 'update_plan'; plan: TaskPlan }
  | { type: 'ask_agent'; question: string }
  | { type: 'complete'; content: string };
```

## 5. IPC 通信

### 5.1 通信协议

```typescript
interface OrchestratorIPCMessage {
  type: OrchestratorMessageType;
  worktaskId: string;
  agentId: string;
  timestamp: Date;
  payload: any;
}

type OrchestratorMessageType =
  | 'worktask:created'
  | 'worktask:progress'
  | 'worktask:step_completed'
  | 'worktask:step_failed'
  | 'worktask:completed'
  | 'worktask:failed'
  | 'worktask:paused'
  | 'executor:spawned'
  | 'executor:completed'
  | 'executor:failed';

interface WorktaskProgressPayload {
  step: number;
  total: number;
  currentAction: string;
  status: WorktaskStatus;
}

interface WorktaskCompletedPayload {
  result: WorktaskResult;
  steps: ReActStep[];
  executors: ExecutorRecord[];
  duration: number;
}
```

### 5.2 进度报告

```typescript
class OrchestratorIPC {
  constructor(private agentChannel: IPCChannel) {}
  
  reportProgress(worktaskId: string, progress: WorktaskProgressPayload): void {
    this.agentChannel.send({
      type: 'worktask:progress',
      worktaskId,
      agentId: this.agentId,
      timestamp: new Date(),
      payload: progress,
    });
  }
  
  reportCompleted(worktaskId: string, result: WorktaskCompletedPayload): void {
    this.agentChannel.send({
      type: 'worktask:completed',
      worktaskId,
      agentId: this.agentId,
      timestamp: new Date(),
      payload: result,
    });
  }
  
  reportFailed(worktaskId: string, error: Error): void {
    this.agentChannel.send({
      type: 'worktask:failed',
      worktaskId,
      agentId: this.agentId,
      timestamp: new Date(),
      payload: {
        error: {
          code: 'ORCHESTRATOR_ERROR',
          message: error.message,
          stack: error.stack,
        },
      },
    });
  }
}
```

## 6. 任务编排策略

### 6.1 编排策略概述

Orchestrator 在 ReAct 循环中根据任务特性选择不同的执行策略：

```
┌─────────────────────────────────────────────────────────────────┐
│                    任务编排策略选择                              │
│                                                                 │
│  任务分析                                                        │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────┐                                            │
│  │ 任务间有依赖？   │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│   是           否                                                │
│     │           │                                               │
│     ▼           ▼                                               │
│ ┌───────┐   ┌─────────────┐                                     │
│ │串行   │   │任务可并行？  │                                     │
│ │执行   │   └──────┬──────┘                                     │
│ └───────┘          │                                            │
│              ┌─────┴─────┐                                      │
│              │           │                                      │
│              ▼           ▼                                      │
│            是           否                                       │
│              │           │                                      │
│              ▼           ▼                                      │
│         ┌───────┐   ┌───────┐                                   │
│         │并行   │   │串行   │                                   │
│         │执行   │   │执行   │                                   │
│         └───────┘   └───────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 串行执行

**适用场景**：
- 任务间有依赖关系（任务 B 依赖任务 A 的结果）
- 需要根据前一步结果决定下一步
- 资源竞争敏感的任务

```
┌─────────────────────────────────────────────────────────────────┐
│                    串行执行流程                                  │
│                                                                 │
│  Step 1: Executor A                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  任务: 查询用户数据                                       │   │
│  │  ReAct: tool_call → db_query → observation              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ 结果传递                         │
│                              ▼                                  │
│  Step 2: Executor B                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  任务: 基于用户数据生成报告                               │   │
│  │  ReAct: tool_call → report_gen → observation            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ 结果传递                         │
│                              ▼                                  │
│  Step 3: Executor C                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  任务: 发送报告给用户                                     │   │
│  │  ReAct: tool_call → email_send → observation            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
async executeSerial(steps: PlanStep[]): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  
  for (const step of steps) {
    this.updateTodoStatus(step.id, 'in_progress');
    
    const executor = await this.createExecutor(step);
    const result = await executor.execute();
    
    if (result.success) {
      this.updateTodoStatus(step.id, 'completed');
      results.push(result);
      
      this.ipc.reportProgress({
        worktaskId: this.worktaskId,
        type: 'step_completed',
        step: step.id,
        result,
      });
    } else {
      this.updateTodoStatus(step.id, 'failed');
      
      if (step.critical) {
        throw new Error(`关键步骤失败: ${step.description}`);
      }
      
      this.ipc.reportProgress({
        worktaskId: this.worktaskId,
        type: 'step_failed',
        step: step.id,
        error: result.error,
      });
    }
  }
  
  return results;
}
```

### 6.3 并行执行

**适用场景**：
- 任务间无依赖关系
- 可同时执行的独立任务
- 需要缩短总体执行时间

```
┌─────────────────────────────────────────────────────────────────┐
│                    并行执行流程                                  │
│                                                                 │
│                    ┌─────────────┐                              │
│                    │ Orchestrator│                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│           ┌───────────────┼───────────────┐                     │
│           │               │               │                     │
│           ▼               ▼               ▼                     │
│    ┌───────────┐   ┌───────────┐   ┌───────────┐               │
│    │ Executor A│   │ Executor B│   │ Executor C│               │
│    │           │   │           │   │           │               │
│    │ 查询销售  │   │ 查询库存  │   │ 查询用户  │               │
│    │ 数据      │   │ 数据      │   │ 数据      │               │
│    │           │   │           │   │           │               │
│    │ ReAct     │   │ ReAct     │   │ ReAct     │               │
│    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘               │
│          │               │               │                     │
│          └───────────────┼───────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                   ┌───────────┐                                 │
│                   │ 结果汇总  │                                 │
│                   └───────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
async executeParallel(steps: PlanStep[]): Promise<ExecutionResult[]> {
  const executorPromises = steps.map(async (step) => {
    this.updateTodoStatus(step.id, 'in_progress');
    
    this.ipc.reportProgress({
      worktaskId: this.worktaskId,
      type: 'executor_spawned',
      step: step.id,
      description: step.description,
    });
    
    const executor = await this.createExecutor(step);
    const result = await executor.execute();
    
    this.updateTodoStatus(step.id, result.success ? 'completed' : 'failed');
    
    this.ipc.reportProgress({
      worktaskId: this.worktaskId,
      type: result.success ? 'step_completed' : 'step_failed',
      step: step.id,
      result,
    });
    
    return result;
  });
  
  return Promise.all(executorPromises);
}
```

### 6.4 混合执行（DAG 调度）

**适用场景**：
- 部分任务有依赖，部分可并行
- 复杂的任务依赖图
- 需要优化执行效率

```
┌─────────────────────────────────────────────────────────────────┐
│                    混合执行流程 (DAG)                            │
│                                                                 │
│  任务依赖图：                                                    │
│                                                                 │
│       ┌───────┐     ┌───────┐                                   │
│       │   A   │     │   B   │  ← 可并行执行                     │
│       └───┬───┘     └───┬───┘                                   │
│           │             │                                       │
│           └──────┬──────┘                                       │
│                  │                                              │
│                  ▼                                              │
│            ┌───────┐                                            │
│            │   C   │  ← 依赖 A 和 B                             │
│            └───┬───┘                                            │
│                │                                                │
│       ┌────────┴────────┐                                       │
│       │                 │                                       │
│       ▼                 ▼                                       │
│  ┌───────┐         ┌───────┐                                    │
│  │   D   │         │   E   │  ← 可并行执行                      │
│  └───────┘         └───────┘                                    │
│                                                                 │
│  执行顺序：                                                      │
│  Phase 1: A, B (并行)                                           │
│  Phase 2: C (等待 A, B 完成)                                    │
│  Phase 3: D, E (并行)                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
async executeHybrid(plan: TaskPlan): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const completed = new Set<string>();
  const failed = new Set<string>();
  
  while (completed.size + failed.size < plan.steps.length) {
    const readySteps = plan.steps.filter(
      step => !completed.has(step.id) && 
              !failed.has(step.id) &&
              step.dependencies.every(d => completed.has(d))
    );
    
    if (readySteps.length === 0) {
      const blockedSteps = plan.steps.filter(
        step => !completed.has(step.id) && !failed.has(step.id)
      );
      throw new Error(`检测到循环依赖或无法继续执行，阻塞任务: ${blockedSteps.map(s => s.id).join(', ')}`);
    }
    
    this.ipc.reportProgress({
      worktaskId: this.worktaskId,
      type: 'phase_started',
      steps: readySteps.map(s => s.id),
      parallel: readySteps.length > 1,
    });
    
    const stepResults = await this.executeParallel(readySteps);
    results.push(...stepResults);
    
    readySteps.forEach((step, i) => {
      if (stepResults[i].success) {
        completed.add(step.id);
      } else {
        failed.add(step.id);
        
        if (step.critical) {
          throw new Error(`关键步骤 ${step.id} 失败，终止执行`);
        }
      }
    });
  }
  
  return results;
}
```

### 6.5 ReAct 循环中的编排决策

```typescript
class OrchestratorReAct {
  async decideExecutionStrategy(task: string, context: OrchestratorContext): Promise<ExecutionStrategy> {
    const analysis = await this.analyzeTask(task, context);
    
    if (analysis.dependencies.length === 0 && analysis.canParallelize) {
      return {
        type: 'parallel',
        steps: analysis.steps,
        reason: '任务间无依赖，可并行执行',
      };
    }
    
    if (analysis.hasSequentialDependency) {
      return {
        type: 'serial',
        steps: analysis.steps,
        reason: '任务间存在依赖关系，需串行执行',
      };
    }
    
    return {
      type: 'hybrid',
      steps: analysis.steps,
      dependencies: analysis.dependencies,
      reason: '部分任务可并行，部分有依赖',
    };
  }
  
  private async analyzeTask(task: string, context: OrchestratorContext): Promise<TaskAnalysis> {
    const prompt = `
分析以下任务，确定执行策略：

任务：${task}

可用工具：${context.tools.map(t => t.name).join(', ')}

请分析：
1. 任务是否可以分解为多个子任务？
2. 子任务之间是否有依赖关系？
3. 哪些子任务可以并行执行？

输出 JSON 格式：
{
  "steps": [{ "id": "step_1", "description": "...", "dependencies": [] }],
  "canParallelize": boolean,
  "hasSequentialDependency": boolean
}
`;
    
    const response = await this.llmService.generate(prompt);
    return JSON.parse(response.content);
  }
}

interface ExecutionStrategy {
  type: 'serial' | 'parallel' | 'hybrid';
  steps: PlanStep[];
  dependencies?: Dependency[];
  reason: string;
}
```

## 7. 超时与重排

### 7.1 超时处理

```typescript
class TimeoutHandler {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  
  setTimeout(worktaskId: string, executorId: string, ms: number): void {
    const timeoutId = setTimeout(() => {
      this.handleTimeout(worktaskId, executorId);
    }, ms);
    
    this.timeouts.set(executorId, timeoutId);
  }
  
  clearTimeout(executorId: string): void {
    const timeoutId = this.timeouts.get(executorId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(executorId);
    }
  }
  
  private handleTimeout(worktaskId: string, executorId: string): void {
    this.ipc.send({
      type: 'executor:timeout',
      worktaskId,
      executorId,
      timestamp: new Date(),
      payload: { message: 'Executor 执行超时' },
    });
  }
}
```

### 7.2 任务重排

```typescript
class TaskRearranger {
  rearrange(plan: TaskPlan, failedStep: PlanStep): TaskPlan {
    const newPlan = { ...plan };
    
    const dependentSteps = newPlan.steps.filter(
      step => step.dependencies.includes(failedStep.id)
    );
    
    if (dependentSteps.length > 0) {
      const alternativeStep = this.findAlternative(failedStep);
      if (alternativeStep) {
        newPlan.steps.push(alternativeStep);
        dependentSteps.forEach(step => {
          step.dependencies = step.dependencies.map(
            d => d === failedStep.id ? alternativeStep.id : d
          );
        });
      }
    }
    
    return newPlan;
  }
  
  private findAlternative(failedStep: PlanStep): PlanStep | null {
    return null;
  }
}
```

## 8. 与 OpenClaw 兼容性

### 8.1 复用 OpenClaw 组件

```typescript
import {
  spawnSubagentDirect,
  registerSubagentRun,
  runSubagentAnnounceFlow,
} from 'openclaw/agents';

class Orchestrator {
  async spawnExecutor(params: SpawnExecutorParams): Promise<Executor> {
    const runId = generateId();
    
    registerSubagentRun({
      runId,
      childSessionKey: `agent:${this.agentId}:worktask:${this.worktaskId}:executor:${runId}`,
      requesterSessionKey: `agent:${this.agentId}:contact:${this.contactId}`,
      task: params.task,
      cleanup: 'delete',
    });
    
    const result = await spawnSubagentDirect({
      task: params.task,
      skills: params.skillSlugs,
      context: params.context,
    });
    
    return result;
  }
}
```

### 8.2 映射关系

| Cradle 概念 | OpenClaw 概念 | 说明 |
|-------------|---------------|------|
| Agent + Contact | session | 会话隔离 |
| Worktask | SubAgent Run | 任务执行记录 |
| Orchestrator | SubAgent (depth < max) | 可 spawn 子代理 |
| Executor | SubAgent (depth = max) | 叶子执行节点 |
| IPC 进度报告 | announce | 完成通知 |

## 9. 关联文档

- [Agent 运行时设计](./runtime.md)
- [Executor 设计](./executor.md)
- [Worktask 设计](./worktask.md)
- [任务编排设计](./task-orchestration.md)