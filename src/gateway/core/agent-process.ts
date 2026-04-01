/**
 * Agent 进程
 * 
 * 职责：
 * 1. 加载 Agent 配置和记忆
 * 2. 处理对话请求
 * 3. 管理对话状态
 * 4. 调用工具
 */

import type {
  IPCMessage,
  LLMRequestMessage,
  LLMResponseMessage,
  OutboundMessage,
  ProcessStatus,
} from "../ipc/types.js";
import type { InboundMessageContext, OutboundMessageContext } from "../channels/types.js";

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent ID */
  agentId: string;
  /** Agent 名称 */
  name: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 岗位/角色 */
  position: string;
  /** 能力列表 */
  capabilities: string[];
  /** 工具列表 */
  tools: string[];
  /** 模型配置 */
  modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

/**
 * 对话状态
 */
interface ConversationState {
  /** 对话ID */
  conversationId: string;
  /** Contact ID */
  contactId?: string;
  /** 消息历史 */
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  /** 最后活动时间 */
  lastActiveAt: number;
  /** 上下文变量 */
  context: Record<string, unknown>;
}

/**
 * Agent 进程
 */
export class AgentProcess {
  private config: AgentConfig;
  private status: ProcessStatus = "idle";
  private conversations = new Map<string, ConversationState>();
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  };
  private running = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private masterId = "master";

  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  }

  /**
   * 设置日志记录器
   */
  setLogger(logger: typeof this.logger): void {
    this.logger = logger;
  }

  /**
   * 启动 Agent 进程
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.logger.info(`[Agent ${this.config.agentId}] Starting...`);

    // 加载记忆和配置
    await this.loadMemory();

    // 注册到 Master
    await this.registerWithMaster();

    // 启动心跳
    this.startHeartbeat();

    this.running = true;
    this.status = "idle";

    this.logger.info(`[Agent ${this.config.agentId}] Started`);
  }

  /**
   * 停止 Agent 进程
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info(`[Agent ${this.config.agentId}] Stopping...`);

    // 保存记忆
    await this.saveMemory();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.status = "stopped";
    this.running = false;

    this.logger.info(`[Agent ${this.config.agentId}] Stopped`);
  }

  /**
   * 处理用户消息
   */
  async handleMessage(context: InboundMessageContext): Promise<void> {
    const conversationId = context.chatId;

    this.logger.debug?.(
      `[Agent ${this.config.agentId}] Handling message in conversation ${conversationId}`,
    );

    this.status = "busy";

    try {
      // 1. 获取或创建对话状态
      const conversation = this.getOrCreateConversation(conversationId, context);

      // 2. 添加用户消息到历史
      conversation.messages.push({
        role: "user",
        content: context.body,
        timestamp: context.timestamp,
      });

      // 3. 构建 LLM 请求
      const llmMessages = this.buildLLMMessages(conversation);

      // 4. 发送 LLM 请求
      const requestId = this.generateMessageId();
      const llmRequest: LLMRequestMessage = {
        id: requestId,
        type: "llm-request",
        from: `agent-${this.config.agentId}`,
        to: "llm-pool",
        timestamp: Date.now(),
        payload: {
          requestId,
          agentId: this.config.agentId,
          conversationId,
          messages: llmMessages,
          stream: true,
          temperature: this.config.modelConfig.temperature,
          maxTokens: this.config.modelConfig.maxTokens,
        },
      };

      this.sendToLLMPool(llmRequest);

      // 5. 等待 LLM 响应（实际实现中需要异步处理）
      // 这里简化处理

    } catch (error) {
      this.logger.error(
        `[Agent ${this.config.agentId}] Error handling message: ${String(error)}`,
      );

      // 发送错误响应
      this.sendErrorResponse(context, error);
    }
  }

  /**
   * 处理 LLM 响应
   */
  async handleLLMResponse(response: LLMResponseMessage): Promise<void> {
    const { requestId, content, chunk, done, error } = response.payload;

    if (error) {
      this.logger.error(`[Agent ${this.config.agentId}] LLM error: ${error}`);
      return;
    }

    // 获取对话ID
    const conversationId = response.payload.requestId; // 简化处理
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      this.logger.warn(`[Agent ${this.config.agentId}] Conversation not found: ${conversationId}`);
      return;
    }

    if (done) {
      // 响应完成
      const fullContent = content ?? "";

      // 添加助手回复到历史
      conversation.messages.push({
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
      });

      // 更新对话状态
      conversation.lastActiveAt = Date.now();

      // 发送回复给用户
      await this.sendReply(conversationId, fullContent);

      this.status = "idle";
    } else {
      // 流式响应块
      this.logger.debug?.(`[Agent ${this.config.agentId}] Received chunk: ${chunk?.slice(0, 50)}...`);
      // 实际实现中需要处理流式输出
    }
  }

  /**
   * 发送回复
   */
  private async sendReply(conversationId: string, content: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    // 构建出站消息
    const outboundMessage: OutboundMessage = {
      id: this.generateMessageId(),
      type: "outbound",
      from: `agent-${this.config.agentId}`,
      to: this.masterId,
      timestamp: Date.now(),
      payload: {
        message: {
          to: conversationId, // 简化处理，实际需要获取正确的目标地址
          text: content,
          channelType: "webui", // 简化处理
        } as OutboundMessageContext,
        originalMessageId: conversation.messages[conversation.messages.length - 2]?.timestamp.toString() ?? "",
      },
    };

    this.sendToMaster(outboundMessage);
  }

  /**
   * 获取或创建对话状态
   */
  private getOrCreateConversation(
    conversationId: string,
    context: InboundMessageContext,
  ): ConversationState {
    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      conversation = {
        conversationId,
        contactId: undefined, // 需要从 context 或数据库获取
        messages: [],
        lastActiveAt: Date.now(),
        context: {},
      };
      this.conversations.set(conversationId, conversation);

      this.logger.debug?.(
        `[Agent ${this.config.agentId}] Created new conversation: ${conversationId}`,
      );
    }

    return conversation;
  }

  /**
   * 构建 LLM 消息
   */
  private buildLLMMessages(
    conversation: ConversationState,
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: this.config.systemPrompt,
      },
    ];

    // 添加历史消息（限制长度）
    const recentMessages = conversation.messages.slice(-20); // 最近 20 条
    messages.push(...recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })));

    return messages;
  }

  /**
   * 加载记忆
   */
  private async loadMemory(): Promise<void> {
    this.logger.debug?.(`[Agent ${this.config.agentId}] Loading memory...`);
    // 实际实现中需要从数据库或文件加载
  }

  /**
   * 保存记忆
   */
  private async saveMemory(): Promise<void> {
    this.logger.debug?.(`[Agent ${this.config.agentId}] Saving memory...`);
    // 实际实现中需要保存到数据库或文件
  }

  /**
   * 注册到 Master
   */
  private async registerWithMaster(): Promise<void> {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "register",
      from: `agent-${this.config.agentId}`,
      to: this.masterId,
      timestamp: Date.now(),
      payload: {
        processType: "agent",
        processId: this.config.agentId,
        capabilities: this.config.capabilities,
      },
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "heartbeat",
        from: `agent-${this.config.agentId}`,
        to: this.masterId,
        timestamp: Date.now(),
        payload: {
          status: this.status,
          load: this.conversations.size / 100, // 简化负载计算
        },
      });
    }, 10000);
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(context: InboundMessageContext, error: unknown): void {
    const errorMessage: OutboundMessage = {
      id: this.generateMessageId(),
      type: "outbound",
      from: `agent-${this.config.agentId}`,
      to: this.masterId,
      timestamp: Date.now(),
      payload: {
        message: {
          to: context.senderId,
          text: "抱歉，处理您的消息时出现了错误，请稍后重试。",
          channelType: context.channelType,
        } as OutboundMessageContext,
        originalMessageId: context.messageId,
      },
    };

    this.sendToMaster(errorMessage);
  }

  /**
   * 发送消息到 Master
   */
  private sendToMaster(message: IPCMessage): void {
    this.logger.debug?.(
      `[Agent ${this.config.agentId}] Sending ${message.type} to Master`,
    );
  }

  /**
   * 发送消息到 LLM Pool
   */
  private sendToLLMPool(message: IPCMessage): void {
    this.logger.debug?.(
      `[Agent ${this.config.agentId}] Sending ${message.type} to LLM Pool`,
    );
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `agent_${this.config.agentId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
