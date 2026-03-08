/**
 * 通道Agent绑定类型定义
 * 对应表: r_channel_agent
 */

/**
 * 通道Agent绑定实体
 */
export interface ChannelAgent {
  /** 通道ID */
  channelId: string;
  /** Agent ID */
  agentId: string;
  /** Agent在通道内的标识 */
  identity: string;
  /** 通道特定配置 */
  config?: Record<string, any>;
  /** 通道名称 */
  channelName?: string;
  /** 创建时间 */
  createTime?: string;
}

/**
 * 通道Agent绑定查询参数
 */
export interface ChannelAgentQuery {
  /** Agent ID */
  agentId?: string;
  /** 通道ID */
  channelId?: string;
}

/**
 * 创建通道Agent绑定DTO
 */
export interface CreateChannelAgentDto {
  /** 通道ID（t_channels.sid） */
  channelId: string;
  /** Agent在通道内的标识 */
  identity: string;
  /** 通道特定配置 */
  config?: Record<string, any>;
}

/**
 * 更新通道Agent绑定DTO
 */
export interface UpdateChannelAgentDto {
  /** Agent在通道内的标识 */
  identity: string;
  /** 通道特定配置 */
  config?: Record<string, any>;
}
