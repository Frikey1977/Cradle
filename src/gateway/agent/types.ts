/**
 * Agent 模块类型定义
 *
 * 定义 Agent 进程相关的接口和类型
 */

import type {
  StandardMessage,
  ConversationContext,
  AgentConfig,
  LLMRequestConfig,
  LLMResponse,
  StrangerInfo,
} from "../core/types.js";
import type { InboundMessageContext } from "../channels/types.js";

/**
 * Agent 状态
 */
export type AgentStatus = "idle" | "processing" | "error" | "stopped";

/**
 * Agent 运行时信息
 */
export interface AgentRuntime {
  /** Agent ID */
  agentId: string;
  /** 当前状态 */
  status: AgentStatus;
  /** 当前处理的会话数 */
  activeConversations: number;
  /** 总处理消息数 */
  totalMessages: number;
  /** CPU 使用率 */
  cpuUsage: number;
  /** 内存使用（MB） */
  memoryUsage: number;
  /** 启动时间 */
  startedAt: number;
  /** 最后活动时间 */
  lastActiveAt: number;
}

/**
 * Agent 处理请求
 */
export interface AgentProcessRequest {
  /** 请求ID */
  requestId: string;
  /** 消息上下文 */
  message: InboundMessageContext;
  /** 会话上下文 */
  conversation: ConversationContext;
  /** 是否为陌生人 */
  isStranger: boolean;
  /** 陌生人信息（如果是陌生人） */
  strangerInfo?: StrangerInfo;
}

/**
 * Agent 处理结果
 */
export interface AgentProcessResult {
  /** 是否成功 */
  success: boolean;
  /** 回复消息 */
  reply?: StandardMessage;
  /** 更新的会话上下文 */
  updatedConversation?: ConversationContext;
  /** 需要执行的操作 */
  actions?: AgentAction[];
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
  };
  /** 处理时间（毫秒） */
  processingTime: number;
}

/**
 * Agent 动作
 */
export type AgentAction =
  | { type: "send_message"; payload: { text: string; to: string } }
  | { type: "update_context"; payload: Record<string, unknown> }
  | { type: "transfer_to_agent"; payload: { agentId: string; reason: string } }
  | { type: "request_verification"; payload: { question: string } }
  | { type: "create_task"; payload: { title: string; description: string } }
  | { type: "escalate"; payload: { reason: string; to: string } };

/**
 * Agent 接口
 *
 * 所有 Agent 实现必须遵循此接口
 */
export interface IAgent {
  /** Agent ID */
  readonly id: string;
  /** Agent 配置 */
  readonly config: AgentConfig;
  /** Agent 运行时信息 */
  readonly runtime: AgentRuntime;

  /**
   * 初始化 Agent
   */
  initialize(): Promise<void>;

  /**
   * 启动 Agent
   */
  start(): Promise<void>;

  /**
   * 停止 Agent
   */
  stop(): Promise<void>;

  /**
   * 处理消息
   * @param request 处理请求
   */
  process(request: AgentProcessRequest): Promise<AgentProcessResult>;

  /**
   * 获取会话上下文
   * @param conversationId 会话ID
   */
  getConversation(conversationId: string): Promise<ConversationContext | undefined>;

  /**
   * 更新会话上下文
   * @param conversation 会话上下文
   */
  updateConversation(conversation: ConversationContext): Promise<void>;

  /**
   * 关闭会话
   * @param conversationId 会话ID
   */
  closeConversation(conversationId: string): Promise<void>;
}

/**
 * Agent 工厂函数类型
 */
export type AgentFactory = (config: AgentConfig) => IAgent;

/**
 * Agent 注册表
 */
export class AgentRegistry {
  private static agents = new Map<string, AgentFactory>();
  private static instances = new Map<string, IAgent>();

  /**
   * 注册 Agent 类型
   * @param type Agent 类型
   * @param factory 工厂函数
   */
  static register(type: string, factory: AgentFactory): void {
    this.agents.set(type.toLowerCase(), factory);
  }

  /**
   * 创建 Agent 实例
   * @param config Agent 配置
   */
  static create(config: AgentConfig): IAgent | undefined {
    const factory = this.agents.get(config.position.toLowerCase());
    if (!factory) return undefined;

    const agent = factory(config);
    this.instances.set(config.id, agent);
    return agent;
  }

  /**
   * 获取 Agent 实例
   * @param agentId Agent ID
   */
  static get(agentId: string): IAgent | undefined {
    return this.instances.get(agentId);
  }

  /**
   * 移除 Agent 实例
   * @param agentId Agent ID
   */
  static remove(agentId: string): boolean {
    return this.instances.delete(agentId);
  }

  /**
   * 获取所有 Agent 实例
   */
  static getAll(): IAgent[] {
    return Array.from(this.instances.values());
  }

  /**
   * 检查是否支持某 Agent 类型
   * @param type Agent 类型
   */
  static has(type: string): boolean {
    return this.agents.has(type.toLowerCase());
  }
}

/**
 * 记忆检索请求
 */
export interface MemoryRetrievalRequest {
  /** Agent ID */
  agentId: string;
  /** Contact ID */
  contactId: string;
  /** 查询内容 */
  query: string;
  /** 最大结果数 */
  limit?: number;
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 记忆ID */
  id: string;
  /** 内容 */
  content: string;
  /** 类型 */
  type: "conversation" | "fact" | "preference" | "task";
  /** 关联的 Contact ID */
  contactId: string;
  /** 关联的 Agent ID */
  agentId: string;
  /** 重要性分数 */
  importance: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

/**
 * 记忆检索结果
 */
export interface MemoryRetrievalResult {
  /** 记忆条目列表 */
  memories: MemoryEntry[];
  /** 总匹配数 */
  total: number;
  /** 检索时间（毫秒） */
  retrievalTime: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数定义 */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 调用ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 参数 */
  arguments: Record<string, unknown>;
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 调用ID */
  id: string;
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
}
