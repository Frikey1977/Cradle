/**
 * Gateway Worker 进程
 *
 * 职责：
 * 1. 接收 Master 分发的消息
 * 2. 执行路由决策
 * 3. 调用 Agent 处理消息（通过 AgentManager）
 * 4. 返回处理结果
 */

import type { IPCMessage } from "../ipc/types.js";
import type { InboundMessageContext, OutboundMessageContext } from "../channels/types.js";
import type { RouteDecision, ConversationContext, AgentConfig } from "./types.js";
import { AgentManager } from "../../agent/runtime/agent-manager.js";
import type { AgentMessage, AgentResponse } from "../../agent/types/index.js";

/**
 * Worker 配置
 */
export interface WorkerConfig {
  /** Worker ID */
  workerId: string;
  /** 最大并发处理数 */
  maxConcurrency: number;
  /** 消息处理超时（毫秒） */
  messageTimeout: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number;
  /** Agent ID */
  agentId?: string;
}

/**
 * 正在处理的消息
 */
interface ProcessingMessage {
  id: string;
  context: InboundMessageContext;
  startTime: number;
  timeoutTimer: NodeJS.Timeout;
}

/**
 * Gateway Worker 进程
 */
export class GatewayWorker {
  private config: WorkerConfig;
  private processingMessages = new Map<string, ProcessingMessage>();
  private currentLoad = 0;
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  };
  private heartbeatTimer?: NodeJS.Timeout;
  private running = false;
  private agentManager?: AgentManager;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      workerId: config.workerId ?? "worker-unknown",
      maxConcurrency: config.maxConcurrency ?? 10,
      messageTimeout: config.messageTimeout ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 5000,
      agentId: config.agentId,
    };

    this.logger = {
      info: (msg: string) => console.log(`[${this.config.workerId}] ${msg}`),
      warn: (msg: string) => console.warn(`[${this.config.workerId}] ${msg}`),
      error: (msg: string) => console.error(`[${this.config.workerId}] ${msg}`),
      debug: (msg: string) => console.debug(`[${this.config.workerId}] ${msg}`),
    };
  }

  /**
   * 设置日志记录器
   */
  setLogger(logger: typeof this.logger): void {
    this.logger = logger;
  }

  /**
   * 启动 Worker 进程
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn("Already running");
      return;
    }

    this.logger.info("Starting Gateway Worker...");

    // 1. 初始化 AgentManager（如果指定了 agentId）
    if (this.config.agentId) {
      await this.initializeAgentManager();
    }

    // 2. 设置 IPC 消息处理
    this.setupIPC();

    // 3. 启动心跳
    this.startHeartbeat();

    this.running = true;
    this.logger.info("Started");

    // 发送启动完成消息
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "worker-ready",
      from: this.config.workerId,
      to: "master",
      timestamp: Date.now(),
      payload: {
        workerId: this.config.workerId,
        maxConcurrency: this.config.maxConcurrency,
        agentId: this.config.agentId,
      },
    });
  }

  /**
   * 初始化 AgentManager
   */
  private async initializeAgentManager(): Promise<void> {
    if (!this.config.agentId) {
      throw new Error("Agent ID not configured");
    }

    this.logger.info(`Initializing AgentManager for agent: ${this.config.agentId}`);

    this.agentManager = new AgentManager({
      agentId: this.config.agentId,
    });

    await this.agentManager.initialize();

    this.logger.info(`AgentManager initialized for agent: ${this.config.agentId}`);
  }

  /**
   * 停止 Worker 进程
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info("Stopping...");

    // 停止心跳
    this.stopHeartbeat();

    // 停止 AgentManager
    if (this.agentManager) {
      await this.agentManager.stop();
      this.agentManager = undefined;
    }

    // 清理正在处理的消息
    for (const msg of this.processingMessages.values()) {
      clearTimeout(msg.timeoutTimer);
    }
    this.processingMessages.clear();

    this.running = false;
    this.logger.info("Stopped");
  }

  /**
   * 处理入站消息
   */
  private async handleInboundMessage(message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      messageId: string;
      context: InboundMessageContext;
      channelConfig: { name: string; type: string };
    };

    const context = payload.context;
    const messageId = payload.messageId;

    this.logger.info(`Worker received message ${messageId}, audio: ${!!context.audio}, images: ${context.images?.length || 0}, stream: ${context.stream}`);
    this.logger.info(`Context keys: ${Object.keys(context).join(', ')}`);

    // 检查并发数
    if (this.processingMessages.size >= this.config.maxConcurrency) {
      this.logger.warn(`Max concurrency reached, rejecting message ${messageId}`);
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "error",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          messageId,
          error: "Max concurrency reached",
        },
      });
      return;
    }

    // 设置超时
    const timeoutTimer = setTimeout(() => {
      this.handleMessageTimeout(messageId);
    }, this.config.messageTimeout);

    // 记录正在处理的消息
    const processingMsg: ProcessingMessage = {
      id: messageId,
      context,
      startTime: Date.now(),
      timeoutTimer,
    };
    this.processingMessages.set(messageId, processingMsg);
    this.updateLoad();

    try {
      // 1. 请求路由决策
      const routeDecision = await this.requestRouteDecision(context);

      // 2. 检查是否需要陌生人处理
      if (routeDecision.needsStrangerHandling) {
        await this.handleStranger(context, routeDecision);
      }

      // 3. 调用 Agent 处理
      const result = await this.callAgent(context, routeDecision);

      // 4. 发送处理结果
      // 提取回复文本
      const replyAction = (result as any)?.actions?.find((a: any) => a.type === "reply");
      const replyText = replyAction?.payload?.text || "处理完成";

      // 构建出站消息payload
      const outboundPayload: any = {
        channelName: context.channelType || "cradle",
        context: {
          messageId,
          clientId: context.senderId,
          agentId: routeDecision.agentId,
          content: replyText,
          replyTo: messageId,
          timestamp: Date.now(),
        },
      };

      // 如果有音频输出，添加到payload
      if ((result as any)?.audio) {
        outboundPayload.context.audio = (result as any).audio;
      }

      this.sendToMaster({
        id: this.generateMessageId(),
        type: "outbound",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: outboundPayload,
      });

      this.logger.debug?.(`Message ${messageId} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing message ${messageId}: ${String(error)}`);
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "error",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          messageId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      // 清理
      clearTimeout(timeoutTimer);
      this.processingMessages.delete(messageId);
      this.updateLoad();
    }
  }

  /**
   * 处理路由决策响应
   */
  private handleRouteDecision(message: IPCMessage): void {
    // 实际实现中需要处理 Master 返回的路由决策
    this.logger.debug?.("Received route decision");
  }

  /**
   * 请求路由决策
   */
  private async requestRouteDecision(context: InboundMessageContext): Promise<RouteDecision> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateMessageId();

      // 发送路由请求
      this.sendToMaster({
        id: requestId,
        type: "route-request",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          messageId: context.messageId,
          senderId: context.senderId,
          channelType: context.channelType,
        },
      });

      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error("Route decision timeout"));
      }, 5000);

      // 等待响应（简化实现，实际应该使用 Promise 映射表）
      // 这里使用默认决策
      clearTimeout(timeout);
      resolve({
        agentId: "default-agent",
        workerId: this.config.workerId,
        priority: 1,
        reason: "default routing",
        needsStrangerHandling: false,
        decidedAt: Date.now(),
      });
    });
  }

  /**
   * 处理陌生人
   */
  private async handleStranger(
    context: InboundMessageContext,
    decision: RouteDecision,
  ): Promise<void> {
    this.logger.info(`Handling stranger: ${context.senderId}`);
    // 实际实现中需要：
    // 1. 查询企业配置
    // 2. 应用陌生人策略
    // 3. 可能创建临时 Agent 或拒绝消息
  }

  /**
   * 调用 Agent 处理消息（通过 AgentManager 调用 LLM）
   */
  private async callAgent(
    context: InboundMessageContext,
    decision: RouteDecision,
  ): Promise<unknown> {
    this.logger.info(`Calling agent ${decision.agentId} for message: ${context.body}`);

    const startTime = Date.now();

    // 检查 AgentManager 是否已初始化
    if (!this.agentManager) {
      throw new Error(`AgentManager not initialized for agent: ${decision.agentId}`);
    }

    // 构建 AgentMessage
    this.logger.info(`[callAgent] context.stream=${context.stream}, context.audio=${!!context.audio}`);
    const agentMessage: AgentMessage = {
      agentId: decision.agentId,
      contactId: context.senderId,
      content: context.body,
      conversationId: context.chatId,
      channelName: context.channelType,
      timestamp: context.timestamp,
      stream: context.stream,
      metadata: {
        senderName: context.senderName,
        recipientId: context.recipientId,
        replyToId: context.replyToId,
      },
    };
    this.logger.info(`[callAgent] agentMessage.stream=${agentMessage.stream}`);

    // 传递多媒体数据
    if (context.audio) {
      this.logger.info(`Worker: Adding audio to agentMessage: ${context.audio.data.length} chars`);
      agentMessage.audio = context.audio;
    }
    if (context.images) {
      this.logger.info(`Worker: Adding ${context.images.length} images to agentMessage`);
      agentMessage.images = context.images;
    }

    // 发送系统消息：暴露处理信息
    this.logger.info(`Worker: agentMessage has audio: ${!!agentMessage.audio}, images: ${agentMessage.images?.length || 0}`);
    const processingInfo = this.agentManager.getProcessingInfo(agentMessage);
    this.sendSystemMessage(context, processingInfo);

    // 调用 AgentManager 处理消息（内部会调用 LLM）
    this.logger.info(`Calling agentManager.handleMessage for agent ${decision.agentId}`);
    const agentResponse: AgentResponse = await this.agentManager.handleMessage(agentMessage);
    this.logger.info(`Got agent response: stream=${agentResponse.stream}, hasContentStream=${!!agentResponse.contentStream}, contentLength=${agentResponse.content?.length || 0}`);

    // 处理流式响应
    let finalContent = agentResponse.content;

    if (agentResponse.stream && agentResponse.contentStream) {
      this.logger.info(`Processing streaming response for agent ${decision.agentId}`);
      this.logger.info(`Agent ${decision.agentId} returned streaming response, collecting content...`);

      // 发送流式开始消息
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-stream-start",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          requestId: context.messageId,
          agentId: decision.agentId,
          thinkingMessage: agentResponse.thinkingMessage,
        },
      });
      this.logger.info(`[DEBUG] agent-stream-start message sent`);

      // 收集流式内容
      const contentChunks: string[] = [];
      let chunkCount = 0;
      const streamStartTime = Date.now();
      this.logger.info(`[DEBUG] About to enter try block...`);
      try {
        this.logger.info(`[DEBUG] Starting to iterate contentStream...`);
        this.logger.info(`[DEBUG] contentStream type: ${typeof agentResponse.contentStream}`);
        this.logger.info(`[DEBUG] contentStream is async generator: ${agentResponse.contentStream?.[Symbol.asyncIterator] !== undefined}`);
        for await (const chunk of agentResponse.contentStream) {
          chunkCount++;
          // chunk 是字符串（根据 AgentResponse 类型定义）
          if (chunk && typeof chunk === 'string') {
            contentChunks.push(chunk);
            this.logger.debug?.(`[DEBUG] Received chunk ${chunkCount}: length=${chunk.length}, content="${chunk.substring(0, 50)}..."`);
          } else {
            this.logger.warn(`[DEBUG] Received non-string chunk ${chunkCount}: type=${typeof chunk}, value=${JSON.stringify(chunk).substring(0, 100)}`);
          }
          // 发送流式块消息
          this.sendToMaster({
            id: this.generateMessageId(),
            type: "agent-stream-chunk",
            from: this.config.workerId,
            to: "master",
            timestamp: Date.now(),
            payload: {
              requestId: context.messageId,
              agentId: decision.agentId,
              chunk: chunk || "",
            },
          });
        }
        const streamDuration = Date.now() - streamStartTime;
        this.logger.info(`[DEBUG] ContentStream iteration completed: ${chunkCount} chunks in ${streamDuration}ms`);
      } catch (streamError) {
        this.logger.error(`[DEBUG] Error collecting stream content: ${streamError}`);
        this.logger.error(`[DEBUG] Stack: ${(streamError as Error).stack}`);
      }

      finalContent = contentChunks.join("");
      this.logger.info(`[DEBUG] Streaming content collected: ${contentChunks.length} chunks, final content length: ${finalContent.length}`);
      this.logger.info(`Agent ${decision.agentId} streaming completed, total content length: ${finalContent.length}, chunks=${contentChunks.length}`);

      // 发送流式结束消息
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-stream-end",
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          requestId: context.messageId,
          agentId: decision.agentId,
          content: finalContent,
          metadata: agentResponse.metadata,
          audio: agentResponse.audio?.data,
          audioFormat: agentResponse.audio?.format,
        },
      });

      // 保存助手消息到短期记忆（即使内容为空也尝试保存，用于调试）
      this.logger.info(`[DEBUG] Preparing to save assistant message for agent ${decision.agentId}, contentLength=${finalContent?.length || 0}, senderId=${context.senderId}`);
      try {
        if (finalContent && finalContent.length > 0) {
          await this.agentManager.saveAssistantMessage(
            finalContent,
            context.senderId,
            context.channelType,
            !!agentResponse.audio
          );
          this.logger.info(`[DEBUG] Agent ${decision.agentId} assistant message saved to short-term memory successfully`);
        } else {
          this.logger.warn(`[DEBUG] Not saving assistant message: content is empty`);
        }
      } catch (saveError) {
        this.logger.error(`[DEBUG] Failed to save assistant message: ${saveError}`);
      }
    }

    // 如果不是流式响应，在这里保存助手消息
    if (!agentResponse.stream && finalContent) {
      this.logger.info(`Saving assistant message (non-streaming) for agent ${decision.agentId}, contentLength=${finalContent?.length || 0}`);
      try {
        await this.agentManager.saveAssistantMessage(
          finalContent,
          context.senderId,
          context.channelType,
          !!agentResponse.audio
        );
        this.logger.info(`Agent ${decision.agentId} assistant message saved to short-term memory (non-streaming) successfully`);
      } catch (saveError) {
        this.logger.error(`Failed to save assistant message (non-streaming): ${saveError}`);
      }
    } else if (!agentResponse.stream) {
      this.logger.info(`Not saving assistant message: stream=${agentResponse.stream}, finalContent=${finalContent?.length || 0}`);
    }

    const processingTime = Date.now() - startTime;
    this.logger.info(`Agent ${decision.agentId} processed message in ${processingTime}ms`);

    // 构建会话上下文
    const conversation: ConversationContext = {
      conversationId: context.chatId,
      contactId: context.senderId,
      agentId: decision.agentId,
      channelId: context.channelType,
      messages: [
        {
          id: `msg-${Date.now()}-user`,
          role: "user",
          content: context.body,
          contentType: "text",
          senderId: context.senderId,
          timestamp: context.timestamp,
        },
        {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: finalContent,
          contentType: "text",
          senderId: decision.agentId,
          timestamp: Date.now(),
        },
      ],
      state: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    // 构建 actions
    const actions = agentResponse.actions || [
      {
        type: "reply",
        payload: {
          text: finalContent,
        },
      },
    ];

    return {
      conversation,
      actions,
      audio: agentResponse.audio, // 传递音频输出
      metadata: {
        processingTime,
        model: agentResponse.metadata?.modelUsed,
        agentName: agentResponse.metadata?.agentName,
      },
    };
  }

  /**
   * 处理消息超时
   */
  private handleMessageTimeout(messageId: string): void {
    this.logger.error(`Message ${messageId} timed out`);
    this.processingMessages.delete(messageId);
    this.updateLoad();

    this.sendToMaster({
      id: this.generateMessageId(),
      type: "error",
      from: this.config.workerId,
      to: "master",
      timestamp: Date.now(),
      payload: {
        messageId,
        error: "Message processing timeout",
      },
    });
  }

  /**
   * 更新负载状态
   */
  private updateLoad(): void {
    this.currentLoad = this.processingMessages.size / this.config.maxConcurrency;
  }

  /**
   * 设置 IPC 消息处理
   */
  private setupIPC(): void {
    if (process.send) {
      process.on("message", (message: IPCMessage) => {
        this.handleMasterMessage(message);
      });
    }
  }

  /**
   * 处理 Master 消息
   */
  private handleMasterMessage(message: IPCMessage): void {
    this.logger.debug?.(`Received from master: ${message.type}`);

    switch (message.type) {
      case "inbound":
        this.handleInboundMessage(message);
        break;
      case "route-decision":
      case "route-response":
        this.handleRouteDecision(message);
        break;
      case "shutdown":
        this.stop();
        break;
      default:
        this.logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * 发送消息到 Master
   */
  private sendToMaster(message: IPCMessage): void {
    if (process.send) {
      process.send(message);
    }
  }

  /**
   * 发送系统消息到客户端
   */
  private sendSystemMessage(context: InboundMessageContext, content: string): void {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "outbound",
      from: this.config.workerId,
      to: "master",
      timestamp: Date.now(),
      payload: {
        channelName: context.channelType || "cradle",
        context: {
          messageId: this.generateMessageId(),
          clientId: context.senderId,
          agentId: "system",
          text: content,
          isThinking: true,
          thinkingSteps: content.split('\n').filter(s => s.trim()),
          timestamp: Date.now(),
        },
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
        from: this.config.workerId,
        to: "master",
        timestamp: Date.now(),
        payload: {
          status: this.processingMessages.size > 0 ? "busy" : "idle",
          load: this.currentLoad,
          processingCount: this.processingMessages.size,
        },
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `${this.config.workerId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 如果直接运行此文件，启动 Worker
if (import.meta.url === `file://${process.argv[1]}`) {
  const workerId = process.argv[2] || "worker-1";
  const worker = new GatewayWorker({ workerId });

  // 处理进程信号
  process.on("SIGTERM", async () => {
    await worker.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await worker.stop();
    process.exit(0);
  });

  // 启动
  worker.start().catch((error) => {
    console.error("Failed to start worker:", error);
    process.exit(1);
  });
}
