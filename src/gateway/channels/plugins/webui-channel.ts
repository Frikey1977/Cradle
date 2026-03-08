/**
 * WebUI Channel 实现
 * 通过 WebSocket 与前端通信
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { BaseChannel, type ChannelPluginOptions } from "../base-channel.js";
import type {
  ChatType,
  ChannelCapabilities,
  InboundMessageContext,
  OutboundMessageContext,
} from "../types.js";
import type { ProcessResult } from "../../core/types.js";

/**
 * WebSocket 消息格式
 */
interface WebSocketMessage {
  type: "message" | "typing" | "presence" | "ack" | "auth";
  payload: {
    messageId?: string;
    senderId?: string;
    senderName?: string;
    recipientId?: string;
    content?: string;
    timestamp?: number;
    replyToId?: string;
    token?: string;
    userId?: string;
    status?: string;
    // 语音识别结果
    isRecognitionResult?: boolean;
    recognizedText?: string;
    requestId?: string;
    // 入站消息字段
    audio?: string;
    audioFormat?: string;
    audioDuration?: number;
    images?: string[];
    stream?: boolean;
    thinkingMessage?: boolean;
    voiceResponse?: boolean;
    voice?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * WebSocket 客户端连接
 */
interface WebSocketClient {
  id: string;
  socket: WebSocket;
  userId?: string;
  userName?: string;
  isAuthenticated: boolean;
  connectedAt: number;
  lastPingAt: number;
}

/**
 * WebUI Channel 配置
 */
interface WebUIChannelConfig {
  /** WebSocket 端口 */
  port: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 连接超时（毫秒） */
  connectionTimeout?: number;
  /** 是否启用 CORS */
  cors?: boolean;
  /** 认证回调 */
  authHandler?: (token: string) => Promise<{ userId: string; userName?: string } | null>;
}

/**
 * 消息处理器回调
 */
type MessageHandler = (context: InboundMessageContext) => Promise<void>;

/**
 * WebUI Channel 实现
 */
export class WebUIChannel extends BaseChannel {
  private clients = new Map<string, WebSocketClient>();
  private wss?: WebSocketServer;
  private httpServer?: ReturnType<typeof createServer>;
  private heartbeatTimer?: NodeJS.Timeout;
  private configDetails: WebUIChannelConfig;
  private messageHandler?: MessageHandler;

  constructor(options: ChannelPluginOptions) {
    super(options);
    this.configDetails = (this.config as unknown as WebUIChannelConfig | undefined) ?? {
      port: 8080,
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      cors: true,
    };
  }

  getChannelType(): string {
    return "webui";
  }

  getCapabilities(): ChannelCapabilities {
    return {
      supportsRichText: true,
      supportsAttachments: true,
      supportsThreads: false,
      supportsReplies: true,
      supportsMessageEditing: true,
      supportsMessageDeletion: false,
      supportsReactions: false,
      supportsMentions: false,
      supportsDM: true,
      supportsGroups: false,
      supportsChannels: false,
      chatTypes: ["direct"],
      reply: true,
      edit: true,
      media: true,
      streaming: true,
    };
  }

  /**
   * 设置消息处理器
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  protected async onInitialize(): Promise<void> {
    // 创建 HTTP 服务器
    this.httpServer = createServer((req, res) => {
      // 处理 CORS
      if (this.configDetails.cors) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      }

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // 健康检查
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "ok",
          channel: "webui",
          connections: this.clients.size,
        }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    // 创建 WebSocket 服务器
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: "/ws",
    });

    // 监听连接
    this.wss.on("connection", (socket, req) => {
      const clientId = this.generateClientId();
      this.handleConnection(socket, clientId, req);
    });

    console.log(`[WebUI] WebSocket server initialized on port ${this.configDetails.port}`);
  }

  protected async onStart(): Promise<void> {
    if (!this.httpServer) {
      throw new Error("HTTP server not initialized");
    }

    // 启动 HTTP 服务器
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.listen(this.configDetails.port, () => {
        console.log(`[WebUI] Server started on port ${this.configDetails.port}`);
        resolve();
      });

      this.httpServer?.on("error", (err) => {
        reject(err);
      });
    });

    // 启动心跳
    this.startHeartbeat();

    // 启动连接清理
    this.startConnectionCleanup();
  }

  protected async onStop(): Promise<void> {
    // 停止心跳
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // 关闭所有客户端连接
    for (const client of this.clients.values()) {
      client.socket.close(1000, "Server shutting down");
    }
    this.clients.clear();

    // 关闭 WebSocket 服务器
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }

    // 关闭 HTTP 服务器
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer?.close(() => resolve());
      });
      this.httpServer = undefined;
    }

    console.log("[WebUI] Channel stopped");
  }

  async sendMessage(context: OutboundMessageContext): Promise<ProcessResult> {
    const startTime = Date.now();
    try {
      const client = this.findClientByUserId(context.to);
      if (!client) {
        return {
          success: false,
          error: {
            code: "CLIENT_NOT_FOUND",
            message: `Client not found: ${context.to}`,
          },
          processingTime: Date.now() - startTime,
        };
      }
      
      // 日志：语音识别结果
      if (context.isRecognitionResult) {
        console.log(`[WebUI] Sending recognition result to ${context.to}:`, context.recognizedText);
      }

      const message: WebSocketMessage = {
        type: "message",
        payload: {
          messageId: this.generateMessageId(),
          senderId: context.accountId ?? "agent",
          recipientId: context.to,
          content: context.text,
          timestamp: Date.now(),
          replyToId: context.replyToId ?? undefined,
          // 语音识别结果相关字段
          isRecognitionResult: context.isRecognitionResult,
          recognizedText: context.recognizedText,
          requestId: context.requestId,
        },
      };
      
      console.log(`[WebUI] Sending WebSocket message:`, JSON.stringify(message, null, 2));

      // 发送消息到客户端
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      } else {
        return {
          success: false,
          error: {
            code: "CLIENT_NOT_CONNECTED",
            message: `Client not connected: ${context.to}`,
          },
          processingTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SEND_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
        processingTime: Date.now() - startTime,
      };
    }
  }

  normalizeTarget(raw: string): string | undefined {
    // WebUI 目标地址格式: user:<userId>
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    if (trimmed.startsWith("user:")) {
      return trimmed;
    }

    // 纯用户ID，添加前缀
    return `user:${trimmed}`;
  }

  parseInboundMessage(raw: unknown): InboundMessageContext | undefined {
    try {
      const msg = raw as WebSocketMessage;

      if (msg.type !== "message" || !msg.payload) {
        return undefined;
      }

      const { payload } = msg;
      
      console.log(`[WebUI] parseInboundMessage - payload.messageId: ${payload.messageId}, generated: ${!payload.messageId}`);
      
      // 构建音频数据（如果有）
      let audio: { data: string; format: string; duration?: number } | undefined;
      if (payload.audio) {
        audio = {
          data: payload.audio,
          format: payload.audioFormat || "webm",
          duration: payload.audioDuration,
        };
      }

      return {
        messageId: payload.messageId ?? this.generateMessageId(),
        body: payload.content ?? "",
        senderId: payload.senderId ?? "unknown",
        senderName: payload.senderName,
        recipientId: payload.recipientId ?? "bot",
        chatId: payload.senderId ?? "unknown",
        chatType: "direct",
        channelType: "webui",
        accountId: this.channelId,
        replyToId: payload.replyToId,
        timestamp: payload.timestamp ?? Date.now(),
        wasMentioned: false,
        audio,
        images: payload.images,
        stream: payload.stream,
        thinkingMessage: payload.thinkingMessage,
        voiceResponse: payload.voiceResponse,
        voice: payload.voice,
        metadata: payload.metadata,
        raw: msg,
      };
    } catch {
      return undefined;
    }
  }

  formatOutboundMessage(context: OutboundMessageContext): WebSocketMessage {
    return {
      type: "message",
      payload: {
        messageId: this.generateMessageId(),
        senderId: context.accountId ?? "agent",
        recipientId: context.to,
        content: context.text,
        timestamp: Date.now(),
        replyToId: context.replyToId,
        // 语音识别结果相关字段
        isRecognitionResult: context.isRecognitionResult,
        recognizedText: context.recognizedText,
        requestId: context.requestId,
      },
    };
  }

  looksLikeTargetId(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    return trimmed.startsWith("user:") || /^[a-zA-Z0-9_-]+$/.test(trimmed);
  }

  /**
   * 处理新的 WebSocket 连接
   */
  private handleConnection(socket: WebSocket, clientId: string, req: unknown): void {
    console.log(`[WebUI] New connection: ${clientId}`);

    const client: WebSocketClient = {
      id: clientId,
      socket,
      isAuthenticated: false,
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // 监听消息
    socket.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        await this.handleClientMessage(client, message);
      } catch (error) {
        console.error(`[WebUI] Failed to parse message from ${clientId}:`, error);
        socket.send(JSON.stringify({
          type: "error",
          payload: { error: "Invalid message format" },
        }));
      }
    });

    // 监听关闭
    socket.on("close", (code, reason) => {
      console.log(`[WebUI] Connection closed: ${clientId}, code=${code}, reason=${reason}`);
      this.clients.delete(clientId);
    });

    // 监听错误
    socket.on("error", (error) => {
      console.error(`[WebUI] Socket error for ${clientId}:`, error);
      this.clients.delete(clientId);
    });

    // 发送欢迎消息
    socket.send(JSON.stringify({
      type: "ack",
      payload: {
        clientId,
        serverTime: Date.now(),
        message: "Connected to WebUI Channel",
      },
    }));
  }

