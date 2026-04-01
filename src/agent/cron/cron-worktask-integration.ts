/**
 * Cron 与 Worktask 集成
 *
 * 将 Cron 任务触发与 WorktaskScheduler 连接
 */

import { EventEmitter } from "events";
import { CronScheduler, type JobExecutor } from "./cron-scheduler.js";
import { CronJobRepository } from "./cron-job-repository.js";
import type { WorktaskScheduler, SchedulerConfig } from "../loop/worktask-scheduler.js";
import type { CronJob, CreateCronJobParams, CronJobFilter } from "./types.js";
import type { Worktask, DriverConfig } from "../worktask/types.js";
import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";

export interface CronWorktaskIntegrationConfig {
  agentId: string;
  modelConfig: SchedulerConfig["modelConfig"];
  userHome?: string;
  checkIntervalMs?: number;
}

export interface CreateCronWorktaskParams {
  name: string;
  description?: string;
  agentId: string;
  contactId: string;
  conversationId?: string;
  task: string;
  schedule: {
    type: "at" | "every" | "cron";
    at?: Date | string;
    interval?: number;
    expression?: string;
    timezone?: string;
  };
  payload?: {
    type: "systemEvent" | "agentTurn" | "skill" | "workflow";
    content: Record<string, unknown>;
  };
  delivery?: {
    mode: "none" | "announce";
    channel?: string;
    target?: string;
  };
  context?: Record<string, unknown>;
}

export class CronWorktaskIntegration extends EventEmitter {
  private cronScheduler: CronScheduler;
  private cronRepository: CronJobRepository;
  private worktaskScheduler: WorktaskScheduler | null = null;
  private config: CronWorktaskIntegrationConfig;
  private llmService: LLMServiceInterface;

  constructor(
    config: CronWorktaskIntegrationConfig,
    llmService: LLMServiceInterface
  ) {
    super();
    this.config = config;
    this.llmService = llmService;
    this.cronRepository = new CronJobRepository();
    this.cronScheduler = new CronScheduler(this.cronRepository, {
      checkIntervalMs: config.checkIntervalMs,
    });

    this.setupJobExecutor();
  }

  private setupJobExecutor(): void {
    const executor: JobExecutor = async (job: CronJob) => {
      return this.executeCronJob(job);
    };

    this.cronScheduler.setJobExecutor(executor);
  }

  setWorktaskScheduler(scheduler: WorktaskScheduler): void {
    this.worktaskScheduler = scheduler;
  }

  async start(): Promise<void> {
    await this.cronRepository.initialize();
    await this.cronScheduler.start();
    console.log("[CronWorktaskIntegration] Started");
  }

  async stop(): Promise<void> {
    await this.cronScheduler.stop();
    console.log("[CronWorktaskIntegration] Stopped");
  }

  async createCronWorktask(params: CreateCronWorktaskParams): Promise<{
    cronJob: CronJob;
    worktask: Worktask;
  }> {
    const cronParams: CreateCronJobParams = {
      name: params.name,
      description: params.description,
      agentId: params.agentId,
      schedule: params.schedule,
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: params.payload || {
        type: "agentTurn",
        content: { message: params.task },
      },
      delivery: params.delivery,
    };

    const cronJob = await this.cronRepository.create(cronParams);

    const driver: DriverConfig = {
      type: "cron",
      config: {
        cronExpression: params.schedule.expression,
        cronJobId: cronJob.id,
      },
      nextTriggerTime: cronJob.state.nextRunAt,
    };

    const { WorktaskManager } = await import("../worktask/worktask-manager.js");
    const worktaskManager = new WorktaskManager({ mode: "database" });

    const worktask = await worktaskManager.create({
      agentId: params.agentId,
      contactId: params.contactId,
      conversationId: params.conversationId || "",
      task: params.task,
      context: {
        ...params.context,
        cronJobId: cronJob.id,
      },
      driver,
    });

    this.emit("integration:created", { cronJob, worktask });

    return { cronJob, worktask };
  }

