/**
 * Store 模块统一导出
 * 提供数据库访问接口和类型定义
 */

// 类型定义
export type {
  User,
  Role,
  Dept,
  Module,
  Permission,
  UserRole,
  RolePermission,
} from "./types.js";

// 数据库适配器接口
export type { IDatabaseAdapter, ITransaction } from "./adapter.js";
export { SQLDialect } from "./adapter.js";

// 数据库配置
export type {
  DatabaseType,
  DatabaseConfig,
  MySQLConfig,
  SQLiteConfig,
} from "./config.js";
export { loadDatabaseConfig, validateConfig, getDefaultDataDir } from "./config.js";

// 数据库工厂
export {
  createAdapter,
  getDatabase,
  resetDatabase,
  initializeDatabase,
} from "./factory.js";

// 适配器实现（按需导入）
export { MySQLAdapter } from "./mysql/adapter.js";
export { SQLiteAdapter } from "./sqlite/adapter.js";

// 兼容旧版数据库接口（database.ts 本身提供兼容）
export { query, run, withTransaction, closePool, getPool } from "./database.js";

// LLM日志仓库
export type {
  LLMLogEntry,
  LLMLogsQuery,
  LLMLogsResult,
} from "./repositories/llm-logs.js";
export {
  LLMLogRepository,
  getLLMLogRepository,
  resetLLMLogRepository,
} from "./repositories/llm-logs.js";

// 心跳日志仓库
export type {
  HeartbeatLogEntry,
  HeartbeatLogsQuery,
  HeartbeatLogsResult,
} from "./repositories/heartbeat-logs.js";
export {
  HeartbeatLogRepository,
  getHeartbeatLogRepository,
  resetHeartbeatLogRepository,
} from "./repositories/heartbeat-logs.js";
