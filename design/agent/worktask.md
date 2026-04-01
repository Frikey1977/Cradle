# Worktask 设计

## 1. 概述

Worktask 是运行时任务隔离的核心概念，由 Orchestrator 负责创建和维护。每个 Worktask 代表一个独立的任务执行单元，包含任务计划、执行记录和进度跟踪。

### 1.1 核心定位

```
┌─────────────────────────────────────────────────────────────────┐
│                      会话与任务隔离层级                          │
│                                                                 │
│  Level 1: 会话级                                                │
│  └── Agent + Contact 对话 (对应 OpenClaw session)              │
│       └── 记忆、画像、关系                                       │
│                                                                 │
│  Level 2: 任务级 (Worktask)                                     │
│  └── Orchestrator 进程                                          │
│       └── 任务计划、Todo 列表、执行记录                          │
│                                                                 │
│  Level 3: 执行级 (Executor)                                     │
│  └── 独立进程                                                    │
│       └── 具体任务执行、工具调用                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 与 OpenClaw 的映射关系

| Cradle Worktask | OpenClaw 对应 | 说明 |
|-----------------|---------------|------|
| Worktask | SubAgent Run | 任务执行记录 |
| worktaskId | runId | 唯一标识 |
| Todo 列表 | (无直接对应) | Cradle 增强 |
| IPC 进度报告 | announce | 完成通知 |

## 2. Worktask 数据模型

### 2.1 核心结构

```typescript
interface Worktask {
  id: string;
  
  agentId: string;
  contactId: string;
  conversationId: string;
  
  task: string;
  description?: string;
  status: WorktaskStatus;
  
  plan: TaskPlan;
  todos: WorktaskTodo[];
  executors: ExecutorRecord[];
  
  progress: WorktaskProgress;
  result?: WorktaskResult;
  
  context: WorktaskContext;
  
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  metadata: {
    totalDuration?: number;
    tokenUsage?: TokenUsage;
    errorCount: number;
    retryCount: number;
  };
}

type WorktaskStatus = 
  | 'created'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';
```

### 2.2 任务计划

```typescript
interface TaskPlan {
  steps: PlanStep[];
  strategy: 'serial' | 'parallel' | 'hybrid';
  estimatedDuration?: number;
  dependencies: DependencyGraph;
}

interface PlanStep {
  id: string;
  order: number;
  description: string;
  type: 'executor' | 'tool_call' | 'skill_call' | 'decision';
  
  dependencies: string[];
  
  config: {
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, any>;
    timeout?: number;
    retries?: number;
  };
  
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  executorId?: string;
  result?: StepResult;
}

interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string }[];
}
```

### 2.3 Todo 列表

```typescript
interface WorktaskTodo {
  id: string;
  worktaskId: string;
  
  content: string;
  description?: string;
  
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  order: number;
  
  stepId?: string;
  executorId?: string;
  
  startedAt?: Date;
  completedAt?: Date;
  
  result?: string;
  error?: string;
}

interface TodoList {
  worktaskId: string;
  items: WorktaskTodo[];
  
  getPending(): WorktaskTodo[];
  getInProgress(): WorktaskTodo[];
  getCompleted(): WorktaskTodo[];
  getFailed(): WorktaskTodo[];
  
  updateStatus(todoId: string, status: WorktaskTodo['status']): void;
  addTodo(content: string, options?: Partial<WorktaskTodo>): WorktaskTodo;
  removeTodo(todoId: string): void;
}
```

### 2.4 执行记录

```typescript
interface ExecutorRecord {
  id: string;
  worktaskId: string;
  stepId: string;
  
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  
  result?: ExecutorResult;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  
  metadata: {
    toolCalls: ToolCallRecord[];
    tokenUsage?: TokenUsage;
  };
}

interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, any>;
  result: string;
  duration: number;
  success: boolean;
}
```

### 2.5 进度跟踪

```typescript
interface WorktaskProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  
  percentage: number;
  
  currentStep?: string;
  currentExecutor?: string;
  
  estimatedTimeRemaining?: number;
  
  timeline: ProgressEvent[];
}

