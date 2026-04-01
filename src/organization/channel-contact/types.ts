/**
 * 通道联系人绑定类型定义
 */

/**
 * 通道联系人绑定实体
 */
export interface ChannelContact {
  /** 通道ID */
  channelId: string;
  /** 联系人ID */
  contactId: string;
  /** 发送者标识 */
  sender: string;
  /** 通道名称 */
  channelName?: string;
  /** 创建时间 */
  createTime?: string;
}

/**
 * 通道联系人绑定查询参数
 */
export interface ChannelContactQuery {
  /** 联系人ID */
  contactId?: string;
  /** 源ID（如员工ID） */
  sourceId?: string;
  /** 源类型 */
  sourceType?: string;
  /** 通道ID */
  channelId?: string;
}

/**
 * 创建通道联系人绑定DTO
 */
export interface CreateChannelContactDto {
  /** 通道ID */
  channelId: string;
  /** 发送者标识 */
  sender: string;
}

/**
 * 更新通道联系人绑定DTO
 */
export interface UpdateChannelContactDto {
  /** 发送者标识 */
  sender: string;
}
