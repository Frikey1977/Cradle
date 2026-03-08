import { requestClient } from "#/api/request";

export namespace OrganizationAgentApi {
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
    avatar?: string;
    config?: AgentConfig;
    profile?: AgentProfile;
    soul?: string; // 灵魂/人格描述，纯文本字段
    facts?: Record<string, any>;
    preferences?: Record<string, any>;
    heartbeat?: AgentHeartbeat;
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
 * 删除 Agent Skill 配置
 * @param agentId Agent ID
 * @param skillId Skill ID
 */
async function deleteAgentSkillConfig(agentId: string, skillId: string) {
  return requestClient.delete(`/organization/agents/${agentId}/skills/${skillId}`);
}

export {
  createAgent,
  deleteAgent,
  deleteAgentSkillConfig,
  getAgentDetail,
  getAgentList,
  getAgentSkillConfigs,
  isAgentNoExists,
  bindUser,
  unbindUser,
  configAgentSkill,
  updateAgent,
};
