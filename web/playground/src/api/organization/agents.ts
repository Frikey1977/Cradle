import { requestClient } from "#/api/request";

export namespace OrganizationAgentApi {
  export type ServiceMode = string;
  export type ServicePattern = string;

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

  export interface ActiveHours {
    start: string;
    end: string;
    timezone: string;
  }

  export interface ContextBlock {
    id: string;
    role: "system" | "user" | "assistant";
    content: string;
    enabled: boolean;
    order: number;
  }

  export interface CustomContextConfig {
    enabled: boolean;
    blocks: ContextBlock[];
  }

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

  export type HeartbeatAction = "start" | "stop" | "trigger";

  export interface HeartbeatControlRequest {
    agentId: string;
    action: HeartbeatAction;
  }

  export interface HeartbeatStatusResponse {
    agentId: string;
    enabled: boolean;
    isRunning: boolean;
    lastRunAt: number | null;
    nextDueAt: number | null;
    status: "idle" | "running" | "paused" | "error";
  }

  export interface AgentProfile {
    facts?: string[];
    preferences?: Record<string, any>;
    [key: string]: any;
  }

  export interface Agent {
    [key: string]: any;
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
    facts?: Record<string, any>;
    preferences?: Record<string, any>;
    heartbeat?: HeartbeatConfig;
    status: string;
    createTime?: string;
    timestamp?: string;
  }

  export interface AgentListResult {
    items: Agent[];
    total: number;
    page: number;
    pageSize: number;
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

  export interface AgentSkillConfig {
    sid?: string;
    agentId: string;
    skillId: string;
    skillName?: string;
    config?: Record<string, any>;
    env?: Record<string, any>;
    invocation?: Record<string, any>;
    status?: string;
    priority?: number;
    createTime?: string;
  }

  export interface BindUserDto {
    agentId: string;
    userId: string;
  }

