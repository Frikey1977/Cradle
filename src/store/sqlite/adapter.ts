/**
 * SQLite 数据库适配器实现
 * 使用 better-sqlite3 提供同步高性能操作
 */

import type { IDatabaseAdapter, ITransaction } from "../adapter.js";
import type { SQLiteConfig } from "../config.js";
import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

export class SQLiteAdapter implements IDatabaseAdapter {
  private db: Database.Database | null = null;
  private config: SQLiteConfig;

  constructor(config: SQLiteConfig) {
    this.config = config;
  }

  getType(): "sqlite" {
    return "sqlite";
  }

  async initialize(): Promise<void> {
    // 确保数据目录存在
    const dbDir = dirname(this.config.path);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // 创建数据库连接
    this.db = new Database(this.config.path);

    // 启用外键约束
    this.db.pragma("foreign_keys = ON");

    // 配置WAL模式（提升并发性能）
    if (this.config.walMode !== false) {
      this.db.pragma("journal_mode = WAL");
    }

    // 配置同步模式（平衡安全和性能）
    this.db.pragma("synchronous = NORMAL");

    // 配置缓存大小
    if (this.config.cacheSize) {
      this.db.pragma(`cache_size = ${this.config.cacheSize}`);
    }

    // 临时表存储在内存
    this.db.pragma("temp_store = MEMORY");

    console.log(`[SQLite] Database initialized: ${this.config.path}`);

    // 初始化版本表
    await this.initVersionTable();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[SQLite] Database closed");
    }
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    this.ensureConnected();
    const stmt = this.db!.prepare(sql);
    return stmt.all(params || []) as T[];
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    this.ensureConnected();
    const stmt = this.db!.prepare(sql);
    return (stmt.get(params || []) as T) || null;
  }

  async run(
    sql: string,
    params?: any[],
  ): Promise<{ lastID?: number; changes?: number }> {
    this.ensureConnected();
    const stmt = this.db!.prepare(sql);
    const result = stmt.run(params || []);
    return {
      lastID: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  async transaction<T>(callback: (trx: ITransaction) => Promise<T>): Promise<T> {
    this.ensureConnected();

    const trx: ITransaction = {
      query: async <R>(sql: string, params?: any[]) => {
        const stmt = this.db!.prepare(sql);
        return stmt.all(params || []) as R[];
      },
      queryOne: async <R>(sql: string, params?: any[]) => {
        const stmt = this.db!.prepare(sql);
        return stmt.get(params || []) as R || null;
      },
      run: async (sql: string, params?: any[]) => {
        const stmt = this.db!.prepare(sql);
        const result = stmt.run(params || []);
        return {
          lastID: Number(result.lastInsertRowid),
          changes: result.changes,
        };
      },
    };

    return await callback(trx);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?",
      [tableName],
    );
    return (result?.count ?? 0) > 0;
  }

  async getVersion(): Promise<number> {
    const exists = await this.tableExists("_schema_version");
    if (!exists) {
      return 0;
    }
    const result = await this.queryOne<{ version: number }>(
      "SELECT MAX(version) as version FROM _schema_version",
    );
    return result?.version || 0;
  }

  async setVersion(version: number): Promise<void> {
    await this.run(
      "INSERT INTO _schema_version (version, applied_at) VALUES (?, datetime('now'))",
      [version],
    );
  }

  private async initVersionTable(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }
}
