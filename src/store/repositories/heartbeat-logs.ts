/**
 * 心跳日志存储仓库
 * 记录心跳执行历史
 */

import type { IDatabaseAdapter } from "../adapter.js";

export interface HeartbeatLogEntry {
  id?: number;
  timestamp: Date | string;
  agentId: string;
  agentName?: string;
  type: "started" | "stopped" | "triggered" | "completed" | "error" | "skipped";
  prompt?: string;
  result?: string;
  error?: string;
  nextDueAt?: number;
}

export interface HeartbeatLogsQuery {
  agentId?: string;
  type?: HeartbeatLogEntry["type"];
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface HeartbeatLogsResult {
  list: HeartbeatLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export class HeartbeatLogRepository {
  private db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  async initializeTable(): Promise<void> {
    const isSQLite = this.db.getType() === "sqlite";

    // MySQL 使用 TIMESTAMP 类型，SQLite 使用 TEXT 类型
    // 两者都能正确存储和返回 ISO 8601 格式的时间字符串
    const timestampType = isSQLite ? "TEXT" : "TIMESTAMP";

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS t_heartbeat_logs (
        ${isSQLite ? "id INTEGER PRIMARY KEY AUTOINCREMENT" : "id INT AUTO_INCREMENT PRIMARY KEY"},
        timestamp ${timestampType} NOT NULL,
        agent_id VARCHAR(64) NOT NULL,
        agent_name VARCHAR(100),
        type VARCHAR(20) NOT NULL,
        prompt TEXT,
        result TEXT,
        error TEXT,
        next_due_at BIGINT
      )
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_agent_id ON t_heartbeat_logs(agent_id)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_timestamp ON t_heartbeat_logs(timestamp)
    `);
  }

  async log(entry: Omit<HeartbeatLogEntry, "id">): Promise<number> {
    // 使用 ISO 8601 格式的 UTC 时间字符串存储（如：2026-03-29T15:28:37.000Z）
    const timestamp = entry.timestamp instanceof Date 
      ? entry.timestamp.toISOString() 
      : new Date().toISOString();
    const result = await this.db.run(
      `INSERT INTO t_heartbeat_logs (timestamp, agent_id, agent_name, type, prompt, result, error, next_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        entry.agentId,
        entry.agentName || null,
        entry.type,
        entry.prompt || null,
        entry.result || null,
        entry.error || null,
        entry.nextDueAt || null,
      ]
    );

    return result.lastID || 0;
  }

  async query(queryParams: HeartbeatLogsQuery): Promise<HeartbeatLogsResult> {
    const page = queryParams.page || 1;
    const pageSize = queryParams.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];

    if (queryParams.agentId) {
      conditions.push("agent_id = ?");
      params.push(queryParams.agentId);
    }

    if (queryParams.type) {
      conditions.push("type = ?");
      params.push(queryParams.type);
    }

    if (queryParams.startDate) {
      conditions.push("timestamp >= ?");
      params.push(queryParams.startDate);
    }

    if (queryParams.endDate) {
      conditions.push("timestamp <= ?");
      params.push(queryParams.endDate + " 23:59:59");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM t_heartbeat_logs ${whereClause}`,
      params
    );

    const total = countResult?.count || 0;

    const rows = await this.db.query<{
      id: number;
      timestamp: Date;
      agent_id: string;
      agent_name: string | null;
      type: string;
      prompt: string | null;
      result: string | null;
      error: string | null;
      next_due_at: number | null;
    }>(
      `SELECT id, timestamp, agent_id, agent_name, type, prompt, result, error, next_due_at
       FROM t_heartbeat_logs ${whereClause}
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return {
      list: rows.map((row: {
        id: number;
        timestamp: Date;
        agent_id: string;
        agent_name: string | null;
        type: string;
        prompt: string | null;
        result: string | null;
        error: string | null;
        next_due_at: number | null;
      }) => ({
        id: row.id,
        timestamp: row.timestamp,
        agentId: row.agent_id,
        agentName: row.agent_name || undefined,
        type: row.type as HeartbeatLogEntry["type"],
        prompt: row.prompt || undefined,
        result: row.result || undefined,
        error: row.error || undefined,
        nextDueAt: row.next_due_at || undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getRecentByAgent(agentId: string, limit: number = 10): Promise<HeartbeatLogEntry[]> {
    const rows = await this.db.query<{
      id: number;
      timestamp: Date;
      agent_id: string;
      agent_name: string | null;
      type: string;
      prompt: string | null;
      result: string | null;
      error: string | null;
      next_due_at: number | null;
    }>(
      `SELECT id, timestamp, agent_id, agent_name, type, prompt, result, error, next_due_at
       FROM t_heartbeat_logs
       WHERE agent_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [agentId, limit]
    );

    return rows.map((row: {
      id: number;
      timestamp: Date;
      agent_id: string;
      agent_name: string | null;
      type: string;
      prompt: string | null;
      result: string | null;
      error: string | null;
      next_due_at: number | null;
    }) => {
      // 数据库中存储的是 ISO 8601 格式的 UTC 时间字符串
      // 直接返回 ISO 字符串，前端可以正确解析
      return {
        id: row.id,
        timestamp: row.timestamp,
        agentId: row.agent_id,
        agentName: row.agent_name || undefined,
        type: row.type as HeartbeatLogEntry["type"],
        prompt: row.prompt || undefined,
        result: row.result || undefined,
        error: row.error || undefined,
        nextDueAt: row.next_due_at || undefined,
      };
    });
  }

  async deleteOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.run(
      `DELETE FROM t_heartbeat_logs WHERE timestamp < ?`,
      [cutoffDate.toISOString()]
    );

    return result.changes || 0;
  }
}

let globalHeartbeatLogRepository: HeartbeatLogRepository | null = null;

export async function getHeartbeatLogRepository(
  db?: IDatabaseAdapter,
): Promise<HeartbeatLogRepository> {
  if (!globalHeartbeatLogRepository) {
    if (!db) {
      const { getDatabase } = await import("../factory.js");
      db = await getDatabase();
    }
    globalHeartbeatLogRepository = new HeartbeatLogRepository(db);
    await globalHeartbeatLogRepository.initializeTable();
  }
  return globalHeartbeatLogRepository;
}

export function resetHeartbeatLogRepository(): void {
  globalHeartbeatLogRepository = null;
}
