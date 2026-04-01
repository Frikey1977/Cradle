/**
 * 记忆层基础接口
 *
 * 所有记忆层（Layer 1-4）都必须实现此接口
 */

import type { MemoryLayerType, MemorySaveOptions } from "../types.js";

/**
 * 记忆层基础接口
 */
export interface IMemoryLayer<TEntry, TQuery = unknown> {
  /** 层级类型 */
  readonly layerType: MemoryLayerType;

  /** 层级名称 */
  readonly layerName: string;

  /**
   * 初始化层
   */
  initialize(): Promise<void>;

  /**
   * 添加条目
   */
  add(entry: Omit<TEntry, "id" | "timestamp">, options?: MemorySaveOptions): Promise<TEntry>;

  /**
   * 查询条目
   */
  query(query: TQuery): Promise<TEntry[]>;

  /**
   * 获取最近的条目
   */
  getRecent(limit: number): Promise<TEntry[]>;

  /**
   * 清空层数据
   */
  clear(): Promise<void>;

  /**
   * 获取层状态
   */
  getStatus(): Promise<{
    available: boolean;
    entryCount: number;
    lastUpdated?: number;
    error?: string;
  }>;

  /**
   * 关闭层（释放资源）
   */
  close(): Promise<void>;
}

/**
 * 记忆层基类
 */
export abstract class BaseMemoryLayer<TEntry extends { id: string; timestamp: number }, TQuery = unknown>
  implements IMemoryLayer<TEntry, TQuery>
{
  abstract readonly layerType: MemoryLayerType;
  abstract readonly layerName: string;

  protected initialized = false;
  protected lastUpdated?: number;
  protected entryCount = 0;

  /**
   * 关闭层（释放资源）
   * 子类可以覆盖此方法
   */
  async close(): Promise<void> {
    // 默认实现：无操作
    this.initialized = false;
  }

  /**
   * 初始化层
   */
  abstract initialize(): Promise<void>;

  /**
   * 添加条目（内部实现）
   */
  protected abstract doAdd(entry: TEntry, options?: MemorySaveOptions): Promise<TEntry>;

  /**
   * 查询条目（内部实现）
   */
  protected abstract doQuery(query: TQuery): Promise<TEntry[]>;

  /**
   * 获取最近条目（内部实现）
   */
  protected abstract doGetRecent(limit: number): Promise<TEntry[]>;

  /**
   * 清空数据（内部实现）
   */
  protected abstract doClear(): Promise<void>;

  /**
   * 添加条目
   */
  async add(entry: Omit<TEntry, "id" | "timestamp">, options?: MemorySaveOptions): Promise<TEntry> {
    await this.ensureInitialized();

    const fullEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    } as TEntry;

    const result = await this.doAdd(fullEntry, options);
    this.lastUpdated = Date.now();
    this.entryCount++;

    return result;
  }

  /**
   * 查询条目
   */
  async query(query: TQuery): Promise<TEntry[]> {
    await this.ensureInitialized();
    return this.doQuery(query);
  }

  /**
   * 获取最近的条目
   */
  async getRecent(limit: number): Promise<TEntry[]> {
    await this.ensureInitialized();
    return this.doGetRecent(limit);
  }

  /**
   * 清空层数据
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    await this.doClear();
    this.entryCount = 0;
    this.lastUpdated = Date.now();
  }

  /**
   * 获取层状态
   */
  async getStatus(): Promise<{
    available: boolean;
    entryCount: number;
    lastUpdated?: number;
    error?: string;
  }> {
    try {
      await this.ensureInitialized();
      return {
        available: true,
        entryCount: this.entryCount,
        lastUpdated: this.lastUpdated,
      };
    } catch (error) {
      return {
        available: false,
        entryCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 确保已初始化
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }

  /**
   * 生成唯一ID
   */
  protected generateId(): string {
    return `${this.layerType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
