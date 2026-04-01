/**
 * 检查点管理器
 *
 * 负责 Executor 和 Orchestrator 的上下文保存与恢复
 * 支持任务暂停后从检查点恢复执行
 */

import type { ModelMessage } from "ai";
import type { TaskCheckpoint } from "../worktask/types.js";
import type { WorktaskManager } from "../worktask/worktask-manager.js";
import type { Environment, EnvironmentInfo } from "../context/environment.js";
import path from "path";
import fs from "fs/promises";

export interface ExecutorContextSnapshot {
  messages: ModelMessage[];
  steps: Array<{
    type: "thought" | "tool_call" | "tool_result" | "text";
    content?: string;
    toolCall?: {
      id: string;
      name: string;
      args: unknown;
    };
    toolResult?: {
      callId: string;
      output: string;
    };
  }>;
  iteration: number;
  taskDescription: string;
  skillSlug?: string;
  environment?: {
    userHome: string;
    workspacePath: string;
    currentDirectory: string;
  };
  variables: Record<string, unknown>;
  createdAt: Date;
}

export interface OrchestratorContextSnapshot {
  task: string;
  plan: {
    steps: Array<{
      id: string;
      order: number;
      description: string;
      type: string;
      status: string;
      dependencies: string[];
      config: Record<string, unknown>;
    }>;
    strategy: string;
  };
  completedSteps: string[];
  pendingSteps: string[];
  currentStep?: string;
  iteration: number;
  results: Record<string, unknown>;
  environment?: {
    userHome: string;
    workspacePath: string;
  };
  createdAt: Date;
}

export interface LoopStateSnapshot {
  loopCount: number;
  maxLoops?: number;
  lastDecision?: "continue" | "pause" | "exit";
  lastDecisionReason?: string;
  lastObservation?: string;
  accumulatedData: Record<string, unknown>;
  createdAt: Date;
}

export class CheckpointManager {
  private worktaskManager: WorktaskManager;
  private userHome: string;

  constructor(worktaskManager: WorktaskManager, userHome?: string) {
    this.worktaskManager = worktaskManager;
    this.userHome = userHome || process.env.USERPROFILE || process.env.HOME || "";
  }

  private getWorktaskDir(worktaskId: string): string {
    return path.join(this.userHome, "worktasks", worktaskId);
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  async saveExecutorContext(
    worktaskId: string,
    executorId: string,
    snapshot: ExecutorContextSnapshot
  ): Promise<TaskCheckpoint> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    await this.ensureDir(worktaskDir);

    const checkpointFile = path.join(worktaskDir, `executor_${executorId}_context.json`);
    
    const checkpoint = await this.worktaskManager.saveCheckpoint({
      worktaskId,
      executorId,
      type: "executor_context",
      data: snapshot as unknown as Record<string, unknown>,
      iteration: snapshot.iteration,
    });

    await fs.writeFile(checkpointFile, JSON.stringify(snapshot, null, 2), "utf-8");

    console.log(`[CheckpointManager] Saved executor context: ${executorId} for worktask: ${worktaskId}`);
    
    return checkpoint;
  }

  async loadExecutorContext(
    worktaskId: string,
    executorId: string
  ): Promise<ExecutorContextSnapshot | null> {
    const checkpoint = await this.worktaskManager.getLatestCheckpoint(worktaskId, executorId);
    
    if (!checkpoint || checkpoint.type !== "executor_context") {
      return null;
    }

    const worktaskDir = this.getWorktaskDir(worktaskId);
    const checkpointFile = path.join(worktaskDir, `executor_${executorId}_context.json`);

    try {
      const content = await fs.readFile(checkpointFile, "utf-8");
      return JSON.parse(content) as ExecutorContextSnapshot;
    } catch {
      return checkpoint.data as unknown as ExecutorContextSnapshot;
    }
  }

  async saveOrchestratorContext(
    worktaskId: string,
    snapshot: OrchestratorContextSnapshot
  ): Promise<TaskCheckpoint> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    await this.ensureDir(worktaskDir);

    const checkpointFile = path.join(worktaskDir, "orchestrator_context.json");

    const checkpoint = await this.worktaskManager.saveCheckpoint({
      worktaskId,
      type: "orchestrator_context",
      data: snapshot as unknown as Record<string, unknown>,
      iteration: snapshot.iteration,
    });

    await fs.writeFile(checkpointFile, JSON.stringify(snapshot, null, 2), "utf-8");

    console.log(`[CheckpointManager] Saved orchestrator context for worktask: ${worktaskId}`);

