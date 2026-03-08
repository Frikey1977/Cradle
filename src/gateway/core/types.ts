/**
 * Gateway 核心类型定义
 * 
 * 定义消息、路由、Agent 等核心概念
 * 参考 OpenClaw 的 MsgContext 设计
 */

/**
 * 消息角色
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * 消息内容类型
 */
export type ContentType = "text" | "image" | "file" | "mixed";

/**
 * 消息内容块
 * 支持多模态内容
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "file"; url: string; name: string; mimeType?: string };

/**
 * 标准化消息格式
 * 用于 Gateway 内部传递和 LLM 交互
 */
export interface StandardMessage {
  /** 消息唯一ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 内容（纯文本或内容块数组） */
  content: string | ContentBlock[];
  /** 内容类型 */
  contentType: ContentType;
  /** 发送者ID */
  senderId: string;
  /** 发送者名称 */
  senderName?: string;
  /** 时间戳 */
  timestamp: number;
  /** 回复的消息ID */
  replyTo?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 会话上下文
 * 包含对话历史和状态
 */
export interface ConversationContext {
  /** 会话ID */
  conversationId: string;
  /** Contact ID */
  contactId: string;
  /** Agent ID */
  agentId: string;
  /** 通道ID */
  channelId: string;
  /** 消息历史 */
  messages: StandardMessage[];
  /** 会话状态 */
  state: "active" | "paused" | "closed";
  /** 创建时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActiveAt: number;
  /** 上下文变量 */
  variables?: Record<string, unknown>;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent ID */
  id: string;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description?: string;
  /** 岗位/职位 */
  position: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 使用的模型 */
  model: string;
  /** 模型参数 */
  modelParams?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  /** 能力标签 */
  capabilities?: string[];
  /** 是否启用 */
  enabled: boolean;
  /** 陌生人处理策略 */
  strangerPolicy: StrangerPolicy;
  /** 最大上下文长度 */
  maxContextLength?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 陌生人处理策略
 */
export type StrangerPolicy = 
  | "auto_accept"      // 自动接受并回复
  | "verify_first"     // 先验证身份
  | "admin_approve"    // 需要管理员审批
  | "ignore";          // 忽略

/**
 * 陌生人信息
 */
export interface StrangerInfo {
  /** 发送者标识 */
  senderId: string;
  /** 发送者名称 */
  senderName?: string;
  /** 通道类型 */
  channelType: string;
  /** 通道ID */
  channelId: string;
  /** 首次联系时间 */
  firstSeenAt: number;
  /** 验证状态 */
  verificationStatus: "pending" | "verified" | "rejected";
  /** 验证问题（如果有） */
  verificationQuestion?: string;
}

/**
 * 路由决策
 */
export interface RouteDecision {
  /** 目标 Agent ID */
  agentId: string;
  /** 目标 Worker ID */
  workerId?: string;
  /** 联系人ID */
  contactId?: string;
  /** 是否允许路由 */
  allowed?: boolean;
  /** 优先级（数字越小优先级越高） */
  priority?: number;
  /** 路由原因 */
  reason?: string;
  /** 是否需要陌生人处理 */
  needsStrangerHandling?: boolean;
  /** 决策时间 */
  decidedAt?: number;
}

/**
 * 处理结果
 */
export interface ProcessResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** 处理时间（毫秒） */
  processingTime: number;
}

/**
 * LLM 请求配置
 */
export interface LLMRequestConfig {
  /** 请求ID */
  requestId: string;
  /** 模型名称 */
  model: string;
  /** 消息列表 */
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  /** 是否流式输出 */
  stream: boolean;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 系统提示词 */
  systemPrompt?: string;
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  /** 请求ID */
  requestId: string;
  /** 完整内容 */
  content?: string;
  /** 流式内容块 */
  chunk?: string;
  /** 是否完成 */
  done: boolean;
  /** 错误信息 */
  error?: string;
  /** Token 使用情况 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 响应时间（毫秒） */
  responseTime: number;
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  /** 工作进程数 */
  workerCount: number;
  /** Agent 进程数 */
  agentCount: number;
  /** LLM 连接池大小 */
  llmPoolSize: number;
  /** 消息队列大小 */
  messageQueueSize: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number;
  /** 进程超时时间（毫秒） */
  processTimeout: number;
  /** 是否启用流式输出 */
  enableStreaming: boolean;
}

/**
 * 默认 Gateway 配置
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  workerCount: 4,
  agentCount: 2,
  llmPoolSize: 4,
  messageQueueSize: 1000,
  heartbeatInterval: 30000,
  processTimeout: 300000,
  enableStreaming: true,
};

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 创建标准消息
 */
export function createStandardMessage(
  role: MessageRole,
  content: string,
  senderId: string,
  options?: {
    senderName?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  },
): StandardMessage {
  return {
    id: generateId(),
    role,
    content,
    contentType: "text",
    senderId,
    senderName: options?.senderName,
    timestamp: Date.now(),
    replyTo: options?.replyTo,
    metadata: options?.metadata,
  };
}

/**
 * 创建会话上下文
 */
export function createConversationContext(
  contactId: string,
  agentId: string,
  channelId: string,
): ConversationContext {
  const now = Date.now();
  return {
    conversationId: generateId(),
    contactId,
    agentId,
    channelId,
    messages: [],
    state: "active",
    createdAt: now,
    lastActiveAt: now,
  };
}
