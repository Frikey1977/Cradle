/**
 * Layer 4: 短期记忆层
 *
 * 存储当前会话窗口内的近期对话
 * 存储位置: t_relationship.short_term_memory (JSON)
 * 默认保留: 最近 50 轮对话
 *
 * 注意: 短期记忆存储在 relationship 表中，因为每个用户(Contact)与每个Agent
 * 之间的短期记忆是独立的。Contact 是身份归一化后的用户，Agent 是助手，
 * Relationship 是他们之间的关系（包含对话历史）。
 */

import { query, run } from "../../../store/database.js";
import { generateUUID } from "../../../shared/utils.js";
import type {
  ShortTermMemory,
  ShortTermMemoryEntry,
  MemorySaveOptions,
} from "../types.js";
import { BaseMemoryLayer } from "./memory-layer.js";

/** 默认最大短期记忆条数 */
const DEFAULT_MAX_ENTRIES = 50;

/** 短期记忆版本号 */
const MEMORY_VERSION = 1;

/** 数据库表名 */
const TABLE_NAME = "t_relationship";

/**
 * 短期记忆层查询参数
 */
export interface ShortTermQuery {
  /** 角色筛选 */
  role?: "user" | "agent";
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 通道筛选 */
  channel?: string;
}

/**
 * 短期记忆层配置
 */
export interface ShortTermLayerConfig {
  /** Agent ID */
  agentId: string;
  /** Contact ID */
  contactId: string;
  /** 会话ID */
  conversationId?: string;
  /** 最大保留条数 */
  maxEntries?: number;
}

/**
 * 短期记忆层实现
 */
export class ShortTermMemoryLayer extends BaseMemoryLayer<ShortTermMemoryEntry, ShortTermQuery> {
  readonly layerType = "short-term" as const;
  readonly layerName = "短期记忆层";

  private config: ShortTermLayerConfig;
  private cache: ShortTermMemory | null = null;
  private dirty = false;

  constructor(config: ShortTermLayerConfig) {
    super();
    this.config = {
      maxEntries: DEFAULT_MAX_ENTRIES,
      ...config,
    };
  }

