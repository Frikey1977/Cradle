/**
 * LLM 日志存储仓库
 * 统一存储LLM调用日志到数据库，替代文件日志
 */

import type { IDatabaseAdapter } from "../adapter.js";
import type { LLMCallSource } from "../../utils/llm-logger.js";

export interface LLMLogEntry {
  id?: number;
  timestamp: Date;
  type: "request" | "response" | "error";
  model?: string;
  provider?: string;
  instanceId?: string;
  source?: LLMCallSource;
  agentName?: string;
  contactName?: string;
  worktaskId?: string;
  duration?: number;
  hasToolCalls?: boolean;
  requestBody?: any;
  responseData?: any;
  error?: string;
  tokenPrompt?: number;
  tokenCompletion?: number;
  tokenTotal?: number;
}

export interface LLMLogsQuery {
  date?: string; // YYYY-MM-DD
  type?: "request" | "response" | "error";
  source?: LLMCallSource;
  model?: string;
  provider?: string;
  agentName?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface LLMLogsResult {
  list: LLMLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * LLM日志仓库
 */
export class LLMLogRepository {
  private db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  /**
   * 初始化日志表
   */
  async initializeTable(): Promise<void> {
    const isSQLite = this.db.getType() === "sqlite";

    // 创建日志表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS t_llm_logs (
        ${isSQLite ? "id INTEGER PRIMARY KEY AUTOINCREMENT" : "id INT AUTO_INCREMENT PRIMARY KEY"},
        timestamp DATETIME DEFAULT ${isSQLite ? "CURRENT_TIMESTAMP" : "NOW()"},
        type VARCHAR(20) NOT NULL,
        model VARCHAR(50),
        provider VARCHAR(50),
        instance_id VARCHAR(64),
        source VARCHAR(50),
        agent_name VARCHAR(100),
        contact_name VARCHAR(100),
        worktask_id VARCHAR(64),
        duration INT,
        has_tool_calls ${isSQLite ? "INTEGER" : "BOOLEAN"} DEFAULT 0,
        request_body TEXT,
        response_data TEXT,
        error TEXT,
        token_prompt INT DEFAULT 0,
        token_completion INT DEFAULT 0,
        token_total INT DEFAULT 0,
        log_date DATE
      )
    `);

    // 创建索引
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_date ON t_llm_logs(log_date)",
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_type ON t_llm_logs(type)",
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_source ON t_llm_logs(source)",
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_model ON t_llm_logs(model)",
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_timestamp ON t_llm_logs(timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_llm_logs_agent ON t_llm_logs(agent_name)",
    ];

    for (const indexSql of indexes) {
      try {
        await this.db.run(indexSql);
      } catch (e) {
        // 索引可能已存在，忽略错误
      }
    }

    console.log("[LLMLogRepository] Table initialized");
  }

  /**
   * 记录请求日志
   */
  async logRequest(entry: Omit<LLMLogEntry, "timestamp" | "type">): Promise<number> {
    const isSQLite = this.db.getType() === "sqlite";
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const logDate = timestamp.slice(0, 10);

    const result = await this.db.run(
      `INSERT INTO t_llm_logs (
        timestamp, type, model, provider, instance_id, source,
        agent_name, contact_name, worktask_id, request_body, log_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        "request",
        entry.model || null,
        entry.provider || null,
        entry.instanceId || null,
        entry.source || null,
        entry.agentName || null,
        entry.contactName || null,
        entry.worktaskId || null,
        entry.requestBody ? JSON.stringify(entry.requestBody) : null,
        logDate,
      ],
    );

    return result.lastID || 0;
  }

  /**
   * 记录响应日志
   */
  async logResponse(
    entry: Omit<LLMLogEntry, "timestamp" | "type"> & { requestId?: number },
  ): Promise<number> {
    const isSQLite = this.db.getType() === "sqlite";
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const logDate = timestamp.slice(0, 10);

    const hasToolCalls = entry.responseData?.toolCalls?.length > 0;
    
    const tokenPrompt = entry.tokenPrompt ?? entry.responseData?.tokenUsage?.prompt ?? entry.responseData?.usage?.prompt_tokens ?? 0;
    const tokenCompletion = entry.tokenCompletion ?? entry.responseData?.tokenUsage?.completion ?? entry.responseData?.usage?.completion_tokens ?? 0;
    const tokenTotal = entry.tokenTotal ?? entry.responseData?.tokenUsage?.total ?? entry.responseData?.usage?.total_tokens ?? 0;

    if (entry.requestId) {
      await this.db.run(
        `UPDATE t_llm_logs SET
          duration = ?,
          has_tool_calls = ?,
          response_data = ?,
          token_prompt = ?,
          token_completion = ?,
          token_total = ?
        WHERE id = ?`,
        [
          entry.duration || 0,
          isSQLite ? (hasToolCalls ? 1 : 0) : hasToolCalls,
          entry.responseData ? JSON.stringify(entry.responseData) : null,
          tokenPrompt,
          tokenCompletion,
          tokenTotal,
          entry.requestId,
        ],
      );
      return entry.requestId;
    }

    const result = await this.db.run(
      `INSERT INTO t_llm_logs (
        timestamp, type, model, provider, instance_id, source,
        agent_name, contact_name, worktask_id, duration, has_tool_calls,
        response_data, token_prompt, token_completion, token_total, log_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        "response",
        entry.model || null,
        entry.provider || null,
        entry.instanceId || null,
        entry.source || null,
        entry.agentName || null,
        entry.contactName || null,
        entry.worktaskId || null,
        entry.duration || 0,
        isSQLite ? (hasToolCalls ? 1 : 0) : hasToolCalls,
        entry.responseData ? JSON.stringify(entry.responseData) : null,
        tokenPrompt,
        tokenCompletion,
        tokenTotal,
        logDate,
      ],
    );

    return result.lastID || 0;
  }

  /**
   * 记录错误日志
   */
  async logError(
    entry: Omit<LLMLogEntry, "timestamp" | "type"> & { requestId?: number },
  ): Promise<number> {
    const isSQLite = this.db.getType() === "sqlite";
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const logDate = timestamp.slice(0, 10);

    // 如果有requestId，更新原有记录
    if (entry.requestId) {
      await this.db.run(
        `UPDATE t_llm_logs SET
          type = ?,
          duration = ?,
          error = ?
        WHERE id = ?`,
        ["error", entry.duration || 0, entry.error || null, entry.requestId],
      );
      return entry.requestId;
    }

    // 否则插入新记录
    const result = await this.db.run(
      `INSERT INTO t_llm_logs (
        timestamp, type, model, provider, instance_id, source,
        agent_name, contact_name, worktask_id, duration, error, log_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        "error",
        entry.model || null,
        entry.provider || null,
        entry.instanceId || null,
        entry.source || null,
        entry.agentName || null,
        entry.contactName || null,
        entry.worktaskId || null,
        entry.duration || 0,
        entry.error || null,
        logDate,
      ],
    );

    return result.lastID || 0;
  }

