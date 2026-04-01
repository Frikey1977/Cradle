/**
 * 用户确认处理器
 *
 * 处理任务执行过程中的用户确认请求
 */

import { EventEmitter } from "events";
import type { WorktaskManager } from "../worktask/worktask-manager.js";
import type { CheckpointManager } from "../worktask/checkpoint-manager.js";
import type { TaskDefinition } from "./types.js";
import type { TaskDefinitionExecutor } from "./task-definition-executor.js";

export interface UserConfirmRequest {
  worktaskId: string;
  stepId: string;
  message: string;
  options: Array<{
    label: string;
    value: string;
    default?: boolean;
  }>;
  timeoutSeconds?: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface UserConfirmResponse {
  worktaskId: string;
  stepId: string;
  choice: string;
  respondedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PendingConfirm {
  request: UserConfirmRequest;
  definition: TaskDefinition;
  resolve: (response: UserConfirmResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

export type ConfirmChannel = "ui" | "message" | "notification";

export interface UserConfirmHandlerConfig {
  defaultTimeoutSeconds?: number;
  channels?: ConfirmChannel[];
  notifyOnRequest?: boolean;
}

export class UserConfirmHandler extends EventEmitter {
  private worktaskManager: WorktaskManager;
  private checkpointManager: CheckpointManager;
  private executor: TaskDefinitionExecutor | null = null;
  private config: Required<UserConfirmHandlerConfig>;
  
  private pendingConfirms: Map<string, PendingConfirm> = new Map();
  private confirmHistory: Map<string, UserConfirmResponse[]> = new Map();

  constructor(
    worktaskManager: WorktaskManager,
    checkpointManager: CheckpointManager,
    config?: UserConfirmHandlerConfig
  ) {
    super();
    this.worktaskManager = worktaskManager;
    this.checkpointManager = checkpointManager;
    this.config = {
      defaultTimeoutSeconds: config?.defaultTimeoutSeconds ?? 300,
      channels: config?.channels || ["ui", "message"],
      notifyOnRequest: config?.notifyOnRequest ?? true,
    };
  }

  setExecutor(executor: TaskDefinitionExecutor): void {
    this.executor = executor;
  }

  async requestConfirm(
    worktaskId: string,
    stepId: string,
    message: string,
    options: Array<{ label: string; value: string; default?: boolean }>,
    timeoutSeconds?: number,
    definition?: TaskDefinition
  ): Promise<UserConfirmResponse> {
    const timeout = timeoutSeconds || this.config.defaultTimeoutSeconds;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeout * 1000);

    const request: UserConfirmRequest = {
      worktaskId,
      stepId,
      message,
      options,
      timeoutSeconds: timeout,
      createdAt: now,
      expiresAt,
    };

    console.log(`[UserConfirmHandler] Requesting confirmation for worktask ${worktaskId}, step ${stepId}`);

    return new Promise((resolve, reject) => {
      const pending: PendingConfirm = {
        request,
        definition: definition!,
        resolve,
        reject,
      };

      if (timeout > 0) {
        pending.timeoutId = setTimeout(() => {
          this.handleTimeout(worktaskId);
        }, timeout * 1000);
      }

      this.pendingConfirms.set(worktaskId, pending);

      this.emit("confirm:requested", { request });

      if (this.config.notifyOnRequest) {
        this.notifyUser(request);
      }

      this.updateWorktaskState(worktaskId, {
        userConfirmRequired: true,
        userConfirmData: {
          stepId,
          message,
          options,
        },
      });
    });
  }

  async respondConfirm(
    worktaskId: string,
    choice: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const pending = this.pendingConfirms.get(worktaskId);
    if (!pending) {
      throw new Error(`No pending confirmation for worktask ${worktaskId}`);
    }

    const validChoice = pending.request.options.some((opt) => opt.value === choice);
    if (!validChoice) {
      throw new Error(`Invalid choice: ${choice}`);
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    const response: UserConfirmResponse = {
      worktaskId,
      stepId: pending.request.stepId,
      choice,
      respondedAt: new Date(),
      metadata,
    };

    this.addToHistory(worktaskId, response);
    this.pendingConfirms.delete(worktaskId);

    this.emit("confirm:responded", { response });

    await this.updateWorktaskState(worktaskId, {
      userConfirmRequired: false,
      userConfirmData: undefined,
    });

    pending.resolve(response);

    if (pending.definition && this.executor) {
      this.resumeExecution(worktaskId, pending.definition, choice);
    }
  }

  async cancelConfirm(worktaskId: string, reason?: string): Promise<void> {
    const pending = this.pendingConfirms.get(worktaskId);
    if (!pending) {
      return;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingConfirms.delete(worktaskId);

    this.emit("confirm:cancelled", { worktaskId, reason });

    await this.updateWorktaskState(worktaskId, {
      userConfirmRequired: false,
      userConfirmData: undefined,
    });

    pending.reject(new Error(reason || "Confirmation cancelled"));
  }

  getPendingConfirm(worktaskId: string): UserConfirmRequest | null {
    const pending = this.pendingConfirms.get(worktaskId);
    return pending?.request || null;
  }

  getAllPendingConfirms(): UserConfirmRequest[] {
    return Array.from(this.pendingConfirms.values()).map((p) => p.request);
  }

  getConfirmHistory(worktaskId: string): UserConfirmResponse[] {
    return this.confirmHistory.get(worktaskId) || [];
  }

  private handleTimeout(worktaskId: string): void {
    const pending = this.pendingConfirms.get(worktaskId);
    if (!pending) return;

    const defaultOption = pending.request.options.find((opt) => opt.default);
    const defaultChoice = defaultOption?.value || pending.request.options[0]?.value;

    if (defaultChoice) {
      console.log(`[UserConfirmHandler] Timeout, using default choice: ${defaultChoice}`);
      this.respondConfirm(worktaskId, defaultChoice, { timeout: true });
    } else {
      console.log(`[UserConfirmHandler] Timeout, cancelling confirmation`);
      this.cancelConfirm(worktaskId, "Confirmation timeout");
    }
  }

  private async resumeExecution(
    worktaskId: string,
    definition: TaskDefinition,
    choice: string
  ): Promise<void> {
    if (!this.executor) {
      console.warn("[UserConfirmHandler] No executor set, cannot resume execution");
      return;
    }

    try {
      console.log(`[UserConfirmHandler] Resuming execution for worktask ${worktaskId}`);

      const result = await this.executor.resume(definition, worktaskId, choice);

      this.emit("confirm:execution_resumed", {
        worktaskId,
        choice,
        result,
      });

    } catch (error) {
      console.error(`[UserConfirmHandler] Failed to resume execution:`, error);
      this.emit("confirm:execution_failed", {
        worktaskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async updateWorktaskState(
    worktaskId: string,
    state: { userConfirmRequired: boolean; userConfirmData?: unknown }
  ): Promise<void> {
    try {
      await this.worktaskManager.updateLoopState(worktaskId, {
        userConfirmRequired: state.userConfirmRequired,
        userConfirmData: state.userConfirmData as Record<string, unknown>,
        waitingForUserInput: state.userConfirmRequired,
      });
    } catch (error) {
      console.error(`[UserConfirmHandler] Failed to update worktask state:`, error);
    }
  }

  private notifyUser(request: UserConfirmRequest): void {
    const notification = {
      type: "confirm_request",
      worktaskId: request.worktaskId,
      stepId: request.stepId,
      message: request.message,
      options: request.options,
      timeout: request.timeoutSeconds,
    };

    for (const channel of this.config.channels) {
      this.emit(`notify:${channel}`, notification);
    }
  }

  private addToHistory(worktaskId: string, response: UserConfirmResponse): void {
    if (!this.confirmHistory.has(worktaskId)) {
      this.confirmHistory.set(worktaskId, []);
    }
    this.confirmHistory.get(worktaskId)!.push(response);
  }

  getStats(): {
    pendingCount: number;
    historyCount: number;
  } {
    return {
      pendingCount: this.pendingConfirms.size,
      historyCount: Array.from(this.confirmHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };
  }
}

export function createUserConfirmHandler(
  worktaskManager: WorktaskManager,
  checkpointManager: CheckpointManager,
  config?: UserConfirmHandlerConfig
): UserConfirmHandler {
  return new UserConfirmHandler(worktaskManager, checkpointManager, config);
}
