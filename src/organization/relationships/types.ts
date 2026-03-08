/**
 * Agent-Contact 关系管理类型定义
 * 对应设计文档: design/memory/database/t_relationship.md
 */

import type { Contact } from "../contact/types.js";

export interface Relationship {
  sid: string;
  agentId: string;
  contactId: string;
  contactAgent?: ContactAgentView;
  agentContact?: AgentContactView;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

// Contact 视角：Contact 对 Agent 的偏好
export interface ContactAgentView {
  intimacy?: number;
  trust?: number;
  interactionMode?: {
    formality?: string;
    frequency?: string;
    topics?: string[];
  };
  specialPreferences?: string[];
  keyMemories?: Array<{
    type: string;
    content: string;
    createdAt: string;
  }>;
}

// Agent 视角：Agent 对 Contact 的学习
export interface AgentContactView {
  intimacy?: number;
  trust?: number;
  bindingMode?: string;
  learnedPreferences?: {
    likes?: string[];
    dislikes?: string[];
    topics?: string[];
  };
  communicationStyle?: {
    formality?: string;
    verbosity?: string;
    responseTime?: string;
  };
  keyMemories?: Array<{
    type: string;
    content: string;
    createdAt: string;
  }>;
}

// 绑定 DTO
export interface BindAgentContactDto {
  agentId: string;
  contactId: string;
  oid?: string;
}

// 绑定 Agent 到员工 DTO
export interface BindAgentEmployeeDto {
  agentId: string;
  employeeId: string;
  oid?: string;
}

// Agent-Contact 绑定结果（包含员工信息）
export interface AgentContactBinding {
  sid: string;
  agentId: string;
  contactId: string;
  employeeId?: string;
  employeeName?: string;
  employeeNo?: string;
  departmentId?: string;
  departmentName?: string;
  createTime?: string;
}

// 记忆联系人信息（用于记忆管理 Tab）
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

// 查询参数
export interface RelationshipQuery {
  agentId?: string;
  contactId?: string;
  page?: number;
  pageSize?: number;
}

// 更新 DTO
export interface UpdateRelationshipDto {
  contactAgent?: ContactAgentView;
  agentContact?: AgentContactView;
}