  private async executeCronJob(job: CronJob): Promise<{
    worktaskId?: string;
    status: "ok" | "error" | "skipped";
    output?: string;
    error?: string;
  }> {
    console.log(`[CronWorktaskIntegration] Executing cron job: ${job.id}`);

    if (!this.worktaskScheduler) {
      const error = "WorktaskScheduler not configured";
      console.error(`[CronWorktaskIntegration] ${error}`);
      return { status: "error", error };
    }

    try {
      const existingWorktask = await this.findWorktaskForCronJob(job.id);

      let worktask: Worktask;

      if (existingWorktask && existingWorktask.status !== "completed" && existingWorktask.status !== "cancelled") {
        worktask = existingWorktask;
        console.log(`[CronWorktaskIntegration] Resuming existing worktask: ${worktask.id}`);
      } else {
        const triggerRequest = this.buildTriggerRequest(job);
        worktask = await this.worktaskScheduler.triggerTask(triggerRequest);
        console.log(`[CronWorktaskIntegration] Created new worktask: ${worktask.id}`);
      }

      const result = await this.worktaskScheduler.executeLoop(worktask.id);

      return {
        worktaskId: worktask.id,
        status: result?.success ? "ok" : "error",
        output: result?.output,
        error: result?.error?.message,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CronWorktaskIntegration] Execution failed:`, errorMessage);
      return {
        status: "error",
        error: errorMessage,
      };
    }
  }

  private async findWorktaskForCronJob(cronJobId: string): Promise<Worktask | null> {
    const { WorktaskManager } = await import("../worktask/worktask-manager.js");
    const worktaskManager = new WorktaskManager({ mode: "database" });

    const worktasks = await worktaskManager.query({
      driverType: "cron",
    });

    const matchingWorktask = worktasks.find(
      (w) => w.driver?.config?.cronJobId === cronJobId
    );
    
    return matchingWorktask || null;
  }

  private buildTriggerRequest(job: CronJob): {
    agentId: string;
    contactId: string;
    conversationId?: string;
    task: string;
    driver: DriverConfig;
    context?: Record<string, unknown>;
  } {
    let task = "";
    const context: Record<string, unknown> = {
      cronJobId: job.id,
      cronJobName: job.name,
    };

    switch (job.payload.type) {
      case "systemEvent":
        task = (job.payload.content.text as string) || "System event triggered";
        break;

      case "agentTurn":
        task = (job.payload.content.message as string) || job.description || job.name;
        Object.assign(context, job.payload.content);
        break;

      case "skill":
        task = `Execute skill: ${job.payload.content.skillId || "unknown"}`;
        Object.assign(context, job.payload.content);
        break;

      case "workflow":
        task = `Execute workflow: ${job.payload.content.workflowId || "unknown"}`;
        Object.assign(context, job.payload.content);
        break;
    }

    const driver: DriverConfig = {
      type: "cron",
      config: {
        cronExpression: job.schedule.expression,
        cronJobId: job.id,
      },
      nextTriggerTime: job.state.nextRunAt,
    };

    return {
      agentId: job.agentId || this.config.agentId,
      contactId: `cron:${job.id}`,
      conversationId: `cron-session:${job.id}`,
      task,
      driver,
      context,
    };
  }

  async getCronJobs(filter?: CronJobFilter): Promise<CronJob[]> {
    return this.cronRepository.query(filter || {});
  }

  async getCronJob(jobId: string): Promise<CronJob | null> {
    return this.cronRepository.get(jobId);
  }

  async enableCronJob(jobId: string): Promise<void> {
    await this.cronRepository.enable(jobId);
    this.emit("integration:job_enabled", { jobId });
  }

  async disableCronJob(jobId: string): Promise<void> {
    await this.cronRepository.disable(jobId);
    this.emit("integration:job_disabled", { jobId });
  }

  async deleteCronJob(jobId: string): Promise<void> {
    await this.cronRepository.delete(jobId);
    this.emit("integration:job_deleted", { jobId });
  }

  async getJobHistory(jobId: string, limit?: number) {
    return this.cronRepository.getHistory(jobId, limit);
  }

  getSchedulerStats(): ReturnType<CronScheduler["getStats"]> {
    return this.cronScheduler.getStats();
  }
}

export async function createCronWorktaskIntegration(
  config: CronWorktaskIntegrationConfig,
  llmService: LLMServiceInterface,
  worktaskScheduler?: WorktaskScheduler
): Promise<CronWorktaskIntegration> {
  const integration = new CronWorktaskIntegration(config, llmService);

  if (worktaskScheduler) {
    integration.setWorktaskScheduler(worktaskScheduler);
  }

  return integration;
}
