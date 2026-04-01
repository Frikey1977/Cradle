/**
 * Worktask 管理器
 *
 * 负责创建、更新、查询 Worktask
 * 支持持久化存储和循环状态管理
 * 由 Orchestrator 和 WorktaskScheduler 使用
 */

import type {
  Worktask,
  WorktaskStatus,
  WorktaskTodo,
  WorktaskProgress,
  WorktaskResult,
  CreateWorktaskParams,
  WorktaskFilter,
  PlanStep,
  ExecutorRecord,
  ProgressEvent,
  ProgressEventType,
  LoopState,
  LoopDecision,
  TaskCheckpoint,
  DriverConfig,
} from "./types.js";
import {
  WorktaskRepository,
  worktaskRepository,
} from "../../store/repositories/worktask-repository.js";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface WorktaskStore {
  save(worktask: Worktask): Promise<void>;
  get(worktaskId: string): Promise<Worktask | null>;
  getByAgent(agentId: string): Promise<Worktask[]>;
  getByConversation(conversationId: string): Promise<Worktask[]>;
  getByStatus(status: WorktaskStatus | WorktaskStatus[]): Promise<Worktask[]>;
  getByNextTriggerTime(before: Date): Promise<Worktask[]>;
  delete(worktaskId: string): Promise<void>;
  query(filter: WorktaskFilter): Promise<Worktask[]>;
  count(filter: WorktaskFilter): Promise<number>;
  saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void>;
  getLatestCheckpoint(worktaskId: string, executorId?: string): Promise<TaskCheckpoint | null>;
  getCheckpoints(worktaskId: string): Promise<TaskCheckpoint[]>;
}

export class InMemoryWorktaskStore implements WorktaskStore {
  private worktasks: Map<string, Worktask> = new Map();
  private checkpoints: Map<string, TaskCheckpoint[]> = new Map();

  async save(worktask: Worktask): Promise<void> {
    this.worktasks.set(worktask.id, { ...worktask });
  }

  async get(worktaskId: string): Promise<Worktask | null> {
    return this.worktasks.get(worktaskId) || null;
  }

  async getByAgent(agentId: string): Promise<Worktask[]> {
    return Array.from(this.worktasks.values()).filter((w) => w.agentId === agentId);
  }

  async getByConversation(conversationId: string): Promise<Worktask[]> {
    return Array.from(this.worktasks.values()).filter(
      (w) => w.conversationId === conversationId
    );
  }

  async getByStatus(status: WorktaskStatus | WorktaskStatus[]): Promise<Worktask[]> {
    const statuses = Array.isArray(status) ? status : [status];
    return Array.from(this.worktasks.values()).filter((w) => statuses.includes(w.status));
  }

  async getByNextTriggerTime(before: Date): Promise<Worktask[]> {
    return Array.from(this.worktasks.values()).filter(
      (w) =>
        w.driver?.nextTriggerTime &&
        w.driver.nextTriggerTime <= before &&
        (w.status === "paused" || w.status === "running")
    );
  }

  async delete(worktaskId: string): Promise<void> {
    this.worktasks.delete(worktaskId);
    this.checkpoints.delete(worktaskId);
  }

  async query(filter: WorktaskFilter): Promise<Worktask[]> {
    return Array.from(this.worktasks.values()).filter((w) =>
      this.matchesFilter(w, filter)
    );
  }

  async count(filter: WorktaskFilter): Promise<number> {
    return (await this.query(filter)).length;
  }

  async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
    const worktaskId = checkpoint.worktaskId;
    if (!this.checkpoints.has(worktaskId)) {
      this.checkpoints.set(worktaskId, []);
    }
    this.checkpoints.get(worktaskId)!.push({
      ...checkpoint,
      id: checkpoint.id || generateId(),
      createdAt: checkpoint.createdAt || new Date(),
    });
  }

  async getLatestCheckpoint(worktaskId: string, executorId?: string): Promise<TaskCheckpoint | null> {
    const checkpoints = this.checkpoints.get(worktaskId) || [];
    const filtered = executorId
      ? checkpoints.filter((c) => c.executorId === executorId)
      : checkpoints;
    return filtered.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0] || null;
  }

  async getCheckpoints(worktaskId: string): Promise<TaskCheckpoint[]> {
    return this.checkpoints.get(worktaskId) || [];
  }

  private matchesFilter(worktask: Worktask, filter: WorktaskFilter): boolean {
    if (filter.agentId && worktask.agentId !== filter.agentId) return false;
    if (filter.contactId && worktask.contactId !== filter.contactId) return false;
    if (filter.conversationId && worktask.conversationId !== filter.conversationId)
      return false;
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(worktask.status)) return false;
    }
    if (filter.driverType && worktask.driver?.type !== filter.driverType) return false;
    if (filter.createdAfter && worktask.createdAt < filter.createdAfter) return false;
    if (filter.createdBefore && worktask.createdAt > filter.createdBefore) return false;
    return true;
  }
}