  /**
   * 处理客户端消息
   */
  private async handleClientMessage(client: WebSocketClient, message: WebSocketMessage): Promise<void> {
    // 更新最后活动时间
    client.lastPingAt = Date.now();

    switch (message.type) {
      case "auth": {
        // 处理认证
        const token = message.payload?.token;
        if (token && this.configDetails.authHandler) {
          const authResult = await this.configDetails.authHandler(token);
          if (authResult) {
            client.userId = authResult.userId;
            client.userName = authResult.userName;
            client.isAuthenticated = true;
            client.socket.send(JSON.stringify({
              type: "ack",
              payload: { status: "authenticated", userId: authResult.userId },
            }));
          } else {
            client.socket.send(JSON.stringify({
              type: "error",
              payload: { error: "Authentication failed" },
            }));
          }
        } else {
          // 无认证，使用匿名
          client.userId = `anonymous_${client.id}`;
          client.isAuthenticated = true;
          client.socket.send(JSON.stringify({
            type: "ack",
            payload: { status: "connected", userId: client.userId },
          }));
        }
        break;
      }

      case "message": {
        // 处理消息
        if (!client.isAuthenticated) {
          client.socket.send(JSON.stringify({
            type: "error",
            payload: { error: "Not authenticated" },
          }));
          return;
        }

        // 设置发送者信息
        if (message.payload) {
          message.payload.senderId = client.userId;
          message.payload.senderName = client.userName;
        }

        const context = this.parseInboundMessage(message);
        if (context && this.messageHandler) {
          await this.messageHandler(context);
        }
        break;
      }

      case "typing": {
        // 处理打字指示
        // 可以广播给其他客户端
        break;
      }

      case "presence": {
        // 心跳响应
        client.socket.send(JSON.stringify({
          type: "presence",
          payload: { status: "pong", timestamp: Date.now() },
        }));
        break;
      }
    }
  }

