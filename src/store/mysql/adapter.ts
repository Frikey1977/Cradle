/**
 * MySQL 数据库适配器实现
 * 使用 mysql2/promise 提供异步操作
 */

import type { IDatabaseAdapter, ITransaction } from "../adapter.js";
import type { MySQLConfig } from "../config.js";
import mysql from "mysql2/promise";

export class MySQLAdapter implements IDatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private config: MySQLConfig;

  constructor(config: MySQLConfig) {
    this.config = config;
  }

  getType(): "mysql" {
    return "mysql";
  }

  async initialize(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit,
      enableKeepAlive: this.config.enableKeepAlive ?? true,
      keepAliveInitialDelay: this.config.keepAliveInitialDelay ?? 10000,
      idleTimeout: this.config.idleTimeout ?? 600000,
      connectTimeout: this.config.connectTimeout ?? 10000,
    });

    // 监听连接事件
    this.pool.on("connection", (connection) => {
      console.log("[MySQL] New connection established");
      connection.on("error", (err) => {
        console.error("[MySQL] Connection error:", err.message);
      });
    });

    this.pool.on("release", () => {
      console.log("[MySQL] Connection released");
    });

    console.log(
      `[MySQL] Pool initialized: ${this.config.host}:${this.config.port}/${this.config.database}`,
    );

    // 初始化版本表
    await this.initVersionTable();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log("[MySQL] Pool closed");
    }
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    this.ensureConnected();
    try {
      const [rows] = await this.pool!.execute(sql, params);
      return rows as T[];
    } catch (error: any) {
      // 连接错误时重试一次
      if (error.code === "ECONNRESET" || error.code === "PROTOCOL_CONNECTION_LOST") {
        console.warn("[MySQL] Connection lost, retrying query...");
        const [rows] = await this.pool!.execute(sql, params);
        return rows as T[];
      }
      throw error;
    }
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async run(
    sql: string,
    params?: any[],
  ): Promise<{ lastID?: number; changes?: number }> {
    this.ensureConnected();
    try {
      const [result] = await this.pool!.execute(sql, params);
      const okResult = result as mysql.OkPacket;
      return {
        lastID: okResult.insertId,
        changes: okResult.affectedRows,
      };
    } catch (error: any) {
      // 连接错误时重试一次
      if (error.code === "ECONNRESET" || error.code === "PROTOCOL_CONNECTION_LOST") {
        console.warn("[MySQL] Connection lost, retrying...");
        const [result] = await this.pool!.execute(sql, params);
        const okResult = result as mysql.OkPacket;
        return {
          lastID: okResult.insertId,
          changes: okResult.affectedRows,
        };
      }
      throw error;
    }
  }

  async transaction<T>(callback: (trx: ITransaction) => Promise<T>): Promise<T> {
    this.ensureConnected();
    const connection = await this.pool!.getConnection();

    try {
      await connection.beginTransaction();

      const trx: ITransaction = {
        query: async <T>(sql: string, params?: any[]) => {
          const [rows] = await connection.execute(sql, params);
          return rows as T[];
        },
        queryOne: async <T>(sql: string, params?: any[]) => {
          const [rows] = await connection.execute(sql, params);
          const rowArray = rows as T[];
          return rowArray[0] || null;
        },
        run: async (sql: string, params?: any[]) => {
          const [result] = await connection.execute(sql, params);
          const okResult = result as mysql.OkPacket;
          return {
            lastID: okResult.insertId,
            changes: okResult.affectedRows,
          };
        },
      };

      const result = await callback(trx);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [this.config.database, tableName],
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
      "INSERT INTO _schema_version (version, applied_at) VALUES (?, NOW())",
      [version],
    );
  }

  private async initVersionTable(): Promise<void> {
    await this.run(`
      CREATE TABLE IF NOT EXISTS _schema_version (
        version INT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private ensureConnected(): void {
    if (!this.pool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }
}