interface ProgressEvent {
  timestamp: Date;
  type: ProgressEventType;
  message: string;
  details?: Record<string, any>;
}

type ProgressEventType =
  | 'created'
  | 'planning_started'
  | 'planning_completed'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'executor_spawned'
  | 'executor_completed'
  | 'executor_failed'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'failed';
```

### 2.6 执行结果

```typescript
interface WorktaskResult {
  success: boolean;
  output: string;
  summary?: string;
  
  steps: StepResult[];
  executors: ExecutorResult[];
  
  metrics: {
    totalDuration: number;
    totalSteps: number;
    totalExecutors: number;
    successRate: number;
    tokenUsage: TokenUsage;
  };
  
  artifacts?: {
    files?: string[];
    data?: Record<string, any>;
  };
}

interface StepResult {
  stepId: string;
  description: string;
  success: boolean;
  output: string;
  duration: number;
}

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}
```

## 3. Worktask 生命周期

### 3.1 状态流转

```
┌─────────────────────────────────────────────────────────────────┐
│                    Worktask 状态流转                             │
│                                                                 │
│  ┌─────────┐                                                    │
│  │ created │  Agent 启动 Orchestrator                           │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ planning│  Orchestrator 拆解任务、制定计划                    │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ running │  执行中（启动 Executor）                            │
│  └────┬────┘                                                    │
│       │                                                         │
│       ├─── 暂停 ──────────────────┐                             │
│       │                           │                             │
│       │                           ▼                             │
│       │                    ┌─────────┐                          │
│       │                    │ paused  │  等待资源/用户输入        │
│       │                    └────┬────┘                          │
│       │                           │                             │
│       │                           ▼                             │
│       │                    ┌─────────┐                          │
│       │                    │ resumed │  恢复执行                 │
│       │                    └────┬────┘                          │
│       │                           │                             │
│       │                           ▼                             │
│       │                    ┌─────────┐                          │
│       │                    │ running │                          │
│       │                    └────┬────┘                          │
│       │                           │                             │
│       ├─── 完成 ──────────────────┼─── 失败 ─────┐              │
│       │                           │              │              │
│       ▼                           │              ▼              │
│  ┌───────────┐                    │         ┌─────────┐         │
│  │ completed │                    │         │ failed  │         │
│  └───────────┘                    │         └─────────┘         │
│                                   │                             │
│                                   ▼                             │
│                              ┌──────────┐                       │
│                              │cancelled │  用户取消              │
│                              └──────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 生命周期事件

```typescript
enum WorktaskLifecycleEvent {
  CREATED = 'worktask:created',
  PLANNING_STARTED = 'worktask:planning_started',
  PLANNING_COMPLETED = 'worktask:planning_completed',
  STEP_STARTED = 'worktask:step_started',
  STEP_COMPLETED = 'worktask:step_completed',
  STEP_FAILED = 'worktask:step_failed',
  EXECUTOR_SPAWNED = 'worktask:executor_spawned',
  EXECUTOR_COMPLETED = 'worktask:executor_completed',
  EXECUTOR_FAILED = 'worktask:executor_failed',
  PAUSED = 'worktask:paused',
  RESUMED = 'worktask:resumed',
  COMPLETED = 'worktask:completed',
  FAILED = 'worktask:failed',
  CANCELLED = 'worktask:cancelled',
}

interface WorktaskEvent {
  type: WorktaskLifecycleEvent;
  worktaskId: string;
  timestamp: Date;
  payload: Record<string, any>;
}
```

## 4. WorktaskManager

### 4.1 核心接口

