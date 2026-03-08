/**
 * Agent 管理类型定义
 */

export type ServiceMode = "exclusive" | "shared" | "public" | "department";

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

export interface AgentHeartbeat {
  enabled?: boolean;
  interval?: string;
  lastRun?: string;
  config?: Record<string, any>;
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
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: AgentHeartbeat;
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
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: AgentHeartbeat;
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
  avatar?: string;
  config?: AgentConfig;
  profile?: AgentProfile;
  soul?: string; // 灵魂/人格描述，纯文本字段
  heartbeat?: AgentHeartbeat;
  status?: string;
}

export interface AgentQuery {
  oid?: string;
  mode?: ServiceMode;
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
