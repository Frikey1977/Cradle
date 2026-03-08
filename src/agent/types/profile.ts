/**
 * 多维度画像系统类型定义
 *
 * 三类核心画像：
 * 1. 用户画像 - 了解对方是谁
 * 2. Agent 画像 - 知道自己是谁
 * 3. 关系画像 - 了解双方关系
 */

import type { ShortTermMemoryEntry } from "../memory/types.js";

// ==================== 基础类型 ====================

/**
 * 公司信息
 */
export interface CompanyInfo {
  companyId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  culture?: string; // 企业文化
  type: string;
}

/**
 * 部门信息
 */
export interface DepartmentInfo {
  departmentId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  culture?: string; // 部门文化
  type: string;
  parentId?: string;
  path: string;
  leaderId?: string;
}

/**
 * 岗位信息
 */
export interface PositionInfo {
  positionId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  level?: string;
  type?: string;
  // 其他字段根据实际表结构动态获取
}

// ==================== 三类核心画像 ====================

/**
 * 用户画像
 * 来自 t_contacts.profile + 关联的组织信息
 */
export interface ContactProfile {
  contactId: string;
  type: 'employee' | 'customer' | 'partner' | 'visitor';
  sourceId?: string; // 关联的 t_employees.sid（当 type='employee' 时）
  name: string;

  // 完整的 profile JSON
  profile?: Record<string, any>;

  // 组织信息（仅当 type='employee' 时存在）
  organization?: {
    company?: CompanyInfo;
    department?: DepartmentInfo;
    position?: PositionInfo;
    location?: string; // 工作地点
  };
}

/**
 * Agent 画像
 * 来自 t_agents.profile + 关联的组织信息
 */
export interface AgentProfile {
  agentId: string;
  name: string;
  eName?: string;
  agentNo: string;

  // 灵魂设定
  soul?: string;

  // 完整的 profile JSON (包含 facts, preferences 等)
  profile?: Record<string, any>;

  // 组织信息
  organization?: {
    company?: CompanyInfo;
    department?: DepartmentInfo;
    position?: PositionInfo;
  };
}

/**
 * 关系画像（双向）
 * 来自 t_relationship
 */
export interface RelationshipProfile {
  relationshipId: string;
  agentId: string;
  contactId: string;

  // 用户对 Agent 的偏好 (contact_agent JSON)
  contactToAgent?: Record<string, any>;

  // Agent 对用户的偏好 (agent_contact JSON)
  agentToContact?: Record<string, any>;

  // 短期记忆 (short_term_memory JSON)
  shortTermMemory?: ShortTermMemoryEntry[];
}

/**
 * 场景画像（动态生成）
 */
export interface ScenarioProfile {
  timeContext: string;
  locationContext?: string;
  businessContext?: string;
  urgency?: string;
}

/**
 * 画像集合 - 三类核心画像
 */
export interface ProfileCollection {
  // 用户画像
  contact?: ContactProfile;

  // Agent 画像
  agent?: AgentProfile;

  // 关系画像
  relationship?: RelationshipProfile;

  // 场景画像
  scenario?: ScenarioProfile;
}

// ==================== 画像加载参数 ====================

/**
 * 画像加载参数
 */
export interface ProfileLoadParams {
  agentId: string;
  contactId: string;
  conversationId?: string;
}

// ==================== 兼容旧代码 ====================

/** @deprecated 使用 ProfileCollection 替代 */
export type FiveProfiles = ProfileCollection;

/** @deprecated 使用 ContactProfile 替代 */
export type ContactProfileOld = ContactProfile;

/** @deprecated 使用 AgentProfile 替代 */
export type AgentProfileDetailed = AgentProfile;
