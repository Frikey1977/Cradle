/**
 * 进程间通信类型定义
 * 
 * 定义 Master/Worker/Agent/LLM Pool 之间的消息格式
 */

import type { InboundMessageContext, OutboundMessageContext } from "../channels/types.js";

/**
 * 进程类型
 */
export type ProcessType = "master" | "worker" | "agent" | "llm-pool";

/**
 * 进程状态
 */
export type ProcessStatus = "idle" | "busy" | "error" | "stopped";

/**
 * 基础 IPC 消息
 */
export interface IPCMessage {
  /** 消息ID */
  id: string;
  /** 消息类型 */
  type: string;
  /** 发送方进程ID */
  from: string;
  /** 接收方进程ID */
  to: string;
  /** 时间戳 */
  timestamp: number;
  /** 消息负载 */
  payload: unknown;
}

/**
 * 注册进程消息
 */
export interface RegisterProcessMessage extends IPCMessage {
  type: "register";
  payload: {
    processType: ProcessType;
    processId: string;
    capabilities?: string[];
  };
}

/**
 * 心跳消息
 */
export interface HeartbeatMessage extends IPCMessage {
  type: "heartbeat";
  payload: {
    status: ProcessStatus;
    load?: number;
    memory?: number;
  };
}

/**
 * 入站消息（从 Master 到 Worker）
 */
export interface InboundMessage extends IPCMessage {
  type: "inbound";
  payload: {
    message: InboundMessageContext;
    route: {
      channelId: string;
      contactId?: string;
      agentId?: string;
      isStranger: boolean;
    };
  };
}

/**
 * 出站消息（从 Agent 到 Master）
 */
export interface OutboundMessage extends IPCMessage {
  type: "outbound";
  payload: {
    message: OutboundMessageContext;
    originalMessageId: string;
  };
}

/**
 * LLM 请求消息
 */
export interface LLMRequestMessage extends IPCMessage {
  type: "llm-request";
  payload: {
    requestId: string;
    agentId: string;
    conversationId: string;
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    stream: boolean;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * LLM 响应消息
 */
export interface LLMResponseMessage extends IPCMessage {
  type: "llm-response";
  payload: {
    requestId: string;
    /** 完整内容（非流式） */
    content?: string;
    /** 流式内容块 */
    chunk?: string;
    /** 是否完成 */
    done: boolean;
    /** 错误信息 */
    error?: string;
    /** 使用的 token 数 */
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

/**
 * 路由决策消息
 */
export interface RouteDecisionMessage extends IPCMessage {
  type: "route-decision";
  payload: {
    messageId: string;
    decision: {
      agentId: string;
      workerId: string;
      priority: number;
    };
  };
}

/**
 * 错误消息
 */
export interface ErrorMessage extends IPCMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 进程统计信息
 */
export interface ProcessStats {
  processId: string;
  processType: ProcessType;
  status: ProcessStatus;
  /** CPU 使用率 */
  cpuUsage: number;
  /** 内存使用（MB） */
  memoryUsage: number;
  /** 处理的消息数 */
  messageCount: number;
  /** 最后活动时间 */
  lastActiveAt: number;
  /** 启动时间 */
  startedAt: number;
}

/**
 * IPC 传输接口
 */
export interface IPCTransport {
  /** 发送消息 */
  send(message: IPCMessage): Promise<void>;
  /** 注册消息处理器 */
  onMessage(handler: (message: IPCMessage) => void | Promise<void>): void;
  /** 关闭连接 */
  close(): Promise<void>;
}
