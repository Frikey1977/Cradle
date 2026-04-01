/**
 * 记忆管理器
 *
 * 统一管理层级化的记忆系统（四层架构）
 * 对外提供简洁的 API，内部协调各层数据流转
 */

import type {
  MemoryManagerConfig,
  ShortTermMemoryEntry,
  LongTermMemoryEntry,
  ConversationLogEntry,
  MemoryStats,
  MemoryLayerStatus,
  MemorySaveOptions,
} from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import {
  ShortTermMemoryLayer,
  ConversationLogLayer,
  LongTermMemoryLayer,
  MemoryIndexLayer,
  type IMemoryLayer,
} from "./layers/index.js";

/**
 * 记忆管理器
 *
 * 负责：
 * 1. 管理四层记忆系统的生命周期
 * 2. 协调层间数据流转
 * 3. 对外提供统一接口
 */
export class MemoryManager {
  private config: MemoryManagerConfig;

  // 各层实例
  private layers: {
    conversation?: ConversationLogLayer;
    longTerm?: LongTermMemoryLayer;
    index?: MemoryIndexLayer;
    shortTerm: ShortTermMemoryLayer;
  };

  constructor(config: MemoryManagerConfig) {
    this.config = {
      layers: {
        shortTermMaxEntries: 50,
        enableConversationLog: false,
        enableLongTermMemory: false,
        ...config.layers,
      },
      ...config,
    };

    // 初始化各层
    this.layers = {
      shortTerm: new ShortTermMemoryLayer({
        agentId: this.config.agentId,
        contactId: this.config.contactId,
        conversationId: this.config.conversationId,
        maxEntries: this.config.layers?.shortTermMaxEntries,
      }),
    };

    // 可选层：对话日志
    if (this.config.layers?.enableConversationLog) {
      this.layers.conversation = new ConversationLogLayer({
        agentId: this.config.agentId,
        contactId: this.config.contactId,
      });
    }

    // 可选层：长期记忆
    if (this.config.layers?.enableLongTermMemory) {
      this.layers.longTerm = new LongTermMemoryLayer({
        agentId: this.config.agentId,
      });

      this.layers.index = new MemoryIndexLayer({
        agentId: this.config.agentId,
      });
    }
  }

  // ==================== 属性访问 ====================

  get agentId(): string {
    return this.config.agentId;
  }

  get contactId(): string {
    return this.config.contactId;
  }

  get conversationId(): string | undefined {
    return this.config.conversationId;
  }

  // ==================== 初始化与关闭 ====================

  /**
   * 初始化所有层
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // 短期记忆层（必需）
    initPromises.push(this.layers.shortTerm.initialize());

    // 可选层
    if (this.layers.conversation) {
      initPromises.push(this.layers.conversation.initialize());
    }
    if (this.layers.longTerm) {
      initPromises.push(this.layers.longTerm.initialize());
    }
    if (this.layers.index) {
      initPromises.push(this.layers.index.initialize());
    }

    await Promise.all(initPromises);
    console.log(`[MemoryManager:${this.config.agentId}] All layers initialized`);
  }

  /**
   * 关闭所有层（释放资源）
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // 短期记忆层
    closePromises.push(this.layers.shortTerm.close?.() || Promise.resolve());

    // 可选层
    if (this.layers.conversation) {
      closePromises.push(this.layers.conversation.close?.() || Promise.resolve());
    }
    if (this.layers.longTerm) {
      closePromises.push(this.layers.longTerm.close?.() || Promise.resolve());
    }
    if (this.layers.index) {
      closePromises.push(this.layers.index.close?.() || Promise.resolve());
    }

    await Promise.all(closePromises);
    console.log(`[MemoryManager:${this.config.agentId}] All layers closed`);
  }

  // ==================== 短期记忆操作（Layer 4）====================

  /**
   * 添加用户消息（精简格式）
   */
  async addUserMessage(content: string, metadata?: Record<string, any>): Promise<ShortTermMemoryEntry> {
    const type = metadata?.type || "text";
    const channel = metadata?.channel || "cradle";
    return this.addToShortTerm({
      id: generateUUID(),
      timestamp: Date.now(),
      channel,
      role: "user",
      content,
      type,
    });
  }

  /**
   * 添加助手消息（精简格式）
   */
  async addAssistantMessage(content: string, metadata?: Record<string, any>): Promise<ShortTermMemoryEntry> {
    console.log(`[MemoryManager:${this.config.agentId}] [DEBUG] addAssistantMessage called: contentLength=${content?.length || 0}, contactId=${this.config.contactId}`);
    const type = metadata?.type || "text";
    const channel = metadata?.channel || "cradle";
    const result = await this.addToShortTerm({
      id: generateUUID(),
      timestamp: Date.now(),
      channel,
      role: "agent",
      content,
      type,
    });
    console.log(`[MemoryManager:${this.config.agentId}] [DEBUG] addAssistantMessage completed:`, result);
    return result;
  }

