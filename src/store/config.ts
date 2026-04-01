/**
 * 数据库配置管理
 * 支持从环境变量读取配置，支持MySQL和SQLite
 */

export type DatabaseType = 'mysql' | 'sqlite';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  enableKeepAlive?: boolean;
  keepAliveInitialDelay?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

export interface SQLiteConfig {
  path: string;
  walMode?: boolean;
  cacheSize?: number;
}

export interface DatabaseConfig {
  type: DatabaseType;
  mysql?: MySQLConfig;
  sqlite?: SQLiteConfig;
}

/**
 * 从环境变量加载数据库配置
 */
export function loadDatabaseConfig(): DatabaseConfig {
  const type = (process.env.DB_TYPE as DatabaseType) || 'sqlite';

  if (type === 'mysql') {
    return {
      type: 'mysql',
      mysql: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cradle',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
        enableKeepAlive: process.env.DB_ENABLE_KEEPALIVE !== 'false',
        keepAliveInitialDelay: parseInt(process.env.DB_KEEPALIVE_DELAY || '10000', 10),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000', 10),
        connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
      }
    };
  }

  // SQLite 默认配置
  return {
    type: 'sqlite',
    sqlite: {
      path: process.env.DB_PATH || './data/cradle.db',
      walMode: process.env.DB_WAL_MODE !== 'false',
      cacheSize: parseInt(process.env.DB_CACHE_SIZE || '-64000', 10),
    }
  };
}

/**
 * 验证配置是否有效
 */
export function validateConfig(config: DatabaseConfig): void {
  if (config.type === 'mysql') {
    if (!config.mysql) {
      throw new Error('MySQL configuration is required when DB_TYPE=mysql');
    }
    if (!config.mysql.host || !config.mysql.user || !config.mysql.database) {
      throw new Error('MySQL host, user, and database are required');
    }
  } else if (config.type === 'sqlite') {
    if (!config.sqlite) {
      throw new Error('SQLite configuration is required when DB_TYPE=sqlite');
    }
    if (!config.sqlite.path) {
      throw new Error('SQLite path is required');
    }
  }
}

/**
 * 获取默认SQLite数据目录
 */
export function getDefaultDataDir(): string {
  return process.env.DATA_DIR || './data';
}
