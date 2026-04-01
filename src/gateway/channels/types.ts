/**
 * 通道消息类型定义
 * 参考 OpenClaw 的 types.core.ts 和 templating.ts 设计
 * 适配我们的 Cradle 架构
 */

/**
 * 聊天类型
 * - direct: 私聊/单聊
 * - group: 群组
 * - channel: 频道/广播
 */
export type ChatType = "direct" | "group" | "channel";

/**
 * 标准化聊天类型
 */
export function normalizeChatType(raw?: string): ChatType | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "direct" || value === "dm" || value === "private") {
    return "direct";
  }
  if (value === "group") {
    return "group";
  }
  if (value === "channel" || value === "broadcast") {
    return "channel";
  }
  return undefined;
}

/**
 * 通道类型标识
 */
export type ChannelType =
  | "webui"
  | "dingtalk"
  | "telegram"
  | "discord"
  | "slack"
  | "whatsapp"
  | "signal"
  | "imessage"
  | "wechat"
  | "feishu"
  | string;

/**
 * 入站消息上下文
 * 包含消息的完整信息，用于路由和处理
 */
export interface InboundMessageContext {
  /** 消息唯一ID */
  messageId: string;
  /** 消息文本内容 */
  body: string;
  /** 发送者ID（通道特定） */
  senderId: string;
  /** 发送者显示名称 */
  senderName?: string;
  /** 发送者用户名（如果有） */
  senderUsername?: string;
  /** 接收者ID（通常是Agent的通道身份） */
  recipientId: string;
  /** 会话/聊天ID */
  chatId: string;
  /** 聊天类型 */
  chatType: ChatType;
  /** 通道类型 */
  channelType: ChannelType;
  /** 通道名称 */
  channelName?: string;
  /** 账户ID（多账户场景） */
  accountId?: string;
  /** 回复的消息ID */
  replyToId?: string;
  /** 线程/话题ID */
  threadId?: string | number;
  /** 消息时间戳 */
  timestamp: number;
  /** 是否被@提及 */
  wasMentioned?: boolean;
  /** 群组/频道名称 */
  groupName?: string;
  /** 音频数据（Base64） */
  audio?: {
    data: string;
    format: string;
    duration?: number;
  };
  /** 图片数据（Base64数组） */
  images?: string[];
  /** 是否使用流式输出 */
  stream?: boolean;
  /** 是否显示思考过程 */
  thinkingMessage?: boolean;
  /** 是否语音回复 */
  voiceResponse?: boolean;
  /** 语音合成音色 */
  voice?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 原始消息数据（通道特定） */
  raw?: unknown;
}

/**
 * 出站消息上下文
 * 用于发送消息到通道
 */
export interface OutboundMessageContext {
  /** 目标地址 */
  to: string;
  /** 消息文本 */
  text: string;
  /** 通道类型 */
  channelType: ChannelType;
  /** 聊天类型 */
  chatType?: ChatType;
  /** 账户ID（发送者） */
  accountId?: string;
  /** 回复的消息ID */
  replyToId?: string;
  /** 线程/话题ID */
  threadId?: string | number;
  /** 是否使用Markdown */
  useMarkdown?: boolean;
  /** 附件列表 */
  attachments?: Array<{
    type: "image" | "file" | "audio";
    url: string;
    name?: string;
  }>;
  /** 音频输出（Base64，用于TTS） */
  audio?: {
    data: string;
    format: string;
    duration?: number;
  };
  /** 原始上下文（用于回调） */
  originalContext?: InboundMessageContext;
  /** 是否为语音识别结果消息 */
  isRecognitionResult?: boolean;
  /** 识别文本 */
  recognizedText?: string;
  /** 请求ID（用于关联） */
  requestId?: string;
}

/**
 * 通道能力接口
 * 定义通道支持的功能
 */
export interface ChannelCapabilities {
  /** 支持富文本（Markdown/HTML） */
  supportsRichText: boolean;
  /** 支持附件 */
  supportsAttachments: boolean;
  /** 支持线程/话题 */
  supportsThreads: boolean;
  /** 支持回复 */
  supportsReplies: boolean;
  /** 支持编辑消息 */
  supportsMessageEditing: boolean;
  /** 支持删除消息 */
  supportsMessageDeletion: boolean;
  /** 支持反应/表情 */
  supportsReactions: boolean;
  /** 支持提及 */
  supportsMentions: boolean;
  /** 支持私聊 */
  supportsDM: boolean;
  /** 支持群组 */
  supportsGroups: boolean;
  /** 支持频道 */
  supportsChannels: boolean;
  /** 支持的聊天类型 */
  chatTypes?: ChatType[];
  /** 支持回复 */
  reply?: boolean;
  /** 支持媒体 */
  media?: boolean;
  /** 支持编辑 */
  edit?: boolean;
  /** 支持流式传输 */
  streaming?: boolean;
  /** 最大消息长度 */
  maxMessageLength?: number;
  /** 支持的附件类型 */
  supportedAttachmentTypes?: string[];
}

/**
 * 通道配置接口
 * 用于通道插件初始化
 */
export interface ChannelConfig {
  /** 通道唯一标识 (name 字段) */
  name: string;
  /** 通道类型 */
  type: string;
  /** 是否启用 */
  enabled: boolean;
  /** 配置参数 */
  config: Record<string, unknown>;
  /** 客户端配置 */
  clientConfig?: Record<string, unknown>;
  /** 通道ID (兼容旧代码) */
  channelId?: string;
  /** 通道名称 (兼容旧代码) */
  channelName?: string;
  /** 通道类型 (兼容旧代码) */
  channelType?: ChannelType;
  /** 凭证信息 */
  credentials?: Record<string, string>;
  /** 企业ID */
  enterpriseId?: string;
}

/**
 * ============================================================
 * 通道管理类型定义（数据库实体）
 * ============================================================
 */

/**
 * 通道状态
 */
export type ChannelStatus = "active" | "error" | "disabled";

/**
 * 通道实体（数据库）
 */
export interface Channel {
  sid: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  clientConfig?: Record<string, any>;
  status: ChannelStatus;
  lastError?: string;
  lastConnectedAt?: Date;
  createTime: Date;
  updateTime: Date;
}

/**
 * 创建通道 DTO
 */
export interface CreateChannelDto {
  name: string;
  description?: string;
  config: Record<string, any>;
  clientConfig?: Record<string, any>;
  status?: ChannelStatus;
}

/**
 * 更新通道 DTO
 */
export interface UpdateChannelDto {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  clientConfig?: Record<string, any>;
  status?: ChannelStatus;
  lastError?: string;
  lastConnectedAt?: Date;
}

/**
 * 通道查询参数
 */
export interface ChannelQuery {
  status?: ChannelStatus;
  keyword?: string;
}

/**
 * 更新状态 DTO
 */
export interface UpdateStatusDto {
  status: ChannelStatus;
}