    return checkpoint;
  }

  async loadOrchestratorContext(
    worktaskId: string
  ): Promise<OrchestratorContextSnapshot | null> {
    const checkpoint = await this.worktaskManager.getLatestCheckpoint(worktaskId);

    if (!checkpoint || checkpoint.type !== "orchestrator_context") {
      const worktaskDir = this.getWorktaskDir(worktaskId);
      const checkpointFile = path.join(worktaskDir, "orchestrator_context.json");

      try {
        const content = await fs.readFile(checkpointFile, "utf-8");
        return JSON.parse(content) as OrchestratorContextSnapshot;
      } catch {
        return null;
      }
    }

    return checkpoint.data as unknown as OrchestratorContextSnapshot;
  }

  async saveLoopState(
    worktaskId: string,
    snapshot: LoopStateSnapshot
  ): Promise<TaskCheckpoint> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    await this.ensureDir(worktaskDir);

    const checkpointFile = path.join(worktaskDir, "loop_state.json");

    const checkpoint = await this.worktaskManager.saveCheckpoint({
      worktaskId,
      type: "loop_state",
      data: snapshot as unknown as Record<string, unknown>,
      iteration: snapshot.loopCount,
    });

    await fs.writeFile(checkpointFile, JSON.stringify(snapshot, null, 2), "utf-8");

    console.log(`[CheckpointManager] Saved loop state for worktask: ${worktaskId}, loop: ${snapshot.loopCount}`);

    return checkpoint;
  }

  async loadLoopState(worktaskId: string): Promise<LoopStateSnapshot | null> {
    const checkpoints = await this.worktaskManager.getCheckpoints(worktaskId);
    const loopCheckpoints = checkpoints.filter((c) => c.type === "loop_state");
    
    if (loopCheckpoints.length === 0) {
      const worktaskDir = this.getWorktaskDir(worktaskId);
      const checkpointFile = path.join(worktaskDir, "loop_state.json");

      try {
        const content = await fs.readFile(checkpointFile, "utf-8");
        return JSON.parse(content) as LoopStateSnapshot;
      } catch {
        return null;
      }
    }

    const latest = loopCheckpoints.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    )[0];

    return latest.data as unknown as LoopStateSnapshot;
  }

  async saveIntermediateData(
    worktaskId: string,
    key: string,
    data: unknown
  ): Promise<void> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    const dataDir = path.join(worktaskDir, "data");
    await this.ensureDir(dataDir);

    const dataFile = path.join(dataDir, `${key}.json`);
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf-8");

    console.log(`[CheckpointManager] Saved intermediate data: ${key} for worktask: ${worktaskId}`);
  }

  async loadIntermediateData<T = unknown>(
    worktaskId: string,
    key: string
  ): Promise<T | null> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    const dataFile = path.join(worktaskDir, "data", `${key}.json`);

    try {
      const content = await fs.readFile(dataFile, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async listIntermediateData(worktaskId: string): Promise<string[]> {
    const worktaskDir = this.getWorktaskDir(worktaskId);
    const dataDir = path.join(worktaskDir, "data");

    try {
      const files = await fs.readdir(dataDir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  async clearCheckpoints(worktaskId: string): Promise<void> {
    const worktaskDir = this.getWorktaskDir(worktaskId);

    try {
      await fs.rm(worktaskDir, { recursive: true, force: true });
      console.log(`[CheckpointManager] Cleared all checkpoints for worktask: ${worktaskId}`);
    } catch (error) {
      console.warn(`[CheckpointManager] Failed to clear checkpoints: ${error}`);
    }
  }

  createExecutorSnapshot(
    messages: ModelMessage[],
    steps: ExecutorContextSnapshot["steps"],
    iteration: number,
    taskDescription: string,
    environment?: EnvironmentInfo,
    skillSlug?: string,
    variables?: Record<string, unknown>
  ): ExecutorContextSnapshot {
    return {
      messages,
      steps,
      iteration,
      taskDescription,
      skillSlug,
      environment: environment
        ? {
            userHome: environment.userDocumentsDir,
            workspacePath: environment.workspaceDir,
            currentDirectory: environment.workspaceDir,
          }
        : undefined,
      variables: variables || {},
      createdAt: new Date(),
    };
  }

  createOrchestratorSnapshot(
    task: string,
    plan: { steps: Array<{ id: string; description: string; status: string }>; strategy: string },
    completedSteps: string[],
    pendingSteps: string[],
    currentStep: string | undefined,
    iteration: number,
    results: Record<string, unknown>,
    environment?: EnvironmentInfo
  ): OrchestratorContextSnapshot {
    return {
      task,
      plan: {
        steps: plan.steps.map((s, i) => ({
          id: s.id,
          order: i,
          description: s.description,
          type: "task",
          status: s.status,
          dependencies: [],
          config: {},
        })),
        strategy: plan.strategy,
      },
      completedSteps,
      pendingSteps,
      currentStep,
      iteration,
      results,
      environment: environment
        ? {
            userHome: environment.userDocumentsDir,
            workspacePath: environment.workspaceDir,
          }
        : undefined,
      createdAt: new Date(),
    };
  }

  createLoopStateSnapshot(
    loopCount: number,
    maxLoops?: number,
    lastDecision?: "continue" | "pause" | "exit",
    lastDecisionReason?: string,
    lastObservation?: string,
    accumulatedData?: Record<string, unknown>
  ): LoopStateSnapshot {
    return {
      loopCount,
      maxLoops,
      lastDecision,
      lastDecisionReason,
      lastObservation,
      accumulatedData: accumulatedData || {},
      createdAt: new Date(),
    };
  }
}

export function createCheckpointManager(
  worktaskManager: WorktaskManager,
  userHome?: string
): CheckpointManager {
  return new CheckpointManager(worktaskManager, userHome);
}
