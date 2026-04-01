/**
 * Agent Worker 进程管理
 *
 * 职责：
 * - Worker 进程生命周期管理
 * - IPC 通信管理
 * - 心跳管理
 * - 委托业务逻辑给 AgentMessageHandler
 */

import { AgentManager, type AgentManagerConfig } from "./agent-manager.js";
import type { AgentMessage } from "../types/index.js";
import { AgentMessageHandler, type HandlerConfig } from "./handler.js";
import path from "path";

/**
 * IPC 消息
 */
interface IPCMessage {
  id: string;
  type: string;
  payload: any;
}

/**
 * Agent Worker 进程
 */
class AgentWorker {
  private agentId: string;
  private agentManager?: AgentManager;
  private messageHandler?: AgentMessageHandler;
  private running = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒

  constructor() {
    this.agentId = process.env.AGENT_ID || "";

    if (!this.agentId) {
      throw new Error("AGENT_ID environment variable is required");
    }

    console.log(`[AgentWorker] Created for agent: ${this.agentId}`);
  }

  /**
   * 启动 Worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn(`[AgentWorker:${this.agentId}] Already running`);
      return;
    }

    console.log(`[AgentWorker:${this.agentId}] Starting...`);

    try {
      // 创建 AgentManager
      this.agentManager = new AgentManager({
        agentId: this.agentId,
        sendToMaster: (message) => this.sendToMaster(message),
      });

      // 初始化
      await this.agentManager.initialize();

      // 设置心跳消息推送回调（将心跳消息推送到前端）
      this.agentManager.setHeartbeatPushMessageCallback((data) => {
        console.log(`[AgentWorker:${this.agentId}] Pushing heartbeat message to contact ${data.contactId}`);
        this.sendToMaster({
          id: this.generateMessageId(),
          type: "heartbeat-push-message",
          payload: {
            agentId: this.agentId,
            agentName: data.agentName,
            contactId: data.contactId,
            content: data.content,
            timestamp: Date.now(),
          },
        });
      });

      // 设置 IPC 监听
      this.setupIPC();

      this.running = true;

      // 启动心跳
      this.startHeartbeat();

      // 通知 Master 就绪
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "worker-ready",
        payload: {
          agentId: this.agentId,
          status: "ready",
          timestamp: Date.now(),
        },
      });

      console.log(`[AgentWorker:${this.agentId}] Started successfully`);
    } catch (error) {
      console.error(`[AgentWorker:${this.agentId}] Failed to start:`, error);

      this.sendToMaster({
        id: this.generateMessageId(),
        type: "worker-error",
        payload: {
          agentId: this.agentId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * 停止 Worker
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log(`[AgentWorker:${this.agentId}] Stopping...`);

    this.running = false;

    // 停止心跳
    this.stopHeartbeat();

    // 停止 AgentManager
    if (this.agentManager) {
      await this.agentManager.stop();
    }

    console.log(`[AgentWorker:${this.agentId}] Stopped`);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    // 立即发送第一个心跳
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "heartbeat",
      payload: {
        agentId: this.agentId,
        timestamp: Date.now(),
      },
    });

    // 启动定时心跳
    this.heartbeatTimer = setInterval(() => {
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "heartbeat",
        payload: {
          agentId: this.agentId,
          timestamp: Date.now(),
        },
      });
    }, this.HEARTBEAT_INTERVAL);

    console.log(`[AgentWorker:${this.agentId}] Heartbeat started`);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
      console.log(`[AgentWorker:${this.agentId}] Heartbeat stopped`);
    }
  }

  /**
   * 处理入站消息
   */
  private async handleInboundMessage(message: IPCMessage): Promise<void> {
    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized`);
      return;
    }

    const { messageId, context } = message.payload;

    console.log(
      `[AgentWorker:${this.agentId}] Received inbound message: ${messageId}, ` +
      `audio: ${!!context.audio}, images: ${context.images?.length || 0}`
    );

    const stream = context.stream !== false;
    console.log(`[AgentWorker:${this.agentId}] Stream mode: ${stream}`);

    // 构建 AgentMessage
    const agentMessage: AgentMessage = {
      messageId: messageId || context.messageId,
      agentId: this.agentId,
      contactId: context.senderId,
      contactName: context.senderName,
      content: context.body,
      channelName: context.channelName || context.channelType,
      timestamp: context.timestamp,
      metadata: {
        channelType: context.channelType,
        channelName: context.channelName,
        chatType: context.chatType,
        chatId: context.chatId,
        senderName: context.senderName,
        recipientId: context.recipientId,
      },
      stream,
      voice: context.voice,
    };

    // 传递多媒体数据
    if (context.audio) {
      agentMessage.audio = context.audio;
      agentMessage.voiceResponse = context.voiceResponse !== false;
      agentMessage.voice = context.voice;
    }
    if (context.images && context.images.length > 0) {
      agentMessage.images = context.images;
    }

    // 获取 Agent 配置
    const agentConfig = (this.agentManager as any).agent?.getConfig?.();
    const modelConfig = agentConfig?.model || {
      provider: "openai",
      model: "gpt-3.5-turbo",
      parameters: { temperature: 0.7, maxTokens: 4096 },
    };
    const maxIterations = agentConfig?.maxIterations || 15;

    // 获取技能和工具
    const availableSkills = this.agentManager.getSkills();
    const availableTools = (this.agentManager as any).agent?.getTools?.() || [];

    // 构建 Handler 配置
    const handlerConfig: HandlerConfig = {
      agentId: this.agentId,
      agentName: this.agentManager.getAgentName(),
      workspaceDir: path.join(process.cwd(), "workspace", "agents", this.agentManager.getAgentEName() || this.agentId),
      preferredLanguage: agentMessage.preferredLanguage,
    };

    // 创建或复用 MessageHandler
    if (!this.messageHandler) {
      this.messageHandler = new AgentMessageHandler(
        this.agentManager,
        (msg) => this.sendToMaster(msg),
        handlerConfig
      );
    }

    try {
      await this.messageHandler.handleMessage(
        messageId,
        agentMessage,
        modelConfig,
        maxIterations,
        availableTools,
        availableSkills
      );
    } catch (error) {
      console.error(`[AgentWorker:${this.agentId}] Error handling message:`, error);
      this.sendError(messageId, error as Error);
    }
  }

  /**
   * 处理状态查询
   */
  private handleStatusQuery(): void {
    if (!this.agentManager) {
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-status",
        payload: {
          agentId: this.agentId,
          status: "not-initialized",
          timestamp: Date.now(),
        },
      });
      return;
    }

    const status = this.agentManager.getAgentStatus();

    this.sendToMaster({
      id: this.generateMessageId(),
      type: "agent-status",
      payload: {
        agentId: this.agentId,
        status: status?.status || "unknown",
        details: status,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 处理 LLM 响应（来自 Master）
   */
  private handleLLMResponse(message: IPCMessage): void {
    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized for LLM response`);
      return;
    }

    const llmClient = (this.agentManager as any).llmClient;
    if (llmClient && llmClient.handleResponse) {
      llmClient.handleResponse(message.payload);
    }
  }

  /**
   * 处理联系人语言更新
   */
  private handleUpdateContactLanguage(message: IPCMessage): void {
    const { contactId, language } = message.payload;
    console.log(`[AgentWorker:${this.agentId}] Updating contact ${contactId} language to ${language}`);

    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized for language update`);
      return;
    }

    this.agentManager.updateContactLanguage(contactId, language);
  }

  /**
   * 设置 IPC 监听
   */
  private setupIPC(): void {
    if (!process.send) {
      console.warn(`[AgentWorker:${this.agentId}] IPC not available`);
      return;
    }

    process.on("message", async (message: IPCMessage) => {
      await this.handleIPCMessage(message);
    });

    // 处理进程信号
    process.on("SIGTERM", () => {
      console.log(`[AgentWorker:${this.agentId}] Received SIGTERM`);
      this.stop().then(() => process.exit(0));
    });

    process.on("SIGINT", () => {
      console.log(`[AgentWorker:${this.agentId}] Received SIGINT`);
      this.stop().then(() => process.exit(0));
    });
  }

  /**
   * 处理 IPC 消息
   */
  private async handleIPCMessage(message: IPCMessage): Promise<void> {
    switch (message.type) {
      case "inbound":
        await this.handleInboundMessage(message);
        break;

      case "status-query":
        this.handleStatusQuery();
        break;

      case "stop":
        await this.stop();
        break;

      case "llm-response":
        this.handleLLMResponse(message);
        break;

      case "update-contact-language":
        this.handleUpdateContactLanguage(message);
        break;

      case "heartbeat-control":
        await this.handleHeartbeatControl(message);
        break;

      default:
        console.warn(`[AgentWorker:${this.agentId}] Unknown message type: ${message.type}`);
    }
  }

  /**
   * 处理心跳控制
   */
  private async handleHeartbeatControl(message: IPCMessage): Promise<void> {
    const { action, config } = message.payload;
    console.log(`[AgentWorker:${this.agentId}] Heartbeat control: ${action}`);

    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized for heartbeat control`);
      return;
    }

    const agent = (this.agentManager as any).agent;
    if (!agent) {
      console.error(`[AgentWorker:${this.agentId}] Agent not initialized for heartbeat control`);
      return;
    }

    switch (action) {
      case "start":
        console.log(`[AgentWorker:${this.agentId}] Calling agentManager.startHeartbeat()`);
        await this.agentManager.startHeartbeat();
        console.log(`[AgentWorker:${this.agentId}] agentManager.startHeartbeat() completed`);
        break;
      case "stop":
        await this.agentManager.stopHeartbeat();
        break;
      case "trigger":
        this.agentManager.triggerHeartbeat();
        break;
      case "update-config":
        if (config) {
          this.agentManager.updateHeartbeatConfig(config);
        }
        break;
      default:
        console.warn(`[AgentWorker:${this.agentId}] Unknown heartbeat action: ${action}`);
    }
  }

  /**
   * 发送消息给 Master
   */
  private sendToMaster(message: IPCMessage): void {
    if (process.send) {
      process.send(message);
    } else {
      console.log(`[AgentWorker:${this.agentId}] IPC not available, message:`, message);
    }
  }

  /**
   * 发送错误
   */
  private sendError(requestId: string, error: Error): void {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "agent-error",
      payload: {
        requestId,
        agentId: this.agentId,
        error: error.message,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 启动 Worker
 */
async function main(): Promise<void> {
  const worker = new AgentWorker();

  try {
    await worker.start();
  } catch (error) {
    console.error("[AgentWorker] Failed to start:", error);
    process.exit(1);
  }
}

// 启动
main();

export { AgentWorker };
