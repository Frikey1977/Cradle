/**
 * Cradle Channel 插件
 *
 * 处理内部客户端 (Cradle Web) 的 WebSocket 连接
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import jwt from "jsonwebtoken";
import {
  BaseChannelPlugin,
  type ChannelConfig,
} from "../channel-plugin.js";
import type {
  InboundMessageContext,
  OutboundMessageContext,
} from "../types.js";
import { query } from "../../../store/database.js";

/**
 * Cradle 客户端配置
 */
interface CradleClientConfig {
  token: string;
  enabled: boolean;
}

/**
 * Cradle Channel 配置
 */
interface CradleChannelConfig {
  clients: Record<string, CradleClientConfig>;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

/**
 * WebSocket 客户端连接
 */
interface CradleClient {
  id: string;
  socket: WebSocket;
  userId?: string;
  userName?: string;
  employeeId?: string;
  contactId?: string;
  clientType?: string;
  isAuthenticated: boolean;
  handshakeCompleted: boolean;
  connectedAt: number;
  lastPingAt: number;
}

/**
 * Cradle Channel 插件
 *
 * 处理 WebSocket 连接、握手、认证、消息收发
 */
export class CradleChannel extends BaseChannelPlugin {
  private wss?: WebSocketServer;
  private clients = new Map<string, CradleClient>();
  private channelConfig?: CradleChannelConfig;
  private heartbeatTimer?: NodeJS.Timeout;

  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  } = {
    info: (msg: string) => console.log(`[CradleChannel] ${msg}`),
    warn: (msg: string) => console.warn(`[CradleChannel] ${msg}`),
    error: (msg: string) => console.error(`[CradleChannel] ${msg}`),
    debug: (msg: string) => console.debug(`[CradleChannel] ${msg}`),
  };

  /**
   * 设置日志记录器
   */
  setLogger(logger: typeof this.logger): void {
    this.logger = logger;
  }

  getName(): string {
    return this.config?.name || "cradle";
  }

  getType(): string {
    return "cradle";
  }

  protected async onInitialize(): Promise<void> {
    if (!this.config) {
      throw new Error("Channel not configured");
    }

    // 解析配置
    const config = this.config.config as Record<string, unknown>;
    const clientConfig = (this.config.clientConfig || {}) as Record<
      string,
      { token: string; enabled: boolean }
    >;

    this.channelConfig = {
      clients: clientConfig,
      heartbeatInterval: (config.heartbeatInterval as number) || 30000,
      connectionTimeout: (config.connectionTimeout as number) || 60000,
    };

    this.logger.info(
      `Initialized with ${Object.keys(clientConfig).length} clients`,
    );
  }

