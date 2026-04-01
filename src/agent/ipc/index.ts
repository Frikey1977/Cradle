/**
 * IPC 通信协议
 *
 * 用于 Agent、Orchestrator、Executor 之间的进程间通信
 */

import { EventEmitter } from "events";

/**
 * IPC 消息基础类型
 */
export interface IPCMessage {
  type: string;
  id: string;
  timestamp: Date;
  source: string;
  target: string;
  payload: Record<string, unknown>;
}

/**
 * Agent IPC 消息
 */
export interface AgentIPCMessage extends IPCMessage {
  type: AgentMessageType;
  agentId: string;
}

export type AgentMessageType =
  | "agent:message"
  | "agent:response"
  | "agent:error"
  | "agent:status";

/**
 * Orchestrator IPC 消息
 */
export interface OrchestratorIPCMessage extends IPCMessage {
  type: OrchestratorMessageType;
  worktaskId: string;
  agentId: string;
}

export type OrchestratorMessageType =
  | "worktask:created"
  | "worktask:status_changed"
  | "worktask:progress_updated"
  | "worktask:todo_added"
  | "worktask:todo_updated"
  | "worktask:executor_added"
  | "worktask:executor_updated"
  | "worktask:completed"
  | "worktask:failed"
  | "worktask:cancelled";

/**
 * Executor IPC 消息
 */
export interface ExecutorIPCMessage extends IPCMessage {
  type: ExecutorMessageType;
  executorId: string;
  worktaskId: string;
}

export type ExecutorMessageType =
  | "executor:started"
  | "executor:progress"
  | "executor:step_completed"
  | "executor:step_failed"
  | "executor:completed"
  | "executor:failed"
  | "executor:timeout";

/**
 * IPC 通道接口
 */
export interface IPCChannel {
  send(message: IPCMessage): void;
  onMessage(handler: (message: IPCMessage) => void): void;
  close(): void;
}

/**
 * 内存 IPC 通道（用于同一进程内通信）
 */
export class InMemoryIPCChannel implements IPCChannel {
  private handlers: Array<(message: IPCMessage) => void> = [];

  send(message: IPCMessage): void {
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error("[InMemoryIPCChannel] Handler error:", error);
      }
    }
  }

  onMessage(handler: (message: IPCMessage) => void): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.handlers = [];
  }
}

/**
 * IPC 消息总线
 */
export class IPCBus extends EventEmitter {
  private channels: Map<string, IPCChannel> = new Map();

  /**
   * 注册通道
   */
  registerChannel(id: string, channel: IPCChannel): void {
    this.channels.set(id, channel);
    channel.onMessage((message) => this.handleMessage(id, message));
  }

  /**
   * 注销通道
   */
  unregisterChannel(id: string): void {
    const channel = this.channels.get(id);
    if (channel) {
      channel.close();
      this.channels.delete(id);
    }
  }

  /**
   * 发送消息到指定目标
   */
  sendTo(target: string, message: IPCMessage): void {
    const channel = this.channels.get(target);
    if (channel) {
      channel.send(message);
    } else {
      console.warn(`[IPCBus] Target channel not found: ${target}`);
    }
  }

  /**
   * 广播消息到所有通道
   */
  broadcast(message: IPCMessage): void {
    for (const channel of this.channels.values()) {
      channel.send(message);
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(sourceId: string, message: IPCMessage): void {
    this.emit("message", { sourceId, message });
    this.emit(message.type, message);
  }
}

/**
 * IPC 消息构建器
 */
export class IPCMessageBuilder {
  private static generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 构建 Agent 消息
   */
  static buildAgentMessage(
    type: AgentMessageType,
    agentId: string,
    payload: Record<string, unknown>
  ): AgentIPCMessage {
    return {
      type,
      id: this.generateId(),
      timestamp: new Date(),
      source: `agent:${agentId}`,
      target: "orchestrator",
      agentId,
      payload,
    };
  }

  /**
   * 构建 Orchestrator 消息
   */
  static buildOrchestratorMessage(
    type: OrchestratorMessageType,
    worktaskId: string,
    agentId: string,
    payload: Record<string, unknown>
  ): OrchestratorIPCMessage {
    return {
      type,
      id: this.generateId(),
      timestamp: new Date(),
      source: `orchestrator:${worktaskId}`,
      target: `agent:${agentId}`,
      worktaskId,
      agentId,
      payload,
    };
  }

  /**
   * 构建 Executor 消息
   */
  static buildExecutorMessage(
    type: ExecutorMessageType,
    executorId: string,
    worktaskId: string,
    payload: Record<string, unknown>
  ): ExecutorIPCMessage {
    return {
      type,
      id: this.generateId(),
      timestamp: new Date(),
      source: `executor:${executorId}`,
      target: `orchestrator:${worktaskId}`,
      executorId,
      worktaskId,
      payload,
    };
  }
}

/**
 * 进度报告消息
 */
export interface ProgressReportMessage {
  worktaskId: string;
  agentId: string;
  status: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  currentStep?: string;
  currentExecutor?: string;
  message?: string;
}

/**
 * 创建进度报告消息
 */
export function createProgressReport(
  worktaskId: string,
  agentId: string,
  progress: ProgressReportMessage["progress"],
  options?: {
    status?: string;
    currentStep?: string;
    currentExecutor?: string;
    message?: string;
  }
): OrchestratorIPCMessage {
  return IPCMessageBuilder.buildOrchestratorMessage(
    "worktask:progress_updated",
    worktaskId,
    agentId,
    {
      status: options?.status || "running",
      progress,
      currentStep: options?.currentStep,
      currentExecutor: options?.currentExecutor,
      message: options?.message,
    }
  );
}

/**
 * 创建完成消息
 */
export function createCompletionMessage(
  worktaskId: string,
  agentId: string,
  result: {
    success: boolean;
    output: string;
    duration: number;
  }
): OrchestratorIPCMessage {
  return IPCMessageBuilder.buildOrchestratorMessage(
    "worktask:completed",
    worktaskId,
    agentId,
    {
      result,
    }
  );
}

/**
 * 创建错误消息
 */
export function createErrorMessage(
  worktaskId: string,
  agentId: string,
  error: {
    code: string;
    message: string;
    stack?: string;
  }
): OrchestratorIPCMessage {
  return IPCMessageBuilder.buildOrchestratorMessage(
    "worktask:failed",
    worktaskId,
    agentId,
    {
      error,
    }
  );
}