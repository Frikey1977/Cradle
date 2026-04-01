/**
 * 记忆层导出
 *
 * 四层记忆系统：
 * - Layer 1: ConversationLogLayer - 对话日志层
 * - Layer 2: LongTermMemoryLayer - 长期记忆层
 * - Layer 3: MemoryIndexLayer - 记忆索引层
 * - Layer 4: ShortTermMemoryLayer - 短期记忆层
 */

// 基础接口
export { BaseMemoryLayer, type IMemoryLayer } from "./memory-layer.js";

// Layer 1: 对话日志层
export {
  ConversationLogLayer,
  type ConversationLayerConfig,
  type ConversationLogQuery,
} from "./conversation-layer.js";

// Layer 2: 长期记忆层
export {
  LongTermMemoryLayer,
  type LongTermLayerConfig,
  type LongTermMemoryQuery,
} from "./long-term-layer.js";

// Layer 3: 记忆索引层
export {
  MemoryIndexLayer,
  type IndexLayerConfig,
  type MemoryIndexQuery,
} from "./index-layer.js";

// Layer 4: 短期记忆层
export {
  ShortTermMemoryLayer,
  type ShortTermLayerConfig,
  type ShortTermQuery,
} from "./short-term-layer.js";