  /**
   * 处理 WebSocket 连接升级
   */
  handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (!this.wss) {
      // 创建 WebSocketServer，但不监听端口（使用 handleUpgrade）
      this.wss = new WebSocketServer({ noServer: true });
      this.wss.on("connection", (ws, req) => {
        this.handleConnection(ws, req);
      });
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss?.emit("connection", ws, request);
    });
  }

  /**
   * 处理 Webhook 请求
   * Cradle Channel 不支持 Webhook
   */
  handleWebhook(): void {
    // Cradle Channel 只支持 WebSocket，不支持 Webhook
    throw new Error("CradleChannel does not support Webhook");
  }

  /**
   * 处理新的 WebSocket 连接
   */
  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    const clientId = this.generateId("ws");

    this.logger.info(`Client connected: ${clientId}`);

    const client: CradleClient = {
      id: clientId,
      socket,
      isAuthenticated: false,
      handshakeCompleted: false,
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // 监听消息
    socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(clientId, data);
    });

    // 监听关闭
    socket.on("close", () => {
      this.logger.info(`Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    // 监听错误
    socket.on("error", (error) => {
      this.logger.error(`WebSocket error for client ${clientId}: ${error}`);
    });

    // 发送连接成功消息
    socket.send(
      JSON.stringify({
        type: "connected",
        payload: { clientId },
      }),
    );

    // 启动心跳检查
    this.startHeartbeat();
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(
    clientId: string,
    data: Buffer | ArrayBuffer | Buffer[],
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // 统一处理 Buffer
      let buffer: Buffer;
      if (Array.isArray(data)) {
        buffer = Buffer.concat(data);
      } else if (Buffer.isBuffer(data)) {
        buffer = data;
      } else {
        buffer = Buffer.from(data);
      }

      const message = JSON.parse(buffer.toString());
      this.logger.debug?.(`Message from ${clientId}: ${message.type}`);

      switch (message.type) {
        case "handshake":
          this.handleHandshake(clientId, message.payload);
          break;
        case "auth":
          void this.handleAuth(clientId, message.payload);
          break;
        case "message":
        case "chat":
          this.handleChatMessage(clientId, message.payload);
          break;
        case "ping":
          client.lastPingAt = Date.now();
          client.socket.send(JSON.stringify({ type: "pong" }));
          break;
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message: ${error}`);
      client.socket.send(
        JSON.stringify({
          type: "error",
          payload: { error: "Invalid message format" },
        }),
      );
    }
  }

  /**
   * 处理握手
   */
  private handleHandshake(
    clientId: string,
    payload: { name?: string; client?: string; token?: string },
  ): void {
    const client = this.clients.get(clientId);
    if (!client || !this.channelConfig) return;

    const { name, client: clientType, token } = payload || {};

    // 验证参数 - Channel 插件自己处理
    if (!name || !clientType || !token) {
      client.socket.send(
        JSON.stringify({
          type: "handshake_error",
          payload: { error: "name, client and token are required" },
        }),
      );
      return;
    }

    // 验证 name 匹配
    if (name !== this.getName()) {
      client.socket.send(
        JSON.stringify({
          type: "handshake_error",
          payload: { error: `Invalid channel name: ${name}` },
        }),
      );
      return;
    }

    // 验证客户端配置
    const clientConfig = this.channelConfig.clients[clientType];
    if (!clientConfig) {
      client.socket.send(
        JSON.stringify({
          type: "handshake_error",
          payload: { error: `Client '${clientType}' not allowed` },
        }),
      );
      return;
    }

    if (!clientConfig.enabled) {
      client.socket.send(
        JSON.stringify({
          type: "handshake_error",
          payload: { error: `Client '${clientType}' is disabled` },
        }),
      );
      return;
    }

    if (token !== clientConfig.token) {
      client.socket.send(
        JSON.stringify({
          type: "handshake_error",
          payload: { error: "Invalid token" },
        }),
      );
      return;
    }

    // 握手成功
    client.handshakeCompleted = true;
    client.clientType = clientType;

    this.logger.info(`Handshake successful for ${clientType}`);

    client.socket.send(
      JSON.stringify({
        type: "handshake_success",
        payload: {
          name,
          client: clientType,
          sessionId: this.generateId("session"),
          serverTime: Date.now(),
          requiresAuth: true,
        },
      }),
    );
  }

  /**
   * 处理认证
   */
  private async handleAuth(
    clientId: string,
    payload: { token?: string },
  ): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 检查是否已完成握手
    if (!client.handshakeCompleted) {
      client.socket.send(
        JSON.stringify({
          type: "auth_error",
          payload: { error: "Handshake required before auth" },
        }),
      );
      return;
    }

    const { token } = payload || {};
    if (!token) {
      client.socket.send(
        JSON.stringify({
          type: "auth_error",
          payload: { error: "Token is required" },
        }),
      );
      return;
    }

    try {
      // 验证 JWT
      const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId?: string;
        username?: string;
        sub?: string;
        employeeId?: string;
      };

      const userId = decoded.userId || decoded.sub || "unknown";
      const userName = decoded.username || "Unknown User";
      const employeeId = decoded.employeeId;

      // 查询该用户在此通道中的专用名 (r_channel_contact.sender)
      let channelUserName = userName;
      if (employeeId) {
        try {
          const channelResult = await query<
            Array<{ sender: string }>
          >(
            `SELECT rcc.sender 
             FROM r_channel_contact rcc
             JOIN t_channels tc ON rcc.channel_id = tc.sid
             JOIN t_contacts c ON rcc.contact_id = c.sid
             WHERE tc.name = ? 
               AND c.source_id = ?
               AND tc.status = 'enabled'`,
            [this.getName(), employeeId]
          );
          if (channelResult.length > 0 && channelResult[0].sender) {
            channelUserName = channelResult[0].sender;
            this.logger.info(
              `Found channel-specific name for ${userName}: ${channelUserName}`
            );
          }
        } catch (err) {
          this.logger.warn(`Failed to query channel-specific name: ${err}`);
        }
      }

      // Channel 层只保存原始身份信息，不查询 contact
      // Contact 归一化由 Message Router 统一处理
      client.isAuthenticated = true;
      client.userId = userId; // 原始 userId
      client.userName = channelUserName; // 使用通道专用名
      client.employeeId = employeeId;
      // contactId 由 Message Router 查询后设置

      this.logger.info(
        `Client ${clientId} authenticated: userId=${userId}, employeeId=${employeeId}, channelName=${channelUserName}`
      );

      client.socket.send(
        JSON.stringify({
          type: "auth_success",
          payload: {
            userId,
            userName: client.userName,
            employeeId,
          },
        }),
      );
    } catch (error) {
      this.logger.warn(`Auth failed for client ${clientId}: ${error}`);
      client.socket.send(
        JSON.stringify({
          type: "auth_error",
          payload: { error: "Invalid or expired token" },
        }),
      );
    }
  }

  /**
   * 处理聊天消息
   */
  private handleChatMessage(
    clientId: string,
    payload: {
      content?: string;
      agentId?: string;
      audio?: string;
      audioFormat?: string;
      audioDuration?: number;
      images?: string[];
      stream?: boolean;
      thinkingMessage?: boolean;
      voiceResponse?: boolean;
      voice?: string; // 语音合成音色
      metadata?: Record<string, unknown>;
      messageId?: string; // 客户端消息ID，用于关联识别结果
    },
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 检查握手和认证
    if (!client.handshakeCompleted) {
      client.socket.send(
        JSON.stringify({
          type: "error",
          payload: { error: "Handshake required" },
        }),
      );
      return;
    }

    if (!client.isAuthenticated) {
      client.socket.send(
        JSON.stringify({
          type: "error",
          payload: { error: "Not authenticated" },
        }),
      );
      return;
    }

    const { content, agentId, audio, audioFormat, audioDuration, images, stream, thinkingMessage, voiceResponse, voice, metadata, messageId: clientMessageId } = payload || {};
    
    // 调试日志
    this.logger.info(`Received chat message - content: ${content?.substring(0, 50)}, audio: ${audio ? 'yes (' + audio.length + ' chars)' : 'no'}, images: ${images?.length || 0}, stream: ${stream}`);
    this.logger.info(`Features: stream=${stream}, thinkingMessage=${thinkingMessage}, voiceResponse=${voiceResponse}, voice=${voice}`);
    this.logger.info(`Full metadata: ${JSON.stringify(metadata)}`);
    this.logger.info(`Client messageId: ${clientMessageId}`);
    
    // 检查是否有内容、音频或图片
    if (!content && !audio && (!images || images.length === 0)) {
      client.socket.send(
        JSON.stringify({
          type: "error",
          payload: { error: "Message content, audio or images are required" },
        }),
      );
      return;
    }

    // 构建入站消息上下文
    // 使用 userName 作为 senderId，便于日志跟踪和调试
    const senderId = client.userName || client.userId || "unknown";
    const recipientId = agentId || "default-agent";
    
    const inbound: InboundMessageContext = {
      messageId: clientMessageId || this.generateId("msg"),
      channelType: "cradle",
      channelName: this.getName(),
      chatType: "direct",
      chatId: `cradle:${senderId}`,
      senderId: senderId,
      senderName: client.userName || "Unknown",
      recipientId: recipientId,
      body: content || "",
      timestamp: Date.now(),
      // 功能开关参数放到消息顶层
      stream,
      thinkingMessage,
      voiceResponse,
      voice,
      metadata: metadata || {},
    };

    // 添加音频数据
    if (audio) {
      inbound.audio = {
        data: audio,
        format: audioFormat || "webm",
        duration: audioDuration,
      };
    }

    // 添加图片数据
    if (images && images.length > 0) {
      inbound.images = images;
    }

    // 发送确认
    client.socket.send(
      JSON.stringify({
        type: "ack",
        payload: { messageId: inbound.messageId },
      }),
    );

    // 提交到消息队列（通过回调）
    this.onMessage?.(inbound, clientId);
  }

  /**
   * 发送消息到客户端
   */
  async sendMessage(context: OutboundMessageContext): Promise<void> {
    // 确定目标客户端ID - 使用 to 字段或从 originalContext 获取
    const targetId = context.to || context.originalContext?.senderId;
    
    if (!targetId) {
      this.logger.warn(`No target client specified in context`);
      return;
    }

    // 通过 clientId 或 userId/userName 查找客户端
    let client: CradleClient | undefined;
    
    // 首先尝试作为 clientId 查找
    client = this.clients.get(targetId);
    
    // 如果没找到，尝试通过 userId、userName 或 contactId 查找
    if (!client) {
      for (const c of this.clients.values()) {
        if (c.userId === targetId || 
            c.userName === targetId || 
            c.contactId === targetId) {
          client = c;
          break;
        }
      }
    }
    
    if (!client) {
      this.logger.warn(`Client ${targetId} not found`);
      return;
    }

    if (client.socket.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Client ${client.id} socket not open`);
      return;
    }

    // 获取消息内容 - 使用 text 字段
    const content = context.text || "";
    
    // 获取发送者ID - 从 originalContext 或默认值
    const senderId = context.originalContext?.recipientId || "agent";
    
    // 检查是否为系统消息/思考过程
    const isSystemMessage = (context as any).isSystemMessage || (context as any).isThinking;
    const thinkingSteps = (context as any).thinkingSteps;
    const isStreamChunk = (context as any).isStreamChunk;
    const isStreamEnd = (context as any).isStreamEnd;
    const isToolCall = (context as any).isToolCall;
    const isToolResult = (context as any).isToolResult;

    try {
      // 构建消息 payload
      // 对于语音识别结果消息，使用 requestId 作为消息 ID，以便前端正确匹配
      const messageId = context.isRecognitionResult && context.requestId 
        ? context.requestId 
        : this.generateId("msg");
      
      const payload: any = {
        id: messageId,
        content: content,
        sender: isSystemMessage ? "System" : "Agent",
        senderId: senderId,
        timestamp: Date.now(),
        replyTo: context.replyToId,
      };

      // 如果是系统消息/思考过程，添加标记
      if (isSystemMessage) {
        payload.isSystemMessage = true;
        payload.isThinking = true;
        if (thinkingSteps) {
          payload.thinkingSteps = thinkingSteps;
        }
      }

      // 如果是流式块，添加标记
      if (isStreamChunk) {
        payload.isStreamChunk = true;
      }

      // 如果是工具调用事件
      if (isToolCall) {
        payload.isToolCall = true;
        payload.toolCall = (context as any).toolCall;
      }

      // 如果是工具结果事件
      if (isToolResult) {
        payload.isToolResult = true;
        payload.toolResult = (context as any).toolResult;
      }

      // 如果有音频输出，添加到 payload
      if (context.audio) {
        payload.audio = context.audio.data;
        payload.audioFormat = context.audio.format;
        payload.audioDuration = context.audio.duration;
      }

      // 如果是语音识别结果消息，添加标记和识别文本
      if (context.isRecognitionResult) {
        payload.isRecognitionResult = true;
        payload.recognizedText = context.recognizedText;
        payload.requestId = context.requestId;
      }

      // 确定消息类型
      let messageType = "message";
      if (isSystemMessage) {
        messageType = "thinking";
      } else if (isToolCall) {
        messageType = "tool-call";
      } else if (isToolResult) {
        messageType = "tool-result";
      } else if (isStreamChunk) {
        messageType = "stream-chunk";
      } else if (isStreamEnd) {
        messageType = "stream-end";
      }

      const messageJson = JSON.stringify({
        type: messageType,
        payload: payload,
      });

      client.socket.send(messageJson);
    } catch (error) {
      this.logger.error(`Failed to send to client ${client.id}: ${error}`);
    }
  }

  /**
   * 启动心跳检查
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    const timeout = this.channelConfig?.connectionTimeout || 60000;

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPingAt > timeout) {
          this.logger.warn(`Client ${clientId} timed out`);
          client.socket.close();
          this.clients.delete(clientId);
        }
      }
    }, 30000);
  }

  /**
   * 停止心跳检查
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 消息回调
   */
  onMessage?: (
    message: InboundMessageContext,
    clientId: string,
  ) => void;

  /**
   * 关闭插件
   */
  async onShutdown(): Promise<void> {
    this.stopHeartbeat();

    // 关闭所有客户端连接
    for (const client of this.clients.values()) {
      client.socket.close();
    }
    this.clients.clear();

    this.logger.info("Shutdown complete");
  }
}