  export interface AgentSkillConfigDto {
    agentId: string;
    skillId: string;
    config?: Record<string, any>;
    env?: Record<string, any>;
    invocation?: Record<string, any>;
    status?: string;
    priority?: number;
  }
}

/**
 * 获取 Agent 列表
 * @param params 查询参数
 */
async function getAgentList(params?: OrganizationAgentApi.AgentQuery) {
  return requestClient.get<OrganizationAgentApi.AgentListResult>(
    "/organization/agents",
    { params },
  );
}

/**
 * 获取 Agent 详情
 * @param id Agent ID
 */
async function getAgentDetail(id: string) {
  return requestClient.get<OrganizationAgentApi.Agent>(`/organization/agents/${id}`);
}

/**
 * 创建 Agent
 * @param data Agent 数据
 */
async function createAgent(
  data: Omit<OrganizationAgentApi.Agent, "id" | "createTime" | "timestamp" | "orgName">,
) {
  return requestClient.post("/organization/agents", data);
}

/**
 * 更新 Agent
 * @param id Agent ID
 * @param data Agent 数据
 */
async function updateAgent(
  id: string,
  data: Partial<Omit<OrganizationAgentApi.Agent, "id" | "createTime" | "timestamp" | "orgName">>,
) {
  return requestClient.put(`/organization/agents/${id}`, data);
}

/**
 * 删除 Agent
 * @param id Agent ID
 */
async function deleteAgent(id: string) {
  return requestClient.delete(`/organization/agents/${id}`);
}

/**
 * 检查 Agent 编号是否存在
 * @param agentNo Agent 编号
 * @param id 排除的 Agent ID（编辑时使用）
 */
async function isAgentNoExists(agentNo: string, id?: string) {
  return requestClient.get<boolean>("/organization/agents/agent-no-exists", {
    params: { agentNo, id },
  });
}

/**
 * 绑定用户（专属模式）
 * @param data 绑定数据
 */
async function bindUser(data: OrganizationAgentApi.BindUserDto) {
  return requestClient.post("/organization/agents/bind-user", data);
}

/**
 * 解绑用户
 * @param agentId Agent ID
 */
async function unbindUser(agentId: string) {
  return requestClient.post("/organization/agents/unbind-user", { agentId });
}

/**
 * 获取 Agent Skill 配置列表
 * @param agentId Agent ID
 */
async function getAgentSkillConfigs(agentId: string) {
  return requestClient.get<OrganizationAgentApi.AgentSkillConfig[]>(
    `/organization/agents/${agentId}/skills`,
  );
}

/**
 * 配置 Agent Skill
 * @param data Skill 配置数据
 */
async function configAgentSkill(data: OrganizationAgentApi.AgentSkillConfigDto) {
  return requestClient.post("/organization/agents/skill/config", data);
}

/**
 * 删除 Agent 技能配置
 * @param agentId Agent ID
 * @param skillId 技能 ID
 */
async function deleteAgentSkillConfig(agentId: string, skillId: string) {
  return requestClient.delete(`/organization/agents/${agentId}/skills/${skillId}`);
}

/**
 * 获取当前登录用户绑定的 Agent 列表
 */
async function getMyAgents() {
  return requestClient.get<OrganizationAgentApi.AgentListResult>(
    "/organization/agents/my/agents",
  );
}

/**
 * 更新心跳配置
 * @param agentId Agent ID
 * @param config 心跳配置
 */
async function updateHeartbeatConfig(agentId: string, config: OrganizationAgentApi.HeartbeatConfig) {
  try {
    const result = await requestClient.put(`/organization/agents/${agentId}/heartbeat`, config);
    return result;
  } catch (error) {
    console.error(`[API] updateHeartbeatConfig error:`, error);
    throw error;
  }
}

/**
 * 获取心跳配置
 * @param agentId Agent ID
 */
async function getHeartbeatConfig(agentId: string) {
  return requestClient.get<OrganizationAgentApi.HeartbeatConfig>(
    `/organization/agents/${agentId}/heartbeat`,
  );
}

/**
 * 控制心跳（启动/停止/触发）
 * @param data 控制请求数据
 */
async function controlHeartbeat(data: OrganizationAgentApi.HeartbeatControlRequest) {
  const url = `/organization/agents/${data.agentId}/heartbeat/control`;
  try {
    const result = await requestClient.post(url, {
      action: data.action,
    });
    return result;
  } catch (error) {
    console.error(`[API] controlHeartbeat error:`, error);
    throw error;
  }
}

/**
 * 获取心跳状态
 * @param agentId Agent ID
 */
async function getHeartbeatStatus(agentId: string) {
  return requestClient.get<OrganizationAgentApi.HeartbeatStatusResponse>(
    `/organization/agents/${agentId}/heartbeat/status`,
  );
}

export interface HeartbeatLogEntry {
  id: number;
  timestamp: Date;
  agentId: string;
  agentName?: string;
  type: "started" | "stopped" | "triggered" | "completed" | "error" | "skipped";
  prompt?: string;
  result?: string;
  error?: string;
  nextDueAt?: number;
}

/**
 * 获取心跳日志
 * @param agentId Agent ID
 * @param limit 限制数量
 */
async function getHeartbeatLogs(agentId: string, limit: number = 20) {
  return requestClient.get<HeartbeatLogEntry[]>(
    `/organization/agents/${agentId}/heartbeat/logs`,
    { params: { limit } },
  );
}

/**
 * 注册客户端到 Agent
 * WebSocket 认证成功后调用，用于接收心跳消息等推送
 * @param agentId Agent ID
 * @param contactId 联系人 ID
 */
async function registerClient(agentId: string, contactId: string) {
  try {
    const result = await requestClient.post(
      `/organization/agents/${agentId}/client/register`,
      { contactId },
    );
    return result;
  } catch (error) {
    console.error(`[API] registerClient error:`, error);
    throw error;
  }
}

/**
 * 从 Agent 注销客户端
 * WebSocket 断开连接时调用
 * @param agentId Agent ID
 * @param contactId 联系人 ID
 */
async function unregisterClient(agentId: string, contactId: string) {
  try {
    const result = await requestClient.post(
      `/organization/agents/${agentId}/client/unregister`,
      { contactId },
    );
    return result;
  } catch (error) {
    console.error(`[API] unregisterClient error:`, error);
    throw error;
  }
}

/**
 * 获取 Agent 原始上下文
 * @param agentId Agent ID
 * @param contactId 联系人 ID（可选）
 * @param conversationId 会话 ID（可选）
 */
async function getAgentRawContext(
  agentId: string,
  contactId?: string,
  conversationId?: string,
) {
  const params = new URLSearchParams();
  if (contactId) params.append("contactId", contactId);
  if (conversationId) params.append("conversationId", conversationId);

  return requestClient.get<{
    systemPrompt: string;
    systemMessages: Array<{ role: string; category?: string; content: string }>;
    modelConfig: any;
    conversationHistory: Array<{ role: string; content: string; timestamp?: number }>;
    memories: any[];
    availableTools: any[];
    metadata: any;
    contactName?: string;
    environment?: any;
  }>(`/organization/agents/${agentId}/raw-context`, {
    params,
  });
}

export {
  createAgent,
  deleteAgent,
  deleteAgentSkillConfig,
  getAgentDetail,
  getAgentList,
  getMyAgents,
  getAgentSkillConfigs,
  isAgentNoExists,
  bindUser,
  unbindUser,
  configAgentSkill,
  updateAgent,
  updateHeartbeatConfig,
  getHeartbeatConfig,
  controlHeartbeat,
  getHeartbeatStatus,
  getHeartbeatLogs,
  registerClient,
  unregisterClient,
  getAgentRawContext,
};