  /**
   * 添加条目到短期记忆（精简格式）
   */
  private async addToShortTerm(
    entry: ShortTermMemoryEntry,
    options?: MemorySaveOptions,
  ): Promise<ShortTermMemoryEntry> {
    console.log(`[MemoryManager:${this.config.agentId}] [DEBUG] addToShortTerm called: role=${entry.role}, contentLength=${entry.content?.length || 0}`);
    const result = await this.layers.shortTerm.add(entry, options);
    console.log(`[MemoryManager:${this.config.agentId}] [DEBUG] addToShortTerm completed: role=${entry.role}, timestamp=${entry.timestamp}`);

    // 同时写入对话日志（如果启用）
    if (this.layers.conversation) {
      try {
        await this.layers.conversation.add({
          role: entry.role === "agent" ? "assistant" : entry.role,
          content: entry.content,
          agentId: this.config.agentId,
          contactId: this.config.contactId,
          conversationId: this.config.conversationId || "",
          messageType: entry.type,
          rawData: { channel: entry.channel, type: entry.type },
        });
      } catch (error) {
        console.error(`[MemoryManager:${this.config.agentId}] Failed to write to conversation log:`, error);
      }
    }

    return result;
  }

  /**
   * 获取最近的对话历史
   */
  async getRecentHistory(limit?: number): Promise<ShortTermMemoryEntry[]> {
    return this.layers.shortTerm.getRecent(limit || 50);
  }

  /**
   * 获取对话历史（用于LLM上下文）
   */
  async getConversationHistory(limit?: number): Promise<Array<{ role: string; content: string; timestamp: number }>> {
    return this.layers.shortTerm.getConversationHistory(limit);
  }

  /**
   * 清空短期记忆
   */
  async clearShortTerm(): Promise<void> {
    await this.layers.shortTerm.clear();
  }

  // ==================== 长期记忆操作（Layer 2）====================

  /**
   * 检索长期记忆（语义搜索）
   *
   * TODO: 实现语义检索
   */
  async retrieveLongTerm(_query: string): Promise<LongTermMemoryEntry[]> {
    if (!this.layers.longTerm) {
      return [];
    }
    // TODO: 调用向量检索
    return [];
  }

  /**
   * 添加长期记忆
   *
   * TODO: 实现手动添加长期记忆
   */
  async addLongTerm(_entry: Omit<LongTermMemoryEntry, "id" | "createdAt">): Promise<LongTermMemoryEntry | null> {
    if (!this.layers.longTerm) {
      return null;
    }
    // TODO: 生成向量嵌入并存储
    return null;
  }

  // ==================== 对话日志操作（Layer 1）====================

  /**
   * 查询对话日志
   *
   * TODO: 实现日志查询
   */
  async queryConversationLog(_options: {
    date?: string;
    conversationId?: string;
  }): Promise<ConversationLogEntry[]> {
    if (!this.layers.conversation) {
      return [];
    }
    // TODO: 从日志文件查询
    return [];
  }

  // ==================== 统计与状态 ====================

  /**
   * 获取记忆统计信息
   */
  async getStats(): Promise<MemoryStats> {
    const shortTermStatus = await this.layers.shortTerm.getStatus();

    const stats: MemoryStats = {
      shortTermCount: shortTermStatus.entryCount,
    };

    if (this.layers.conversation) {
      const status = await this.layers.conversation.getStatus();
      stats.conversationLogCount = status.entryCount;
    }

    if (this.layers.longTerm) {
      const status = await this.layers.longTerm.getStatus();
      stats.longTermCount = status.entryCount;
    }

    return stats;
  }

  /**
   * 获取各层状态
   */
  async getLayerStatuses(): Promise<MemoryLayerStatus[]> {
    const statuses: MemoryLayerStatus[] = [];

    // Layer 4: 短期记忆
    const shortTermStatus = await this.layers.shortTerm.getStatus();
    statuses.push({
      layer: "short-term",
      ...shortTermStatus,
    });

    // Layer 1: 对话日志
    if (this.layers.conversation) {
      const status = await this.layers.conversation.getStatus();
      statuses.push({
        layer: "conversation",
        ...status,
      });
    }

    // Layer 2: 长期记忆
    if (this.layers.longTerm) {
      const status = await this.layers.longTerm.getStatus();
      statuses.push({
        layer: "long-term",
        ...status,
      });
    }

    // Layer 3: 索引
    if (this.layers.index) {
      const status = await this.layers.index.getStatus();
      statuses.push({
        layer: "index",
        ...status,
      });
    }

    return statuses;
  }

  // ==================== 内部工具 ====================
}

/**
 * 创建记忆管理器实例（工厂函数）
 */
export function createMemoryManager(config: MemoryManagerConfig): MemoryManager {
  return new MemoryManager(config);
}
