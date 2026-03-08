import mysql from "mysql2/promise";

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const config: DatabaseConfig = {
  host: process.env.DB_HOST || "rm-uf609fl41tpozix1v3o.mysql.rds.aliyuncs.com",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "aosendb",
  password: process.env.DB_PASSWORD || "Frikey1977",
  database: process.env.DB_NAME || "cradle",
};

let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // 连接保持和超时配置
      enableKeepAlive: true, // 启用 TCP KeepAlive
      keepAliveInitialDelay: 10000, // 10秒后开始发送 keepalive 探测
      // 连接空闲超时（小于RDS的wait_timeout，默认8小时）
      idleTimeout: 600000, // 10分钟
      // 连接超时
      connectTimeout: 10000, // 10秒连接超时
    });

    // 监听连接错误，自动清理无效连接
    pool.on("connection", (connection) => {
      console.log("[Database] New connection established");
      connection.on("error", (err) => {
        console.error("[Database] Connection error:", err.message);
      });
    });

    pool.on("release", (connection) => {
      console.log("[Database] Connection released");
    });
  }
  return pool;
}

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const p = await getPool();
  try {
    const [rows] = await p.execute(sql, params);
    return rows as T;
  } catch (error: any) {
    // 如果是连接错误，尝试重试一次
    if (error.code === "ECONNRESET" || error.code === "PROTOCOL_CONNECTION_LOST") {
      console.warn("[Database] Connection lost, retrying query...");
      const [rows] = await p.execute(sql, params);
      return rows as T;
    }
    throw error;
  }
}

export async function run(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const p = await getPool();
  try {
    const [result] = await p.execute(sql, params);
    return result as mysql.ResultSetHeader;
  } catch (error: any) {
    // 如果是连接错误，尝试重试一次
    if (error.code === "ECONNRESET" || error.code === "PROTOCOL_CONNECTION_LOST") {
      console.warn("[Database] Connection lost, retrying...");
      const [result] = await p.execute(sql, params);
      return result as mysql.ResultSetHeader;
    }
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * 执行数据库事务
 * @param callback 事务回调函数，接收连接对象用于执行事务中的SQL
 * @returns 回调函数的返回值
 */
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const p = await getPool();
  const connection = await p.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
