/**
 * 数据库实体类型定义
 * 
 * 对应设计文档中的表结构
 */

/**
 * 通道配置表 (t_channels)
 */
export interface ChannelEntity {
  /** 主键UUID */
  sid: string;
  /** 通道类型: cradle/wechat/dingtalk/lark/slack/discord/email/webhook */
  channel_type: string;
  /** 通道名称（显示用） */
  channel_name: string;
  /** 通道配置（非敏感，JSON） */
  config: Record<string, unknown> | null;
  /** 凭证（敏感信息，加密存储） */
  credentials: string | null;
  /** 是否启用: 0=禁用, 1=启用 */
  enabled: number;
  /** 状态: active/error/disabled */
  status: string;
  /** 最后错误信息 */
  last_error: string | null;
  /** 最后连接时间 */
  last_connected_at: Date | null;
  /** 所属企业ID（NULL表示系统默认） */
  enterprise_id: string | null;
  /** 创建时间 */
  create_time: Date;
  /** 更新时间 */
  update_time: Date;
}

/**
 * Contact 通道绑定表 (r_channel_contact)
 */
export interface ChannelContactEntity {
  /** 主键UUID */
  sid: string;
  /** 通道ID，外键关联 t_channels */
  channel_id: string;
  /** 发送者在通道内的唯一标识（由IM生成） */
  sender: string;
  /** 联系人ID，外键关联 t_contacts */
  contact_id: string;
  /** 绑定来源: webui_scan/admin_bind/auto_create */
  bind_source: string | null;
  /** 是否验证: 0=未验证, 1=已验证 */
  verified: number;
  /** 状态: active/inactive */
  status: string;
  /** 创建时间 */
  create_time: Date;
  /** 更新时间 */
  update_time: Date;
}

/**
 * Agent 通道绑定表 (r_channel_agent)
 */
export interface ChannelAgentEntity {
  /** 主键UUID */
  sid: string;
  /** 通道ID，外键关联 t_channels */
  channel_id: string;
  /** Agent 在通道内的标识 */
  identity: string;
  /** Agent ID，外键关联 t_agents */
  agent_id: string;
  /** 通道特定配置（JSON） */
  config: Record<string, unknown> | null;
  /** 状态: active/inactive */
  status: string;
  /** 创建时间 */
  create_time: Date;
  /** 更新时间 */
  update_time: Date;
}

/**
 * 通道类型枚举
 */
export type ChannelType = 
  | "cradle" 
  | "wechat" 
  | "dingtalk" 
  | "lark" 
  | "slack" 
  | "discord" 
  | "email" 
  | "webhook";

/**
 * 通道状态枚举
 */
export type ChannelStatus = "active" | "error" | "disabled";

/**
 * 绑定来源枚举
 */
export type BindSource = "webui_scan" | "admin_bind" | "auto_create";

/**
 * 绑定状态枚举
 */
export type BindStatus = "active" | "inactive";

/**
 * 查询 Contact 通道身份结果
 */
export interface ContactChannelIdentity {
  /** Contact ID */
  contactId: string;
  /** 通道ID */
  channelId: string;
  /** 通道类型 */
  channelType: string;
  /** 发送者标识 */
  sender: string;
  /** 是否已验证 */
  verified: boolean;
  /** 绑定状态 */
  status: BindStatus;
}

/**
 * 查询 Agent 通道身份结果
 */
export interface AgentChannelIdentity {
  /** Agent ID */
  agentId: string;
  /** 通道ID */
  channelId: string;
  /** 通道类型 */
  channelType: string;
  /** 通道内标识 */
  identity: string;
  /** 通道特定配置 */
  config: Record<string, unknown> | null;
  /** 绑定状态 */
  status: BindStatus;
}