  /**
   * 查询日志列表
   */
  async query(params: LLMLogsQuery): Promise<LLMLogsResult> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // 构建WHERE条件
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.date) {
      conditions.push("log_date = ?");
      queryParams.push(params.date);
    }
    if (params.type) {
      conditions.push("type = ?");
      queryParams.push(params.type);
    }
    if (params.source) {
      conditions.push("source = ?");
      queryParams.push(params.source);
    }
    if (params.model) {
      conditions.push("model = ?");
      queryParams.push(params.model);
    }
    if (params.provider) {
      conditions.push("provider = ?");
      queryParams.push(params.provider);
    }
    if (params.agentName) {
      conditions.push("agent_name = ?");
      queryParams.push(params.agentName);
    }
    if (params.keyword) {
      conditions.push(
        "(model LIKE ? OR provider LIKE ? OR agent_name LIKE ? OR error LIKE ?)",
      );
      const keyword = `%${params.keyword}%`;
      queryParams.push(keyword, keyword, keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 查询总数
    const countResult = await this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM t_llm_logs ${whereClause}`,
      queryParams,
    );
    const total = countResult?.total || 0;

    // 查询列表
    const isSQLite = this.db.getType() === "sqlite";
    const limitClause = isSQLite
      ? `LIMIT ${pageSize} OFFSET ${offset}`
      : `LIMIT ${offset}, ${pageSize}`;

    const rows = await this.db.query<any>(
      `SELECT * FROM t_llm_logs ${whereClause} ORDER BY timestamp DESC, id DESC ${limitClause}`,
      queryParams,
    );

    // 转换结果
    const list: LLMLogEntry[] = rows.map((row) => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      type: row.type,
      model: row.model,
      provider: row.provider,
      instanceId: row.instance_id,
      source: row.source,
      agentName: row.agent_name,
      contactName: row.contact_name,
      worktaskId: row.worktask_id,
      duration: row.duration,
      hasToolCalls: row.has_tool_calls === 1 || row.has_tool_calls === true,
      requestBody: row.request_body ? JSON.parse(row.request_body) : undefined,
      responseData: row.response_data ? JSON.parse(row.response_data) : undefined,
      error: row.error,
      tokenPrompt: row.token_prompt,
      tokenCompletion: row.token_completion,
      tokenTotal: row.token_total,
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取可用的日志日期列表
   */
  async getAvailableDates(): Promise<string[]> {
    const rows = await this.db.query<{ log_date: string }>(
      `SELECT DISTINCT log_date FROM t_llm_logs ORDER BY log_date DESC`,
    );
    return rows.map((r) => r.log_date);
  }

  /**
   * 删除指定日期的日志
   */
  async deleteByDate(date: string): Promise<number> {
    const result = await this.db.run("DELETE FROM t_llm_logs WHERE log_date = ?", [
      date,
    ]);
    return result.changes || 0;
  }

  /**
   * 清理旧日志（保留最近N天）
   */
  async cleanupOldLogs(keepDays: number): Promise<number> {
    const isSQLite = this.db.getType() === "sqlite";
    const date = new Date();
    date.setDate(date.getDate() - keepDays);
    const cutoffDate = date.toISOString().slice(0, 10);

    const result = await this.db.run(
      `DELETE FROM t_llm_logs WHERE log_date < ?`,
      [cutoffDate],
    );

    return result.changes || 0;
  }
}

// 全局仓库实例
let globalRepository: LLMLogRepository | null = null;

/**
 * 获取LLM日志仓库实例
 */
export async function getLLMLogRepository(
  db?: IDatabaseAdapter,
): Promise<LLMLogRepository> {
  if (!globalRepository) {
    if (!db) {
      const { getDatabase } = await import("../factory.js");
      db = await getDatabase();
    }
    globalRepository = new LLMLogRepository(db);
    await globalRepository.initializeTable();
  }
  return globalRepository;
}

/**
 * 重置仓库实例（用于测试）
 */
export function resetLLMLogRepository(): void {
  globalRepository = null;
}