  /**
   * 初始化层 - 从数据库加载现有记忆
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 从 relationship 表中读取短期记忆
      const rows = await query<Array<{ short_term_memory: string | null }>>(
        `SELECT short_term_memory FROM ${TABLE_NAME} 
         WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
        [this.config.agentId, this.config.contactId],
      );

      if (!rows || rows.length === 0 || !rows[0].short_term_memory) {
        this.cache = this.createEmptyMemory();
        // 如果 relationship 不存在，需要创建
        await this.ensureRelationshipExists();
      } else {
        try {
          const parsed = JSON.parse(rows[0].short_term_memory) as ShortTermMemory;
          if (this.validateMemory(parsed)) {
            this.cache = parsed;
            this.entryCount = parsed.entries.length;
            this.lastUpdated = parsed.lastUpdated;
          } else {
            console.warn(`[ShortTermMemoryLayer:${this.config.agentId}] Invalid memory structure, creating new`);
            this.cache = this.createEmptyMemory();
          }
        } catch (parseError) {
          console.error(`[ShortTermMemoryLayer:${this.config.agentId}] Failed to parse memory:`, parseError);
          this.cache = this.createEmptyMemory();
        }
      }

      this.dirty = false;
      this.initialized = true;
    } catch (error) {
      console.error(`[ShortTermMemoryLayer:${this.config.agentId}] Failed to initialize:`, error);
      this.cache = this.createEmptyMemory();
      this.initialized = true;
    }
  }

  /**
   * 确保 relationship 记录存在
   */
  private async ensureRelationshipExists(): Promise<void> {
    try {
      const rows = await query<Array<{ sid: string }>>(
        `SELECT sid FROM ${TABLE_NAME} 
         WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
        [this.config.agentId, this.config.contactId],
      );

      if (!rows || rows.length === 0) {
        // 创建新的 relationship 记录
        const sid = generateUUID();
        await run(
          `INSERT INTO ${TABLE_NAME} (sid, agent_id, contact_id, short_term_memory, contact_agent, agent_contact) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            sid,
            this.config.agentId,
            this.config.contactId,
            JSON.stringify(this.cache),
            JSON.stringify({ intimacy: 50, trust: 50 }),
            JSON.stringify({ intimacy: 50, trust: 50 }),
          ],
        );
        console.log(`[ShortTermMemoryLayer:${this.config.agentId}] Created new relationship: ${sid}`);
      }
    } catch (error) {
      console.error(`[ShortTermMemoryLayer:${this.config.agentId}] Failed to ensure relationship:`, error);
    }
  }

  /**
   * 添加条目到短期记忆
   */
  protected async doAdd(
    entry: ShortTermMemoryEntry,
    options?: MemorySaveOptions,
  ): Promise<ShortTermMemoryEntry> {
    console.log(`[ShortTermMemoryLayer:${this.config.agentId}] doAdd called: role=${entry.role}, contentLength=${entry.content?.length || 0}`);

    if (!this.cache) {
      console.error(`[ShortTermMemoryLayer:${this.config.agentId}] Cache not initialized`);
      throw new Error("Short term memory not initialized");
    }

    // 添加条目
    this.cache.entries.push(entry);
    console.log(`[ShortTermMemoryLayer:${this.config.agentId}] Entry added, total entries: ${this.cache.entries.length}`);

    // 限制条数
    const maxEntries = this.config.maxEntries || DEFAULT_MAX_ENTRIES;
    if (this.cache.entries.length > maxEntries) {
      this.cache.entries = this.cache.entries.slice(-maxEntries);
    }

    this.dirty = true;

    // 立即保存（如果需要）
    if (options?.immediate !== false) {
      await this.persist();
    }

    return entry;
  }

  /**
   * 查询条目
   */
  protected async doQuery(query: ShortTermQuery): Promise<ShortTermMemoryEntry[]> {
    if (!this.cache) {
      return [];
    }

    let results = [...this.cache.entries];

    // 角色筛选
    if (query.role) {
      results = results.filter((e) => e.role === query.role);
    }

    // 通道筛选
    if (query.channel) {
      results = results.filter((e) => e.channel === query.channel);
    }

    // 时间范围筛选
    if (query.timeRange) {
      results = results.filter(
        (e) => e.timestamp >= query.timeRange!.start && e.timestamp <= query.timeRange!.end,
      );
    }

    return results;
  }

  /**
   * 获取最近条目
   */
  protected async doGetRecent(limit: number): Promise<ShortTermMemoryEntry[]> {
    if (!this.cache) {
      return [];
    }
    return this.cache.entries.slice(-limit);
  }

  /**
   * 清空数据
   */
  protected async doClear(): Promise<void> {
    this.cache = this.createEmptyMemory();
    this.dirty = true;
    await this.persist();
  }

  /**
   * 持久化到数据库（精简格式）
   */
  async persist(): Promise<void> {
    console.log(`[ShortTermMemoryLayer:${this.config.agentId}] persist called: dirty=${this.dirty}, hasCache=${!!this.cache}`);

    if (!this.cache || !this.dirty) {
      console.log(`[ShortTermMemoryLayer:${this.config.agentId}] Skipping persist: dirty=${this.dirty}, hasCache=${!!this.cache}`);
      return;
    }

    try {
      // 精简格式：只保留 entries 数组
      const memory = {
        entries: this.cache.entries,
      };

      console.log(`[ShortTermMemoryLayer:${this.config.agentId}] Persisting ${this.cache.entries.length} entries to database`);
      await run(
        `UPDATE ${TABLE_NAME} SET short_term_memory = ?, update_time = NOW() 
         WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
        [JSON.stringify(memory), this.config.agentId, this.config.contactId],
      );

      this.dirty = false;
      console.log(`[ShortTermMemoryLayer:${this.config.agentId}] Memory persisted successfully`);
    } catch (error) {
      console.error(`[ShortTermMemoryLayer:${this.config.agentId}] Failed to persist memory:`, error);
      throw error;
    }
  }

  /**
   * 获取对话历史（用于LLM上下文）
   */
  async getConversationHistory(limit?: number): Promise<Array<{ role: string; content: string; timestamp: number }>> {
    const entries = await this.getRecent(limit || this.config.maxEntries || DEFAULT_MAX_ENTRIES);
    return entries.map((entry) => ({
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
    }));
  }

  /**
   * 获取原始记忆数据
   */
  getRawMemory(): ShortTermMemory | null {
    return this.cache;
  }

  /**
   * 创建空记忆结构（精简格式）
   */
  private createEmptyMemory(): ShortTermMemory {
    return {
      entries: [],
      lastUpdated: Date.now(),
    };
  }

  /**
   * 验证记忆数据结构
   */
  private validateMemory(memory: unknown): memory is ShortTermMemory {
    if (!memory || typeof memory !== "object") return false;

    const m = memory as ShortTermMemory;
    if (!Array.isArray(m.entries)) return false;

    return true;
  }

  /**
   * 生成唯一ID
   */
  protected generateId(): string {
    return generateUUID();
  }
}