export class DatabaseWorktaskStore implements WorktaskStore {
  private repository: WorktaskRepository;
  private initialized = false;

  constructor(repository?: WorktaskRepository) {
    this.repository = repository || worktaskRepository;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.repository.initialize();
      this.initialized = true;
    }
  }

  async save(worktask: Worktask): Promise<void> {
    await this.ensureInitialized();
    await this.repository.save(worktask);
  }

  async get(worktaskId: string): Promise<Worktask | null> {
    await this.ensureInitialized();
    return this.repository.get(worktaskId);
  }

  async getByAgent(agentId: string): Promise<Worktask[]> {
    await this.ensureInitialized();
    return this.repository.getByAgent(agentId);
  }

  async getByConversation(conversationId: string): Promise<Worktask[]> {
    await this.ensureInitialized();
    return this.repository.query({ conversationId });
  }

  async getByStatus(status: WorktaskStatus | WorktaskStatus[]): Promise<Worktask[]> {
    await this.ensureInitialized();
    return this.repository.getByStatus(status);
  }

  async getByNextTriggerTime(before: Date): Promise<Worktask[]> {
    await this.ensureInitialized();
    return this.repository.getByNextTriggerTime(before);
  }

  async delete(worktaskId: string): Promise<void> {
    await this.ensureInitialized();
    await this.repository.delete(worktaskId);
  }

  async query(filter: WorktaskFilter): Promise<Worktask[]> {
    await this.ensureInitialized();
    return this.repository.query(filter);
  }

  async count(filter: WorktaskFilter): Promise<number> {
    return (await this.query(filter)).length;
  }

  async saveCheckpoint(checkpoint: TaskCheckpoint): Promise<void> {
    await this.ensureInitialized();
    await this.repository.saveCheckpoint(checkpoint);
  }

  async getLatestCheckpoint(worktaskId: string, executorId?: string): Promise<TaskCheckpoint | null> {
    await this.ensureInitialized();
    return this.repository.getLatestCheckpoint(worktaskId, executorId);
  }

  async getCheckpoints(worktaskId: string): Promise<TaskCheckpoint[]> {
    await this.ensureInitialized();
    return this.repository.getCheckpoints(worktaskId);
  }
}

export interface EventBus {
  emit(event: WorktaskEvent): void;
  on(handler: (event: WorktaskEvent) => void): void;
  off(handler: (event: WorktaskEvent) => void): void;
}

export interface WorktaskEvent {
  type: WorktaskEventType;
  worktaskId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export type WorktaskEventType =
  | "worktask:created"
  | "worktask:status_changed"
  | "worktask:progress_updated"
  | "worktask:todo_added"
  | "worktask:todo_updated"
  | "worktask:executor_added"
  | "worktask:executor_updated"
  | "worktask:loop_updated"
  | "worktask:checkpoint_saved"
  | "worktask:completed"
  | "worktask:failed"
  | "worktask:cancelled"
  | "worktask:paused"
  | "worktask:resumed";

export class SimpleEventBus implements EventBus {
  private handlers: Array<(event: WorktaskEvent) => void> = [];

  emit(event: WorktaskEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("[EventBus] Handler error:", error);
      }
    }
  }

  on(handler: (event: WorktaskEvent) => void): void {
    this.handlers.push(handler);
  }

  off(handler: (event: WorktaskEvent) => void): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }
}

export type WorktaskManagerMode = "memory" | "database";

export interface WorktaskManagerOptions {
  mode?: WorktaskManagerMode;
  store?: WorktaskStore;
  eventBus?: EventBus;
}

export class WorktaskManager {
  private store: WorktaskStore;
  private eventBus: EventBus;
  private mode: WorktaskManagerMode;

  constructor(options?: WorktaskManagerOptions) {
    this.mode = options?.mode || "memory";
    
    if (options?.store) {
      this.store = options.store;
    } else if (this.mode === "database") {
      this.store = new DatabaseWorktaskStore();
    } else {
      this.store = new InMemoryWorktaskStore();
    }
    
    this.eventBus = options?.eventBus || new SimpleEventBus();
  }

  async create(params: CreateWorktaskParams): Promise<Worktask> {
    const now = new Date();
    const worktask: Worktask = {
      id: generateId(),
      agentId: params.agentId,
      contactId: params.contactId,
      conversationId: params.conversationId,
      task: params.task,
      description: params.description,
      status: "created",
      plan: {
        steps: [],
        strategy: "serial",
        dependencies: { nodes: [], edges: [] },
      },
      todos: [],
      executors: [],
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        timeline: [],
      },
      context: params.context || {},
      createdAt: now,
      updatedAt: now,
      metadata: {
        errorCount: 0,
        retryCount: 0,
      },
      loopState: {
        loopCount: 0,
        ...params.loopState,
      },
      driver: params.driver,
    };