```typescript
interface WorktaskManager {
  create(params: CreateWorktaskParams): Promise<Worktask>;
  get(worktaskId: string): Promise<Worktask | null>;
  getByAgent(agentId: string): Promise<Worktask[]>;
  getByConversation(conversationId: string): Promise<Worktask[]>;
  
  updateStatus(worktaskId: string, status: WorktaskStatus): Promise<void>;
  updateProgress(worktaskId: string, progress: Partial<WorktaskProgress>): Promise<void>;
  
  addTodo(worktaskId: string, todo: Omit<WorktaskTodo, 'id' | 'worktaskId'>): Promise<WorktaskTodo>;
  updateTodo(worktaskId: string, todoId: string, updates: Partial<WorktaskTodo>): Promise<void>;
  
  addExecutor(worktaskId: string, executor: ExecutorRecord): Promise<void>;
  updateExecutor(worktaskId: string, executorId: string, updates: Partial<ExecutorRecord>): Promise<void>;
  
  complete(worktaskId: string, result: WorktaskResult): Promise<void>;
  fail(worktaskId: string, error: Error): Promise<void>;
  cancel(worktaskId: string): Promise<void>;
  
  getProgress(worktaskId: string): Promise<WorktaskProgress>;
  getTodoList(worktaskId: string): Promise<TodoList>;
}
```

### 4.2 实现示例

```typescript
class WorktaskManagerImpl implements WorktaskManager {
  private store: WorktaskStore;
  private eventBus: EventBus;
  
  async create(params: CreateWorktaskParams): Promise<Worktask> {
    const worktask: Worktask = {
      id: generateId(),
      agentId: params.agentId,
      contactId: params.contactId,
      conversationId: params.conversationId,
      task: params.task,
      description: params.description,
      status: 'created',
      plan: { steps: [], strategy: 'serial', dependencies: { nodes: [], edges: [] } },
      todos: [],
      executors: [],
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0, timeline: [] },
      context: params.context,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { errorCount: 0, retryCount: 0 },
    };
    
    await this.store.save(worktask);
    
    this.eventBus.emit({
      type: WorktaskLifecycleEvent.CREATED,
      worktaskId: worktask.id,
      timestamp: new Date(),
      payload: { worktask },
    });
    
    return worktask;
  }
  
  async updateStatus(worktaskId: string, status: WorktaskStatus): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }
    
    worktask.status = status;
    worktask.updatedAt = new Date();
    
    if (status === 'running' && !worktask.startedAt) {
      worktask.startedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      worktask.completedAt = new Date();
      worktask.metadata.totalDuration = 
        worktask.completedAt.getTime() - (worktask.startedAt?.getTime() || worktask.createdAt.getTime());
    }
    
    await this.store.save(worktask);
    
    this.eventBus.emit({
      type: this.getStatusEvent(status),
      worktaskId,
      timestamp: new Date(),
      payload: { status },
    });
  }
  
  async addTodo(worktaskId: string, todo: Omit<WorktaskTodo, 'id' | 'worktaskId'>): Promise<WorktaskTodo> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }
    
    const newTodo: WorktaskTodo = {
      id: generateId(),
      worktaskId,
      ...todo,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    worktask.todos.push(newTodo);
    worktask.progress.total = worktask.todos.length;
    worktask.updatedAt = new Date();
    
    await this.store.save(worktask);
    
    return newTodo;
  }
  
  async updateTodo(worktaskId: string, todoId: string, updates: Partial<WorktaskTodo>): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }
    
    const todo = worktask.todos.find(t => t.id === todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found in worktask ${worktaskId}`);
    }
    
    Object.assign(todo, updates, { updatedAt: new Date() });
    
    worktask.progress.completed = worktask.todos.filter(t => t.status === 'completed').length;
    worktask.progress.failed = worktask.todos.filter(t => t.status === 'failed').length;
    worktask.progress.percentage = Math.round(
      (worktask.progress.completed / worktask.progress.total) * 100
    );
    
    await this.store.save(worktask);
  }
  
  private getStatusEvent(status: WorktaskStatus): WorktaskLifecycleEvent {
    const eventMap: Record<WorktaskStatus, WorktaskLifecycleEvent> = {
      created: WorktaskLifecycleEvent.CREATED,
      planning: WorktaskLifecycleEvent.PLANNING_STARTED,
      running: WorktaskLifecycleEvent.STEP_STARTED,
      paused: WorktaskLifecycleEvent.PAUSED,
      completed: WorktaskLifecycleEvent.COMPLETED,
      failed: WorktaskLifecycleEvent.FAILED,
      cancelled: WorktaskLifecycleEvent.CANCELLED,
    };
    return eventMap[status];
  }
}
```

## 5. Todo 列表管理

### 5.1 Todo 与 Plan Step 的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                    Todo 与 Plan Step 映射                        │
│                                                                 │
│  TaskPlan                                                       │
│  ├── Step 1: "获取用户信息"                                      │
│  │   └── Todo: "查询用户数据库"                                  │
│  │                                                              │
│  ├── Step 2: "分析数据"                                          │
│  │   ├── Todo: "数据清洗"                                        │
│  │   └── Todo: "统计分析"                                        │
│  │                                                              │
│  └── Step 3: "生成报告"                                          │
│      ├── Todo: "格式化数据"                                      │
│      └── Todo: "生成文档"                                        │
│                                                                 │
│  关系：                                                          │
│  ├── 一个 Step 可以对应多个 Todo                                 │
│  ├── Todo 状态变化触发 Step 状态更新                             │
│  └── Todo 完成度决定 Step 完成度                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Todo 状态同步

```typescript
class TodoPlanSync {
  syncTodoToStep(worktask: Worktask, todoId: string): void {
    const todo = worktask.todos.find(t => t.id === todoId);
    if (!todo?.stepId) return;
    
    const step = worktask.plan.steps.find(s => s.id === todo.stepId);
    if (!step) return;
    
    const stepTodos = worktask.todos.filter(t => t.stepId === step.id);
    const completedCount = stepTodos.filter(t => t.status === 'completed').length;
    const failedCount = stepTodos.filter(t => t.status === 'failed').length;
    
    if (completedCount === stepTodos.length) {
      step.status = 'completed';
    } else if (failedCount > 0) {
      step.status = 'failed';
    } else if (stepTodos.some(t => t.status === 'in_progress')) {
      step.status = 'running';
    }
  }
}
```

## 6. IPC 通信协议

### 6.1 Worktask IPC 消息

```typescript
interface WorktaskIPCMessage {
  type: WorktaskMessageType;
  worktaskId: string;
  agentId: string;
  contactId: string;
  timestamp: Date;
  payload: any;
}

