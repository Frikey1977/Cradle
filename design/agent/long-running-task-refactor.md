# 长程循环任务架构改造设计

## 1. 概述

### 1.1 改造目标

当前 Agent 架构仅依赖 ReAct 循环，驱动依赖单次用户交互指令，无法完成监控抖音直播间评论区互动交互等复杂场景。本次改造旨在实现**长程循环驱动**能力，支持以下场景：

| 场景 | 描述 | 驱动方式 |
|------|------|---------|
| 直播间助理 | 感谢点赞送礼物、引导加群、收集商机 | Cron 定时轮询 |
| 多平台发布 | 文案提取、重构、用户确认、多平台发布 | 用户触发 + 用户确认 |
| 行业资讯收集 | 定时获取AI资讯、提炼观点、汇总 | Cron 定时触发 |

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **LLM 自主决策** | 所有业务逻辑由 LLM 决策，框架只提供能力 |
| **状态可恢复** | Worktask 持久化，支持任务暂停、恢复 |
| **驱动可配置** | 支持用户指令、定时、轮询、事件等多种驱动 |
| **上下文隔离** | 每个 Worktask 独立存储，数据不混淆 |
| **任务定义 JSON 化** | 通过 JSON 定义任务，支持条件分支、并行执行 |

### 1.3 改造范围

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           改造模块范围                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  新增模块                                                                    │
│  ├── TaskDefinitionExecutor    任务定义执行引擎                             │
│  ├── WorktaskScheduler         任务调度器                                   │
│  ├── ResultValidator           结果验证器                                   │
│  ├── LoopPromptBuilder         循环提示词构建器                             │
│  ├── LoopDecisionMaker         循环决策器                                   │
│  ├── LoopStateManager          循环状态管理器                               │
│  ├── UserConfirmHandler        用户确认处理器                               │
│  └── CronModule                定时任务模块                                 │
│                                                                             │
│  改造模块                                                                    │
│  ├── Orchestrator              扩展长程循环能力                             │
│  ├── Executor                  新增状态管理与恢复                           │
│  ├── WorktaskManager           扩展循环状态管理                             │
│  └── Worktask 数据模型         新增循环相关字段                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 现状分析

### 2.1 已实现能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 三层架构 | ✅ 已实现 | Agent/Orchestrator/Executor/Handler |
| Worktask 数据模型 | ✅ 已实现 | 状态管理、Todo 列表、执行记录 |
| JSON 任务定义 | ✅ 已设计 | 多种驱动类型和步骤类型 |
| Orchestrator ReAct | ✅ 已实现 | 任务级 ReAct 循环 |
| Executor ReAct | ✅ 已实现 | 步骤级 ReAct 循环 |
| IPC 通信 | ✅ 已实现 | Agent ↔ Orchestrator ↔ Executor |

### 2.2 待实现能力

| 模块 | 状态 | 说明 |
|------|------|------|
| TaskDefinitionExecutor | ⚠️ 仅设计 | JSON 任务解析执行引擎 |
| Cron 模块 | ⚠️ 仅设计 | 定时任务调度器 |
| Executor 状态恢复 | ❌ 未实现 | 执行上下文保存/恢复 |
| 结果验证 | ❌ 未实现 | 执行结果质量检验 |
| 循环提示词构建 | ❌ 未实现 | 下一轮执行提示词生成 |
| 循环决策 | ❌ 未实现 | 继续/暂停/退出决策 |
| 用户确认机制 | ❌ 未实现 | 等待用户确认/输入 |

### 2.3 架构差距

