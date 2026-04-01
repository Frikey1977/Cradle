/**
 * 心跳模块类型定义
 */

/**
 * 活跃时间配置
 */
export interface ActiveHours {
  start: string;
  end: string;
  timezone: string;
}

/**
 * 上下文块
 */
export interface ContextBlock {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  enabled: boolean;
  order: number;
}

/**
 * 自定义上下文配置
 */
export interface CustomContextConfig {
  enabled: boolean;
  blocks: ContextBlock[];
}

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  enabled: boolean;
  intervalSeconds: number;
  activeHours: ActiveHours;
  prompt: string;
  customContext?: CustomContextConfig;
  isRunning?: boolean;
  lastRunAt?: number | null;
  nextDueAt?: number | null;
  status?: "idle" | "running" | "paused" | "error";
}

/**
 * 心跳运行时状态
 */
export interface HeartbeatState {
  isRunning: boolean;
  lastRunAt: number | null;
  nextDueAt: number | null;
  consecutiveErrors: number;
  lastError: string | null;
  status: "idle" | "running" | "paused" | "error";
}

/**
 * 心跳控制动作
 */
export type HeartbeatAction = "start" | "stop" | "trigger";

/**
 * 心跳控制请求
 */
export interface HeartbeatControlRequest {
  agentId: string;
  action: HeartbeatAction;
}

/**
 * 心跳状态响应
 */
export interface HeartbeatStatusResponse {
  agentId: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: number | null;
  nextDueAt: number | null;
  status: "idle" | "running" | "paused" | "error";
}

/**
 * 心跳执行结果
 */
export interface HeartbeatExecutionResult {
  success: boolean;
  content?: string;
  error?: string;
  timestamp: number;
}

/**
 * 心跳事件类型
 */
export type HeartbeatEventType =
  | "started"
  | "stopped"
  | "triggered"
  | "completed"
  | "error"
  | "skipped"
  | "push-message"; // 推送消息到前端

/**
 * 心跳事件
 */
export interface HeartbeatEvent {
  type: HeartbeatEventType;
  agentId: string;
  timestamp: number;
  data?: any;
}

/**
 * 心跳管理器配置
 */
export interface HeartbeatManagerConfig {
  agentId: string;
  config: HeartbeatConfig;
  onExecute: (prompt: string) => Promise<string>;
  onEvent?: (event: HeartbeatEvent) => void;
}

/**
 * 默认心跳配置
 */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: false,
  intervalSeconds: 1800,
  activeHours: {
    start: "09:00",
    end: "18:00",
    timezone: "Asia/Shanghai",
  },
  prompt: "检查当前事项，如有异常请报告",
};

/**
 * 默认心跳状态
 */
export const DEFAULT_HEARTBEAT_STATE: HeartbeatState = {
  isRunning: false,
  lastRunAt: null,
  nextDueAt: null,
  consecutiveErrors: 0,
  lastError: null,
  status: "idle",
};
