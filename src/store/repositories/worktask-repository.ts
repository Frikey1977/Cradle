/**
 * Worktask 数据库存储层
 * 
 * 实现 Worktask 的持久化存储，支持：
 * - 任务主表 t_worktask
 * - Todo 列表 t_worktask_todo
 * - 执行记录 t_worktask_executor
 * - 检查点 t_task_checkpoint
 */

import { getDatabase } from "../factory.js";
import type { IDatabaseAdapter, ITransaction } from "../adapter.js";
import type {
  Worktask,
  WorktaskStatus,
  WorktaskTodo,
  ExecutorRecord,
  WorktaskFilter,
  TaskCheckpoint,
} from "../../agent/worktask/types.js";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class WorktaskRepository {
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
      CREATE TABLE IF NOT EXISTS t_worktask (
        sid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        agent_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        conversation_id TEXT,
        task_def_id TEXT,
        task TEXT NOT NULL,
        status TEXT DEFAULT 'created',
        plan TEXT,
        context TEXT,
        result TEXT,
        start_time TEXT,
        complete_time TEXT,
        total_duration INTEGER,
        token_input INTEGER,
        token_output INTEGER,
        error_count INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        loop_count INTEGER DEFAULT 0,
        max_loops INTEGER,
        driver_type TEXT,
        driver_config TEXT,
        next_trigger_time TEXT,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        status_field TEXT DEFAULT 'enabled'
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_worktask_todo (
        sid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        worktask_id TEXT NOT NULL,
        content TEXT NOT NULL,
        todo_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        step_id TEXT,
        executor_id TEXT,
        result TEXT,
        error_message TEXT,
        start_time TEXT,
        complete_time TEXT,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        status_field TEXT DEFAULT 'enabled'
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_worktask_executor (
        sid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        worktask_id TEXT NOT NULL,
        step_id TEXT,
        task TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        error_code TEXT,
        error_message TEXT,
        error_stack TEXT,
        tool_calls TEXT,
        token_input INTEGER,
        token_output INTEGER,
        start_time TEXT,
        complete_time TEXT,
        duration INTEGER,
        context_snapshot TEXT,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        status_field TEXT DEFAULT 'enabled'
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_task_checkpoint (
        sid TEXT PRIMARY KEY,
        worktask_id TEXT NOT NULL,
        executor_id TEXT,
        checkpoint_type TEXT NOT NULL,
        checkpoint_data TEXT NOT NULL,
        iteration INTEGER DEFAULT 0,
        create_time TEXT DEFAULT (datetime('now')),
        deleted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now'))
      )
    `);

    await db.run(`CREATE INDEX IF NOT EXISTS idx_worktask_agent ON t_worktask(agent_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_worktask_status ON t_worktask(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_todo_worktask ON t_worktask_todo(worktask_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_executor_worktask ON t_worktask_executor(worktask_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_checkpoint_worktask ON t_task_checkpoint(worktask_id)`);
  }

  private async initMySQLTables(db: IDatabaseAdapter): Promise<void> {
    await db.run(`
      CREATE TABLE IF NOT EXISTS t_worktask (
        sid VARCHAR(36) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        agent_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NOT NULL,
        conversation_id VARCHAR(36),
        task_def_id VARCHAR(36),
        task TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'created',
        plan JSON,
        context JSON,
        result JSON,
        start_time DATETIME,
        complete_time DATETIME,
        total_duration INT,
        token_input INT,
        token_output INT,
        error_count INT DEFAULT 0,
        retry_count INT DEFAULT 0,
        loop_count INT DEFAULT 0,
        max_loops INT,
        driver_type VARCHAR(20),
        driver_config JSON,
        next_trigger_time DATETIME,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status_field VARCHAR(20) DEFAULT 'enabled',
        INDEX idx_worktask_agent (agent_id),
        INDEX idx_worktask_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_worktask_todo (
        sid VARCHAR(36) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        worktask_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        todo_order INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        step_id VARCHAR(100),
        executor_id VARCHAR(36),
        result TEXT,
        error_message TEXT,
        start_time DATETIME,
        complete_time DATETIME,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status_field VARCHAR(20) DEFAULT 'enabled',
        INDEX idx_todo_worktask (worktask_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_worktask_executor (
        sid VARCHAR(36) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        worktask_id VARCHAR(36) NOT NULL,
        step_id VARCHAR(100),
        task TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        result JSON,
        error_code VARCHAR(50),
        error_message TEXT,
        error_stack TEXT,
        tool_calls JSON,
        token_input INT,
        token_output INT,
        start_time DATETIME,
        complete_time DATETIME,
        duration INT,
        context_snapshot JSON,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status_field VARCHAR(20) DEFAULT 'enabled',
        INDEX idx_executor_worktask (worktask_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS t_task_checkpoint (
        sid VARCHAR(36) PRIMARY KEY,
        worktask_id VARCHAR(36) NOT NULL,
        executor_id VARCHAR(36),
        checkpoint_type VARCHAR(20) NOT NULL,
        checkpoint_data JSON NOT NULL,
        iteration INT DEFAULT 0,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted TINYINT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_checkpoint_worktask (worktask_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async save(worktask: Worktask): Promise<void> {
    const db = await this.getDb();
    const existing = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_worktask WHERE sid = ?",
      [worktask.id]
    );

    const now = new Date().toISOString();
    const planJson = JSON.stringify(worktask.plan);
    const contextJson = JSON.stringify(worktask.context || {});
    const resultJson = worktask.result ? JSON.stringify(worktask.result) : null;

    if (existing) {
      await db.run(
        `UPDATE t_worktask SET 
          name = ?, description = ?, task = ?, status = ?, plan = ?, context = ?, result = ?,
          start_time = ?, complete_time = ?, total_duration = ?, 
          token_input = ?, token_output = ?, error_count = ?, retry_count = ?,
          loop_count = ?, max_loops = ?, driver_type = ?, driver_config = ?, next_trigger_time = ?,
          timestamp = ?
        WHERE sid = ?`,
        [
          worktask.task.substring(0, 200),
          worktask.description || null,
          worktask.task,
          worktask.status,
          planJson,
          contextJson,
          resultJson,
          worktask.startedAt?.toISOString() || null,
          worktask.completedAt?.toISOString() || null,
          worktask.metadata?.totalDuration || null,
          worktask.metadata?.tokenUsage?.input || null,
          worktask.metadata?.tokenUsage?.output || null,
          worktask.metadata?.errorCount || 0,
          worktask.metadata?.retryCount || 0,
          worktask.loopState?.loopCount || 0,
          worktask.loopState?.maxLoops || null,
          worktask.driver?.type || null,
          worktask.driver?.config ? JSON.stringify(worktask.driver.config) : null,
          worktask.driver?.nextTriggerTime?.toISOString() || null,
          now,
          worktask.id,
        ]
      );
    } else {
      await db.run(
        `INSERT INTO t_worktask (
          sid, name, description, agent_id, contact_id, conversation_id, task, status,
          plan, context, result, start_time, complete_time, total_duration,
          token_input, token_output, error_count, retry_count,
          loop_count, max_loops, driver_type, driver_config, next_trigger_time, create_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          worktask.id,
          worktask.task.substring(0, 200),
          worktask.description || null,
          worktask.agentId,
          worktask.contactId,
          worktask.conversationId || null,
          worktask.task,
          worktask.status,
          planJson,
          contextJson,
          resultJson,
          worktask.startedAt?.toISOString() || null,
          worktask.completedAt?.toISOString() || null,
          worktask.metadata?.totalDuration || null,
          worktask.metadata?.tokenUsage?.input || null,
          worktask.metadata?.tokenUsage?.output || null,
          worktask.metadata?.errorCount || 0,
          worktask.metadata?.retryCount || 0,
          worktask.loopState?.loopCount || 0,
          worktask.loopState?.maxLoops || null,
          worktask.driver?.type || null,
          worktask.driver?.config ? JSON.stringify(worktask.driver.config) : null,
          worktask.driver?.nextTriggerTime?.toISOString() || null,
          now,
        ]
      );
    }

    await this.saveTodos(worktask.id, worktask.todos);
    await this.saveExecutors(worktask.id, worktask.executors);
  }

  private async saveTodos(worktaskId: string, todos: WorktaskTodo[]): Promise<void> {
    const db = await this.getDb();
    
    for (const todo of todos) {
      const existing = await db.queryOne<{ sid: string }>(
        "SELECT sid FROM t_worktask_todo WHERE sid = ?",
        [todo.id]
      );

      const now = new Date().toISOString();

      if (existing) {
        await db.run(
          `UPDATE t_worktask_todo SET 
            content = ?, status = ?, result = ?, error_message = ?,
            start_time = ?, complete_time = ?, timestamp = ?
          WHERE sid = ?`,
          [
            todo.content,
            todo.status,
            todo.result || null,
            todo.error || null,
            todo.startedAt?.toISOString() || null,
            todo.completedAt?.toISOString() || null,
            now,
            todo.id,
          ]
        );
      } else {
        await db.run(
          `INSERT INTO t_worktask_todo (
            sid, name, worktask_id, content, todo_order, status,
            step_id, executor_id, result, error_message, start_time, complete_time, create_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            todo.id,
            todo.content.substring(0, 200),
            worktaskId,
            todo.content,
            todo.order,
            todo.status,
            todo.stepId || null,
            todo.executorId || null,
            todo.result || null,
            todo.error || null,
            todo.startedAt?.toISOString() || null,
            todo.completedAt?.toISOString() || null,
            now,
          ]
        );
      }
    }
  }

  private async saveExecutors(worktaskId: string, executors: ExecutorRecord[]): Promise<void> {
    const db = await this.getDb();

    for (const executor of executors) {
      const existing = await db.queryOne<{ sid: string }>(
        "SELECT sid FROM t_worktask_executor WHERE sid = ?",
        [executor.id]
      );

      const now = new Date().toISOString();
      const resultJson = executor.result ? JSON.stringify(executor.result) : null;
      const toolCallsJson = executor.metadata?.toolCalls
        ? JSON.stringify(executor.metadata.toolCalls)
        : null;
      const contextSnapshotJson = executor.contextSnapshot
        ? JSON.stringify(executor.contextSnapshot)
        : null;

      if (existing) {
        await db.run(
          `UPDATE t_worktask_executor SET 
            status = ?, result = ?, error_code = ?, error_message = ?, error_stack = ?,
            tool_calls = ?, token_input = ?, token_output = ?,
            start_time = ?, complete_time = ?, duration = ?, context_snapshot = ?, timestamp = ?
          WHERE sid = ?`,
          [
            executor.status,
            resultJson,
            executor.error?.code || null,
            executor.error?.message || null,
            executor.error?.stack || null,
            toolCallsJson,
            executor.metadata?.tokenUsage?.input || null,
            executor.metadata?.tokenUsage?.output || null,
            executor.startedAt?.toISOString() || null,
            executor.completedAt?.toISOString() || null,
            executor.duration || null,
            contextSnapshotJson,
            now,
            executor.id,
          ]
        );
      } else {
        await db.run(
          `INSERT INTO t_worktask_executor (
            sid, name, worktask_id, step_id, task, status, result,
            error_code, error_message, error_stack, tool_calls,
            token_input, token_output, start_time, complete_time, duration, context_snapshot, create_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            executor.id,
            executor.task.substring(0, 200),
            worktaskId,
            executor.stepId || null,
            executor.task,
            executor.status,
            resultJson,
            executor.error?.code || null,
            executor.error?.message || null,
            executor.error?.stack || null,
            toolCallsJson,
            executor.metadata?.tokenUsage?.input || null,
            executor.metadata?.tokenUsage?.output || null,
            executor.startedAt?.toISOString() || null,
            executor.completedAt?.toISOString() || null,
            executor.duration || null,
            contextSnapshotJson,
            now,
          ]
        );
      }
    }
  }

  async get(worktaskId: string): Promise<Worktask | null> {
    const db = await this.getDb();
    const row = await db.queryOne<WorktaskRow>(
      "SELECT * FROM t_worktask WHERE sid = ? AND deleted = 0",
      [worktaskId]
    );

    if (!row) return null;

    return this.rowToWorktask(row);
  }

  async getByAgent(agentId: string): Promise<Worktask[]> {
    const db = await this.getDb();
    const rows = await db.query<WorktaskRow>(
      "SELECT * FROM t_worktask WHERE agent_id = ? AND deleted = 0 ORDER BY create_time DESC",
      [agentId]
    );

    return Promise.all(rows.map((row) => this.rowToWorktask(row)));
  }

  async getByStatus(status: WorktaskStatus | WorktaskStatus[]): Promise<Worktask[]> {
    const db = await this.getDb();
    const statuses = Array.isArray(status) ? status : [status];
    const placeholders = statuses.map(() => "?").join(",");
    const rows = await db.query<WorktaskRow>(
      `SELECT * FROM t_worktask WHERE status IN (${placeholders}) AND deleted = 0 ORDER BY create_time DESC`,
      statuses
    );

    return Promise.all(rows.map((row) => this.rowToWorktask(row)));
  }

  async getByNextTriggerTime(before: Date): Promise<Worktask[]> {
    const db = await this.getDb();
    const rows = await db.query<WorktaskRow>(
      "SELECT * FROM t_worktask WHERE next_trigger_time <= ? AND status IN ('paused', 'running') AND deleted = 0",
      [before.toISOString()]
    );

    return Promise.all(rows.map((row) => this.rowToWorktask(row)));
  }

  async delete(worktaskId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run("UPDATE t_worktask SET deleted = 1, timestamp = ? WHERE sid = ?", [
      now,
      worktaskId,
    ]);
    await db.run("UPDATE t_worktask_todo SET deleted = 1, timestamp = ? WHERE worktask_id = ?", [
      now,
      worktaskId,
    ]);
    await db.run(
      "UPDATE t_worktask_executor SET deleted = 1, timestamp = ? WHERE worktask_id = ?",
      [now, worktaskId]
    );
  }

  async query(filter: WorktaskFilter): Promise<Worktask[]> {
    const db = await this.getDb();
    const conditions: string[] = ["deleted = 0"];
    const params: any[] = [];

    if (filter.agentId) {
      conditions.push("agent_id = ?");
      params.push(filter.agentId);
    }
    if (filter.contactId) {
      conditions.push("contact_id = ?");
      params.push(filter.contactId);
    }
    if (filter.conversationId) {
      conditions.push("conversation_id = ?");
      params.push(filter.conversationId);
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }

    const sql = `SELECT * FROM t_worktask WHERE ${conditions.join(" AND ")} ORDER BY create_time DESC`;
    const rows = await db.query<WorktaskRow>(sql, params);

    return Promise.all(rows.map((row) => this.rowToWorktask(row)));
  }

  private async rowToWorktask(row: WorktaskRow): Promise<Worktask> {
    const db = await this.getDb();
    
    const todos = await db.query<TodoRow>(
      "SELECT * FROM t_worktask_todo WHERE worktask_id = ? AND deleted = 0 ORDER BY todo_order",
      [row.sid]
    );

    const executors = await db.query<ExecutorRow>(
      "SELECT * FROM t_worktask_executor WHERE worktask_id = ? AND deleted = 0 ORDER BY create_time",
      [row.sid]
    );

    return {
      id: row.sid,
      agentId: row.agent_id,
      contactId: row.contact_id,
      conversationId: row.conversation_id || "",
      task: row.task,
      description: row.description || undefined,
      status: row.status as WorktaskStatus,
      plan: row.plan ? JSON.parse(row.plan) : { steps: [], strategy: "serial", dependencies: { nodes: [], edges: [] } },
      context: row.context ? JSON.parse(row.context) : {},
      result: row.result ? JSON.parse(row.result) : undefined,
      todos: todos.map((t) => this.rowToTodo(t)),
      executors: executors.map((e) => this.rowToExecutor(e)),
      progress: {
        total: todos.length,
        completed: todos.filter((t) => t.status === "completed").length,
        failed: todos.filter((t) => t.status === "failed").length,
        skipped: todos.filter((t) => t.status === "skipped").length,
        percentage: 0,
        timeline: [],
      },
      createdAt: new Date(row.create_time),
      updatedAt: new Date(row.timestamp),
      startedAt: row.start_time ? new Date(row.start_time) : undefined,
      completedAt: row.complete_time ? new Date(row.complete_time) : undefined,
      metadata: {
        totalDuration: row.total_duration || undefined,
        tokenUsage: row.token_input || row.token_output
          ? { input: row.token_input || 0, output: row.token_output || 0, total: (row.token_input || 0) + (row.token_output || 0) }
          : undefined,
        errorCount: row.error_count || 0,
        retryCount: row.retry_count || 0,
      },
      loopState: {
        loopCount: row.loop_count || 0,
        maxLoops: row.max_loops || undefined,
      },
      driver: row.driver_type
        ? {
            type: row.driver_type as any,
            config: row.driver_config ? JSON.parse(row.driver_config) : undefined,
            nextTriggerTime: row.next_trigger_time ? new Date(row.next_trigger_time) : undefined,
          }
        : undefined,
    };
  }

  private rowToTodo(row: TodoRow): WorktaskTodo {
    return {
      id: row.sid,
      worktaskId: row.worktask_id,
      content: row.content,
      description: row.description || undefined,
      status: row.status as any,
      order: row.todo_order,
      stepId: row.step_id || undefined,
      executorId: row.executor_id || undefined,
      startedAt: row.start_time ? new Date(row.start_time) : undefined,
      completedAt: row.complete_time ? new Date(row.complete_time) : undefined,
      result: row.result || undefined,
      error: row.error_message || undefined,
      createdAt: new Date(row.create_time),
      updatedAt: new Date(row.timestamp),
    };
  }

  private rowToExecutor(row: ExecutorRow): ExecutorRecord {
    return {
      id: row.sid,
      worktaskId: row.worktask_id,
      stepId: row.step_id || "",
      task: row.task,
      status: row.status as any,
      startedAt: row.start_time ? new Date(row.start_time) : undefined,
      completedAt: row.complete_time ? new Date(row.complete_time) : undefined,
      duration: row.duration || undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error_code
        ? {
            code: row.error_code,
            message: row.error_message || "",
            stack: row.error_stack || undefined,
          }
        : undefined,
      metadata: {
        toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : [],
        tokenUsage: row.token_input || row.token_output
          ? { input: row.token_input || 0, output: row.token_output || 0, total: (row.token_input || 0) + (row.token_output || 0) }
          : undefined,
      },
      contextSnapshot: row.context_snapshot ? JSON.parse(row.context_snapshot) : undefined,
    };
  }

  async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO t_task_checkpoint (
        sid, worktask_id, executor_id, checkpoint_type, checkpoint_data, iteration, create_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        checkpoint.id || generateId(),
        checkpoint.worktaskId,
        checkpoint.executorId || null,
        checkpoint.type,
        JSON.stringify(checkpoint.data),
        checkpoint.iteration || 0,
        now,
      ]
    );
  }

  async getLatestCheckpoint(worktaskId: string, executorId?: string): Promise<TaskCheckpoint | null> {
    const db = await this.getDb();
    const row = await db.queryOne<CheckpointRow>(
      executorId
        ? "SELECT * FROM t_task_checkpoint WHERE worktask_id = ? AND executor_id = ? AND deleted = 0 ORDER BY create_time DESC LIMIT 1"
        : "SELECT * FROM t_task_checkpoint WHERE worktask_id = ? AND deleted = 0 ORDER BY create_time DESC LIMIT 1",
      executorId ? [worktaskId, executorId] : [worktaskId]
    );

    if (!row) return null;

    return {
      id: row.sid,
      worktaskId: row.worktask_id,
      executorId: row.executor_id || undefined,
      type: row.checkpoint_type as TaskCheckpoint["type"],
      data: JSON.parse(row.checkpoint_data),
      iteration: row.iteration,
      createdAt: new Date(row.create_time),
    };
  }

  async getCheckpoints(worktaskId: string): Promise<TaskCheckpoint[]> {
    const db = await this.getDb();
    const rows = await db.query<CheckpointRow>(
      "SELECT * FROM t_task_checkpoint WHERE worktask_id = ? AND deleted = 0 ORDER BY iteration ASC, create_time ASC",
      [worktaskId]
    );

    return rows.map((row) => ({
      id: row.sid,
      worktaskId: row.worktask_id,
      executorId: row.executor_id || undefined,
      type: row.checkpoint_type as TaskCheckpoint["type"],
      data: JSON.parse(row.checkpoint_data),
      iteration: row.iteration,
      createdAt: new Date(row.create_time),
    }));
  }
}

interface WorktaskRow {
  sid: string;
  name: string;
  description: string | null;
  agent_id: string;
  contact_id: string;
  conversation_id: string | null;
  task_def_id: string | null;
  task: string;
  status: string;
  plan: string | null;
  context: string | null;
  result: string | null;
  start_time: string | null;
  complete_time: string | null;
  total_duration: number | null;
  token_input: number | null;
  token_output: number | null;
  error_count: number;
  retry_count: number;
  loop_count: number;
  max_loops: number | null;
  driver_type: string | null;
  driver_config: string | null;
  next_trigger_time: string | null;
  create_time: string;
  deleted: number;
  timestamp: string;
}

interface TodoRow {
  sid: string;
  name: string;
  description: string | null;
  worktask_id: string;
  content: string;
  todo_order: number;
  status: string;
  step_id: string | null;
  executor_id: string | null;
  result: string | null;
  error_message: string | null;
  start_time: string | null;
  complete_time: string | null;
  create_time: string;
  deleted: number;
  timestamp: string;
}

interface ExecutorRow {
  sid: string;
  name: string;
  description: string | null;
  worktask_id: string;
  step_id: string | null;
  task: string;
  status: string;
  result: string | null;
  error_code: string | null;
  error_message: string | null;
  error_stack: string | null;
  tool_calls: string | null;
  token_input: number | null;
  token_output: number | null;
  start_time: string | null;
  complete_time: string | null;
  duration: number | null;
  context_snapshot: string | null;
  create_time: string;
  deleted: number;
  timestamp: string;
}

interface CheckpointRow {
  sid: string;
  worktask_id: string;
  executor_id: string | null;
  checkpoint_type: string;
  checkpoint_data: string;
  iteration: number;
  create_time: string;
  deleted: number;
}

export const worktaskRepository = new WorktaskRepository();