```
当前架构:
用户请求 → Agent → Orchestrator → Executor → 结果返回 → 结束

目标架构:
用户请求/Cron触发/事件触发
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    WorktaskScheduler                         │
│  加载 Worktask → 恢复上下文 → 触发执行                        │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      Orchestrator                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ReAct 循环                                              │ │
│  │   Thought → Action → Observation                       │ │
│  │        ↓                                               │ │
│  │   [结果验证] → [上下文构建] → [循环决策]               │ │
│  │        ↓                                               │ │
│  │   继续/暂停/退出                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                       Executor                               │
│  执行动作 → 保存上下文 → 返回结果                            │
│  状态: pending/running/paused/completed/max_iterations      │
└──────────────────────────────────────────────────────────────┘
```

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           长程循环任务架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  驱动层                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  User   │  │  Cron   │  │ Polling │  │  Event  │  │  API    │         │
│  │ 用户触发 │  │ 定时触发 │  │ 轮询触发 │  │ 事件触发 │  │ 外部调用 │         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│       │            │            │            │            │                │
│       └────────────┴────────────┴────────────┴────────────┘                │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    WorktaskScheduler (任务调度器)                     │  │
│  │                                                                      │  │
│  │  职责:                                                               │  │
│  │  - 接收多种驱动源的触发请求                                          │  │
│  │  - 加载/恢复 Worktask 和执行上下文                                   │  │
│  │  - 根据 driver_type 选择执行策略                                     │  │
│  │  - 管理任务生命周期                                                  │  │
│  │  - 与 Cron 模块双向集成                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Orchestrator (任务编排器)                          │  │
│  │                                                                      │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │                      ReAct 循环                                 │ │  │
│  │  │                                                                │ │  │
│  │  │  Thought ──▶ Action ──▶ Observation                           │ │  │
│  │  │     │           │            │                                 │ │  │
│  │  │     │           │            ▼                                 │ │  │
│  │  │     │           │    ┌───────────────┐                        │ │  │
│  │  │     │           │    │ ResultValidator│ 结果验证               │ │  │
│  │  │     │           │    └───────┬───────┘                        │ │  │
│  │  │     │           │            │                                 │ │  │
│  │  │     │           │            ▼                                 │ │  │
│  │  │     │           │    ┌───────────────────┐                    │ │  │
│  │  │     │           │    │ LoopPromptBuilder │ 构建下一轮提示词   │ │  │
│  │  │     │           │    └───────┬───────────┘                    │ │  │
│  │  │     │           │            │                                 │ │  │
│  │  │     │           │            ▼                                 │ │  │
│  │  │     │           │    ┌───────────────────┐                    │ │  │
│  │  │     │           │    │ LoopDecisionMaker │ 循环决策           │ │  │
│  │  │     │           │    └───────┬───────────┘                    │ │  │
│  │  │     │           │            │                                 │ │  │
│  │  │     │           │            ▼                                 │ │  │
│  │  │     │           │    ┌───────────────────┐                    │ │  │
│  │  │     │           │    │   继续执行?       │                    │ │  │
│  │  │     │           │    │   ├── Yes → 下一轮│                    │ │  │
│  │  │     │           │    │   ├── No  → 暂停  │                    │ │  │
│  │  │     │           │    │   └── Exit → 完成 │                    │ │  │
│  │  │     │           │    └───────────────────┘                    │ │  │
│  │  │     │           │                                             │ │  │
│  │  │     └───────────┴─────────────────────────────────────────────┘ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       Executor Pool (执行器池)                        │  │
│  │                                                                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │  │
│  │  │  Executor 1 │  │  Executor 2 │  │  Executor N │                 │  │
│  │  │             │  │             │  │             │                 │  │
│  │  │ ReAct 循环  │  │ ReAct 循环  │  │ ReAct 循环  │                 │  │
│  │  │ 状态管理    │  │ 状态管理    │  │ 状态管理    │                 │  │
│  │  │ 上下文保存  │  │ 上下文保存  │  │ 上下文保存  │                 │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │  │
│  │                                                                      │  │
│  │  Executor 状态: pending | running | paused | completed | max        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Storage Layer (存储层)                             │  │
│  │                                                                      │  │
│  │  数据库:                                                              │  │
│  │  - t_worktask              任务主表                                  │  │
│  │  - t_worktask_todo         Todo 列表                                 │  │
│  │  - t_worktask_executor     执行记录                                  │  │
│  │  - t_task_definition       任务定义                                  │  │
│  │  - t_task_checkpoint       检查点                                    │  │
│  │  - t_cron_job              定时任务                                  │  │
│  │                                                                      │  │
│  │  文件系统:                                                            │  │
│  │  - {userHome}/worktasks/{worktaskId}/                               │  │
│  │    ├── checkpoint.json      检查点                                   │  │
│  │    ├── context.json         Executor 上下文                         │  │
│  │    ├── variables.json       变量状态                                 │  │
│  │    ├── execution.log        执行日志                                 │  │
│  │    └── data/                中间数据文件                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           模块职责矩阵                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  模块                    │ 职责                                          │  │
│  ────────────────────────┼──────────────────────────────────────────────  │  │
│  WorktaskScheduler       │ 任务调度、驱动管理、生命周期控制               │  │
│  Orchestrator            │ 任务编排、ReAct 循环、结果汇总                 │  │
│  TaskDefinitionExecutor  │ JSON 任务解析、步骤执行、变量管理              │  │
│  ResultValidator         │ 结果验证、质量评估、异常检测                   │  │
│  LoopPromptBuilder       │ 提示词构建、上下文压缩、记忆整合               │  │
│  LoopDecisionMaker       │ 循环决策、策略调整、退出判断                   │  │
│  LoopStateManager        │ 状态持久化、检查点管理、恢复                   │  │
│  Executor                │ 动作执行、ReAct 循环、上下文保存               │  │
│  UserConfirmHandler      │ 用户确认请求、响应处理、超时管理               │  │
│  CronModule              │ 定时调度、Cron 表达式解析、触发管理            │  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. 模块详细设计

### 4.1 WorktaskScheduler (任务调度器)

**文件位置**: `src/agent/scheduler/worktask-scheduler.ts`

**核心职责**:
- 接收多种驱动源的触发请求
- 加载/恢复 Worktask 和执行上下文
- 根据 driver_type 选择执行策略
- 管理任务生命周期
- 与 Cron 模块双向集成

**接口定义**:

```typescript
interface WorktaskScheduler {
  schedule(worktaskId: string, driver: DriverConfig): Promise<void>;
  unschedule(worktaskId: string): Promise<void>;
  trigger(worktaskId: string, triggerSource: TriggerSource): Promise<void>;
  pause(worktaskId: string): Promise<void>;
  resume(worktaskId: string): Promise<void>;
  cancel(worktaskId: string): Promise<void>;
  getStatus(worktaskId: string): Promise<SchedulerStatus>;
}

interface DriverConfig {
  type: 'once' | 'loop' | 'polling' | 'event' | 'cron';
  config?: {
    interval?: number;
    cron?: string;
    maxIterations?: number;
    event?: string;
    timezone?: string;
  };
}

interface TriggerSource {
  type: 'user' | 'cron' | 'event' | 'api' | 'polling';
  timestamp: Date;
  payload?: Record<string, unknown>;
}

interface SchedulerStatus {
  worktaskId: string;
  driverType: DriverConfig['type'];
  currentIteration: number;
  maxIterations?: number;
  nextTriggerTime?: Date;
  lastTriggerTime?: Date;
  status: 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
}
```

**执行策略**:

| 驱动类型 | 执行策略 | 恢复机制 |
|---------|---------|---------|
| `once` | 单次执行 | 失败重试 |
| `loop` | 循环执行 | 从断点恢复 |
| `polling` | 定时轮询 | 每次独立执行，保存状态 |
| `event` | 事件驱动 | 等待事件恢复 |
| `cron` | 定时触发 | 每次独立执行，保存状态 |

**触发流程**:

```
触发请求到达
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 加载 Worktask                                               │
│     - 从数据库加载 Worktask 记录                                │
│     - 检查任务状态是否允许执行                                  │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 恢复执行上下文                                              │
│     - 加载 checkpoint.json                                      │
│     - 恢复 variables                                            │
│     - 恢复 ExecutorContext (如果有)                             │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 创建/恢复 Orchestrator                                      │
│     - 如果是新任务，创建 Orchestrator                           │
│     - 如果是恢复，加载 Orchestrator 状态                        │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 执行任务                                                    │
│     - 调用 orchestrator.orchestrate()                           │
│     - 监控执行状态                                              │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 处理执行结果                                                │
│     - 保存检查点                                                │
│     - 更新 Worktask 状态                                        │
│     - 安排下次触发（如果需要）                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 TaskDefinitionExecutor (任务定义执行引擎)

**文件位置**: `src/agent/executor/task-definition-executor.ts`

**核心职责**:
- 解析 JSON 任务定义
- 执行步骤序列 (action/condition/loop/parallel/wait)
- 变量系统管理
- 检查点保存与恢复

**接口定义**:

```typescript
interface TaskDefinitionExecutor {
  execute(): Promise<ExecutorResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  saveCheckpoint(): Promise<Checkpoint>;
  loadCheckpoint(checkpoint: Checkpoint): Promise<void>;
  getVariables(): Record<string, unknown>;
  setVariable(name: string, value: unknown): void;
}

interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  driver: DriverConfig;
  variables?: Record<string, unknown>;
  steps: StepDefinition[];
  exitCondition?: ConditionExpression;
}

type StepDefinition = 
  | ActionStep 
  | ConditionStep 
  | LoopStep 
  | ParallelStep 
  | WaitStep;

interface ActionStep {
  type: 'action';
  id: string;
  name: string;
  action: {
    type: 'skill' | 'tool' | 'llm';
    target: string;
    params?: Record<string, unknown>;
    paramsFromVariables?: Record<string, string>;
  };
  saveTo?: string;
  onError?: 'continue' | 'abort' | 'retry';
  retryCount?: number;
}

interface ConditionStep {
  type: 'condition';
  id: string;
  name: string;
  branches: Array<{
    condition: ConditionExpression;
    steps: StepDefinition[];
  }>;
  default?: StepDefinition[];
}

interface LoopStep {
  type: 'loop';
  id: string;
  name: string;
  loopType: 'while' | 'forEach';
  condition?: ConditionExpression;
  iterateOver?: string;
  itemVar?: string;
  steps: StepDefinition[];
  maxIterations?: number;
}

interface ParallelStep {
  type: 'parallel';
  id: string;
  name: string;
  branches: Array<{
    id: string;
    name: string;
    steps: StepDefinition[];
  }>;
  mode: 'all' | 'race' | 'any';
}

interface WaitStep {
  type: 'wait';
  id: string;
  name: string;
  waitType: 'timer' | 'event' | 'user';
  config: {
    duration?: number;
    event?: string;
    timeout?: number;
    message?: string;
    options?: string[];
  };
  saveTo?: string;
}
```

**执行流程**:

```
TaskDefinitionExecutor.execute()
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 初始化变量                                                  │
│     - 合并任务定义变量和输入参数                                │
│     - 初始化特殊变量 (${input.*}, ${env.*}, ${now})             │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 根据驱动模式选择执行策略                                    │
│     ├── once: executeOnce()                                     │
│     ├── loop: executeLoop()                                     │
│     ├── polling: executePolling()                               │
│     ├── event: executeEventDriven()                             │
│     └── cron: executeCron()                                     │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 执行步骤序列                                                │
│     ├── executeStep(action)                                     │
│     │   └── spawnExecutor() → validateResult() → saveVariable()│
│     ├── executeStep(condition)                                  │
│     │   └── evaluateCondition() → executeSteps()               │
│     ├── executeStep(loop)                                       │
│     │   └── while/forEach → executeSteps() → checkMaxIterations│
│     ├── executeStep(parallel)                                   │
│     │   └── Promise.all() / Promise.race()                     │
│     └── executeStep(wait)                                       │
│         └── pause() / waitForEvent() / requestUserConfirm()    │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 检查退出条件                                                │
│     - 评估 exitCondition                                        │
│     - 检查 maxIterations                                        │
│     - 检查外部取消信号                                          │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 返回结果                                                    │
│     - 汇总执行结果                                              │
│     - 生成执行报告                                              │
│     - 保存最终检查点                                            │
└─────────────────────────────────────────────────────────────────┘
```

**步骤执行器**:

```typescript
interface StepExecutor {
  execute(step: StepDefinition, context: ExecutionContext): Promise<StepResult>;
}

class ActionStepExecutor implements StepExecutor {
  async execute(step: ActionStep, context: ExecutionContext): Promise<StepResult> {
    const params = this.resolveParams(step.action, context.variables);
    
    let result: ExecutorResult;
    switch (step.action.type) {
      case 'skill':
        result = await this.executeSkill(step.action.target, params, context);
        break;
      case 'tool':
        result = await this.executeTool(step.action.target, params, context);
        break;
      case 'llm':
        result = await this.executeLLM(step.action.target, context);
        break;
    }
    
    if (step.saveTo) {
      context.variables[step.saveTo] = result.output;
    }
    
    return {
      stepId: step.id,
      success: result.success,
      output: result.output,
      error: result.error,
    };
  }
}
```

### 4.3 ResultValidator (结果验证器)

**文件位置**: `src/agent/orchestrator/result-validator.ts`

**核心职责**:
- 验证 Executor 执行结果
- 评估结果质量
- 检测异常情况
- 提供改进建议

**接口定义**:

```typescript
interface ResultValidator {
  validate(result: ExecutorResult, expectation: ResultExpectation): Promise<ValidationResult>;
  assessQuality(result: ExecutorResult): Promise<QualityScore>;
  detectAnomaly(result: ExecutorResult, history: ExecutorResult[]): Promise<AnomalyReport>;
}

interface ResultExpectation {
  mustContain?: string[];
  mustNotContain?: string[];
  format?: 'json' | 'text' | 'markdown';
  schema?: Record<string, unknown>;
  customValidator?: string;
  minQuality?: number;
}

interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestion?: string;
}

interface ValidationIssue {
  type: 'format' | 'content' | 'quality' | 'custom';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
}

interface QualityScore {
  overall: number;
  dimensions: {
    completeness: number;
    accuracy: number;
    relevance: number;
    actionability: number;
  };
}

interface AnomalyReport {
  hasAnomaly: boolean;
  anomalies: Anomaly[];
  recommendation: string;
}

interface Anomaly {
  type: 'unexpected_empty' | 'format_change' | 'quality_drop' | 'pattern_break';
  description: string;
  evidence: string;
}
```

**验证流程**:

```
Executor 执行完成
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 基础验证                                                    │
│     - 格式检查 (JSON/Text/Markdown)                             │
│     - 必填字段检查                                              │
│     - 类型检查                                                  │
│     - Schema 验证                                               │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 内容验证                                                    │
│     - mustContain 检查                                          │
│     - mustNotContain 检查                                       │
│     - 语义相关性检查 (LLM)                                      │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 质量评估                                                    │
│     - 完整性评分                                                │
│     - 准确性评分                                                │
│     - 相关性评分                                                │
│     - 可操作性评分                                              │
│     - 综合评分                                                  │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 异常检测                                                    │
│     - 与历史结果对比                                            │
│     - 检测格式突变                                              │
│     - 检测质量下降                                              │
│     - 检测模式中断                                              │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 生成验证报告                                                │
│     - 汇总验证结果                                              │
│     - 生成改进建议                                              │
│     - 返回 ValidationResult                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 LoopPromptBuilder (循环提示词构建器)

**文件位置**: `src/agent/orchestrator/loop-prompt-builder.ts`

