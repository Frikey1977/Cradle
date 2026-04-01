/**
 * 任务调度器
 *
 * 负责管理长程循环任务的生命周期：
 * - 接收多种驱动源的触发请求
 * - 加载/恢复 Worktask 和执行上下文
 * - 根据 driver_type 选择执行策略
 * - 管理任务生命周期
 */

import { EventEmitter } from "events";
import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type {
  Worktask,
  WorktaskStatus,
  DriverConfig,
  LoopDecision,
  ExecutorResult,
} from "../worktask/types.js";
import {
  WorktaskManager,
  type WorktaskManagerMode,
} from "../worktask/worktask-manager.js";
import { CheckpointManager } from "../worktask/checkpoint-manager.js";
import { LoopDecisionMaker, type DecisionContext } from "./loop-decision-maker.js";
import { LoopPromptBuilder } from "./loop-prompt-builder.js";
import type { Orchestrator, OrchestratorContext } from "../orchestrator/orchestrator.js";

export interface SchedulerConfig {
  agentId: string;
  modelConfig: {
    provider?: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    instanceId?: string;
  };
  storageMode?: WorktaskManagerMode;
  userHome?: string;
}

export interface TriggerRequest {
  worktaskId?: string;
  agentId: string;
  contactId: string;
  conversationId?: string;
  task: string;
  driver?: DriverConfig;
  context?: Record<string, unknown>;
}

export interface SchedulerEvent {
  type: SchedulerEventType;
  worktaskId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export type SchedulerEventType =
  | "scheduler:task_triggered"
  | "scheduler:task_started"
  | "scheduler:task_paused"
  | "scheduler:task_resumed"
  | "scheduler:task_completed"
  | "scheduler:task_failed"
  | "scheduler:decision_made"
  | "scheduler:loop_started"
  | "scheduler:loop_completed";

export interface ActiveTask {
  worktask: Worktask;
  orchestrator?: Orchestrator;
  startTime: Date;
  lastActivity: Date;
}

export class WorktaskScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private worktaskManager: WorktaskManager;
  private checkpointManager: CheckpointManager;
  private decisionMaker: LoopDecisionMaker;
  private promptBuilder: LoopPromptBuilder;
  private llmService: LLMServiceInterface;