type WorktaskMessageType =
  | 'worktask:created'
  | 'worktask:status_changed'
  | 'worktask:progress_updated'
  | 'worktask:todo_added'
  | 'worktask:todo_updated'
  | 'worktask:executor_added'
  | 'worktask:executor_updated'
  | 'worktask:completed'
  | 'worktask:failed'
  | 'worktask:cancelled';

interface WorktaskProgressPayload {
  status: WorktaskStatus;
  progress: WorktaskProgress;
  currentStep?: string;
  currentTodo?: string;
}

interface WorktaskTodoPayload {
  todo: WorktaskTodo;
  action: 'add' | 'update' | 'remove';
}
```

### 6.2 进度报告格式

```typescript
interface WorktaskProgressReport {
  worktaskId: string;
  agentId: string;
  contactId: string;
  
  status: WorktaskStatus;
  
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  
  todos: {
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  
  executors: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  
  timing: {
    startedAt?: Date;
    estimatedCompletion?: Date;
    elapsed: number;
  };
  
  currentActivity?: {
    step: string;
    todo: string;
    executor?: string;
  };
}
```

## 7. 持久化

### 7.1 存储接口

```typescript
interface WorktaskStore {
  save(worktask: Worktask): Promise<void>;
  get(worktaskId: string): Promise<Worktask | null>;
  getByAgent(agentId: string): Promise<Worktask[]>;
  getByConversation(conversationId: string): Promise<Worktask[]>;
  getByStatus(status: WorktaskStatus): Promise<Worktask[]>;
  delete(worktaskId: string): Promise<void>;
  
  query(filter: WorktaskFilter): Promise<Worktask[]>;
  count(filter: WorktaskFilter): Promise<number>;
}

interface WorktaskFilter {
  agentId?: string;
  contactId?: string;
  conversationId?: string;
  status?: WorktaskStatus | WorktaskStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
  completedAfter?: Date;
  completedBefore?: Date;
}
```

### 7.2 内存存储实现

```typescript
class InMemoryWorktaskStore implements WorktaskStore {
  private worktasks: Map<string, Worktask> = new Map();
  