**核心职责**:
- 构建下一轮执行的提示词
- 更新变量状态
- 压缩执行历史
- 整合记忆片段

**接口定义**:

```typescript
interface LoopPromptBuilder {
  buildNextRoundPrompt(context: LoopContext): Promise<string>;
  buildTaskSummary(context: LoopContext): string;
  buildResultReview(result: ExecutorResult, validations: ValidationResult[]): string;
  buildVariableState(variables: Record<string, unknown>): string;
  buildHistorySummary(history: ExecutionLogEntry[]): Promise<string>;
  buildDecisionPoint(context: LoopContext): string;
  compressContext(history: ExecutionHistory): Promise<CompressedContext>;
}

interface LoopContext {
  worktaskId: string;
  iteration: number;
  task: string;
  variables: Record<string, unknown>;
  lastResult?: ExecutorResult;
  executionHistory: ExecutionLogEntry[];
  validationResults: ValidationResult[];
  lastThought?: string;
}

interface CompressedContext {
  summary: string;
  keyDecisions: string[];
  importantObservations: string[];
  currentFocus: string;
  tokenCount: number;
}
```

**提示词结构**:

```typescript
class LoopPromptBuilderImpl implements LoopPromptBuilder {
  async buildNextRoundPrompt(context: LoopContext): Promise<string> {
    const sections: string[] = [];

    // 1. 任务状态摘要
    sections.push(this.buildTaskSummary(context));

    // 2. 上一轮结果回顾
    if (context.lastResult) {
      sections.push(this.buildResultReview(
        context.lastResult, 
        context.validationResults
      ));
    }

    // 3. 变量状态
    sections.push(this.buildVariableState(context.variables));

    // 4. 执行历史摘要（压缩后）
    if (context.iteration > 3) {
      const compressed = await this.compressContext({
        entries: context.executionHistory,
      });
      sections.push(this.buildCompressedHistory(compressed));
    } else {
      sections.push(this.buildRecentHistory(context.executionHistory));
    }

    // 5. 当前决策点
    sections.push(this.buildDecisionPoint(context));

    return sections.join('\n\n');
  }

  buildTaskSummary(context: LoopContext): string {
    return `
## 任务状态摘要

**任务**: ${context.task}
**当前轮次**: ${context.iteration}
**状态**: 执行中

请继续分析当前状态，决定下一步行动。
    `.trim();
  }

  buildResultReview(result: ExecutorResult, validations: ValidationResult[]): string {
    const validationSummary = validations.map(v => 
      `- ${v.passed ? '✓' : '✗'} ${v.score.toFixed(2)}`
    ).join('\n');

    return `
## 上一轮执行结果

**执行状态**: ${result.success ? '成功' : '失败'}
**输出摘要**: ${this.truncate(result.output, 500)}

### 验证结果
${validationSummary}

${result.error ? `**错误信息**: ${result.error.message}` : ''}
    `.trim();
  }

  buildDecisionPoint(context: LoopContext): string {
    return `
## 当前决策点

当前是第 ${context.iteration} 轮执行，请根据以上信息决定：

1. **是否继续执行下一轮？**
   - 任务目标是否已达成？
   - 是否需要更多操作？

2. **是否需要调整策略？**
   - 当前方法是否有效？
   - 是否需要尝试其他方案？

3. **是否需要用户干预？**
   - 遇到无法自动解决的问题？
   - 需要用户确认或输入？

4. **是否满足退出条件？**
   - 任务完成？
   - 达到最大迭代次数？
   - 遇到不可恢复错误？
    `.trim();
  }
}
```

### 4.5 LoopDecisionMaker (循环决策器)

**文件位置**: `src/agent/orchestrator/loop-decision.ts`

**核心职责**:
- 决定是否继续执行
- 调整执行策略
- 判断退出条件
- 处理异常情况

**接口定义**:

```typescript
interface LoopDecisionMaker {
  decide(context: LoopContext, validationResult: ValidationResult): Promise<LoopDecision>;
  shouldContinue(context: LoopContext): Promise<ContinueDecision>;
  shouldPause(context: LoopContext): Promise<PauseDecision>;
  shouldExit(context: LoopContext): Promise<ExitDecision>;
  adjustStrategy(context: LoopContext, issues: ValidationIssue[]): Promise<StrategyAdjustment>;
}

interface LoopDecision {
  action: 'continue' | 'pause' | 'exit';
  reason: string;
  nextAction?: OrchestratorAction;
  config?: Record<string, unknown>;
}

interface ContinueDecision {
  continue: boolean;
  reason: string;
  nextPrompt?: string;
  delay?: number;
}

interface PauseDecision {
  pause: boolean;
  reason: string;
  resumeCondition?: string;
  notifyAgent?: boolean;
  userMessage?: string;
}

interface ExitDecision {
  exit: boolean;
  reason: string;
  finalResult?: WorktaskResult;
  notification?: {
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: Record<string, unknown>;
  };
}

interface StrategyAdjustment {
  type: 'retry' | 'fallback' | 'escalate' | 'replan';
  config: Record<string, unknown>;
  reason: string;
}
```

**决策流程**:

```typescript
class LoopDecisionMakerImpl implements LoopDecisionMaker {
  async decide(
    context: LoopContext, 
    validationResult: ValidationResult
  ): Promise<LoopDecision> {
    // 1. 检查退出条件
    const exitDecision = await this.shouldExit(context);
    if (exitDecision.exit) {
      return {
        action: 'exit',
        reason: exitDecision.reason,
        config: { finalResult: exitDecision.finalResult },
      };
    }

    // 2. 检查暂停条件
    const pauseDecision = await this.shouldPause(context);
    if (pauseDecision.pause) {
      return {
        action: 'pause',
        reason: pauseDecision.reason,
        config: {
          resumeCondition: pauseDecision.resumeCondition,
          notifyAgent: pauseDecision.notifyAgent,
        },
      };
    }

    // 3. 检查是否需要调整策略
    if (!validationResult.passed) {
      const adjustment = await this.adjustStrategy(
        context, 
        validationResult.issues
      );
      
      if (adjustment.type === 'escalate') {
        return {
          action: 'pause',
          reason: adjustment.reason,
          config: { notifyAgent: true },
        };
      }
      
      return {
        action: 'continue',
        reason: `策略调整: ${adjustment.reason}`,
        config: adjustment.config,
      };
    }

    // 4. 正常继续
    const continueDecision = await this.shouldContinue(context);
    return {
      action: 'continue',
      reason: continueDecision.reason,
      config: { delay: continueDecision.delay },
    };
  }

  async shouldExit(context: LoopContext): Promise<ExitDecision> {
    // 检查任务定义的退出条件
    if (context.taskDefinition?.exitCondition) {
      const met = await this.evaluateCondition(
        context.taskDefinition.exitCondition,
        context.variables
      );
      if (met) {
        return {
          exit: true,
          reason: '退出条件已满足',
          finalResult: this.buildFinalResult(context),
        };
      }
    }

    // 检查最大迭代次数
    const maxIterations = context.taskDefinition?.driver?.config?.maxIterations;
    if (maxIterations && context.iteration >= maxIterations) {
      return {
        exit: true,
        reason: `达到最大迭代次数 ${maxIterations}`,
        finalResult: this.buildFinalResult(context),
        notification: {
          type: 'warning',
          message: '任务达到最大迭代次数',
        },
      };
    }

    return { exit: false, reason: '' };
  }

  async shouldPause(context: LoopContext): Promise<PauseDecision> {
    // 检查是否有等待用户确认的步骤
    const pendingConfirm = context.executionHistory.find(
      e => e.type === 'wait' && e.waitType === 'user' && !e.completed
    );
    
    if (pendingConfirm) {
      return {
        pause: true,
        reason: '等待用户确认',
        resumeCondition: 'user_response',
        notifyAgent: true,
        userMessage: pendingConfirm.config?.message,
      };
    }

    // 检查是否有等待事件的步骤
    const pendingEvent = context.executionHistory.find(
      e => e.type === 'wait' && e.waitType === 'event' && !e.completed
    );
    
    if (pendingEvent) {
      return {
        pause: true,
        reason: `等待事件: ${pendingEvent.config?.event}`,
        resumeCondition: `event:${pendingEvent.config?.event}`,
      };
    }

    return { pause: false, reason: '' };
  }
}
```

### 4.6 LoopStateManager (循环状态管理器)

**文件位置**: `src/agent/orchestrator/loop-state-manager.ts`

**核心职责**:
- 管理循环状态持久化
- 检查点创建与恢复
- 状态版本管理
- 清理过期数据

**接口定义**:

```typescript
interface LoopStateManager {
  saveState(state: LoopState): Promise<void>;
  loadState(worktaskId: string): Promise<LoopState | null>;
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
  loadCheckpoint(worktaskId: string): Promise<Checkpoint | null>;
  clearState(worktaskId: string): Promise<void>;
  listCheckpoints(worktaskId: string): Promise<Checkpoint[]>;
}

interface LoopState {
  worktaskId: string;
  iteration: number;
  variables: Record<string, unknown>;
  executionLog: ExecutionLogEntry[];
  validationHistory: ValidationResult[];
  lastPrompt?: string;
  lastThought?: string;
  nextScheduledTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Checkpoint {
  id: string;
  worktaskId: string;
  timestamp: Date;
  iteration: number;
  variables: Record<string, unknown>;
  currentStepId?: string;
  executorContext?: ExecutorContext;
  executionLog: ExecutionLogEntry[];
  type: 'auto' | 'manual' | 'pre_pause' | 'pre_wait';
}
```

**存储结构**:

```
{userHome}/worktasks/{worktaskId}/
├── state.json              # 循环状态
├── checkpoint.json         # 最新检查点
├── checkpoints/            # 历史检查点
│   ├── cp_001.json
│   ├── cp_002.json
│   └── ...
├── context.json            # Executor 上下文
├── variables.json          # 变量状态
├── execution.log           # 执行日志
└── data/                   # 中间数据文件
    ├── extracted_text.txt
    ├── generated_images/
    └── ...
```

### 4.7 Executor 状态管理扩展

**文件位置**: `src/agent/executor/executor.ts` (改造)

**新增能力**:

```typescript
interface ExecutorStateManagement {
  getState(): ExecutorState;
  setState(state: ExecutorState): void;
  saveContext(): Promise<ExecutorContext>;
  loadContext(context: ExecutorContext): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

interface ExecutorState {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'max_iterations';
  iteration: number;
  maxIterations?: number;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
}

interface ExecutorContext {
  messages: CoreMessage[];
  steps: ExecutorStep[];
  variables: Record<string, unknown>;
  lastThought?: string;
  pendingAction?: ToolCall;
  systemMessages: CoreMessage[];
}

// Executor 扩展
class Executor {
  private state: ExecutorState = {
    id: this.id,
    status: 'pending',
    iteration: 0,
  };

  private context: ExecutorContext = {
    messages: [],
    steps: [],
    variables: {},
    systemMessages: [],
  };

  async pause(): Promise<void> {
    if (this.state.status !== 'running') {
      throw new Error('Executor is not running');
    }
    
    this.state.status = 'paused';
    this.state.pausedAt = new Date();
    
    await this.saveContext();
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error('Executor is not paused');
    }
    
    await this.loadContext(this.context);
    this.state.status = 'running';
    this.state.pausedAt = undefined;
    
    // 继续执行
    return this.continueExecution();
  }

  async saveContext(): Promise<ExecutorContext> {
    const context: ExecutorContext = {
      messages: this.messages,
      steps: this.steps,
      variables: this.context.variables,
      lastThought: this.context.lastThought,
      pendingAction: this.context.pendingAction,
      systemMessages: this.systemMessages,
    };

    // 保存到文件系统
    const contextPath = this.getContextPath();
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));

    return context;
  }

  async loadContext(context: ExecutorContext): Promise<void> {
    this.messages = context.messages;
    this.steps = context.steps;
    this.context.variables = context.variables;
    this.context.lastThought = context.lastThought;
    this.context.pendingAction = context.pendingAction;
    this.systemMessages = context.systemMessages;
  }

  private getContextPath(): string {
    return path.join(
      this.options.environment?.getUserHome() || process.cwd(),
      'worktasks',
      this.options.worktaskId,
      'context.json'
    );
  }
}
```

### 4.8 UserConfirmHandler (用户确认处理器)

**文件位置**: `src/agent/interaction/user-confirm-handler.ts`

**核心职责**:
- 发起用户确认请求
- 处理用户响应
- 超时管理
- 与 Agent 通信

**接口定义**:

```typescript
interface UserConfirmHandler {
  requestConfirm(request: ConfirmRequest): Promise<string>;
  handleResponse(worktaskId: string, response: UserResponse): Promise<void>;
  cancelRequest(worktaskId: string): Promise<void>;
  getPendingRequests(): Promise<ConfirmRequest[]>;
}

interface ConfirmRequest {
  id: string;
  worktaskId: string;
  message: string;
  options?: string[];
  timeout?: number;
  createdAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'responded' | 'timeout' | 'cancelled';
}

interface UserResponse {
  requestId: string;
  worktaskId: string;
  choice: string;
  input?: string;
  respondedAt: Date;
}
```

**实现**:

```typescript
class UserConfirmHandlerImpl implements UserConfirmHandler {
  private pendingRequests: Map<string, ConfirmRequest> = new Map();
  private ipcChannel: IPCChannel;

  async requestConfirm(request: ConfirmRequest): Promise<string> {
    // 保存请求
    this.pendingRequests.set(request.id, request);

    // 设置超时
    if (request.timeout) {
      setTimeout(() => {
        this.handleTimeout(request.id);
      }, request.timeout);
    }

    // 通过 IPC 通知 Agent
    this.ipcChannel.send({
      type: 'user_confirm_required',
      worktaskId: request.worktaskId,
      payload: {
        requestId: request.id,
        message: request.message,
        options: request.options,
      },
    });

    // 等待响应
    return new Promise((resolve, reject) => {
      const checkResponse = () => {
        const req = this.pendingRequests.get(request.id);
        if (req?.status === 'responded') {
          resolve(req.response!);
        } else if (req?.status === 'timeout') {
          reject(new Error('User confirm timeout'));
        } else if (req?.status === 'cancelled') {
          reject(new Error('User confirm cancelled'));
        } else {
          setTimeout(checkResponse, 100);
        }
      };
      checkResponse();
    });
  }

  async handleResponse(worktaskId: string, response: UserResponse): Promise<void> {
    const request = this.pendingRequests.get(response.requestId);
    if (!request) {
      throw new Error(`Confirm request not found: ${response.requestId}`);
    }

    request.status = 'responded';
    request.response = response.choice;

    // 通知 Orchestrator 恢复执行
    this.ipcChannel.send({
      type: 'user_confirm_response',
      worktaskId,
      payload: {
        requestId: response.requestId,
        choice: response.choice,
        input: response.input,
      },
    });
  }

  private handleTimeout(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request && request.status === 'pending') {
      request.status = 'timeout';
      
      this.ipcChannel.send({
        type: 'user_confirm_timeout',
        worktaskId: request.worktaskId,
        payload: { requestId },
      });
    }
  }
}
```

### 4.9 Cron 模块

**文件位置**: `src/cron/`

**目录结构**:

```
src/cron/
├── index.ts               # 模块导出
├── scheduler.ts           # 调度器核心
├── job-manager.ts         # 任务管理
├── trigger.ts             # 触发器
├── store.ts               # 存储层
├── types.ts               # 类型定义
└── worktask-integration.ts # Worktask 集成
```

**核心接口**:

```typescript
interface CronScheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
  addJob(job: CronJob): Promise<string>;
  removeJob(jobId: string): Promise<void>;
  updateJob(jobId: string, updates: Partial<CronJob>): Promise<void>;
  getJob(jobId: string): Promise<CronJob | null>;
  listJobs(filter?: JobFilter): Promise<CronJob[]>;
  triggerJob(jobId: string): Promise<void>;
}

interface CronJob {
  id: string;
  name: string;
  description?: string;
  
  scheduleType: 'at' | 'every' | 'cron';
  scheduleAt?: Date;
  scheduleInterval?: number;
  scheduleExpression?: string;
  timezone: string;
  
  payloadType: 'worktask' | 'agent' | 'skill' | 'workflow';
  payloadContent: Record<string, unknown>;
  
  worktaskId?: string;
  agentId?: string;
  
  state: {
    nextRunAt?: Date;
    lastRunAt?: Date;
    lastResult?: JobResult;
    runCount: number;
  };
  
  status: 'enabled' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

interface JobResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  timestamp: Date;
}
```

**与 Worktask 集成**:

```typescript
interface CronWorktaskIntegration {
  createJobForWorktask(worktaskId: string, config: CronConfig): Promise<string>;
  updateJobSchedule(worktaskId: string, schedule: ScheduleUpdate): Promise<void>;
  cancelJobForWorktask(worktaskId: string): Promise<void>;
  onJobTrigger(jobId: string): Promise<void>;
}

class CronWorktaskIntegrationImpl implements CronWorktaskIntegration {
  private scheduler: CronScheduler;
  private worktaskScheduler: WorktaskScheduler;

  async createJobForWorktask(
    worktaskId: string, 
    config: CronConfig
  ): Promise<string> {
    const job: CronJob = {
      id: generateId(),
      name: `worktask-${worktaskId}`,
      scheduleType: config.type,
      scheduleExpression: config.cron,
      scheduleInterval: config.interval,
      timezone: config.timezone || 'UTC',
      payloadType: 'worktask',
      payloadContent: { worktaskId },
      worktaskId,
      status: 'enabled',
      state: { runCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const jobId = await this.scheduler.addJob(job);
    
    // 计算下次执行时间
    const nextRunAt = this.calculateNextRun(job);
    await this.scheduler.updateJob(jobId, {
      state: { ...job.state, nextRunAt },
    });

    return jobId;
  }

  async onJobTrigger(jobId: string): Promise<void> {
    const job = await this.scheduler.getJob(jobId);
    if (!job || !job.worktaskId) return;

    // 触发 Worktask 执行
    await this.worktaskScheduler.trigger(job.worktaskId, {
      type: 'cron',
      timestamp: new Date(),
      payload: { jobId },
    });

    // 更新任务状态
    await this.scheduler.updateJob(jobId, {
      state: {
        ...job.state,
        lastRunAt: new Date(),
        runCount: job.state.runCount + 1,
        nextRunAt: this.calculateNextRun(job),
      },
    });
  }
}
```

## 5. 数据模型扩展

### 5.1 Worktask 扩展字段

**表**: `t_worktask`

**新增字段**:

| 字段名称 | 数据类型 | 说明 |
|---------|---------|------|
| driver_type | VARCHAR(20) | 驱动类型: once/loop/polling/event/cron |
| driver_config | JSON | 驱动配置 |
| iteration | INT | 当前迭代次数 |
| max_iterations | INT | 最大迭代次数 |
| next_trigger_time | DATETIME | 下次触发时间 |
| last_trigger_time | DATETIME | 上次触发时间 |
| cron_job_id | VARCHAR(36) | 关联的 Cron 任务 ID |
| checkpoint_id | VARCHAR(36) | 最新检查点 ID |

