import { requestClient } from "#/api/request";

/**
 * Agent-Contact 绑定信息
 */
export interface AgentContactBinding {
  sid: string;
  agentId: string;
  contactId: string;
  contactName: string;
  contactType: string;
  employeeId?: string;
  employeeName?: string;
  employeeNo?: string;
  departmentId?: string;
  departmentName?: string;
  companyId?: string;
  companyName?: string;
  owner?: boolean;
  createTime?: string;
  updateTime?: string;
}

/**
 * 记忆联系人信息（用于记忆管理 Tab）
 */
export interface MemoryContactInfo {
  sid: string;
  agentId: string;
  contactId: string;
  contactName?: string;
  contactType?: string;
  employeeId?: string;
  employeeName?: string;
  employeeNo?: string;
  departmentId?: string;
  departmentName?: string;
  companyId?: string;
  companyName?: string;
  hasShortTermMemory?: boolean;
  lastInteractionTime?: string;
  createTime?: string;
}

/**
 * 绑定 Agent 到员工请求参数
 */
export interface BindAgentEmployeeDto {
  agentId: string;
  employeeId: string;
  oid?: string;
}

/**
 * 短期记忆条目（精简版）
 * 只保留核心字段：timestamp, channel, role, content, type
 */
export interface ShortTermMemoryEntry {
  /** 时间戳 */
  timestamp: number;
  /** 通道标识：cradle, wechat 等 */
  channel: string;
  /** 角色：user, agent */
  role: "user" | "agent";
  /** 消息内容 */
  content: string;
  /** 消息类型：text, audio 等 */
  type: "text" | "audio" | "image" | "file";
}

/**
 * 获取短期记忆（对话历史）
 * @param agentId Agent ID
 * @param contactId Contact ID
 */
export async function getShortTermMemory(agentId: string, contactId: string) {
  return requestClient.get<ShortTermMemoryEntry[]>(
    `/organization/relationships/${agentId}/${contactId}/short-term-memory`,
  );
}

/**
 * 更新短期记忆（对话历史）
 * @param agentId Agent ID
 * @param contactId Contact ID
 * @param shortTermMemory 短期记忆数据
 */
export async function updateShortTermMemory(
  agentId: string,
  contactId: string,
  shortTermMemory: ShortTermMemoryEntry[],
) {
  return requestClient.put<{ shortTermMemory: ShortTermMemoryEntry[] }>(
    `/organization/relationships/${agentId}/${contactId}/short-term-memory`,
    { shortTermMemory },
  );
}

/**
 * 获取 Agent 绑定的联系人列表
 * @param agentId Agent ID
 */
export async function getAgentContacts(agentId: string) {
  return requestClient.get<AgentContactBinding[]>(
    `/organization/relationships/contacts/agent/${agentId}`,
  );
}

/**
 * 绑定 Agent 到员工
 * @param data 绑定参数
 */
export async function bindAgentToEmployee(data: BindAgentEmployeeDto) {
  return requestClient.post<AgentContactBinding>(
    "/organization/relationships/bind",
    data,
  );
}

/**
 * 解绑 Agent 和 Contact
 * @param agentId Agent ID
 * @param contactId Contact ID
 */
export async function unbindAgentContact(agentId: string, contactId: string) {
  return requestClient.delete<void>(
    `/organization/relationships/agent/${agentId}/contact/${contactId}`,
  );
}

/**
 * 获取 Agent 的记忆联系人列表（用于记忆管理 Tab）
 * @param agentId Agent ID
 */
export async function getAgentMemoryContacts(agentId: string) {
  return requestClient.get<MemoryContactInfo[]>(
    `/organization/relationships/memory-contacts/agent/${agentId}`,
  );
}
