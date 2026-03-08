/**
 * 记忆模块
 *
 * 四层记忆系统架构：
 * - Layer 1: ConversationLogLayer - 对话日志层（原始记录）
 * - Layer 2: LongTermMemoryLayer - 长期记忆层（向量存储）
 * - Layer 3: MemoryIndexLayer - 记忆索引层（主题映射）
 * - Layer 4: ShortTermMemoryLayer - 短期记忆层（会话上下文）
 *
 * 统一入口: MemoryManager
 */

// ==================== 类型定义 ====================
export type {
  // 基础类型
  MessageRole,
  MemoryLayerType,
  BaseMemoryEntry,

  // Layer 4: 短期记忆
  ShortTermMemoryEntry,
  ShortTermMemory,

  // Layer 1: 对话日志
  ConversationLogEntry,
  ConversationLog,

  // Layer 2: 长期记忆
  LongTermMemoryEntry,

  // Layer 3: 记忆索引
  SubjectIndexEntry,

  // 配置和选项
  MemoryRetrievalOptions,
  MemorySaveOptions,
  MemoryManagerConfig,
  MemoryStats,
  MemoryLayerStatus,
  ConversationContext,
} from "./types.js";

// ==================== 记忆层实现 ====================
export {
  // 基础接口
  BaseMemoryLayer,
  type IMemoryLayer,

  // Layer 1: 对话日志层
  ConversationLogLayer,
  type ConversationLayerConfig,
  type ConversationLogQuery,

  // Layer 2: 长期记忆层
  LongTermMemoryLayer,
  type LongTermLayerConfig,
  type LongTermMemoryQuery,

  // Layer 3: 记忆索引层
  MemoryIndexLayer,
  type IndexLayerConfig,
  type MemoryIndexQuery,

  // Layer 4: 短期记忆层
  ShortTermMemoryLayer,
  type ShortTermLayerConfig,
  type ShortTermQuery,
} from "./layers/index.js";

// ==================== 记忆管理器 ====================
export { MemoryManager, createMemoryManager } from "./memory-manager.js";