### 5.2 新增表结构

#### t_task_checkpoint (任务检查点表)

```sql
CREATE TABLE t_task_checkpoint (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联 Worktask ID',
    iteration INT NOT NULL COMMENT '迭代次数',
    type VARCHAR(20) NOT NULL COMMENT '检查点类型: auto/manual/pre_pause/pre_wait',
    variables JSON COMMENT '变量状态',
    current_step_id VARCHAR(36) COMMENT '当前步骤 ID',
    executor_context JSON COMMENT 'Executor 上下文',
    execution_log JSON COMMENT '执行日志',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_checkpoint_worktask (worktask_id),
    INDEX idx_checkpoint_iteration (worktask_id, iteration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务检查点表';
```

#### t_loop_state (循环状态表)

```sql
CREATE TABLE t_loop_state (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联 Worktask ID',
    iteration INT NOT NULL COMMENT '当前迭代次数',
    variables JSON COMMENT '变量状态',
    execution_log JSON COMMENT '执行日志',
    validation_history JSON COMMENT '验证历史',
    last_prompt TEXT COMMENT '上一轮提示词',
    last_thought TEXT COMMENT '上一轮思考',
    next_scheduled_time DATETIME COMMENT '下次计划执行时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    UNIQUE INDEX idx_loop_state_worktask (worktask_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='循环状态表';
```

#### t_user_confirm_request (用户确认请求表)

```sql
CREATE TABLE t_user_confirm_request (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联 Worktask ID',
    message TEXT NOT NULL COMMENT '确认消息',
    options JSON COMMENT '选项列表',
    timeout INT COMMENT '超时时间(毫秒)',
    status VARCHAR(20) NOT NULL COMMENT '状态: pending/responded/timeout/cancelled',
    response VARCHAR(200) COMMENT '用户响应',
    response_input TEXT COMMENT '用户输入',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    responded_at DATETIME COMMENT '响应时间',
    expires_at DATETIME COMMENT '过期时间',
    
    INDEX idx_confirm_worktask (worktask_id),
    INDEX idx_confirm_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户确认请求表';
```

## 6. Orchestrator 改造

### 6.1 扩展接口

```typescript
interface OrchestratorLoopExtension {
  orchestrateLoop(): Promise<WorktaskResult>;
  validateResult(result: ExecutorResult, step: PlanStep): Promise<ValidationResult>;
  buildNextRoundPrompt(context: LoopContext): Promise<string>;
  decideNextAction(context: LoopContext, validation: ValidationResult): Promise<LoopDecision>;
  saveLoopState(): Promise<void>;
  loadLoopState(): Promise<void>;
}
```

### 6.2 改造后的 orchestrate 方法

```typescript
class Orchestrator {
  private loopStateManager: LoopStateManager;
  private resultValidator: ResultValidator;
  private promptBuilder: LoopPromptBuilder;
  private decisionMaker: LoopDecisionMaker;

  async orchestrate(): Promise<WorktaskResult> {
    const driverType = this.worktask.driverType || 'once';

    switch (driverType) {
      case 'once':
        return this.orchestrateOnce();
      case 'loop':
      case 'polling':
      case 'cron':
        return this.orchestrateLoop();
      case 'event':
        return this.orchestrateEventDriven();
      default:
        return this.orchestrateOnce();
    }
  }

  async orchestrateLoop(): Promise<WorktaskResult> {
    // 加载循环状态
    const savedState = await this.loopStateManager.loadState(this.worktask.id);
    let iteration = savedState?.iteration || 0;
    let variables = savedState?.variables || this.initializeVariables();

    const maxIterations = this.worktask.maxIterations || 100;

    while (iteration < maxIterations) {
      iteration++;
      this.iteration = iteration;

      // 构建当前轮次提示词
      const prompt = await this.promptBuilder.buildNextRoundPrompt({
        worktaskId: this.worktask.id,
        iteration,
        task: this.task,
        variables,
        lastResult: this.lastResult,
        executionHistory: this.executionLog,
        validationResults: this.validationHistory,
      });

      // 执行 ReAct 循环
      const result = await this.executeReactLoop(prompt);

      // 验证结果
      const validation = await this.resultValidator.validate(result, {
        customValidator: this.getExpectation(),
      });
      this.validationHistory.push(validation);

      // 更新变量
      variables = this.updateVariables(variables, result);

      // 保存循环状态
      await this.loopStateManager.saveState({
        worktaskId: this.worktask.id,
        iteration,
        variables,
        executionLog: this.executionLog,
        validationHistory: this.validationHistory,
        updatedAt: new Date(),
      });

      // 决策下一步
      const decision = await this.decisionMaker.decide(
        { iteration, variables, task: this.task },
        validation
      );

      switch (decision.action) {
        case 'exit':
          return this.buildFinalResult(decision.finalResult);
        
        case 'pause':
          await this.handlePause(decision);
          return this.buildPausedResult();
        
        case 'continue':
          this.lastResult = result;
          // 继续下一轮
          continue;
      }
    }

    // 达到最大迭代次数
    return this.buildMaxIterationsResult();
  }

  private async executeReactLoop(prompt: string): Promise<ExecutorResult> {
    // Thought
    const thought = await this.think(prompt);
    
    // Action
    const action = this.parseAction(thought);
    
    // Observation
    const observation = await this.executeAction(action);
    
    // 如果需要 spawn Executor
    if (action.type === 'spawn_executor') {
      const result = await this.spawnExecutor({
        id: generateId(),
        description: action.task,
        type: 'executor',
        dependencies: [],
        config: action.config,
        status: 'pending',
      });
      
      return result;
    }
    
    // 继续内部 ReAct 循环
    return this.executeReactLoop(prompt);
  }
}
```

## 7. 实施计划

