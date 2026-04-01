/**
 * Worktask 数据模型
 *
 * Worktask 是运行时任务隔离的核心概念，由 Orchestrator 负责创建和维护。
 * 每个 Worktask 代表一个独立的任务执行单元。
 */

/**
 * Worktask 状态
 */
export type WorktaskStatus =
  | "created"
  | "planning"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 任务计划步骤
 */
export interface PlanStep {
  id: string;
  order: number;
  description: string;
  type: "executor" | "tool_call" | "skill_call" | "decision";
  dependencies: string[];
  config: {
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
    timeout?: number;
    retries?: number;
  };
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  executorId?: string;
  result?: StepResult;
  critical?: boolean;
}

/**
 * 步骤结果
 */
export interface StepResult {
  stepId: string;
  description: string;
  success: boolean;
  output: string;
  duration: number;
  error?: string;
}

/**
 * 任务计划
 */
export interface TaskPlan {
  steps: PlanStep[];
  strategy: "serial" | "parallel" | "hybrid";
  estimatedDuration?: number;
  dependencies: DependencyGraph;
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

/**
 * Worktask Todo 项
 */
export interface WorktaskTodo {
  id: string;
  worktaskId: string;
  content: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  order: number;
  stepId?: string;
  executorId?: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Executor 记录
 */
export interface ExecutorRecord {
  id: string;
  worktaskId: string;
  stepId: string;
  task: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
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
  contextSnapshot?: Record<string, unknown>;
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, unknown>;
  result: string;
  duration: number;
  success: boolean;
}

/**
 * Token 使用量
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Worktask 进度
 */
export interface WorktaskProgress {
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

/**
 * 进度事件
 */
export interface ProgressEvent {
  timestamp: Date;
  type: ProgressEventType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 进度事件类型
 */
export type ProgressEventType =
  | "created"
  | "planning_started"
  | "planning_completed"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "executor_spawned"
  | "executor_completed"
  | "executor_failed"
  | "paused"
  | "resumed"
  | "completed"
  | "failed";

/**
 * Worktask 上下文
 */
export interface WorktaskContext {
  profiles?: {
    contact?: Partial<ContactProfile>;
    agent?: Partial<AgentProfile>;
    relationship?: Partial<RelationshipProfile>;
  };
  memoryFragments?: MemoryFragment[];
  skillBody?: SkillBody[];
  constraints?: {
    timeout?: number;
    maxExecutors?: number;
    allowedTools?: string[];
  };
  cronJobId?: string;
  taskDefinition?: unknown;
  inputs?: Record<string, unknown>;
}

/**
 * 联系人画像（简化版）
 */
export interface ContactProfile {
  id: string;
  name: string;
  facts?: string[];
  preferences?: Record<string, unknown>;
}

/**
 * Agent 画像（简化版）
 */
export interface AgentProfile {
  id: string;
  name: string;
  facts?: string[];
  preferences?: Record<string, unknown>;
}

/**
 * 关系画像（简化版）
 */
export interface RelationshipProfile {
  trustLevel?: number;
  interactionCount?: number;
  lastInteraction?: Date;
}

/**
 * 记忆片段
 */
export interface MemoryFragment {
  id: string;
  content: string;
  type: string;
  relevance?: number;
  timestamp?: Date;
}

/**
 * Skill Body
 */
export interface SkillBody {
  slug?: string;
  name?: string;
  description?: string;
  location?: string;
  commands?: SkillCommand[];
  parameters?: Record<string, unknown>;
}

/**
 * Skill 命令
 */
export interface SkillCommand {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Executor 结果
 */
export interface ExecutorResult {
  success: boolean;
  output: string;
  steps: ExecutorStep[];
  error?: Error;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Executor 步骤
 */
export interface ExecutorStep {
  type: "thought" | "tool_call" | "tool_result" | "text";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    args: unknown;
  };
  toolResult?: {
    callId: string;
    output: string;
  };
}

/**
 * Worktask 结果
 */
export interface WorktaskResult {
  success: boolean;
  output: string;
  summary?: string;
  steps: StepResult[];
  executors: ExecutorRecord[];
  metrics: {
    totalDuration: number;
    totalSteps: number;
    totalExecutors: number;
    successRate: number;
    tokenUsage: TokenUsage;
  };
  artifacts?: {
    files?: string[];
    data?: Record<string, unknown>;
  };
}

/**
 * 驱动类型
 */
export type DriverType = "user" | "cron" | "polling" | "event" | "api";

/**
 * 驱动配置
 */
export interface DriverConfig {
  type: DriverType;
  config?: {
    cronExpression?: string;
    pollingInterval?: number;
    eventSource?: string;
    apiEndpoint?: string;
    [key: string]: unknown;
  };
  nextTriggerTime?: Date;
}

/**
 * 循环状态
 */
export interface LoopState {
  loopCount: number;
  maxLoops?: number;
  lastDecision?: "continue" | "pause" | "exit";
  lastDecisionReason?: string;
  lastObservation?: string;
  pauseReason?: string;
  waitingForUserInput?: boolean;
  userConfirmRequired?: boolean;
  userConfirmData?: Record<string, unknown>;
}

/**
 * 循环决策结果
 */
export interface LoopDecision {
  action: "continue" | "pause" | "exit";
  reason: string;
  nextTask?: string;
  pauseReason?: string;
  userConfirmRequired?: boolean;
  userConfirmData?: Record<string, unknown>;
  nextTriggerTime?: Date;
}

/**
 * 任务检查点
 */
export interface TaskCheckpoint {
  id?: string;
  worktaskId: string;
  executorId?: string;
  type: "executor_context" | "orchestrator_context" | "loop_state" | "intermediate_data";
  data: Record<string, unknown>;
  iteration: number;
  createdAt?: Date;
}

/**
 * Worktask 完整数据结构
 */
export interface Worktask {
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
  loopState?: LoopState;
  driver?: DriverConfig;
}

/**
 * 创建 Worktask 参数
 */
export interface CreateWorktaskParams {
  agentId: string;
  contactId: string;
  conversationId: string;
  task: string;
  description?: string;
  context?: WorktaskContext;
  driver?: DriverConfig;
  loopState?: Partial<LoopState>;
}

/**
 * Worktask 过滤器
 */
export interface WorktaskFilter {
  agentId?: string;
  contactId?: string;
  conversationId?: string;
  status?: WorktaskStatus | WorktaskStatus[];
  driverType?: DriverType;
  createdAfter?: Date;
  createdBefore?: Date;
  completedAfter?: Date;
  completedBefore?: Date;
}