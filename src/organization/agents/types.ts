/**
 * Agent 管理类型定义
 */

export type ServiceMode = string;
export type ServicePattern = string;

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
}

export interface AgentConfig {
  model?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  runtime?: {
    identity?: {
      emoji?: string;
      displayName?: string;
    };
    behavior?: {
      humanDelay?: {
        enabled?: boolean;
        minSeconds?: number;
        maxSeconds?: number;
      };
    };
  };
}

export interface AgentProfile {
  [key: string]: any;
}

export interface Agent {
  id: string;
  name: string;
  eName?: string;
  title?: string;
  agentNo: string;
  description?: string;
  oid: string;
  orgName?: string;
  positionId: string;
  positionTitle?: string;
  mode: ServiceMode;
  pattern?: ServicePattern;
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: HeartbeatConfig; // 心跳配置
  status: string;
  createTime?: string;
  timestamp?: string;
}

export interface CreateAgentDto {
  name: string;
  eName?: string;
  title?: string;
  agentNo: string;
  description?: string;
  oid: string;
  positionId?: string;
  mode?: ServiceMode;
  pattern?: ServicePattern;
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: HeartbeatConfig; // 心跳配置
  status?: string;
}

export interface UpdateAgentDto {
  name?: string;
  eName?: string;
  title?: string;
  agentNo?: string;
  description?: string;
  oid?: string;
  positionId?: string;
  mode?: ServiceMode;
  pattern?: ServicePattern;
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: HeartbeatConfig; // 心跳配置
  status?: string;
}

export interface AgentQuery {
  oid?: string;
  mode?: ServiceMode;
  pattern?: ServicePattern;
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AgentListResult {
  items: Agent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AgentNoExistsQuery {
  agentNo: string;
  id?: string;
}

export interface BindUserDto {
  agentId: string;
  userId: string;
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