### 7.1 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           实施阶段规划                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  阶段一: 基础能力 (P0)                                                       │
│  ├── Executor 状态管理与恢复                                                │
│  ├── LoopStateManager 实现                                                  │
│  ├── 数据库表结构更新                                                        │
│  └── 预计工期: 3-5 天                                                       │
│                                                                             │
│  阶段二: 执行引擎 (P0)                                                       │
│  ├── TaskDefinitionExecutor 实现                                            │
│  ├── 步骤执行器实现                                                          │
│  ├── 变量系统实现                                                            │
│  └── 预计工期: 5-7 天                                                       │
│                                                                             │
│  阶段三: 循环决策 (P1)                                                       │
│  ├── ResultValidator 实现                                                   │
│  ├── LoopPromptBuilder 实现                                                 │
│  ├── LoopDecisionMaker 实现                                                 │
│  └── 预计工期: 3-5 天                                                       │
│                                                                             │
│  阶段四: 调度集成 (P1)                                                       │
│  ├── WorktaskScheduler 实现                                                 │
│  ├── Cron 模块实现                                                          │
│  ├── CronWorktaskIntegration 实现                                           │
│  └── 预计工期: 5-7 天                                                       │
│                                                                             │
│  阶段五: 用户交互 (P2)                                                       │
│  ├── UserConfirmHandler 实现                                                │
│  ├── Agent 通信扩展                                                          │
│  ├── UI 集成接口                                                             │
│  └── 预计工期: 3-5 天                                                       │
│                                                                             │
│  阶段六: 集成测试 (P3)                                                       │
│  ├── 场景一测试                                                              │
│  ├── 场景二测试                                                              │
│  ├── 场景三测试                                                              │
│  └── 预计工期: 3-5 天                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 文件清单

**新增文件**:

```
src/
├── agent/
│   ├── scheduler/
│   │   ├── worktask-scheduler.ts
│   │   └── types.ts
│   ├── orchestrator/
│   │   ├── result-validator.ts
│   │   ├── loop-prompt-builder.ts
│   │   ├── loop-decision.ts
│   │   └── loop-state-manager.ts
│   ├── executor/
│   │   ├── task-definition-executor.ts
│   │   ├── step-executors/
│   │   │   ├── action-step-executor.ts
│   │   │   ├── condition-step-executor.ts
│   │   │   ├── loop-step-executor.ts
│   │   │   ├── parallel-step-executor.ts
│   │   │   └── wait-step-executor.ts
│   │   └── variable-resolver.ts
│   └── interaction/
│       ├── user-confirm-handler.ts
│       └── types.ts
└── cron/
    ├── index.ts
    ├── scheduler.ts
    ├── job-manager.ts
    ├── trigger.ts
    ├── store.ts
    ├── types.ts
    └── worktask-integration.ts
```

**改造文件**:

```
src/
├── agent/
│   ├── orchestrator/
│   │   └── orchestrator.ts          # 扩展长程循环能力
│   ├── executor/
│   │   └── executor.ts              # 新增状态管理与恢复
│   └── worktask/
│       ├── worktask-manager.ts      # 扩展循环状态管理
│       └── types.ts                 # 新增循环相关类型
```

### 7.3 依赖关系

```
阶段一 (基础能力)
    │
    ├── Executor 状态管理
    │       │
    │       └── 依赖: 无
    │
    └── LoopStateManager
            │
            └── 依赖: Executor 状态管理

阶段二 (执行引擎)
    │
    └── TaskDefinitionExecutor
            │
            ├── 依赖: Executor
            └── 依赖: LoopStateManager

阶段三 (循环决策)
    │
    ├── ResultValidator
    │       │
    │       └── 依赖: 无
    │
    ├── LoopPromptBuilder
    │       │
    │       └── 依赖: 无
    │
    └── LoopDecisionMaker
            │
            ├── 依赖: ResultValidator
            └── 依赖: LoopPromptBuilder

阶段四 (调度集成)
    │
    ├── WorktaskScheduler
    │       │
    │       ├── 依赖: TaskDefinitionExecutor
    │       └── 依赖: LoopStateManager
    │
    └── Cron 模块
            │
            └── 依赖: WorktaskScheduler

阶段五 (用户交互)
    │
    └── UserConfirmHandler
            │
            └── 依赖: LoopStateManager

阶段六 (集成测试)
    │
    └── 依赖: 所有模块
```

## 8. 风险与注意事项

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 循环决策不稳定 | 可能导致无限循环或过早退出 | 设置最大迭代次数、人工干预机制 |
| 上下文过长 | Token 消耗过大、响应变慢 | 实现上下文压缩、滑动窗口 |
| 检查点数据丢失 | 无法恢复任务状态 | 多副本存储、定期备份 |
| Cron 触发延迟 | 任务执行不及时 | 分布式调度、心跳检测 |

### 8.2 性能考虑

| 场景 | 优化策略 |
|------|---------|
| 高频轮询 | 批量处理、增量更新 |
| 大量并发任务 | 任务队列、限流控制 |
| 长时间运行任务 | 定期保存检查点、资源释放 |
| 大量执行历史 | 历史压缩、归档策略 |

### 8.3 兼容性考虑

| 兼容点 | 处理方式 |
|--------|---------|
| 现有 Worktask | 新字段设置默认值，不影响现有逻辑 |
| 现有 Orchestrator | 保留 orchestrateOnce 方法，新增 orchestrateLoop |
| 现有 Executor | 扩展状态管理，不改变核心执行逻辑 |
| 现有 IPC 协议 | 新增消息类型，保持向后兼容 |

## 9. 测试策略

### 9.1 单元测试

| 模块 | 测试重点 |
|------|---------|
| TaskDefinitionExecutor | 步骤解析、变量替换、条件判断 |
| ResultValidator | 验证逻辑、质量评分、异常检测 |
| LoopPromptBuilder | 提示词生成、上下文压缩 |
| LoopDecisionMaker | 决策逻辑、边界条件 |
| WorktaskScheduler | 调度逻辑、状态转换 |

### 9.2 集成测试

| 场景 | 测试内容 |
|------|---------|
| 场景一 | 直播间状态检查、评论处理、商机收集、直播结束处理 |
| 场景二 | 文案提取、重构、用户确认、多平台发布 |
| 场景三 | 定时触发、多 URL 并行、结果汇总 |

### 9.3 压力测试

| 测试项 | 指标 |
|--------|------|
| 并发任务数 | 100+ 并发 Worktask |
| 长时间运行 | 24+ 小时持续运行 |
| 检查点恢复 | 1000+ 次暂停恢复 |
| Cron 触发 | 10000+ 次定时触发 |

## 10. 文档更新

需要同步更新的文档:

| 文档 | 更新内容 |
|------|---------|
| `design/agent/orchestrator.md` | 新增循环决策、结果验证章节 |
| `design/agent/executor.md` | 新增状态管理、恢复机制章节 |
| `design/agent/worktask.md` | 新增循环状态字段说明 |
| `design/cron/README.md` | 新增 Worktask 集成说明 |
| `design/agent/database/` | 新增表结构文档 |

---

**文档版本**: v1.0
**创建日期**: 2026-03-23
**最后更新**: 2026-03-23
