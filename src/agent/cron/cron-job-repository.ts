/**
 * Cron 任务存储层
 *
 * 实现 CronJob 的数据库持久化
 */

import { getDatabase } from "../../store/factory.js";
import type { IDatabaseAdapter } from "../../store/adapter.js";
import type {
  CronJob,
  CreateCronJobParams,
  CronJobFilter,
  CronJobHistory,
  CronJobSchedule,
  CronJobState,
  ExecutionStatus,
} from "./types.js";
import { calculateNextRun } from "./types.js";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class CronJobRepository {
  private db: IDatabaseAdapter | null = null;

  private async getDb(): Promise<IDatabaseAdapter> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  async initialize(): Promise<void> {
    const db = await this.getDb();
    const dbType = db.getType();

    if (dbType === "sqlite") {
      await this.initSQLiteTables(db);
    } else {
      await this.initMySQLTables(db);
    }
  }

  private async initSQLiteTables(db: IDatabaseAdapter): Promise<void> {
    await db.run(`
      CREATE TABLE IF NOT EXISTS t_cron_job (
        sid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        agent_id TEXT,
        user_id TEXT,
        org_id TEXT,
        schedule_type TEXT NOT NULL,
        schedule_at TEXT,
        schedule_interval INTEGER,
        schedule_expression TEXT,
        schedule_timezone TEXT NOT NULL DEFAULT 'UTC',
        session_target TEXT NOT NULL DEFAULT 'isolated',
        wake_mode TEXT NOT NULL DEFAULT 'now',
        payload_type TEXT NOT NULL,
        payload_content TEXT NOT NULL,
        delivery_mode TEXT,
        delivery_channel TEXT,
        delivery_target TEXT,
        delivery_best_effort INTEGER DEFAULT 0,
        delete_after_run INTEGER DEFAULT 0,
        state_next_run_at TEXT,
        state_last_run_at TEXT,
        state_last_status TEXT,
        state_last_error TEXT,
        state_last_duration_ms INTEGER,
        state_run_count INTEGER NOT NULL DEFAULT 0,
        state_fail_count INTEGER NOT NULL DEFAULT 0,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        status INTEGER DEFAULT 1
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_cron_job_history (
        sid TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        worktask_id TEXT,
        status TEXT NOT NULL,
        error TEXT,
        duration_ms INTEGER,
        executed_at TEXT NOT NULL,
        output TEXT,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0
      )
    `);

    await db.run(`CREATE INDEX IF NOT EXISTS idx_cron_job_agent ON t_cron_job(agent_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_cron_job_next_run ON t_cron_job(state_next_run_at)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_cron_job_status ON t_cron_job(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_cron_history_job ON t_cron_job_history(job_id)`);
  }

  private async initMySQLTables(db: IDatabaseAdapter): Promise<void> {
    await db.run(`
      CREATE TABLE IF NOT EXISTS t_cron_job (
        sid VARCHAR(36) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        agent_id VARCHAR(36),
        user_id VARCHAR(36),
        org_id VARCHAR(36),
        schedule_type VARCHAR(20) NOT NULL,
        schedule_at DATETIME,
        schedule_interval BIGINT,
        schedule_expression VARCHAR(255),
        schedule_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        session_target VARCHAR(20) NOT NULL DEFAULT 'isolated',
        wake_mode VARCHAR(20) NOT NULL DEFAULT 'now',
        payload_type VARCHAR(20) NOT NULL,
        payload_content JSON NOT NULL,
        delivery_mode VARCHAR(20),
        delivery_channel VARCHAR(50),
        delivery_target VARCHAR(255),
        delivery_best_effort TINYINT DEFAULT 0,
        delete_after_run TINYINT DEFAULT 0,
        state_next_run_at DATETIME,
        state_last_run_at DATETIME,
        state_last_status VARCHAR(20),
        state_last_error TEXT,
        state_last_duration_ms INT,
        state_run_count INT NOT NULL DEFAULT 0,
        state_fail_count INT NOT NULL DEFAULT 0,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status TINYINT DEFAULT 1,
        INDEX idx_cron_job_agent (agent_id),
        INDEX idx_cron_job_next_run (state_next_run_at),
        INDEX idx_cron_job_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_cron_job_history (
        sid VARCHAR(36) PRIMARY KEY,
        job_id VARCHAR(36) NOT NULL,
        worktask_id VARCHAR(36),
        status VARCHAR(20) NOT NULL,
        error TEXT,
        duration_ms INT,
        executed_at DATETIME NOT NULL,
        output TEXT,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        INDEX idx_cron_history_job (job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async create(params: CreateCronJobParams): Promise<CronJob> {
    const db = await this.getDb();
    const now = new Date();
    const id = generateId();

    const schedule: CronJobSchedule = {
      type: params.schedule.type,
      at: params.schedule.at ? new Date(params.schedule.at) : undefined,
      interval: params.schedule.interval,
      expression: params.schedule.expression,
      timezone: params.schedule.timezone || "UTC",
    };

    const nextRunAt = calculateNextRun(schedule);

    const job: CronJob = {
      id,
      name: params.name,
      description: params.description,
      agentId: params.agentId,
      userId: params.userId,
      orgId: params.orgId,
      schedule,
      sessionTarget: params.sessionTarget || "isolated",
      wakeMode: params.wakeMode || "now",
      payload: params.payload,
      delivery: params.delivery ? {
        mode: params.delivery.mode,
        channel: params.delivery.channel,
        target: params.delivery.target,
        bestEffort: params.delivery.bestEffort ?? false,
      } : undefined,
      deleteAfterRun: params.deleteAfterRun ?? (params.schedule.type === "at"),
      state: {
        nextRunAt: nextRunAt || undefined,
        runCount: 0,
        failCount: 0,
      },
      enabled: params.enabled ?? true,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    await db.run(
      `INSERT INTO t_cron_job (
        sid, name, description, agent_id, user_id, org_id,
        schedule_type, schedule_at, schedule_interval, schedule_expression, schedule_timezone,
        session_target, wake_mode, payload_type, payload_content,
        delivery_mode, delivery_channel, delivery_target, delivery_best_effort,
        delete_after_run, state_next_run_at, state_run_count, state_fail_count,
        create_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.name,
        job.description || null,
        job.agentId || null,
        job.userId || null,
        job.orgId || null,
        job.schedule.type,
        job.schedule.at?.toISOString() || null,
        job.schedule.interval || null,
        job.schedule.expression || null,
        job.schedule.timezone,
        job.sessionTarget,
        job.wakeMode,
        job.payload.type,
        JSON.stringify(job.payload.content),
        job.delivery?.mode || null,
        job.delivery?.channel || null,
        job.delivery?.target || null,
        job.delivery?.bestEffort ? 1 : 0,
        job.deleteAfterRun ? 1 : 0,
        job.state.nextRunAt?.toISOString() || null,
        job.state.runCount,
        job.state.failCount,
        now.toISOString(),
        job.enabled ? 1 : 0,
      ]
    );

    return job;
  }

  async get(jobId: string): Promise<CronJob | null> {
    const db = await this.getDb();
    const row = await db.queryOne<CronJobRow>(
      "SELECT * FROM t_cron_job WHERE sid = ? AND deleted = 0",
      [jobId]
    );

    return row ? this.rowToJob(row) : null;
  }

  async getByAgent(agentId: string): Promise<CronJob[]> {
    const db = await this.getDb();
    const rows = await db.query<CronJobRow>(
      "SELECT * FROM t_cron_job WHERE agent_id = ? AND deleted = 0 ORDER BY create_time DESC",
      [agentId]
    );

    return rows.map((row) => this.rowToJob(row));
  }

  async getDueJobs(before: Date): Promise<CronJob[]> {
    const db = await this.getDb();
    const rows = await db.query<CronJobRow>(
      `SELECT * FROM t_cron_job 
       WHERE state_next_run_at <= ? 
       AND status = 1 
       AND deleted = 0
       ORDER BY state_next_run_at ASC`,
      [before.toISOString()]
    );

    return rows.map((row) => this.rowToJob(row));
  }

  async updateState(
    jobId: string,
    state: Partial<CronJobState>
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE t_cron_job SET
        state_next_run_at = ?,
        state_last_run_at = ?,
        state_last_status = ?,
        state_last_error = ?,
        state_last_duration_ms = ?,
        state_run_count = ?,
        state_fail_count = ?,
        timestamp = ?
      WHERE sid = ?`,
      [
        state.nextRunAt?.toISOString() || null,
        state.lastRunAt?.toISOString() || null,
        state.lastStatus || null,
        state.lastError || null,
        state.lastDurationMs || null,
        state.runCount,
        state.failCount,
        now,
        jobId,
      ]
    );
  }

  async updateNextRun(jobId: string, nextRunAt: Date | null): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE t_cron_job SET state_next_run_at = ?, timestamp = ? WHERE sid = ?`,
      [nextRunAt?.toISOString() || null, now, jobId]
    );
  }

  async enable(jobId: string): Promise<void> {
    const db = await this.getDb();
    await db.run("UPDATE t_cron_job SET status = 1 WHERE sid = ?", [jobId]);
  }

  async disable(jobId: string): Promise<void> {
    const db = await this.getDb();
    await db.run("UPDATE t_cron_job SET status = 0 WHERE sid = ?", [jobId]);
  }

  async delete(jobId: string): Promise<void> {
    const db = await this.getDb();
    await db.run("UPDATE t_cron_job SET deleted = 1 WHERE sid = ?", [jobId]);
  }

  async addHistory(history: Omit<CronJobHistory, "id" | "createdAt">): Promise<CronJobHistory> {
    const db = await this.getDb();
    const id = generateId();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO t_cron_job_history (
        sid, job_id, worktask_id, status, error, duration_ms, executed_at, output, create_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        history.jobId,
        history.worktaskId || null,
        history.status,
        history.error || null,
        history.durationMs,
        history.executedAt.toISOString(),
        history.output || null,
        now,
      ]
    );

    return {
      id,
      ...history,
      createdAt: new Date(now),
    };
  }

  async getHistory(jobId: string, limit: number = 50): Promise<CronJobHistory[]> {
    const db = await this.getDb();
    const rows = await db.query<HistoryRow>(
      `SELECT * FROM t_cron_job_history 
       WHERE job_id = ? AND deleted = 0 
       ORDER BY executed_at DESC 
       LIMIT ?`,
      [jobId, limit]
    );

    return rows.map((row) => ({
      id: row.sid,
      jobId: row.job_id,
      worktaskId: row.worktask_id || undefined,
      status: row.status as ExecutionStatus,
      error: row.error || undefined,
      durationMs: row.duration_ms,
      executedAt: new Date(row.executed_at),
      output: row.output || undefined,
      createdAt: new Date(row.create_time),
    }));
  }

  async query(filter: CronJobFilter): Promise<CronJob[]> {
    const db = await this.getDb();
    const conditions: string[] = ["deleted = 0"];
    const params: any[] = [];

    if (filter.agentId) {
      conditions.push("agent_id = ?");
      params.push(filter.agentId);
    }
    if (filter.userId) {
      conditions.push("user_id = ?");
      params.push(filter.userId);
    }
    if (filter.orgId) {
      conditions.push("org_id = ?");
      params.push(filter.orgId);
    }
    if (filter.scheduleType) {
      conditions.push("schedule_type = ?");
      params.push(filter.scheduleType);
    }
    if (filter.enabled !== undefined) {
      conditions.push("status = ?");
      params.push(filter.enabled ? 1 : 0);
    }
    if (filter.nextRunBefore) {
      conditions.push("state_next_run_at <= ?");
      params.push(filter.nextRunBefore.toISOString());
    }

    const sql = `SELECT * FROM t_cron_job WHERE ${conditions.join(" AND ")} ORDER BY create_time DESC`;
    const rows = await db.query<CronJobRow>(sql, params);

    return rows.map((row) => this.rowToJob(row));
  }

  private rowToJob(row: CronJobRow): CronJob {
    return {
      id: row.sid,
      name: row.name,
      description: row.description || undefined,
      agentId: row.agent_id || undefined,
      userId: row.user_id || undefined,
      orgId: row.org_id || undefined,
      schedule: {
        type: row.schedule_type as any,
        at: row.schedule_at ? new Date(row.schedule_at) : undefined,
        interval: row.schedule_interval || undefined,
        expression: row.schedule_expression || undefined,
        timezone: row.schedule_timezone,
      },
      sessionTarget: row.session_target as any,
      wakeMode: row.wake_mode as any,
      payload: {
        type: row.payload_type as any,
        content: JSON.parse(row.payload_content),
      },
      delivery: row.delivery_mode ? {
        mode: row.delivery_mode as any,
        channel: row.delivery_channel || undefined,
        target: row.delivery_target || undefined,
        bestEffort: row.delivery_best_effort === 1,
      } : undefined,
      deleteAfterRun: row.delete_after_run === 1,
      state: {
        nextRunAt: row.state_next_run_at ? new Date(row.state_next_run_at) : undefined,
        lastRunAt: row.state_last_run_at ? new Date(row.state_last_run_at) : undefined,
        lastStatus: row.state_last_status as ExecutionStatus | undefined,
        lastError: row.state_last_error || undefined,
        lastDurationMs: row.state_last_duration_ms || undefined,
        runCount: row.state_run_count,
        failCount: row.state_fail_count,
      },
      enabled: row.status === 1,
      createdAt: new Date(row.create_time),
      updatedAt: new Date(row.timestamp),
      deleted: row.deleted === 1,
    };
  }
}

interface CronJobRow {
  sid: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  user_id: string | null;
  org_id: string | null;
  schedule_type: string;
  schedule_at: string | null;
  schedule_interval: number | null;
  schedule_expression: string | null;
  schedule_timezone: string;
  session_target: string;
  wake_mode: string;
  payload_type: string;
  payload_content: string;
  delivery_mode: string | null;
  delivery_channel: string | null;
  delivery_target: string | null;
  delivery_best_effort: number;
  delete_after_run: number;
  state_next_run_at: string | null;
  state_last_run_at: string | null;
  state_last_status: string | null;
  state_last_error: string | null;
  state_last_duration_ms: number | null;
  state_run_count: number;
  state_fail_count: number;
  create_time: string;
  deleted: number;
  timestamp: string;
  status: number;
}

interface HistoryRow {
  sid: string;
  job_id: string;
  worktask_id: string | null;
  status: string;
  error: string | null;
  duration_ms: number;
  executed_at: string;
  output: string | null;
  create_time: string;
  deleted: number;
}

export const cronJobRepository = new CronJobRepository();