  private activeTasks: Map<string, ActiveTask> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    config: SchedulerConfig,
    llmService: LLMServiceInterface,
    worktaskManager?: WorktaskManager
  ) {
    super();
    this.config = config;
    this.llmService = llmService;
    this.worktaskManager = worktaskManager || new WorktaskManager({
      mode: config.storageMode || "memory",
    });
    this.checkpointManager = new CheckpointManager(
      this.worktaskManager,
      config.userHome
    );
    this.promptBuilder = new LoopPromptBuilder();
    this.decisionMaker = new LoopDecisionMaker(llmService, this.promptBuilder);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`[WorktaskScheduler] Starting scheduler for agent: ${this.config.agentId}`);

    await this.worktaskManager.getByStatus(["paused", "running"]);

    this.pollingInterval = setInterval(() => {
      this.checkScheduledTasks().catch((error) => {
        console.error("[WorktaskScheduler] Error checking scheduled tasks:", error);
      });
    }, 60000);

    this.emit("scheduler:started", { agentId: this.config.agentId });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log(`[WorktaskScheduler] Stopping scheduler for agent: ${this.config.agentId}`);

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    for (const [worktaskId, activeTask] of this.activeTasks) {
      if (activeTask.worktask.status === "running") {
        await this.worktaskManager.pause(worktaskId, "调度器停止");
      }
    }

    this.activeTasks.clear();
    this.emit("scheduler:stopped", { agentId: this.config.agentId });
  }

  async triggerTask(request: TriggerRequest): Promise<Worktask> {
    console.log(`[WorktaskScheduler] Task triggered: ${request.task.substring(0, 50)}...`);

    if (request.worktaskId) {
      const existing = await this.worktaskManager.get(request.worktaskId);
      if (existing) {
        return this.resumeTask(existing);
      }
    }

    const worktask = await this.worktaskManager.create({
      agentId: request.agentId,
      contactId: request.contactId,
      conversationId: request.conversationId || "",
      task: request.task,
      context: request.context,
      driver: request.driver,
    });

    this.emitEvent("scheduler:task_triggered", worktask.id, {
      driver: request.driver?.type || "user",
    });

    return worktask;
  }

  async resumeTask(worktask: Worktask): Promise<Worktask> {
    console.log(`[WorktaskScheduler] Resuming task: ${worktask.id}`);

    if (worktask.status === "paused") {
      await this.worktaskManager.resume(worktask.id);
    }

    this.emitEvent("scheduler:task_resumed", worktask.id, {
      loopCount: worktask.loopState?.loopCount || 0,
    });

    return worktask;
  }

  async executeLoop(worktaskId: string): Promise<ExecutorResult | null> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    if (worktask.status !== "running" && worktask.status !== "created") {
      console.log(`[WorktaskScheduler] Task ${worktaskId} is not in executable state: ${worktask.status}`);
      return null;
    }

    this.emitEvent("scheduler:loop_started", worktaskId, {
      loopCount: (worktask.loopState?.loopCount || 0) + 1,
    });

    await this.worktaskManager.updateStatus(worktaskId, "running");
    await this.worktaskManager.incrementLoopCount(worktaskId);

    const orchestratorContext = await this.checkpointManager.loadOrchestratorContext(worktaskId);
    const loopState = await this.checkpointManager.loadLoopState(worktaskId);

    let result: ExecutorResult | null = null;

    try {
      const { OrchestratorFactory } = await import("../orchestrator/index.js");
      
      const factory = new OrchestratorFactory(this.llmService, this.worktaskManager);
      
      const orchestrator = await factory.create({
        task: worktask.task,
        tools: [],
        skills: [],
        context: worktask.context as OrchestratorContext,
        config: {
          agentId: worktask.agentId,
          contactId: worktask.contactId,
          conversationId: worktask.conversationId,
          maxIterations: 10,
          timeout: 300,
          modelConfig: this.config.modelConfig,
        },
      });

      const activeTask: ActiveTask = {
        worktask,
        orchestrator,
        startTime: new Date(),
        lastActivity: new Date(),
      };
      this.activeTasks.set(worktaskId, activeTask);

      const worktaskResult = await orchestrator.orchestrate();

      result = {
        success: worktaskResult.success,
        output: worktaskResult.output,
        steps: [],
        usage: worktaskResult.metrics.tokenUsage ? {
          prompt: worktaskResult.metrics.tokenUsage.input,
          completion: worktaskResult.metrics.tokenUsage.output,
          total: worktaskResult.metrics.tokenUsage.total,
        } : undefined,
      };

      await this.checkpointManager.saveOrchestratorContext(
        worktaskId,
        this.checkpointManager.createOrchestratorSnapshot(
          worktask.task,
          {
            steps: worktask.plan.steps.map((s) => ({
              id: s.id,
              description: s.description,
              status: s.status,
            })),
            strategy: worktask.plan.strategy,
          },
          worktask.todos.filter((t) => t.status === "completed").map((t) => t.id),
          worktask.todos.filter((t) => t.status === "pending").map((t) => t.id),
          worktask.todos.find((t) => t.status === "in_progress")?.id,
          worktask.loopState?.loopCount || 0,
          { result: worktaskResult }
        )
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[WorktaskScheduler] Loop execution failed: ${errorMessage}`);

      result = {
        success: false,
        output: "",
        steps: [],
        error: error instanceof Error ? error : new Error(errorMessage),
      };

      await this.worktaskManager.updateStatus(worktaskId, "failed");
      this.emitEvent("scheduler:task_failed", worktaskId, { error: errorMessage });

      return result;
    }

    const decision = await this.makeLoopDecision(worktaskId, result);

    this.emitEvent("scheduler:decision_made", worktaskId, {
      action: decision.action,
      reason: decision.reason,
    });

    await this.handleDecision(worktaskId, decision);

    this.emitEvent("scheduler:loop_completed", worktaskId, {
      loopCount: worktask.loopState?.loopCount || 1,
      decision: decision.action,
    });

    return result;
  }

  private async makeLoopDecision(
    worktaskId: string,
    lastResult: ExecutorResult
  ): Promise<LoopDecision> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const context: DecisionContext = {
      worktask,
      lastExecutorResult: lastResult,
      lastObservation: lastResult.output,
      accumulatedData: await this.loadAccumulatedData(worktaskId),
    };

    return this.decisionMaker.makeDecision(context, this.config.modelConfig);
  }

  private async handleDecision(worktaskId: string, decision: LoopDecision): Promise<void> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) return;

    switch (decision.action) {
      case "continue":
        await this.worktaskManager.updateLoopState(worktaskId, {
          lastDecision: "continue",
          lastDecisionReason: decision.reason,
          lastObservation: decision.nextTask,
        });

        if (decision.nextTriggerTime) {
          await this.worktaskManager.updateDriver(worktaskId, {
            nextTriggerTime: decision.nextTriggerTime,
          });
          await this.worktaskManager.pause(worktaskId, "等待下次触发");
        }
        break;

      case "pause":
        await this.worktaskManager.pause(worktaskId, decision.pauseReason || decision.reason);
        await this.worktaskManager.updateLoopState(worktaskId, {
          lastDecision: "pause",
          lastDecisionReason: decision.reason,
          pauseReason: decision.pauseReason,
          userConfirmRequired: decision.userConfirmRequired,
          userConfirmData: decision.userConfirmData,
          waitingForUserInput: decision.userConfirmRequired,
        });
        this.emitEvent("scheduler:task_paused", worktaskId, {
          reason: decision.pauseReason || decision.reason,
        });
        break;

      case "exit":
        const result: import("../worktask/types.js").WorktaskResult = {
          success: true,
          output: decision.reason,
          steps: [],
          executors: worktask.executors,
          metrics: {
            totalDuration: worktask.metadata.totalDuration || 0,
            totalSteps: worktask.plan.steps.length,
            totalExecutors: worktask.executors.length,
            successRate: worktask.executors.filter((e) => e.status === "completed").length / Math.max(worktask.executors.length, 1),
            tokenUsage: worktask.metadata.tokenUsage || { input: 0, output: 0, total: 0 },
          },
        };
        await this.worktaskManager.complete(worktaskId, result);
        this.activeTasks.delete(worktaskId);
        this.emitEvent("scheduler:task_completed", worktaskId, { result });
        break;
    }
  }

  private async loadAccumulatedData(worktaskId: string): Promise<Record<string, unknown>> {
    const dataKeys = await this.checkpointManager.listIntermediateData(worktaskId);
    const data: Record<string, unknown> = {};

    for (const key of dataKeys) {
      const value = await this.checkpointManager.loadIntermediateData(worktaskId, key);
      if (value !== null) {
        data[key] = value;
      }
    }

    return data;
  }

  private async checkScheduledTasks(): Promise<void> {
    if (!this.isRunning) return;

    const now = new Date();
    const tasksToTrigger = await this.worktaskManager.getByNextTriggerTime(now);

    for (const worktask of tasksToTrigger) {
      if (this.activeTasks.has(worktask.id)) {
        continue;
      }

      console.log(`[WorktaskScheduler] Triggering scheduled task: ${worktask.id}`);

      try {
        await this.executeLoop(worktask.id);
      } catch (error) {
        console.error(`[WorktaskScheduler] Failed to trigger task ${worktask.id}:`, error);
      }
    }
  }

  async getActiveTasks(): Promise<Worktask[]> {
    return Array.from(this.activeTasks.values()).map((t) => t.worktask);
  }

  async getTaskStatus(worktaskId: string): Promise<{
    status: WorktaskStatus;
    loopCount: number;
    lastActivity?: Date;
  } | null> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) return null;

    const activeTask = this.activeTasks.get(worktaskId);

    return {
      status: worktask.status,
      loopCount: worktask.loopState?.loopCount || 0,
      lastActivity: activeTask?.lastActivity,
    };
  }

  async cancelTask(worktaskId: string): Promise<void> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    await this.worktaskManager.cancel(worktaskId);
    this.activeTasks.delete(worktaskId);

    this.emitEvent("scheduler:task_completed", worktaskId, { reason: "cancelled" });
  }

  async confirmUserInput(
    worktaskId: string,
    confirmed: boolean,
    data?: Record<string, unknown>
  ): Promise<void> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    if (!worktask.loopState?.userConfirmRequired) {
      throw new Error(`Worktask ${worktaskId} is not waiting for user confirmation`);
    }

    if (confirmed) {
      await this.worktaskManager.updateLoopState(worktaskId, {
        userConfirmRequired: false,
        waitingForUserInput: false,
        userConfirmData: data,
      });
      await this.worktaskManager.resume(worktaskId);
    } else {
      await this.worktaskManager.cancel(worktaskId);
      this.activeTasks.delete(worktaskId);
    }
  }

  private emitEvent(
    type: SchedulerEventType,
    worktaskId: string,
    payload: Record<string, unknown>
  ): void {
    const event: SchedulerEvent = {
      type,
      worktaskId,
      timestamp: new Date(),
      payload,
    };

    this.emit(type, event);
    console.log(`[WorktaskScheduler] Event: ${type} for task ${worktaskId}`);
  }
}

export function createWorktaskScheduler(
  config: SchedulerConfig,
  llmService: LLMServiceInterface,
  worktaskManager?: WorktaskManager
): WorktaskScheduler {
  return new WorktaskScheduler(config, llmService, worktaskManager);
}