    await this.store.save(worktask);
    this.emitEvent("worktask:created", worktask.id, { worktask });

    return worktask;
  }

  async get(worktaskId: string): Promise<Worktask | null> {
    return this.store.get(worktaskId);
  }

  async getByAgent(agentId: string): Promise<Worktask[]> {
    return this.store.getByAgent(agentId);
  }

  async getByConversation(conversationId: string): Promise<Worktask[]> {
    return this.store.getByConversation(conversationId);
  }

  async getByStatus(status: WorktaskStatus | WorktaskStatus[]): Promise<Worktask[]> {
    return this.store.getByStatus(status);
  }

  async getByNextTriggerTime(before: Date): Promise<Worktask[]> {
    return this.store.getByNextTriggerTime(before);
  }

  async updateStatus(worktaskId: string, status: WorktaskStatus): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const oldStatus = worktask.status;
    worktask.status = status;
    worktask.updatedAt = new Date();

    if (status === "running" && !worktask.startedAt) {
      worktask.startedAt = new Date();
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      worktask.completedAt = new Date();
      worktask.metadata.totalDuration =
        worktask.completedAt.getTime() -
        (worktask.startedAt?.getTime() || worktask.createdAt.getTime());
    }

    await this.store.save(worktask);

    if (status === "paused" && oldStatus !== "paused") {
      this.emitEvent("worktask:paused", worktaskId, { previousStatus: oldStatus });
    } else if (status === "running" && oldStatus === "paused") {
      this.emitEvent("worktask:resumed", worktaskId, { previousStatus: oldStatus });
    } else {
      this.emitEvent("worktask:status_changed", worktaskId, { status, previousStatus: oldStatus });
    }
  }

  async updateProgress(
    worktaskId: string,
    progress: Partial<WorktaskProgress>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.progress = { ...worktask.progress, ...progress };
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:progress_updated", worktaskId, { progress });
  }

  async addProgressEvent(
    worktaskId: string,
    type: ProgressEventType,
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const event: ProgressEvent = {
      timestamp: new Date(),
      type,
      message,
      details,
    };

    worktask.progress.timeline.push(event);
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
  }

  async setPlan(worktaskId: string, plan: PlanStep[]): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.plan.steps = plan;
    
    worktask.todos = plan.map((step, index) => ({
      id: step.id,
      worktaskId,
      content: step.description,
      description: step.description,
      status: step.status === "running" ? "in_progress" as const : step.status,
      order: index,
      result: undefined,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    worktask.progress.total = plan.length;
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
  }

  async addTodo(
    worktaskId: string,
    todo: Omit<WorktaskTodo, "id" | "worktaskId" | "createdAt" | "updatedAt">
  ): Promise<WorktaskTodo> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const now = new Date();
    const newTodo: WorktaskTodo = {
      id: generateId(),
      worktaskId,
      ...todo,
      createdAt: now,
      updatedAt: now,
    };

    worktask.todos.push(newTodo);
    worktask.progress.total = worktask.todos.length;
    worktask.updatedAt = now;

    await this.store.save(worktask);
    this.emitEvent("worktask:todo_added", worktaskId, { todo: newTodo });

    return newTodo;
  }

  async updateTodo(
    worktaskId: string,
    todoId: string,
    updates: Partial<WorktaskTodo>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const todo = worktask.todos.find((t) => t.id === todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found in worktask ${worktaskId}`);
    }

    Object.assign(todo, updates, { updatedAt: new Date() });

    worktask.progress.completed = worktask.todos.filter(
      (t) => t.status === "completed"
    ).length;
    worktask.progress.failed = worktask.todos.filter(
      (t) => t.status === "failed"
    ).length;
    worktask.progress.percentage = Math.round(
      (worktask.progress.completed / worktask.progress.total) * 100
    );
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:todo_updated", worktaskId, { todoId, updates });
  }

  async addExecutor(
    worktaskId: string,
    executor: Omit<ExecutorRecord, "id">
  ): Promise<ExecutorRecord> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const newExecutor: ExecutorRecord = {
      id: generateId(),
      ...executor,
    };

    worktask.executors.push(newExecutor);
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:executor_added", worktaskId, { executor: newExecutor });

    return newExecutor;
  }

  async updateExecutor(
    worktaskId: string,
    executorId: string,
    updates: Partial<ExecutorRecord>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const executor = worktask.executors.find((e) => e.id === executorId);
    if (!executor) {
      throw new Error(`Executor ${executorId} not found in worktask ${worktaskId}`);
    }

    Object.assign(executor, updates);
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:executor_updated", worktaskId, { executorId, updates });
  }

  async updateLoopState(
    worktaskId: string,
    loopState: Partial<LoopState>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const existingState = worktask.loopState || { loopCount: 0 };
    worktask.loopState = {
      ...existingState,
      ...loopState,
    } as LoopState;
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:loop_updated", worktaskId, { loopState: worktask.loopState });
  }

  async incrementLoopCount(worktaskId: string): Promise<number> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.loopState = worktask.loopState || { loopCount: 0 };
    worktask.loopState.loopCount++;
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:loop_updated", worktaskId, { loopState: worktask.loopState });

    return worktask.loopState.loopCount;
  }

  async updateDriver(
    worktaskId: string,
    driver: Partial<DriverConfig>
  ): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    if (worktask.driver) {
      worktask.driver = {
        ...worktask.driver,
        ...driver,
      };
    } else {
      worktask.driver = driver as DriverConfig;
    }
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
  }

  async saveCheckpoint(checkpoint: Omit<TaskCheckpoint, "id" | "createdAt">): Promise<TaskCheckpoint> {
    const fullCheckpoint: TaskCheckpoint = {
      ...checkpoint,
      id: generateId(),
      createdAt: new Date(),
    };

    await this.store.saveCheckpoint(fullCheckpoint);
    this.emitEvent("worktask:checkpoint_saved", checkpoint.worktaskId, { checkpoint: fullCheckpoint });

    return fullCheckpoint;
  }

  async getLatestCheckpoint(worktaskId: string, executorId?: string): Promise<TaskCheckpoint | null> {
    return this.store.getLatestCheckpoint(worktaskId, executorId);
  }

  async getCheckpoints(worktaskId: string): Promise<TaskCheckpoint[]> {
    return this.store.getCheckpoints(worktaskId);
  }

  async complete(worktaskId: string, result: WorktaskResult): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.status = "completed";
    worktask.result = result;
    worktask.completedAt = new Date();
    worktask.updatedAt = new Date();
    worktask.metadata.totalDuration =
      worktask.completedAt.getTime() -
      (worktask.startedAt?.getTime() || worktask.createdAt.getTime());

    await this.store.save(worktask);
    this.emitEvent("worktask:completed", worktaskId, { result });
  }

  async fail(worktaskId: string, error: Error): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.status = "failed";
    worktask.completedAt = new Date();
    worktask.updatedAt = new Date();
    worktask.metadata.errorCount++;

    await this.store.save(worktask);
    this.emitEvent("worktask:failed", worktaskId, {
      error: { message: error.message, stack: error.stack },
    });
  }

  async pause(worktaskId: string, reason?: string): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.status = "paused";
    const existingState = worktask.loopState || { loopCount: 0 };
    worktask.loopState = {
      ...existingState,
      pauseReason: reason,
    } as LoopState;
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:paused", worktaskId, { reason });
  }

  async resume(worktaskId: string): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    if (worktask.status !== "paused") {
      throw new Error(`Worktask ${worktaskId} is not paused (current status: ${worktask.status})`);
    }

    worktask.status = "running";
    const existingState = worktask.loopState || { loopCount: 0 };
    worktask.loopState = {
      ...existingState,
      pauseReason: undefined,
    } as LoopState;
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:resumed", worktaskId, {});
  }

  async cancel(worktaskId: string): Promise<void> {
    const worktask = await this.store.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    worktask.status = "cancelled";
    worktask.completedAt = new Date();
    worktask.updatedAt = new Date();

    await this.store.save(worktask);
    this.emitEvent("worktask:cancelled", worktaskId, {});
  }

  async getProgress(worktaskId: string): Promise<WorktaskProgress | null> {
    const worktask = await this.store.get(worktaskId);
    return worktask?.progress || null;
  }

  async getTodoList(worktaskId: string): Promise<WorktaskTodo[]> {
    const worktask = await this.store.get(worktaskId);
    return worktask?.todos || [];
  }

  async query(filter: WorktaskFilter): Promise<Worktask[]> {
    return this.store.query(filter);
  }

  async delete(worktaskId: string): Promise<void> {
    await this.store.delete(worktaskId);
  }

  onEvent(handler: (event: WorktaskEvent) => void): void {
    this.eventBus.on(handler);
  }

  offEvent(handler: (event: WorktaskEvent) => void): void {
    this.eventBus.off(handler);
  }

  private emitEvent(
    type: WorktaskEventType,
    worktaskId: string,
    payload: Record<string, unknown>
  ): void {
    this.eventBus.emit({
      type,
      worktaskId,
      timestamp: new Date(),
      payload,
    });
  }
}

export { generateId };
