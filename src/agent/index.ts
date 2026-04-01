/**
 * Agent 模块
 *
 * Cradle Agent 运行时核心
 *
 * 三层架构：
 * - Agent 层：用户交互、意图识别、结果汇总
 * - Orchestrator 层：任务编排、ReAct 循环、Worktask 管理
 * - Executor 层：具体任务执行、工具调用
 *
 * 长程循环任务支持：
 * - Loop 模块：循环提示词构建、决策、调度
 * - Cron 模块：定时任务调度
 * - TaskDefinition 模块：JSON 任务定义执行
 */

// 类型定义
export * from "./types/index.js";

// 运行时
export * from "./runtime/index.js";

// 上下文
export * from "./context/index.js";

// 记忆
export * from "./memory/index.js";

// Worktask（任务隔离与持久化）
export {
  WorktaskManager,
  CheckpointManager,
  generateId,
  type Worktask,
  type WorktaskStatus,
  type WorktaskProgress,
  type WorktaskTodo,
  type WorktaskResult,
  type TaskPlan,
  type PlanStep,
  type ExecutorRecord,
  type CreateWorktaskParams,
  type WorktaskFilter,
  type LoopState,
  type LoopDecision,
  type TaskCheckpoint,
  type DriverConfig,
  type DriverType,
  type ExecutorContextSnapshot,
  type OrchestratorContextSnapshot,
} from "./worktask/index.js";

// Executor 层
export {
  Executor,
  createExecutor,
  type ExecutorOptions,
  type ExecutorResult,
  type ExecutorStep,
  type ExecutorModelConfig,
  type SystemBlock,
} from "./executor/index.js";

// Orchestrator 层
export {
  Orchestrator,
  OrchestratorFactory,
  AgentOrchestratorIntegration,
  type OrchestratorOptions,
  type OrchestratorConfig,
  type OrchestratorContext,
  type OrchestratorProgressEvent,
  type TaskExecutionResult as OrchestratorTaskResult,
  type AgentOrchestratorOptions,
  type AgentOrchestratorConfig,
} from "./orchestrator/index.js";

// IPC 通信
export {
  IPCBus,
  InMemoryIPCChannel,
  IPCMessageBuilder,
  createProgressReport,
  createCompletionMessage,
  createErrorMessage,
  type IPCMessage,
  type IPCChannel,
  type AgentIPCMessage,
  type AgentMessageType,
  type ProgressReportMessage,
} from "./ipc/index.js";

// Loop 循环任务模块
export {
  LoopPromptBuilder,
  LoopDecisionMaker,
  WorktaskScheduler,
  createLoopDecisionMaker,
  createWorktaskScheduler,
  type LoopContext,
  type LoopPromptOptions,
  type DecisionContext,
  type DecisionOptions,
  type SchedulerConfig,
  type TriggerRequest,
  type SchedulerEvent,
  type SchedulerEventType,
  type ActiveTask,
} from "./loop/index.js";

// Cron 定时任务模块
export {
  CronJobRepository,
  CronScheduler,
  CronWorktaskIntegration,
  createCronScheduler,
  createCronWorktaskIntegration,
  type CronJob,
  type CreateCronJobParams,
  type CronJobFilter,
  type CronJobHistory,
  type CronJobExecutionResult,
  type CronJobSchedule,
  type CronJobPayload,
  type CronJobDelivery,
  type CronJobState,
  type ScheduleType,
  type SessionTarget,
  type WakeMode,
  type PayloadType,
  type DeliveryMode,
  type ExecutionStatus,
  type JobExecutor,
  type CronSchedulerConfig,
  type CronSchedulerEvents,
  type CronWorktaskIntegrationConfig,
  type CreateCronWorktaskParams,
} from "./cron/index.js";

// TaskDefinition 任务定义模块
export {
  TaskDefinitionExecutor,
  ResultValidator,
  UserConfirmHandler,
  createTaskDefinitionExecutor,
  createResultValidator,
  createUserConfirmHandler,
  validateTaskDefinition,
  createTaskDefinition,
  commonValidationRules,
  type TaskDefinition,
  type TaskStep,
  type TaskStepType,
  type TaskCondition,
  type TaskBranch,
  type TaskExecutionContext,
  type TaskStepResult,
  type TaskExecutionResult,
  type TaskExecutorConfig,
  type SkillExecutor,
  type ValidationRule,
  type ValidationRuleType,
  type ValidationResult,
  type ValidationError,
  type ValidationContext,
  type UserConfirmRequest,
  type UserConfirmResponse,
  type PendingConfirm,
  type ConfirmChannel,
  type UserConfirmHandlerConfig,
} from "./task-definition/index.js";
