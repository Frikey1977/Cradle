/**
 * Cron 任务调度器
 *
 * 负责定时扫描和触发 Cron 任务
 */

import { EventEmitter } from "events";
import { CronJobRepository } from "./cron-job-repository.js";
import type {
  CronJob,
  CronJobExecutionResult,
  ExecutionStatus,
} from "./types.js";
import { calculateNextRun } from "./types.js";

export interface CronSchedulerConfig {
  checkIntervalMs?: number;
  maxConcurrentJobs?: number;
  maxRetries?: number;
}

export interface CronSchedulerEvents {
  "scheduler:started": { timestamp: Date };
  "scheduler:stopped": { timestamp: Date };
  "scheduler:job_triggered": { jobId: string; job: CronJob };
  "scheduler:job_started": { jobId: string; worktaskId?: string };
  "scheduler:job_completed": { jobId: string; result: CronJobExecutionResult };
  "scheduler:job_failed": { jobId: string; error: string };
  "scheduler:job_skipped": { jobId: string; reason: string };
}

export type JobExecutor = (
  job: CronJob
) => Promise<{ worktaskId?: string; status: ExecutionStatus; output?: string; error?: string }>;

export class CronScheduler extends EventEmitter {
  private repository: CronJobRepository;
  private config: Required<CronSchedulerConfig>;
  private jobExecutor: JobExecutor | null = null;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;
  private runningJobs: Set<string> = new Set();

  constructor(
    repository: CronJobRepository,
    config: CronSchedulerConfig = {}
  ) {
    super();
    this.repository = repository;
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 60000,
      maxConcurrentJobs: config.maxConcurrentJobs ?? 10,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  setJobExecutor(executor: JobExecutor): void {
    this.jobExecutor = executor;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[CronScheduler] Already running");
      return;
    }

    await this.repository.initialize();
    this.isRunning = true;

    console.log("[CronScheduler] Starting scheduler");
    this.emit("scheduler:started", { timestamp: new Date() });

    await this.checkAndExecuteJobs();

    this.checkInterval = setInterval(() => {
      this.checkAndExecuteJobs().catch((error) => {
        console.error("[CronScheduler] Error in check cycle:", error);
      });
    }, this.config.checkIntervalMs);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log("[CronScheduler] Stopping scheduler");

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    while (this.runningJobs.size > 0) {
      console.log(`[CronScheduler] Waiting for ${this.runningJobs.size} jobs to complete...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.emit("scheduler:stopped", { timestamp: new Date() });
  }

  private async checkAndExecuteJobs(): Promise<void> {
    if (!this.isRunning || !this.jobExecutor) {
      return;
    }

    const now = new Date();
    const dueJobs = await this.repository.getDueJobs(now);

    console.log(`[CronScheduler] Found ${dueJobs.length} due jobs`);

    for (const job of dueJobs) {
      if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
        console.log("[CronScheduler] Max concurrent jobs reached, skipping remaining");
        break;
      }

      if (this.runningJobs.has(job.id)) {
        console.log(`[CronScheduler] Job ${job.id} already running, skipping`);
        continue;
      }

      this.executeJob(job).catch((error) => {
        console.error(`[CronScheduler] Failed to execute job ${job.id}:`, error);
      });
    }
  }

  private async executeJob(job: CronJob): Promise<CronJobExecutionResult> {
    const startTime = Date.now();
    this.runningJobs.add(job.id);

    console.log(`[CronScheduler] Executing job: ${job.id} (${job.name})`);
    this.emit("scheduler:job_triggered", { jobId: job.id, job });

    let result: CronJobExecutionResult;

    try {
      if (!this.jobExecutor) {
        throw new Error("No job executor configured");
      }

      const execution = await this.jobExecutor(job);

      const durationMs = Date.now() - startTime;
      result = {
        jobId: job.id,
        worktaskId: execution.worktaskId,
        status: execution.status,
        error: execution.error,
        durationMs,
        executedAt: new Date(),
        output: execution.output,
      };

      await this.repository.updateState(job.id, {
        lastRunAt: result.executedAt,
        lastStatus: result.status,
        lastError: result.error,
        lastDurationMs: result.durationMs,
        runCount: job.state.runCount + 1,
        failCount: result.status === "error" ? job.state.failCount + 1 : 0,
        nextRunAt: this.calculateNextRunTime(job),
      });

      await this.repository.addHistory({
        jobId: job.id,
        worktaskId: result.worktaskId,
        status: result.status,
        error: result.error,
        durationMs: result.durationMs,
        executedAt: result.executedAt,
        output: result.output,
      });

      if (job.deleteAfterRun && job.schedule.type === "at") {
        await this.repository.delete(job.id);
        console.log(`[CronScheduler] Deleted one-time job: ${job.id}`);
      }

      if (result.status === "ok") {
        this.emit("scheduler:job_completed", { jobId: job.id, result });
      } else {
        this.emit("scheduler:job_failed", { jobId: job.id, error: result.error || "Unknown error" });
      }

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      result = {
        jobId: job.id,
        status: "error",
        error: errorMessage,
        durationMs,
        executedAt: new Date(),
      };

      await this.repository.updateState(job.id, {
        lastRunAt: result.executedAt,
        lastStatus: "error",
        lastError: errorMessage,
        lastDurationMs: result.durationMs,
        runCount: job.state.runCount + 1,
        failCount: job.state.failCount + 1,
        nextRunAt: this.calculateNextRunTime(job),
      });

      await this.repository.addHistory({
        jobId: job.id,
        status: "error",
        error: errorMessage,
        durationMs: result.durationMs,
        executedAt: result.executedAt,
      });

      this.emit("scheduler:job_failed", { jobId: job.id, error: errorMessage });
    } finally {
      this.runningJobs.delete(job.id);
    }

    return result;
  }

  private calculateNextRunTime(job: CronJob): Date | undefined {
    if (job.schedule.type === "at") {
      return undefined;
    }

    const nextRun = calculateNextRun(job.schedule);
    return nextRun || undefined;
  }

  async triggerJobNow(jobId: string): Promise<CronJobExecutionResult> {
    const job = await this.repository.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (this.runningJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    return this.executeJob(job);
  }

  async getRunningJobs(): Promise<string[]> {
    return Array.from(this.runningJobs);
  }

  isJobRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  getStats(): {
    isRunning: boolean;
    checkIntervalMs: number;
    maxConcurrentJobs: number;
    runningCount: number;
  } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.config.checkIntervalMs,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      runningCount: this.runningJobs.size,
    };
  }
}

export function createCronScheduler(
  repository?: CronJobRepository,
  config?: CronSchedulerConfig
): CronScheduler {
  return new CronScheduler(repository || new CronJobRepository(), config);
}