  async save(worktask: Worktask): Promise<void> {
    this.worktasks.set(worktask.id, { ...worktask });
  }
  
  async get(worktaskId: string): Promise<Worktask | null> {
    return this.worktasks.get(worktaskId) || null;
  }
  
  async getByAgent(agentId: string): Promise<Worktask[]> {
    return Array.from(this.worktasks.values())
      .filter(w => w.agentId === agentId);
  }
  
  async getByConversation(conversationId: string): Promise<Worktask[]> {
    return Array.from(this.worktasks.values())
      .filter(w => w.conversationId === conversationId);
  }
  
  async getByStatus(status: WorktaskStatus): Promise<Worktask[]> {
    return Array.from(this.worktasks.values())
      .filter(w => w.status === status);
  }
  
  async delete(worktaskId: string): Promise<void> {
    this.worktasks.delete(worktaskId);
  }
  
  async query(filter: WorktaskFilter): Promise<Worktask[]> {
    return Array.from(this.worktasks.values()).filter(w => this.matchesFilter(w, filter));
  }
  
  async count(filter: WorktaskFilter): Promise<number> {
    return (await this.query(filter)).length;
  }
  
  private matchesFilter(worktask: Worktask, filter: WorktaskFilter): boolean {
    if (filter.agentId && worktask.agentId !== filter.agentId) return false;
    if (filter.contactId && worktask.contactId !== filter.contactId) return false;
    if (filter.conversationId && worktask.conversationId !== filter.conversationId) return false;
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(worktask.status)) return false;
    }
    if (filter.createdAfter && worktask.createdAt < filter.createdAfter) return false;
    if (filter.createdBefore && worktask.createdAt > filter.createdBefore) return false;
    return true;
  }
}
```

## 8. 与 OpenClaw 兼容性

### 8.1 复用 OpenClaw 组件

```typescript
import {
  registerSubagentRun,
  cleanupSubagentRun,
  type SubagentRunRecord,
} from 'openclaw/agents/subagent-registry';

class WorktaskOpenClawAdapter {
  toSubagentRun(worktask: Worktask): SubagentRunRecord {
    return {
      runId: worktask.id,
      childSessionKey: `agent:${worktask.agentId}:worktask:${worktask.id}`,
      requesterSessionKey: `agent:${worktask.agentId}:contact:${worktask.contactId}`,
      task: worktask.task,
      cleanup: 'delete',
      label: worktask.description,
    };
  }
  
  async register(worktask: Worktask): Promise<void> {
    registerSubagentRun(this.toSubagentRun(worktask));
  }
  
  async cleanup(worktaskId: string): Promise<void> {
    cleanupSubagentRun(worktaskId);
  }
}
```

### 8.2 映射关系

| Cradle Worktask | OpenClaw SubagentRun | 说明 |
|-----------------|----------------------|------|
| id | runId | 唯一标识 |
| agentId + contactId | requesterSessionKey | 会话标识 |
| task | task | 任务描述 |
| status | (运行时状态) | 状态跟踪 |
| todos | (无直接对应) | Cradle 增强 |
| executors | (子 SubAgent) | 执行记录 |

## 9. 数据库表设计

数据库表设计详见 [database 目录](./database/)：

- [t_worktask.md](./database/t_worktask.md) - 任务主表
- [t_worktask_todo.md](./database/t_worktask_todo.md) - Todo列表表
- [t_worktask_executor.md](./database/t_worktask_executor.md) - 执行记录表
- [t_worktask_progress.md](./database/t_worktask_progress.md) - 进度事件表

## 10. 关联文档

- [Agent 运行时设计](./runtime.md)
- [Orchestrator 设计](./orchestrator.md)
- [Executor 设计](./executor.md)
- [任务编排设计](./task-orchestration.md)
- [任务定义设计](./task-definition.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)