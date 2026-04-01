/**
 * 数据库访问层（兼容旧接口）
 * 现在底层使用新的适配器架构，支持MySQL和SQLite双模式
 */

import mysql from "mysql2/promise";
import { getDatabase, resetDatabase } from "./factory.js";
import type { IDatabaseAdapter } from "./adapter.js";

// 为了兼容旧代码，保留mysql类型导出
export type { DatabaseConfig } from "./config.js";

/**
 * 获取数据库连接池（兼容旧接口）
 * 注意：在新架构中，这个方法返回一个兼容mysql.Pool接口的包装对象
 */
export async function getPool(): Promise<mysql.Pool> {
  const db = await getDatabase();

  // 返回一个兼容mysql.Pool接口的包装对象
  return {
    execute: async (sql: string, params?: any[]) => {
      // 判断是查询还是更新
      const isSelect = sql.trim().toLowerCase().startsWith("select");
      if (isSelect) {
        const rows = await db.query(sql, params);
        return [rows, []] as any;
      } else {
        const result = await db.run(sql, params);
        return [
          {
            affectedRows: result.changes || 0,
            insertId: result.lastID || 0,
          } as mysql.OkPacket,
          [],
        ];
      }
    },
    getConnection: async () => {
      // 返回一个模拟的连接对象
      return {
        execute: async (sql: string, params?: any[]) => {
          const isSelect = sql.trim().toLowerCase().startsWith("select");
          if (isSelect) {
            const rows = await db.query(sql, params);
            return [rows, []] as any;
          } else {
            const result = await db.run(sql, params);
            return [
              {
                affectedRows: result.changes || 0,
                insertId: result.lastID || 0,
              } as mysql.OkPacket,
              [],
            ];
          }
        },
        beginTransaction: async () => {
          // SQLite不支持真正的嵌套事务，这里只是模拟
          if (db.getType() === "sqlite") {
            await db.run("BEGIN TRANSACTION");
          }
        },
        commit: async () => {
          if (db.getType() === "sqlite") {
            await db.run("COMMIT");
          }
        },
        rollback: async () => {
          if (db.getType() === "sqlite") {
            await db.run("ROLLBACK");
          }
        },
        release: () => {
          // 在新架构中不需要手动释放
        },
        on: (event: string, callback: any) => {
          // 模拟事件监听
        },
      } as mysql.PoolConnection;
    },
    end: async () => {
      await resetDatabase();
    },
    on: (event: string, callback: any) => {
      // 模拟事件监听
      if (event === "connection") {
        // 触发一次连接事件
        callback({
          on: (e: string, cb: any) => {
            // 模拟连接错误事件
          },
        });
      }
    },
  } as mysql.Pool;
}

/**
 * 执行查询（兼容旧接口）
 */
export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const db = await getDatabase();
  // 自动转换 NOW() 为 SQLite 兼容语法
  let compatSqlStr = sql;
  if (db.getType() === "sqlite") {
    compatSqlStr = sql.replace(/\bNOW\(\)/gi, "datetime('now')");
  }
  return db.query(compatSqlStr, params) as Promise<T>;
}

/**
 * 执行更新/插入/删除（兼容旧接口）
 */
export async function run(
  sql: string,
  params?: any[],
): Promise<mysql.ResultSetHeader> {
  const db = await getDatabase();
  
  // 自动转换 NOW() 为 SQLite 兼容语法
  let compatSqlStr = sql;
  if (db.getType() === "sqlite") {
    compatSqlStr = sql.replace(/\bNOW\(\)/gi, "datetime('now')");
  }
  
  const result = await db.run(compatSqlStr, params);
  return {
    affectedRows: result.changes || 0,
    insertId: result.lastID || 0,
    warningStatus: 0,
    serverStatus: 2,
    changedRows: result.changes || 0,
    fieldCount: 0,
    info: "",
  } as mysql.ResultSetHeader;
}

/**
 * 关闭连接池（兼容旧接口）
 */
export async function closePool(): Promise<void> {
  await resetDatabase();
}

/**
 * 执行事务（兼容旧接口）
 */
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();

  return db.transaction(async (trx) => {
    // 包装事务对象以兼容旧接口
    const compatConnection = {
      execute: async (sql: string, params?: any[]) => {
        const isSelect = sql.trim().toLowerCase().startsWith("select");
        if (isSelect) {
          const rows = await trx.query(sql, params);
          return [rows, []] as any;
        } else {
          const result = await trx.run(sql, params);
          return [
            {
              affectedRows: result.changes || 0,
              insertId: result.lastID || 0,
            } as mysql.OkPacket,
            [],
          ];
        }
      },
      beginTransaction: async () => {
        // 事务已在db.transaction中开始
      },
      commit: async () => {
        // 事务在db.transaction中自动提交
      },
      rollback: async () => {
        // 事务在db.transaction中自动回滚
      },
      release: () => {
        // 不需要手动释放
      },
      on: (event: string, callback: any) => {
        // 模拟事件
      },
    } as mysql.PoolConnection;

    return callback(compatConnection);
  });
}

/**
 * 获取数据库类型
 */
export async function getDbType(): Promise<"mysql" | "sqlite"> {
  const db = await getDatabase();
  return db.getType() as "mysql" | "sqlite";
}

/**
 * 获取当前时间函数（兼容MySQL和SQLite）
 */
export async function getNowFunction(): Promise<string> {
  const type = await getDbType();
  return type === "mysql" ? "NOW()" : "datetime('now')";
}

/**
 * 转换 SQL 语句中的 NOW() 函数为兼容语法
 */
export async function compatSql(sql: string): Promise<string> {
  const type = await getDbType();
  if (type === "sqlite") {
    return sql.replace(/\bNOW\(\)/gi, "datetime('now')");
  }
  return sql;
}
