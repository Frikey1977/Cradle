/**
 * 数据库工厂
 * 根据配置创建对应的数据库适配器实例
 */

import type { IDatabaseAdapter } from "./adapter.js";
import { loadDatabaseConfig, validateConfig } from "./config.js";
import { MySQLAdapter } from "./mysql/adapter.js";
import { SQLiteAdapter } from "./sqlite/adapter.js";

let globalAdapter: IDatabaseAdapter | null = null;

/**
 * 创建数据库适配器
 */
export function createAdapter(): IDatabaseAdapter {
  const config = loadDatabaseConfig();
  validateConfig(config);

  if (config.type === "mysql") {
    return new MySQLAdapter(config.mysql!);
  }

  return new SQLiteAdapter(config.sqlite!);
}

/**
 * 获取全局数据库适配器实例（单例）
 */
export async function getDatabase(): Promise<IDatabaseAdapter> {
  if (!globalAdapter) {
    globalAdapter = createAdapter();
    await globalAdapter.initialize();

    // 初始化心跳日志表
    const { getHeartbeatLogRepository } = await import("./repositories/heartbeat-logs.js");
    await getHeartbeatLogRepository(globalAdapter);
  }
  return globalAdapter;
}

/**
 * 重置全局适配器（用于测试）
 */
export async function resetDatabase(): Promise<void> {
  if (globalAdapter) {
    await globalAdapter.close();
    globalAdapter = null;
  }
}

/**
 * 初始化数据库（应用迁移）
 */
export async function initializeDatabase(): Promise<IDatabaseAdapter> {
  const db = await getDatabase();

  // 1. 执行数据库迁移
  console.log("[Database] Running migrations...");
  const { runMigrations } = await import("./migrations/index.js");
  await runMigrations(db);

  // 2. 初始化心跳日志表
  const { getHeartbeatLogRepository } = await import("./repositories/heartbeat-logs.js");
  await getHeartbeatLogRepository(db);

  console.log("[Database] Initialization completed");
  return db;
}