  /**
   * 绑定用户ID到连接
   */
  bindUser(clientId: string, userId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.userId = userId;
      client.isAuthenticated = true;
      console.log(`[WebUI] Client ${clientId} bound to user ${userId}`);
    }
  }

  /**
   * 查找客户端
   */
  private findClientByUserId(userId: string): WebSocketClient | undefined {
    // 移除 user: 前缀
    const cleanUserId = userId.startsWith("user:") ? userId.slice(5) : userId;

    for (const client of this.clients.values()) {
      if (client.userId === cleanUserId || client.userId === userId) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `webui_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    const interval = this.configDetails.heartbeatInterval ?? 30000;
    this.heartbeatTimer = setInterval(() => {
      const heartbeatMessage: WebSocketMessage = {
        type: "presence",
        payload: {
          senderId: "server",
          recipientId: "all",
          content: "ping",
          timestamp: Date.now(),
        },
      };

      for (const client of this.clients.values()) {
        if (client.socket.readyState === WebSocket.OPEN) {
          try {
            client.socket.send(JSON.stringify(heartbeatMessage));
          } catch {
            // 客户端可能已断开
            this.clients.delete(client.id);
          }
        }
      }
    }, interval);
  }

  /**
   * 启动连接清理
   */
  private startConnectionCleanup(): void {
    const timeout = this.configDetails.connectionTimeout ?? 60000;
    setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPingAt > timeout) {
          console.log(`[WebUI] Connection timeout: ${clientId}`);
          client.socket.close(1001, "Connection timeout");
          this.clients.delete(clientId);
        }
      }
    }, 10000);
  }

  /**
   * 获取连接统计
   */
  getStats(): { total: number; authenticated: number } {
    let authenticated = 0;
    for (const client of this.clients.values()) {
      if (client.isAuthenticated) authenticated++;
    }
    return {
      total: this.clients.size,
      authenticated,
    };
  }
}

// 注册插件
import { ChannelPluginRegistry } from "../base-channel.js";

ChannelPluginRegistry.register("webui", (options) => new WebUIChannel(options));
