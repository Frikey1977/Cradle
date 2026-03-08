/**
 * 记忆模块类型定义
 *
 * 四层记忆系统架构：
 * - Layer 1: 对话日志层 (Conversation Logs) - 原始对话记录
 * - Layer 2: 长期记忆层 (Long-term Memory) - 向量存储的精炼知识
 * - Layer 3: 记忆索引层 (Memory Index) - 主题到记忆的映射
 * - Layer 4: 短期记忆层 (Short-term Memory) - 当前会话上下文
 */

// ==================== 基础类型 ====================

/**
 * 对话消息角色
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 记忆层级类型
 */
export type MemoryLayerType = "conversation" | "long-term" | "index" | "short-term";

/**
 * 记忆条目基础接口
 */
export interface BaseMemoryEntry {
  /** 消息ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 关联的 Agent ID */
  agentId: string;
  /** 关联的 Contact ID */
  contactId: string;
}

// ==================== Layer 4: 短期记忆层 ====================

/**
 * 短期记忆条目（精简版）
 * 只保留核心字段：id, timestamp, channel, role, content, type
 */
export interface ShortTermMemoryEntry {
  /** 消息ID */
  id: string;
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
 * 短期记忆数据结构
 * 存储在 t_relationship.short_term_memory 字段中
 */
export interface ShortTermMemory {
  /** 对话条目列表 */
  entries: ShortTermMemoryEntry[];
  /** 最后更新时间 */
  lastUpdated: number;
}

// ==================== Layer 1: 对话日志层 ====================

/**
 * 对话日志条目
 */
export interface ConversationLogEntry extends BaseMemoryEntry {
  /** 会话ID */
  conversationId: string;
  /** 渠道名称 */
  channelName?: string;
  /** 消息类型 */
  messageType: "text" | "audio" | "image" | "file" | "system";
  /** 原始数据（用于审计） */
  rawData?: Record<string, any>;
}

/**
 * 对话日志文件结构
 */
export interface ConversationLog {
  /** 日期 */
  date: string;
  /** 条目列表 */
  entries: ConversationLogEntry[];
  /** 元数据 */
  metadata: {
    agentId: string;
    contactId: string;
    totalEntries: number;
  };
}

// ==================== Layer 2: 长期记忆层 ====================

/**
 * 长期记忆条目
 */
export interface LongTermMemoryEntry {
  /** 记忆ID */
  id: string;
  /** 时间戳（用于BaseMemoryLayer兼容） */
  timestamp: number;
  /** 主题 */
  subject: string;
  /** 内容摘要 */
  summary: string;
  /** 关键事实 */
  facts: string[];
  /** 关联的对话日志ID */
  sourceLogIds: string[];
  /** 时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
  /** 向量嵌入 */
  embedding?: number[];
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

// ==================== Layer 3: 记忆索引层 ====================

/**
 * 主题索引条目
 */
export interface SubjectIndexEntry {
  /** 主题ID（作为主键） */
  id: string;
  /** 时间戳（用于BaseMemoryLayer兼容） */
  timestamp: number;
  /** 主题名称 */
  name: string;
  /** 关联的长期记忆ID列表 */
  memoryIds: string[];
  /** 关键词 */
  keywords: string[];
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
}

// ==================== 配置选项 ====================

/**
 * 记忆检索选项
 */
export interface MemoryRetrievalOptions {
  /** 最大返回条数 */
  limit?: number;
  /** 时间范围筛选 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 角色筛选 */
  roleFilter?: MessageRole[];
  /** 层级筛选 */
  layerFilter?: MemoryLayerType[];
}

/**
 * 记忆保存选项
 */
export interface MemorySaveOptions {
  /** 是否立即持久化 */
  immediate?: boolean;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 记忆管理器配置
 */
export interface MemoryManagerConfig {
  /** Agent ID */
  agentId: string;
  /** Contact ID */
  contactId: string;
  /** 会话ID（可选） */
  conversationId?: string;
  /** 各层配置 */
  layers?: {
    /** 短期记忆最大条数（默认50） */
    shortTermMaxEntries?: number;
    /** 是否启用对话日志 */
    enableConversationLog?: boolean;
    /** 是否启用长期记忆 */
    enableLongTermMemory?: boolean;
  };
}

// ==================== 统计和状态 ====================

/**
 * 记忆统计信息
 */
export interface MemoryStats {
  /** 短期记忆条目数 */
  shortTermCount: number;
  /** 对话日志条目数 */
  conversationLogCount?: number;
  /** 长期记忆条目数 */
  longTermCount?: number;
  /** 最早记录时间 */
  oldestEntryTime?: number;
  /** 最新记录时间 */
  newestEntryTime?: number;
}

/**
 * 记忆层状态
 */
export interface MemoryLayerStatus {
  /** 层级类型 */
  layer: MemoryLayerType;
  /** 是否可用 */
  available: boolean;
  /** 条目数 */
  entryCount: number;
  /** 最后更新时间 */
  lastUpdated?: number;
  /** 错误信息（如果有） */
  error?: string;
}

// ==================== 对话上下文 ====================

/**
 * 对话上下文
 */
export interface ConversationContext {
  /** 会话ID */
  conversationId: string;
  /** Contact ID */
  contactId: string;
  /** Agent ID */
  agentId: string;
  /** 当前对话历史 */
  history: ShortTermMemoryEntry[];
  /** 会话开始时间 */
  startedAt: number;
  /** 最后活动时间 */
  lastActiveAt: number;
}
