/**
 * 数据库适配器接口
 * 定义统一的数据库操作接口，支持MySQL和SQLite
 */

export interface ITransaction {
  /** 执行查询（返回多行） */
  query<T>(sql: string, params?: any[]): Promise<T[]>;

  /** 执行单条查询（返回单行） */
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;

  /** 执行更新/插入/删除 */
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

export interface IDatabaseAdapter {
  /** 初始化数据库连接 */
  initialize(): Promise<void>;

  /** 关闭数据库连接 */
  close(): Promise<void>;

  /** 执行查询（返回多行） */
  query<T>(sql: string, params?: any[]): Promise<T[]>;

  /** 执行单条查询（返回单行） */
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;

  /** 执行更新/插入/删除 */
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;

  /** 执行事务 */
  transaction<T>(callback: (trx: ITransaction) => Promise<T>): Promise<T>;

  /** 检查表是否存在 */
  tableExists(tableName: string): Promise<boolean>;

  /** 获取数据库版本 */
  getVersion(): Promise<number>;

  /** 设置数据库版本 */
  setVersion(version: number): Promise<void>;

  /** 获取数据库类型 */
  getType(): 'mysql' | 'sqlite';
}

/**
 * SQL方言转换工具
 * 处理MySQL和SQLite之间的语法差异
 */
export class SQLDialect {
  /**
   * 转换LIMIT语句
   * MySQL: LIMIT offset, count
   * SQLite: LIMIT count OFFSET offset
   */
  static limit(sql: string, type: 'mysql' | 'sqlite'): string {
    if (type === 'mysql') {
      // MySQL格式已经是标准格式
      return sql;
    }
    // SQLite: 将 LIMIT offset, count 转换为 LIMIT count OFFSET offset
    return sql.replace(/LIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');
  }

  /**
   * 转换布尔值
   * MySQL: TRUE/FALSE 或 1/0
   * SQLite: 1/0
   */
  static boolean(value: boolean, type: 'mysql' | 'sqlite'): number | boolean {
    if (type === 'sqlite') {
      return value ? 1 : 0;
    }
    return value;
  }

  /**
   * 转换日期时间函数
   */
  static now(type: 'mysql' | 'sqlite'): string {
    return type === 'mysql' ? 'NOW()' : "datetime('now')";
  }

  /**
   * 转换日期格式化
   */
  static dateFormat(type: 'mysql' | 'sqlite'): string {
    return type === 'mysql' ? 'DATE_FORMAT(?, ?)' : "strftime(?, ?)";
  }
}
