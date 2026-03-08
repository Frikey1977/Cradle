/**
 * 发送消息 outbound 类型定义
 * 从 OpenClaw 提取并简化
 */

/**
 * 发送文本消息参数
 */
export interface SendTextParams {
  /** 目标地址 */
  to: string;
  /** 消息文本 */
  text: string;
  /** 账户ID（多账户场景） */
  accountId?: string | null;
  /** 回复的消息ID */
  replyToId?: string | null;
  /** 线程/话题ID */
  threadId?: string | number | null;
  /** 是否静默发送 */
  silent?: boolean;
}

/**
 * 发送媒体消息参数
 */
export interface SendMediaParams {
  /** 目标地址 */
  to: string;
  /** 消息文本 */
  text: string;
  /** 媒体文件URL */
  mediaUrl?: string;
  /** 本地媒体文件根目录 */
  mediaLocalRoots?: readonly string[];
  /** 账户ID */
  accountId?: string | null;
  /** 回复的消息ID */
  replyToId?: string | null;
  /** 线程/话题ID */
  threadId?: string | number | null;
  /** 是否静默发送 */
  silent?: boolean;
}

/**
 * 发送结果
 */
export interface SendResult {
  /** 通道类型 */
  channel: string;
  /** 消息ID */
  messageId: string;
  /** 聊天/频道ID */
  chatId?: string;
  /** 额外元数据 */
  meta?: Record<string, unknown>;
}

/**
 * Outbound 适配器接口
 * 简化版，适配我们的架构
 */
export interface OutboundAdapter {
  /** 投递模式 */
  deliveryMode: "direct" | "gateway" | "hybrid";
  /** 文本分块大小限制 */
  textChunkLimit: number;
  /** 发送文本消息 */
  sendText: (params: SendTextParams) => Promise<SendResult>;
  /** 发送媒体消息 */
  sendMedia?: (params: SendMediaParams) => Promise<SendResult>;
}
