/**
 * Gateway Master 进程
 *
 * 采用单端口多路复用架构：
 * 1. 单一端口监听所有请求 (HTTP/WebSocket)
 * 2. URL 路径路由到对应 Channel 插件
 * 3. Channel 插件自治处理协议细节
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { fork, type ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { IPCMessage, ProcessStats, ProcessType } from "../ipc/types.js";
import type { InboundMessageContext, ChannelConfig } from "../channels/types.js";
import type { RouteDecision } from "./types.js";
import type { ChannelPlugin } from "../channels/channel-plugin.js";
import { CradleChannel } from "../channels/plugins/cradle-channel.js";
import { AgentRouter } from "../router/agent-router.js";
import { query } from "../../store/database.js";
import { LLMService } from "../../llm/service/llm-service.js";
import type { LLMIPCRequest, LLMIPCResponse } from "../../llm/service/ipc-protocol.js";
import type { StreamEvent } from "../../agent/runtime/llm-service-interface.js";
import {
  startBrowserControlServer,
  stopBrowserControlServer,
  type BrowserServerState,
} from "../../agent/browser/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Master 进程配置
 */
export interface MasterConfig {
  /** HTTP 端口 */
  port: number;
  /** Worker 进程数 */
  workerCount: number;
  /** 心跳超时（毫秒） */
  heartbeatTimeout: number;
  /** 消息队列最大长度 */
  maxQueueSize: number;
  /** Webhook 路径前缀 */
  webhookPathPrefix?: string;
}

/**
 * Worker 进程信息
 */
interface WorkerInfo {
  id: string;
  agentId: string;
  process: ChildProcess;
  status: "idle" | "busy" | "error";
  lastHeartbeat: number;
  messageCount: number;
  currentLoad: number;
}

/**
 * 待处理消息
 */
interface QueuedMessage {
  id: string;
  context: InboundMessageContext;
  channelConfig: ChannelConfig;
  enqueueTime: number;
  retryCount: number;
}

/**
 * 进行中的消息（等待 Agent 响应）
 */
interface PendingMessage {
  messageId: string;
  channelName: string;
  clientId?: string;
  enqueueTime: number;
  startTime: number;  // Agent 开始处理的时间
  thinkingMessage?: boolean;  // 是否显示思考过程
}

// 全局 GatewayMaster 实例引用
let globalGatewayMaster: GatewayMaster | null = null;

/**
 * 获取全局 GatewayMaster 实例
 */
export function getGlobalGatewayMaster(): GatewayMaster | null {
  return globalGatewayMaster;
}

/**
 * Gateway Master 进程
 */
export class GatewayMaster {
  private config: MasterConfig;
  private workers = new Map<string, WorkerInfo>();
  private messageQueue: QueuedMessage[] = [];
  private pendingMessages = new Map<string, PendingMessage>();
  private server?: ReturnType<typeof createServer>;
  private running = false;
  private browserServerState?: BrowserServerState;

  /** Channel 插件实例 */
  private channelPlugins = new Map<string, ChannelPlugin>();

  /** 消息路由器 */
  private agentRouter: AgentRouter;

  /** LLM 服务 */
  private llmService?: LLMService;

  /** 期望的 Agent 数量（用于 Worker 检查） */
  private expectedAgentCount = 0;
  
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  };
  
  private heartbeatTimer?: NodeJS.Timeout;
  private processCheckTimer?: NodeJS.Timeout;
  private dispatchTimer?: NodeJS.Timeout;

  constructor(config: Partial<MasterConfig> = {}) {
    // 设置全局实例
    globalGatewayMaster = this;

    this.config = {
      port: config.port ?? 3000,
      workerCount: config.workerCount ?? 4,
      heartbeatTimeout: config.heartbeatTimeout ?? 60000, // 60秒超时
      maxQueueSize: config.maxQueueSize ?? 10000,
    };

    this.logger = {
      info: (msg: string) => console.log(`[Master] ${msg}`),
      warn: (msg: string) => console.warn(`[Master] ${msg}`),
      error: (msg: string) => console.error(`[Master] ${msg}`),
      debug: (msg: string) => console.debug(`[Master] ${msg}`),
    };

    // 初始化消息路由器
    this.agentRouter = new AgentRouter();
  }

  /**
   * 设置日志记录器
   */
  setLogger(logger: typeof this.logger): void {
    this.logger = logger;
  }

  /**
   * 注册 Channel 插件
   */
  registerChannel(name: string, plugin: ChannelPlugin): void {
    this.channelPlugins.set(name, plugin);
    this.logger.info(`Registered channel plugin: ${name}`);
  }

  /**
   * 加载并初始化 Channel 插件
   */
  private async loadChannelPlugins(): Promise<void> {
    // TODO: 从数据库加载通道配置
    // 目前先硬编码 Cradle Channel
    
    const cradleConfig: ChannelConfig = {
      name: "cradle",
      type: "cradle",
      enabled: true,
      config: {
        heartbeatInterval: 30000,
        connectionTimeout: 60000,
      },
      clientConfig: {
        "cradle-web": {
          token: "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab",
          enabled: true,
        },
        "cradle-mobile": {
          token: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
          enabled: true,
        },
      },
    };

    const cradleChannel = new CradleChannel();
    await cradleChannel.initialize(cradleConfig);
    
    // 设置消息回调
    cradleChannel.onMessage = (message, clientId) => {
      // 将 clientId 保存到 message metadata 中
      message.metadata = {
        ...message.metadata,
        clientId,
      };
      this.handleInboundMessage(message, cradleConfig);
    };
    
    this.registerChannel("cradle", cradleChannel);
  }

  /**
   * 启动 Master 进程
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn("Already running");
      return;
    }

    this.logger.info("Starting Gateway Master...");

    try {
      // 1. 初始化 LLM 服务（必须在Worker之前）
      this.llmService = new LLMService();
      await this.llmService.initialize();

      // 2. 启动浏览器控制服务
      await this.startBrowserControlService();

      // 3. 加载并初始化 Channel 插件
      await this.loadChannelPlugins();

      // 4. 启动 Worker 进程
      await this.startWorkers();

      // 5. 启动 HTTP 服务器（单一端口）
      await this.startHTTPServer();

      // 6. 启动定时任务
      this.startTimers();

      this.running = true;
      this.logger.info(`Started on port ${this.config.port}`);
    } catch (error) {
      this.logger.error(`Failed to start: ${String(error)}`);
      throw error;
    }
  }

  /**
   * 停止 Master 进程
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info("Stopping...");

    // 停止定时器
    this.stopTimers();

    // 关闭所有 Channel 插件
    for (const [name, plugin] of this.channelPlugins.entries()) {
      this.logger.info(`Shutting down channel: ${name}`);
      await plugin.shutdown();
    }
    this.channelPlugins.clear();

    // 关闭 HTTP 服务器
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = undefined;
    }

    // 停止所有 Worker
    for (const worker of this.workers.values()) {
      worker.process.kill("SIGTERM");
      this.logger.info(`Stopping worker ${worker.id}`);
    }
    this.workers.clear();

    // 停止浏览器控制服务
    await this.stopBrowserControlService();

    this.running = false;
    this.logger.info("Stopped");
  }

  /**
   * 启动浏览器控制服务
   */
  private async startBrowserControlService(): Promise<void> {
    try {
      const state = await startBrowserControlServer({
        onWarn: (msg) => this.logger.warn(msg),
      });
      
      if (state) {
        this.browserServerState = state;
        this.logger.info(`Browser control service started on port ${state.port}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to start browser control service: ${error}`);
      // 浏览器控制服务启动失败不影响主服务
    }
  }

  /**
   * 停止浏览器控制服务
   */
  private async stopBrowserControlService(): Promise<void> {
    if (this.browserServerState) {
      try {
        await stopBrowserControlServer();
        this.logger.info("Browser control service stopped");
      } catch (error) {
        this.logger.warn(`Failed to stop browser control service: ${error}`);
      }
      this.browserServerState = undefined;
    }
  }

  /**
   * 启动 HTTP 服务器（单一端口多路复用）
   */
  private async startHTTPServer(): Promise<void> {
    this.logger.info(`Starting HTTP server on port ${this.config.port}...`);

    this.server = createServer((req, res) => {
      this.handleHTTPRequest(req, res);
    });

    // 监听 WebSocket 升级事件
    this.server.on("upgrade", (request, socket, head) => {
      this.handleWebSocketUpgrade(request, socket, head);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(this.config.port, () => {
        this.logger.info("HTTP server started with WebSocket support");
        resolve();
      });

      this.server?.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * 处理 HTTP 请求（URL 路由）
   */
  private async handleHTTPRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? "";
    const method = req.method ?? "GET";

    // 设置 CORS 头
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // 健康检查
    if (url === "/health") {
      const stats = this.getStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        timestamp: Date.now(),
        stats,
      }));
      return;
    }

    // Webhook 路由: /webhook/:channelName
    if (url.startsWith("/webhook/")) {
      const channelName = url.replace("/webhook/", "").split("/")[0];
      const plugin = this.channelPlugins.get(channelName);
      
      if (plugin) {
        try {
          plugin.handleWebhook(req, res);
        } catch (error) {
          this.logger.error(`Channel ${channelName} handleWebhook error: ${error}`);
          res.writeHead(500);
          res.end("Internal server error");
        }
      } else {
        res.writeHead(404);
        res.end(`Channel '${channelName}' not found`);
      }
      return;
    }

    // API 路由: /api/contact/:sid/language
    if (url.startsWith("/api/contact/") && url.endsWith("/language") && method === "POST") {
      await this.handleContactLanguageUpdate(req, res, url);
      return;
    }

    // API 路由: /api/agent/:agentId/heartbeat/control
    if (url.startsWith("/api/agent/") && url.endsWith("/heartbeat/control") && method === "POST") {
      await this.handleHeartbeatControl(req, res, url);
      return;
    }

    // API 路由: /api/agent/:agentId/client/register
    if (url.startsWith("/api/agent/") && url.endsWith("/client/register") && method === "POST") {
      await this.handleClientRegister(req, res, url);
      return;
    }

    // API 路由: /api/agent/:agentId/client/unregister
    if (url.startsWith("/api/agent/") && url.endsWith("/client/unregister") && method === "POST") {
      await this.handleClientUnregister(req, res, url);
      return;
    }

    // API 路由: /api/agent/:agentId/raw-context
    if (url.startsWith("/api/agent/") && url.endsWith("/raw-context") && method === "GET") {
      await this.handleRawContextRequest(req, res, url);
      return;
    }

    // 404
    res.writeHead(404);
    res.end("Not found");
  }

  /**
   * 处理心跳控制请求
   */
  private async handleHeartbeatControl(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): Promise<void> {
    try {
      // 解析 URL: /api/agent/:agentId/heartbeat/control
      const urlParts = url.split("/");
      const agentId = urlParts[3]; // ["", "api", "agent", ":agentId", "heartbeat", "control"]

      if (!agentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing agent ID" }));
        return;
      }

      // 读取请求体
      const body = await new Promise<string>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });

      const { action, config } = JSON.parse(body);

      if (!action) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing action" }));
        return;
      }

      this.logger.info(`Heartbeat control: ${action} for agent ${agentId}`);

      // 找到对应的 Worker
      const workerId = `worker-${agentId}`;
      const worker = this.workers.get(workerId);

      if (!worker) {
        this.logger.warn(`Worker ${workerId} not found`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Agent ${agentId} not found or not running` }));
        return;
      }

      // 发送心跳控制消息给 Worker
      console.log(`[Master] Sending heartbeat-control message to worker ${worker.id}, action=${action}`);
      worker.process.send({
        type: "heartbeat-control",
        payload: {
          action,
          config,
        },
      });
      console.log(`[Master] heartbeat-control message sent`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        agentId,
        action,
        timestamp: Date.now(),
      }));
    } catch (error) {
      this.logger.error(`Failed to handle heartbeat control: ${error}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * 处理客户端注册请求
   */
  private async handleClientRegister(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): Promise<void> {
    try {
      // 解析 URL: /api/agent/:agentId/client/register
      const urlParts = url.split("/");
      const agentId = urlParts[3]; // ["", "api", "agent", ":agentId", "client", "register"]

      if (!agentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing agent ID" }));
        return;
      }

      // 读取请求体
      const body = await new Promise<string>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });

      const { contactId } = JSON.parse(body);

      if (!contactId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing contactId" }));
        return;
      }

      this.logger.info(`[handleClientRegister] Registering client for agent ${agentId}: contactId=${contactId}`);

      // 找到对应的 Worker
      const workerId = `worker-${agentId}`;
      const worker = this.workers.get(workerId);

      if (!worker) {
        this.logger.warn(`[handleClientRegister] Worker ${workerId} not found`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Agent ${agentId} not found or not running` }));
        return;
      }

      // 发送客户端注册消息给 Worker
      console.log(`[Master] Sending client-register message to worker ${worker.id}, contactId=${contactId}`);
      worker.process.send({
        type: "client-register",
        payload: {
          contactId,
        },
      });
      console.log(`[Master] client-register message sent`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        agentId,
        contactId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      this.logger.error(`Failed to handle client register: ${error}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * 处理客户端注销请求
   */
  private async handleClientUnregister(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): Promise<void> {
    try {
      // 解析 URL: /api/agent/:agentId/client/unregister
      const urlParts = url.split("/");
      const agentId = urlParts[3]; // ["", "api", "agent", ":agentId", "client", "unregister"]

      if (!agentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing agent ID" }));
        return;
      }

      // 读取请求体
      const body = await new Promise<string>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });

      const { contactId } = JSON.parse(body);

      if (!contactId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing contactId" }));
        return;
      }

      this.logger.info(`[handleClientUnregister] Unregistering client for agent ${agentId}: contactId=${contactId}`);

      // 找到对应的 Worker
      const workerId = `worker-${agentId}`;
      const worker = this.workers.get(workerId);

      if (!worker) {
        this.logger.warn(`[handleClientUnregister] Worker ${workerId} not found`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Agent ${agentId} not found or not running` }));
        return;
      }

      // 发送客户端注销消息给 Worker
      console.log(`[Master] Sending client-unregister message to worker ${worker.id}, contactId=${contactId}`);
      worker.process.send({
        type: "client-unregister",
        payload: {
          contactId,
        },
      });
      console.log(`[Master] client-unregister message sent`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        agentId,
        contactId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      this.logger.error(`Failed to handle client unregister: ${error}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * 处理原始上下文请求
   */
  private async handleRawContextRequest(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): Promise<void> {
    try {
      // 解析 URL: /api/agent/:agentId/raw-context
      const urlParts = url.split("/");
      const agentId = urlParts[3]; // ["", "api", "agent", ":agentId", "raw-context"]

      if (!agentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing agent ID" }));
        return;
      }

      // 从查询参数获取 contactId 和 conversationId（可选）
      const queryString = url.split("?")[1] || "";
      const params = new URLSearchParams(queryString);
      const contactId = params.get("contactId") || "";
      const conversationId = params.get("conversationId") || undefined;

      this.logger.info(`Raw context request: agent=${agentId}, contact=${contactId}`);

      // 找到对应的 Worker
      const workerId = `worker-${agentId}`;
      const worker = this.workers.get(workerId);

      if (!worker) {
        this.logger.warn(`Worker ${workerId} not found`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Agent ${agentId} not found or not running` }));
        return;
      }

      // 创建请求 ID 用于关联响应
      const requestId = `raw-context-${Date.now()}`;

      // 发送获取原始上下文消息给 Worker
      const message: IPCMessage = {
        id: requestId,
        type: "get-raw-context",
        from: "master",
        to: workerId,
        timestamp: Date.now(),
        payload: {
          agentId,
          contactId,
          conversationId,
        },
      };

      // 等待 Worker 响应
      const response = await this.sendToWorkerAndWait(worker, message, 30000);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        data: response.payload,
      }));
    } catch (error) {
      this.logger.error(`Failed to handle raw context request: ${error}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * 发送消息给 Worker 并等待响应
   */
  private sendToWorkerAndWait(worker: WorkerInfo, message: IPCMessage, timeout: number): Promise<IPCMessage> {
    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        reject(new Error("Worker response timeout"));
      }, timeout);

      // 临时设置响应处理器
      const responseHandler = (response: IPCMessage) => {
        if (response.id === message.id || (response.payload as any)?.requestId === message.id) {
          clearTimeout(timeoutTimer);
          worker.process.off("message", responseHandler);
          resolve(response);
        }
      };

      worker.process.on("message", responseHandler);
      worker.process.send(message);
    });
  }

  /**
   * 处理联系人语言更新请求
   */
  private async handleContactLanguageUpdate(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
  ): Promise<void> {
    try {
      // 解析 URL: /api/contact/:sid/language
      const urlParts = url.split("/");
      const sid = urlParts[3]; // ["", "api", "contact", ":sid", "language"]

      if (!sid) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing contact ID" }));
        return;
      }

      // 读取请求体
      const body = await new Promise<string>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });

      const { language, agentId } = JSON.parse(body);

      if (!language || !agentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing language or agentId" }));
        return;
      }

      this.logger.info(`Updating contact ${sid} language to ${language} for agent ${agentId}`);

      // 找到对应的 Worker
      const workerId = `worker-${agentId}`;
      const worker = this.workers.get(workerId);

      if (!worker) {
        this.logger.warn(`Worker ${workerId} not found`);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Agent ${agentId} not found` }));
        return;
      }

      // 发送语言更新消息给 Worker
      worker.process.send({
        type: "update-contact-language",
        payload: {
          contactId: sid,
          language,
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        contactId: sid,
        agentId,
        language,
        timestamp: Date.now(),
      }));
    } catch (error) {
      this.logger.error(`Failed to update contact language: ${error}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  /**
   * 处理 WebSocket 升级（URL 路由）
   */
  private handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: import("stream").Duplex,
    head: Buffer,
  ): void {
    const url = request.url ?? "";

    // WebSocket 路由: /ws/:channelName
    if (url.startsWith("/ws/")) {
      const channelName = url.replace("/ws/", "").split("/")[0];
      const plugin = this.channelPlugins.get(channelName);

      if (plugin) {
        try {
          plugin.handleWebSocketUpgrade(request, socket, head);
        } catch (error) {
          this.logger.error(`Channel ${channelName} handleWebSocketUpgrade error: ${error}`);
          socket.destroy();
        }
      } else {
        this.logger.warn(`WebSocket upgrade failed: Channel '${channelName}' not found`);
        socket.destroy();
      }
      return;
    }

    // 未知路径
    this.logger.warn(`WebSocket upgrade failed: Unknown path '${url}'`);
    socket.destroy();
  }

  /**
   * 处理入站消息
   * 由 Channel 插件调用
   */
  async handleInboundMessage(
    context: InboundMessageContext,
    channelConfig: ChannelConfig,
  ): Promise<{ success: boolean; messageId: string; queued: boolean }> {
    const messageId = context.messageId;
    const originalSenderId = context.senderId;
    const startTime = Date.now();
    let stepStartTime = startTime;

    this.logger.info(`Received message ${messageId} from ${context.senderId}, audio: ${!!context.audio}, images: ${context.images?.length || 0}`);

    // 步骤 1: 发送系统消息 - 消息已接收
    await this.sendSystemMessage(originalSenderId, context, channelConfig, 
      `📨 消息已接收 (ID: ${messageId.slice(-8)})\n发送者: ${originalSenderId}\n⏱️ 0ms`);

    // 检查队列长度
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.logger.warn(`Message queue full, dropping message ${messageId}`);
      await this.sendSystemMessage(originalSenderId, context, channelConfig, 
        `❌ 消息队列已满，消息被丢弃\n⏱️ ${Date.now() - stepStartTime}ms`);
      throw new Error("Message queue full");
    }

    // 使用 Message Router 进行身份归一化和 Agent 路由
    let agentName = "Unknown";
    try {
      // 步骤 2: 发送系统消息 - 正在解析身份
      await this.sendSystemMessage(originalSenderId, context, channelConfig, 
        `🔍 正在解析身份...\n通道: ${channelConfig.name}\n⏱️ ${Date.now() - stepStartTime}ms`);
      stepStartTime = Date.now();

      this.logger.info(`Before route - context.audio: ${!!context.audio}, context.images: ${context.images?.length || 0}, context.voice: ${context.voice}`);
        const agentMessage = await this.agentRouter.route(
        context,
        channelConfig.name
      );
        this.logger.info(`After route - agentMessage.audio: ${!!agentMessage.audio}, agentMessage.images: ${agentMessage.images?.length || 0}`);

      // 查询 Agent 名称
      try {
        const agentResult = await query<{ name: string }[]>(
          "SELECT name FROM t_agents WHERE sid = ? AND deleted = 0",
          [agentMessage.agentId]
        );
        if (agentResult.length > 0) {
          agentName = agentResult[0].name;
        }
      } catch {
        // 忽略查询失败
      }

      // 更新上下文中的 senderId 为 contactId（归一化后）
      context.senderId = agentMessage.contactId;
      
      // 如果消息指定了 agentId，更新 recipientId
      if (agentMessage.agentId) {
        context.recipientId = agentMessage.agentId;
      }

      // 保存 agentMessage 到 metadata 供后续使用
      context.metadata = {
        ...context.metadata,
        agentMessage,
      };
      
      // 确保音频和图片数据在 context 中
      if (agentMessage.audio && !context.audio) {
        this.logger.info(`Copying audio from agentMessage to context`);
        context.audio = agentMessage.audio;
      }
      if (agentMessage.images && !context.images) {
        this.logger.info(`Copying images from agentMessage to context`);
        context.images = agentMessage.images;
      }

      // 步骤 3: 发送系统消息 - 身份解析完成
      await this.sendSystemMessage(originalSenderId, context, channelConfig, 
        `✅ 身份解析完成\nContact: ${agentMessage.contactId.slice(0, 8)}...\nAgent: ${agentName}\n⏱️ ${Date.now() - stepStartTime}ms`);
      stepStartTime = Date.now();

      this.logger.info(
        `Message ${messageId} routed: contact=${agentMessage.contactId}, agent=${agentMessage.agentId}`
      );
    } catch (error) {
      this.logger.error(`Failed to route message ${messageId}: ${error}`);
      await this.sendSystemMessage(originalSenderId, context, channelConfig, 
        `❌ 身份解析失败: ${error}\n⏱️ ${Date.now() - stepStartTime}ms`);
      throw error;
    }

    // 加入队列
    const queuedMessage: QueuedMessage = {
      id: messageId,
      context,
      channelConfig,
      enqueueTime: Date.now(),
      retryCount: 0,
    };

    this.messageQueue.push(queuedMessage);

    // 步骤 4: 发送系统消息 - 消息已入队
    await this.sendSystemMessage(originalSenderId, context, channelConfig, 
      `📥 消息已入队 (队列长度: ${this.messageQueue.length})\n⏱️ ${Date.now() - stepStartTime}ms`);
    stepStartTime = Date.now();

    // 立即尝试分发
    this.dispatchMessages();

    // 步骤 5: 发送系统消息 - 正在分发给 Agent
    await this.sendSystemMessage(originalSenderId, context, channelConfig, 
      `🚀 正在分发给 Agent [${agentName}] 处理...\n⏱️ ${Date.now() - stepStartTime}ms`);

    return {
      success: true,
      messageId,
      queued: true,
    };
  }

  /**
   * 发送系统消息到客户端
   * @param targetId 目标客户端ID（通道专用名）
   * @param originalContext 原始消息上下文
   * @param channelConfig 通道配置
   * @param text 系统消息文本
   */
  private async sendSystemMessage(
    targetId: string,
    originalContext: InboundMessageContext,
    channelConfig: ChannelConfig,
    text: string
  ): Promise<void> {
    // 检查是否开启了思考过程显示
    if (originalContext.thinkingMessage === false) {
      return;
    }

    try {
      const plugin = this.channelPlugins.get(channelConfig.name);
      if (!plugin) {
        this.logger.warn(`Channel '${channelConfig.name}' not found for system message`);
        return;
      }

      // 构建系统消息上下文
      const systemMessage = {
        to: targetId,  // 使用原始通道专用名作为目标
        text: text,
        channelType: originalContext.channelType,
        chatType: originalContext.chatType,
        // 标记为系统消息/思考过程，供前端特殊处理
        isSystemMessage: true,
        isThinking: true,
        thinkingSteps: text.split('\n').filter(line => line.trim()),
        originalContext: {
          ...originalContext,
          isSystemMessage: true,
          isThinking: true,
        },
      };

      await plugin.sendMessage(systemMessage as any);
    } catch (error) {
      this.logger.warn(`Failed to send system message: ${error}`);
      // 系统消息发送失败不影响主流程
    }
  }

  /**
   * 启动 Worker 进程
   * 每个 Agent 对应一个 Worker
   */
  private async startWorkers(): Promise<void> {
    // 从数据库加载所有启用的 Agent
    const agents = await this.loadAgentsFromDatabase();
    this.logger.info(`Found ${agents.length} agents in database`);

    if (agents.length === 0) {
      this.logger.warn("No agents found in database, workers will not be started");
      return;
    }

    // 设置期望的 Agent 数量
    this.expectedAgentCount = agents.length;

    const workerScript = join(__dirname, "..", "..", "agent", "runtime", "worker.ts");

    for (const agent of agents) {
      const workerId = `worker-${agent.sid}`;

      this.logger.info(`Starting worker for agent: ${agent.name} (${agent.sid})`);

      // 使用 child_process.fork 创建 Worker，传入 AGENT_ID
      // 使用 tsx 运行 TypeScript 文件
      const workerProcess = fork(workerScript, [], {
        stdio: ["inherit", "inherit", "inherit", "ipc"],
        execArgv: ["--import", "tsx"],
        env: {
          ...process.env,
          AGENT_ID: agent.sid,
        },
      });

      const workerInfo: WorkerInfo = {
        id: workerId,
        agentId: agent.sid,
        process: workerProcess,
        status: "idle",
        lastHeartbeat: Date.now(),
        messageCount: 0,
        currentLoad: 0,
      };

      // 监听 Worker 消息
      workerProcess.on("message", (message: IPCMessage) => {
        this.handleWorkerMessage(workerId, message);
      });

      // 监听 Worker 退出
      workerProcess.on("exit", (code) => {
        this.logger.warn(`Worker ${workerId} exited with code ${code}`);
        this.workers.delete(workerId);
        // TODO: 实际实现中需要重启 Worker
      });

      this.workers.set(workerId, workerInfo);
      this.logger.info(`Worker ${workerId} started (PID: ${workerProcess.pid})`);
    }

    this.logger.info(`Started ${this.workers.size} workers for ${agents.length} agents`);
  }

  /**
   * 启动单个 Agent 的 Worker
   * @param agentId Agent ID
   * @returns 是否成功启动
   */
  public async startAgentWorker(agentId: string): Promise<boolean> {
    // 检查是否已存在该 Agent 的 Worker
    for (const worker of this.workers.values()) {
      if (worker.agentId === agentId) {
        this.logger.info(`Worker for agent ${agentId} already exists`);
        return true;
      }
    }

    // 从数据库加载 Agent 信息
    try {
      const rows = await query<Array<{ sid: string; name: string }>>(
        `SELECT sid, name FROM t_agents WHERE sid = ? AND deleted = 0 AND status = 'enabled'`,
        [agentId]
      );

      if (rows.length === 0) {
        this.logger.error(`Agent ${agentId} not found or not enabled`);
        return false;
      }

      const agent = rows[0];
      const workerId = `worker-${agent.sid}`;

      this.logger.info(`Starting worker for new agent: ${agent.name} (${agent.sid})`);

      const workerScript = join(__dirname, "..", "..", "agent", "runtime", "worker.ts");

      // 使用 child_process.fork 创建 Worker，传入 AGENT_ID
      // 使用 tsx 运行 TypeScript 文件
      const workerProcess = fork(workerScript, [], {
        stdio: ["inherit", "inherit", "inherit", "ipc"],
        execArgv: ["--import", "tsx"],
        env: {
          ...process.env,
          AGENT_ID: agent.sid,
        },
      });

      const workerInfo: WorkerInfo = {
        id: workerId,
        agentId: agent.sid,
        process: workerProcess,
        status: "idle",
        lastHeartbeat: Date.now(),
        messageCount: 0,
        currentLoad: 0,
      };

      // 监听 Worker 消息
      workerProcess.on("message", (message: IPCMessage) => {
        this.handleWorkerMessage(workerId, message);
      });

      // 监听 Worker 退出
      workerProcess.on("exit", (code) => {
        this.logger.warn(`Worker ${workerId} exited with code ${code}`);
        this.workers.delete(workerId);
      });

      this.workers.set(workerId, workerInfo);
      this.expectedAgentCount++;

      this.logger.info(`Worker ${workerId} started (PID: ${workerProcess.pid})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to start worker for agent ${agentId}: ${error}`);
      return false;
    }
  }

  /**
   * 从数据库加载 Agent 列表
   */
  private async loadAgentsFromDatabase(): Promise<Array<{ sid: string; name: string }>> {
    try {
      const rows = await query<Array<{ sid: string; name: string }>>(
        `SELECT sid, name FROM t_agents WHERE deleted = 0 AND status = 'enabled'`
      );
      return rows;
    } catch (error) {
      this.logger.error(`Failed to load agents from database: ${error}`);
      return [];
    }
  }

  /**
   * 处理 Worker 消息
   */
  handleWorkerMessage(workerId: string, message: IPCMessage): void {
    // 忽略心跳和流式块消息的日志，只记录重要消息类型
    if (message.type !== "heartbeat" && message.type !== "agent-stream-chunk") {
      this.logger.info(`Received message from worker ${workerId}: ${message.type}`);
    }

    switch (message.type) {
      case "heartbeat": {
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.lastHeartbeat = Date.now();
          const payload = message.payload as { status: string; load?: number };
          worker.status = payload.status === "busy" ? "busy" : "idle";
          worker.currentLoad = payload.load ?? 0;
        }
        break;
      }

      case "outbound": {
        // 转发出站消息到对应通道
        this.handleOutboundMessage(message);
        break;
      }

      case "route-request": {
        // 处理路由请求
        this.handleRouteRequest(workerId, message);
        break;
      }

      case "error": {
        this.logger.error(`Error from worker ${workerId}: ${JSON.stringify(message.payload)}`);
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.status = "error";
        }
        break;
      }

      case "worker-ready": {
        const payload = message.payload as { agentId: string; status: string };
        this.logger.info(`Worker ${workerId} ready for agent ${payload.agentId}`);
        break;
      }

      case "agent-response": {
        // 处理 Agent 响应
        this.handleAgentResponse(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent response: ${error}`);
        });
        break;
      }

      case "agent-stream-start": {
        // 处理流式响应开始
        this.handleAgentStreamStart(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent stream start: ${error}`);
        });
        break;
      }

      case "agent-recognition-result": {
        // 处理语音识别结果
        this.handleAgentRecognitionResult(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent recognition result: ${error}`);
        });
        break;
      }

      case "agent-stream-chunk": {
        // 处理流式响应块
        this.handleAgentStreamChunk(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent stream chunk: ${error}`);
        });
        break;
      }

      case "agent-tool-call": {
        // 处理工具调用开始事件
        this.handleAgentToolCall(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent tool call: ${error}`);
        });
        break;
      }

      case "agent-tool-result": {
        // 处理工具调用结果事件
        this.handleAgentToolResult(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent tool result: ${error}`);
        });
        break;
      }

      case "agent-stream-end": {
        // 处理流式响应结束
        this.handleAgentStreamEnd(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle agent stream end: ${error}`);
        });
        break;
      }

      case "llm-request": {
        // 处理LLM请求（来自Worker）
        this.handleLLMRequest(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle LLM request: ${error}`);
        });
        break;
      }

      case "heartbeat-control-response": {
        // 处理心跳控制响应
        const payload = message.payload as { action: string; success: boolean; error?: string; agentId: string };
        this.logger.info(`Heartbeat control response from ${workerId}: action=${payload.action}, success=${payload.success}`);
        if (!payload.success && payload.error) {
          this.logger.error(`Heartbeat control failed: ${payload.error}`);
        }
        break;
      }

      case "heartbeat-push-message": {
        // 处理心跳消息推送（将心跳执行结果推送到前端）
        this.handleHeartbeatPushMessage(workerId, message).catch((error) => {
          this.logger.error(`Failed to handle heartbeat push message: ${error}`);
        });
        break;
      }

      default:
        this.logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * 发送心跳控制命令到 Worker
   */
  sendHeartbeatControl(agentId: string, action: string, config?: any): boolean {
    // 查找对应的 Worker
    let targetWorker: WorkerInfo | undefined;
    for (const worker of this.workers.values()) {
      if (worker.agentId === agentId) {
        targetWorker = worker;
        break;
      }
    }

    if (!targetWorker) {
      this.logger.warn(`No worker found for agent ${agentId}`);
      return false;
    }

    const message: IPCMessage = {
      id: `hb-control-${Date.now()}`,
      type: "heartbeat-control",
      from: "master",
      to: targetWorker.id,
      timestamp: Date.now(),
      payload: {
        action,
        config,
      },
    };

    targetWorker.process.send?.(message);
    this.logger.info(`Sent heartbeat control command to ${targetWorker.id}: ${action}`);
    return true;
  }

  /**
   * 处理LLM请求（Worker -> Master）
   */
  private async handleLLMRequest(workerId: string, message: IPCMessage): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      this.logger.warn(`Worker ${workerId} not found for LLM request`);
      return;
    }

    const request = message.payload as LLMIPCRequest;
    this.logger.info(`Handling LLM request from ${workerId}: ${request.type}`);

    if (!this.llmService) {
      this.sendLLMErrorResponse(worker, request, "LLMService not initialized");
      return;
    }

    try {
      switch (request.type) {
        case "llm:chat": {
          const { capability, complexity, messages, temperature, maxTokens, tools, instanceId, source, agentName, worktaskId, contactName } = request.payload;
          this.logger.info(`[Master] llm:chat request with instanceId: ${instanceId}`);
          
          const response = await this.llmService.generate({
            model: {
              instanceId,
              parameters: { temperature, maxTokens },
            },
            messages,
            tools,
            source: source as any,
            agentName,
            worktaskId,
            contactName,
          });
          
          this.sendLLMResponse(worker, request, {
            content: response.content,
            toolCalls: response.toolCalls,
            usage: response.usage,
            routeInfo: response.routeInfo,
          });
          break;
        }

        case "llm:stream-chat": {
          const { capability, complexity, messages, temperature, maxTokens, tools, instanceId, source, agentName, worktaskId, contactName } = request.payload;
          this.logger.info(`[Master] llm:stream-chat request with instanceId: ${instanceId}, tools: ${tools?.length || 0}`);
          console.log(`[Master] llm:stream-chat tools:`, JSON.stringify(tools?.map((t: any) => t.function?.name)));
          
          const collectedToolCalls: Array<{
            id: string;
            type: "function";
            function: {
              name: string;
              arguments: string;
            };
          }> = [];

          for await (const event of this.llmService.streamGenerate({
            model: {
              instanceId,
              parameters: { temperature, maxTokens },
            },
            messages,
            tools,
            source: source as any,
            agentName,
            worktaskId,
            contactName,
          }) as AsyncGenerator<StreamEvent>) {
            switch (event.type) {
              case "text":
                if (event.content) {
                  this.sendLLMStreamChunk(worker, request, {
                    content: event.content,
                    finishReason: undefined,
                  });
                }
                break;

              case "tool-call":
                if (event.toolCall) {
                  collectedToolCalls.push({
                    id: event.toolCall.id,
                    type: "function",
                    function: {
                      name: event.toolCall.name,
                      arguments: JSON.stringify(event.toolCall.args),
                    },
                  });
                }
                break;

              case "finish":
                // 流结束事件
                break;
            }
          }

          this.sendLLMStreamEnd(worker, request, {
            toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            routeInfo: {
              instanceId: "unknown",
              instanceName: "unknown",
              modelName: "unknown",
              provider: "unknown",
              billingType: "unknown",
            },
          });
          break;
        }

        case "llm:multimodal": {
          const { capability, complexity, prompt, images, audio, audioFormat, temperature, maxTokens, source, agentName, worktaskId, contactName } = request.payload;
          
          if (request.payload.stream) {
            console.log(`[Master] Starting stream multimodal chat...`);
            let chunkCount = 0;
            
            for await (const chunk of this.llmService.streamMultimodalChat(prompt, {
              images,
              audio,
              audioFormat,
              temperature,
              maxTokens,
              source: source as any,
              agentName,
              worktaskId,
              contactName,
            })) {
              chunkCount++;
              if (!chunk.trim()) continue;
              
              this.sendLLMStreamChunk(worker, request, {
                content: chunk,
                finishReason: undefined,
              });
            }
            
            console.log(`[Master] Stream ended, total ${chunkCount} chunks`);
            
            this.sendLLMStreamEnd(worker, request, {
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              routeInfo: {
                instanceId: "unknown",
                instanceName: "unknown",
                modelName: "unknown",
                provider: "unknown",
                billingType: "unknown",
              },
            });
          } else {
            const response = await this.llmService.multimodalChat(prompt, {
              images,
              audio,
              audioFormat,
              temperature,
              maxTokens,
              source: source as any,
              agentName,
              worktaskId,
              contactName,
            });
            
            this.sendLLMResponse(worker, request, {
              content: response.content,
              usage: response.usage,
              routeInfo: response.routeInfo,
            });
          }
          break;
        }

        case "llm:route": {
          const { capability, complexity } = request.payload;
          const routeInfo = await this.llmService.getRouteInfo({ capability, complexity });
          
          this.sendLLMResponse(worker, request, {
            instanceId: routeInfo.instanceId,
            instanceName: routeInfo.instanceName,
            modelName: routeInfo.modelName,
            provider: routeInfo.provider,
            billingType: routeInfo.billingType,
          }, "llm:route-response");
          break;
        }

        case "llm:transcribe": {
          const { audioData, format, instanceId } = request.payload;
          const result = await this.llmService.transcribeAudio(audioData, {
            format,
            instanceId,
          });
          
          this.sendLLMResponse(worker, request, {
            text: result.text,
            routeInfo: result.routeInfo,
          }, "llm:transcribe-response");
          break;
        }

        case "llm:synthesize": {
          const { text, options } = request.payload;
          if (!this.llmService.synthesizeSpeech) {
            this.sendLLMErrorResponse(worker, request, "Speech synthesis not supported");
            break;
          }
          const result = await this.llmService.synthesizeSpeech(text, {
            voice: options?.voice,
            format: options?.format,
            instanceId: options?.instanceId,
          });
          
          this.sendLLMResponse(worker, request, {
            audio: result.audio,
            format: result.format,
            routeInfo: result.routeInfo,
          }, "llm:synthesize-response");
          break;
        }

        case "llm:get-instance-config": {
          const { instanceId } = request.payload;
          const config = await this.llmService.getInstanceConfig(instanceId);
          
          this.sendLLMResponse(worker, request, {
            config: config || null,
          }, "llm:get-instance-config-response");
          break;
        }

        default:
          this.sendLLMErrorResponse(worker, request, `Unknown LLM request type: ${request.type}`);
      }
    } catch (error) {
      this.logger.error(`LLM request failed: ${error}`);
      const errorMessage = String(error);
      
      // 检查是否是没有可用实例的错误
      if (errorMessage.includes("No available instances")) {
        const friendlyMessage = `⚠️ **系统配置提示**\n\n` +
          `当前没有可用的 LLM 实例，无法处理您的请求。\n\n` +
          `**解决方法：**\n` +
          `1. 进入「大模型管理」→「实例管理」\n` +
          `2. 添加一个新的 LLM 实例（如 DashScope、OpenAI 等）\n` +
          `3. 填写相应的 API Key 并启用实例\n\n` +
          `配置完成后即可正常使用对话功能。`;
        
        // 根据请求类型返回不同的响应格式
        if (request.type === "llm:stream-chat") {
          // 流式请求：发送一个包含提示信息的流式响应
          this.sendLLMStreamChunk(worker, request, {
            content: friendlyMessage,
            finishReason: "stop",
          });
          this.sendLLMStreamEnd(worker, request, {
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            routeInfo: {
              instanceId: "system",
              instanceName: "系统提示",
              modelName: "none",
              provider: "system",
              billingType: "none",
            },
          });
        } else {
          // 非流式请求：返回友好的错误消息作为响应内容
          this.sendLLMResponse(worker, request, {
            content: friendlyMessage,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            routeInfo: {
              instanceId: "system",
              instanceName: "系统提示",
              modelName: "none",
              provider: "system",
              billingType: "none",
            },
          });
        }
        return;
      }
      
      this.sendLLMErrorResponse(worker, request, errorMessage);
    }
  }

  /**
   * 发送LLM响应给Worker
   */
  private sendLLMResponse(
    worker: WorkerInfo,
    request: LLMIPCRequest,
    payload: any,
    responseType: string = "llm:response"
  ): void {
    const response: LLMIPCResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestId: request.id,
      type: responseType as any,
      workerId: request.workerId,
      agentId: request.agentId,
      payload,
    };

    worker.process.send({
      type: "llm-response",
      payload: response,
    });
  }

  /**
   * 发送LLM流式块给Worker
   */
  private sendLLMStreamChunk(
    worker: WorkerInfo,
    request: LLMIPCRequest,
    payload: { content: string; finishReason?: string }
  ): void {
    const response: LLMIPCResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestId: request.id,
      type: "llm:stream-chunk",
      workerId: request.workerId,
      agentId: request.agentId,
      payload,
    };

    worker.process.send({
      type: "llm-response",
      payload: response,
    });
  }

  /**
   * 发送LLM流式结束给Worker
   */
  private sendLLMStreamEnd(
    worker: WorkerInfo,
    request: LLMIPCRequest,
    payload: { 
      toolCalls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
      usage: any; 
      routeInfo: any 
    }
  ): void {
    const response: LLMIPCResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestId: request.id,
      type: "llm:stream-end",
      workerId: request.workerId,
      agentId: request.agentId,
      payload,
    };

    worker.process.send({
      type: "llm-response",
      payload: response,
    });
  }

  /**
   * 发送LLM错误响应给Worker
   */
  private sendLLMErrorResponse(
    worker: WorkerInfo,
    request: LLMIPCRequest,
    error: string
  ): void {
    const response: LLMIPCResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestId: request.id,
      type: "llm:error",
      workerId: request.workerId,
      agentId: request.agentId,
      payload: {},
      error,
    };

    worker.process.send({
      type: "llm-response",
      payload: response,
    });
  }

  /**
   * 处理出站消息
   */
  private async handleOutboundMessage(message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      channelName: string;
      context: InboundMessageContext & { audio?: { data: string; format: string }; isSystemMessage?: boolean; to?: string; text?: string };
    };

    this.logger.info(`[handleOutboundMessage] channelName=${payload.channelName}, to=${(payload.context as any).to}, textLength=${(payload.context as any).text?.length || 0}`);

    const plugin = this.channelPlugins.get(payload.channelName);
    if (plugin) {
      // 如果是系统消息，添加标记
      const context = payload.context;
      if (context.isSystemMessage) {
        (context as any).isSystemMessage = true;
      }
      await plugin.sendMessage(context as any);
    } else {
      this.logger.warn(`Channel '${payload.channelName}' not found for outbound message`);
    }
  }

  /**
   * 处理 Agent 响应
   */
  private async handleAgentResponse(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      response: {
        content: string;
        metadata?: any;
        thinkingMessage?: string;
      };
    };

    this.logger.info(`Received response from agent ${payload.agentId} for request ${payload.requestId}`);
    this.logger.debug?.(`Response content: ${payload.response.content.substring(0, 100)}...`);

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      this.logger.warn(`No pending message found for request ${payload.requestId}`);
      return;
    }

    // 从 pending 中移除
    this.pendingMessages.delete(payload.requestId);

    // 通过 Channel 插件发送响应
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      this.logger.warn(`Channel '${pendingMessage.channelName}' not found for response`);
      return;
    }

    // 查询 Agent 名称
    let agentName = "Agent";
    try {
      const agentResult = await query<{ name: string }[]>(
        "SELECT name FROM t_agents WHERE sid = ? AND deleted = 0",
        [payload.agentId]
      );
      if (agentResult.length > 0) {
        agentName = agentResult[0].name;
      }
    } catch {
      // 忽略查询失败
    }

    // 发送系统消息 - Agent 响应已收到
    const systemContext = {
      messageId: payload.requestId,
      channelType: channelPlugin.getType(),
      channelName: channelPlugin.getName(),
      chatType: "direct" as const,
      chatId: pendingMessage.clientId || "unknown",
      senderId: payload.agentId,
      senderName: agentName,
      recipientId: pendingMessage.clientId || "unknown",
      body: payload.response.content,
      timestamp: Date.now(),
      thinkingMessage: pendingMessage.thinkingMessage,
    } as InboundMessageContext;

    // 如果有思考消息，先发送思考消息
    if (payload.response.thinkingMessage) {
      await this.sendSystemMessage(
        pendingMessage.clientId || "unknown",
        systemContext,
        { name: pendingMessage.channelName, type: channelPlugin.getType(), enabled: true, config: {} },
        `🤖 [${agentName}] 思考过程\n${payload.response.thinkingMessage}`
      );
    }

    await this.sendSystemMessage(
      pendingMessage.clientId || "unknown",
      systemContext,
      { name: pendingMessage.channelName, type: channelPlugin.getType(), enabled: true, config: {} },
      `✅ [${agentName}] 响应已生成\n处理耗时: ${Date.now() - pendingMessage.startTime}ms\n内容长度: ${payload.response.content.length} 字符`
    );

    // 构建出站消息上下文
    const outboundContext: any = {
      to: pendingMessage.clientId || "unknown",
      text: payload.response.content,
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      replyToId: payload.requestId,
      originalContext: systemContext,
    };

    // 如果有音频输出，添加到上下文
    if ((payload.response as any).audio) {
      outboundContext.audio = (payload.response as any).audio;
    }

    // 发送消息
    channelPlugin.sendMessage(outboundContext as any).catch((error) => {
      this.logger.error(`Failed to send response: ${error}`);
    });

    // 将 Worker 状态重置为 idle
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = "idle";
    }
  }

  /**
   * 处理语音识别结果
   */
  private async handleAgentRecognitionResult(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      recognizedText: string;
    };

    this.logger.info(`Received recognition result from agent ${payload.agentId} for request ${payload.requestId}: ${payload.recognizedText}`);
    console.log(`[Master] Pending messages:`, Array.from(this.pendingMessages.keys()));

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      this.logger.warn(`No pending message found for recognition result ${payload.requestId}`);
      return;
    }
    
    console.log(`[Master] Found pending message for ${payload.requestId}, clientId: ${pendingMessage.clientId}, channel: ${pendingMessage.channelName}`);

    // 通过 Channel 插件发送语音识别结果
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      this.logger.warn(`Channel '${pendingMessage.channelName}' not found for recognition result`);
      return;
    }

    // 构建语音识别结果消息上下文
    const recognitionMessage = {
      to: pendingMessage.clientId,
      text: `🎤 语音识别完成: ${payload.recognizedText}`,
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      // 标记为语音识别结果消息，供前端特殊处理
      isRecognitionResult: true,
      recognizedText: payload.recognizedText,
      requestId: payload.requestId,
    };

    console.log(`[Master] Sending recognition message:`, recognitionMessage);

    // 发送语音识别结果消息到客户端
    await channelPlugin.sendMessage(recognitionMessage as any);
  }

  /**
   * 处理流式响应开始
   */
  private async handleAgentStreamStart(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      thinkingMessage?: string;
    };

    this.logger.info(`Received stream start from agent ${payload.agentId} for request ${payload.requestId}`);

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      this.logger.warn(`No pending message found for stream request ${payload.requestId}`);
      return;
    }

    // 通过 Channel 插件发送思考消息
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      this.logger.warn(`Channel '${pendingMessage.channelName}' not found for stream`);
      return;
    }

    // 查询 Agent 名称
    let agentName = "Agent";
    try {
      const agentResult = await query<{ name: string }[]>(
        "SELECT name FROM t_agents WHERE sid = ? AND deleted = 0",
        [payload.agentId]
      );
      if (agentResult.length > 0) {
        agentName = agentResult[0].name;
      }
    } catch {
      // 忽略查询失败
    }

    // 如果有思考消息，发送思考消息
    if (payload.thinkingMessage) {
      const systemContext = {
        messageId: payload.requestId,
        channelType: channelPlugin.getType(),
        channelName: channelPlugin.getName(),
        chatType: "direct" as const,
        chatId: pendingMessage.clientId || "unknown",
        senderId: payload.agentId,
        senderName: "Agent",
        recipientId: pendingMessage.clientId || "unknown",
        body: `🤖 [${agentName}] 思考过程\n${payload.thinkingMessage}`,
        timestamp: Date.now(),
        thinkingMessage: pendingMessage.thinkingMessage,
      } as InboundMessageContext;

      await this.sendSystemMessage(
        pendingMessage.clientId || "unknown",
        systemContext,
        { name: pendingMessage.channelName, type: channelPlugin.getType(), enabled: true, config: {} },
        `🤖 [${agentName}] 思考过程\n${payload.thinkingMessage}`
      );
    }

    // 发送流式开始标记
    const startContext = {
      messageId: `${payload.requestId}-stream-start`,
      channelType: channelPlugin.getType(),
      channelName: channelPlugin.getName(),
      chatType: "direct" as const,
      chatId: pendingMessage.clientId || "unknown",
      senderId: payload.agentId,
      senderName: agentName,
      recipientId: pendingMessage.clientId || "unknown",
      body: "🔄 开始生成响应...",
      timestamp: Date.now(),
      thinkingMessage: pendingMessage.thinkingMessage,
    } as InboundMessageContext;

    await this.sendSystemMessage(
      pendingMessage.clientId || "unknown",
      startContext,
      { name: pendingMessage.channelName, type: channelPlugin.getType(), enabled: true, config: {} },
      `🔄 [${agentName}] 开始生成响应...`
    );
  }

  /**
   * 处理流式响应块
   */
  private async handleAgentStreamChunk(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      chunk: string;
    };

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      return; // 静默忽略，可能消息已完成
    }

    // 通过 Channel 插件发送流式块
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      return;
    }

    // 构建流式消息上下文
    const streamContext: any = {
      to: pendingMessage.clientId || "unknown",
      text: payload.chunk,
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      replyToId: payload.requestId,
      isStreamChunk: true, // 标记为流式块
    };

    // 发送流式块
    channelPlugin.sendMessage(streamContext).catch((error) => {
      this.logger.error(`Failed to send stream chunk: ${error}`);
    });
  }

  /**
   * 处理工具调用开始事件
   */
  private async handleAgentToolCall(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      toolCall: {
        name: string;
        arguments: string;
        step: number;
        total: number;
      };
    };

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      return;
    }

    // 通过 Channel 插件发送工具调用事件
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      return;
    }

    // 构建工具调用消息上下文
    const toolCallContext: any = {
      to: pendingMessage.clientId || "unknown",
      text: "",
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      replyToId: payload.requestId,
      isToolCall: true,
      toolCall: payload.toolCall,
    };

    // 发送工具调用事件
    channelPlugin.sendMessage(toolCallContext).catch((error) => {
      this.logger.error(`Failed to send tool call event: ${error}`);
    });
  }

  /**
   * 处理工具调用结果事件
   */
  private async handleAgentToolResult(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      toolResult: {
        name: string;
        result: string;
        step: number;
        total: number;
      };
    };

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      return;
    }

    // 通过 Channel 插件发送工具结果事件
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      return;
    }

    // 构建工具结果消息上下文
    const toolResultContext: any = {
      to: pendingMessage.clientId || "unknown",
      text: "",
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      replyToId: payload.requestId,
      isToolResult: true,
      toolResult: payload.toolResult,
    };

    // 发送工具结果事件
    channelPlugin.sendMessage(toolResultContext).catch((error) => {
      this.logger.error(`Failed to send tool result event: ${error}`);
    });
  }

  /**
   * 处理流式响应结束
   */
  private async handleAgentStreamEnd(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      requestId: string;
      agentId: string;
      content: string;
      metadata?: any;
      audio?: string;
      audioFormat?: string;
      audioDuration?: number;
    };

    this.logger.info(`Received stream end from agent ${payload.agentId} for request ${payload.requestId}, ${(payload.content || "").length} chars`);

    // 查找对应的 pending message
    const pendingMessage = this.pendingMessages.get(payload.requestId);
    if (!pendingMessage) {
      this.logger.warn(`No pending message found for stream end ${payload.requestId}`);
      return;
    }

    // 从 pending 中移除
    this.pendingMessages.delete(payload.requestId);

    // 通过 Channel 插件发送最终响应
    const channelPlugin = this.channelPlugins.get(pendingMessage.channelName);
    if (!channelPlugin) {
      this.logger.warn(`Channel '${pendingMessage.channelName}' not found for stream end`);
      return;
    }

    // 查询 Agent 名称
    let agentName = "Agent";
    try {
      const agentResult = await query<{ name: string }[]>(
        "SELECT name FROM t_agents WHERE sid = ? AND deleted = 0",
        [payload.agentId]
      );
      if (agentResult.length > 0) {
        agentName = agentResult[0].name;
      }
    } catch {
      // 忽略查询失败
    }

    // 发送 stream-end 消息到前端（包含音频数据）
    const streamEndContext: any = {
      to: pendingMessage.clientId || "unknown",
      text: "",
      channelType: channelPlugin.getType(),
      chatType: "direct" as const,
      replyToId: payload.requestId,
      isStreamEnd: true, // 标记为流式结束
    };

    // 如果有音频数据，添加到上下文
    if (payload.audio) {
      streamEndContext.audio = {
        data: payload.audio,
        format: payload.audioFormat || "wav",
        duration: payload.audioDuration,
      };
      this.logger.info(`Stream end includes audio data (${payload.audio.length} chars, ${payload.audioDuration}s)`);
    }

    await channelPlugin.sendMessage(streamEndContext).catch((error) => {
      this.logger.error(`Failed to send stream end: ${error}`);
    });

    // 发送完成标记
    const completeContext = {
      messageId: `${payload.requestId}-stream-complete`,
      channelType: channelPlugin.getType(),
      channelName: channelPlugin.getName(),
      chatType: "direct" as const,
      chatId: pendingMessage.clientId || "unknown",
      senderId: payload.agentId,
      senderName: agentName,
      recipientId: pendingMessage.clientId || "unknown",
      body: `✅ 响应完成 (${(payload.content || "").length} 字符)`,
      timestamp: Date.now(),
      thinkingMessage: pendingMessage.thinkingMessage,
    } as InboundMessageContext;

    await this.sendSystemMessage(
      pendingMessage.clientId || "unknown",
      completeContext,
      { name: pendingMessage.channelName, type: channelPlugin.getType(), enabled: true, config: {} },
      `✅ [${agentName}] 响应完成\n处理耗时: ${Date.now() - pendingMessage.startTime}ms\n内容长度: ${(payload.content || "").length} 字符`
    );

    // 将 Worker 状态重置为 idle
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = "idle";
    }
  }

  /**
   * 处理路由请求
   */
  private handleRouteRequest(workerId: string, message: IPCMessage): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    const payload = message.payload as {
      requestId: string;
      channelName: string;
      senderId: string;
      recipientId: string;
    };

    // 简单的路由决策
    const decision: RouteDecision = {
      agentId: payload.recipientId || "default-agent",
      contactId: payload.senderId,
      allowed: true,
    };

    worker.process.send?.({
      type: "route-response",
      payload: {
        requestId: payload.requestId,
        decision,
      },
    });
  }

  /**
   * 分发消息到 Worker
   * 根据消息中的 recipientId（Agent ID）选择对应的 Worker
   */
  private dispatchMessages(): void {
    if (this.messageQueue.length === 0) return;

    // 遍历消息队列，为每条消息找到对应的 Worker
    for (let i = this.messageQueue.length - 1; i >= 0; i--) {
      const queuedMessage = this.messageQueue[i];
      const targetAgentId = queuedMessage.context.recipientId;

      // 找到对应 Agent 的空闲 Worker
      let targetWorker: WorkerInfo | undefined;
      for (const worker of this.workers.values()) {
        if (worker.agentId === targetAgentId && worker.status === "idle") {
          targetWorker = worker;
          break;
        }
      }

      if (targetWorker) {
        // 从队列中移除消息
        this.messageQueue.splice(i, 1);

        targetWorker.status = "busy";
        targetWorker.messageCount++;

        // 记录 pending message，用于后续响应路由
        this.pendingMessages.set(queuedMessage.id, {
          messageId: queuedMessage.id,
          channelName: queuedMessage.channelConfig.name,
          clientId: queuedMessage.context.metadata?.clientId as string | undefined,
          enqueueTime: queuedMessage.enqueueTime,
          startTime: Date.now(),  // Agent 开始处理的时间
          thinkingMessage: queuedMessage.context.thinkingMessage !== false,  // 是否显示思考过程
        });

        this.logger.info(
          `Dispatching message ${queuedMessage.id} to worker for agent ${targetAgentId}`
        );

        targetWorker.process.send?.({
          type: "inbound",
          payload: {
            messageId: queuedMessage.id,
            context: queuedMessage.context,
            channelConfig: queuedMessage.channelConfig,
          },
        });
      } else {
        // 如果没有找到对应的空闲 Worker，记录日志
        this.logger.debug?.(
          `No idle worker found for agent ${targetAgentId}, message ${queuedMessage.id} will wait`
        );
      }
    }
  }

  /**
   * 启动定时任务
   */
  private startTimers(): void {
    // 心跳检查（每 10 秒检查一次）
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [workerId, worker] of this.workers.entries()) {
        if (now - worker.lastHeartbeat > this.config.heartbeatTimeout) {
          this.logger.warn(`Worker ${workerId} heartbeat timeout`);
          worker.process.kill("SIGTERM");
          this.workers.delete(workerId);
        }
      }
    }, 10000);

    // 消息分发
    this.dispatchTimer = setInterval(() => {
      this.dispatchMessages();
    }, 100);

    // 进程检查（每5分钟检查一次）
    this.processCheckTimer = setInterval(async () => {
      // 1. 检查 Worker 数量，如有缺失则重启
      const expectedCount = this.expectedAgentCount;
      const actualCount = this.workers.size;
      if (expectedCount > 0 && actualCount < expectedCount) {
        this.logger.warn(`Worker count mismatch: ${actualCount}/${expectedCount}, restarting...`);
        this.startWorkers();
      }

      // 2. 自动检测并启动新 Agent 的 Worker
      try {
        const currentAgents = await this.loadAgentsFromDatabase();
        const currentAgentIds = new Set(currentAgents.map(a => a.sid));

        // 检查是否有新 Agent 需要启动 Worker
        for (const agent of currentAgents) {
          const hasWorker = Array.from(this.workers.values()).some(
            w => w.agentId === agent.sid
          );
          if (!hasWorker) {
            this.logger.info(`New agent detected: ${agent.name} (${agent.sid}), starting worker...`);
            await this.startAgentWorker(agent.sid);
          }
        }

        // 更新期望的 Agent 数量
        this.expectedAgentCount = currentAgents.length;
      } catch (error) {
        this.logger.error(`Failed to check for new agents: ${error}`);
      }
    }, 300000);
  }

  /**
   * 停止定时任务
   */
  private stopTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer);
      this.dispatchTimer = undefined;
    }
    if (this.processCheckTimer) {
      clearInterval(this.processCheckTimer);
      this.processCheckTimer = undefined;
    }
  }

  /**
   * 处理心跳消息推送
   * 将心跳执行结果以流式方式推送到前端
   */
  private async handleHeartbeatPushMessage(workerId: string, message: IPCMessage): Promise<void> {
    const payload = message.payload as {
      agentId: string;
      agentName: string;
      contactId: string;
      content: string;
      timestamp: number;
    };

    this.logger.info(`[Master] Handling heartbeat push message from ${workerId} for contact ${payload.contactId}`);

    try {
      // 查找 Cradle Channel 插件
      const cradlePlugin = this.channelPlugins.get("cradle");
      if (!cradlePlugin) {
        this.logger.warn(`[Master] Cradle channel plugin not found, cannot push heartbeat message`);
        return;
      }

      const messageId = `heartbeat-${payload.timestamp}`;
      const content = payload.content;
      
      // 将内容分块，模拟流式输出
      const chunkSize = 5; // 每块5个字符
      const chunks: string[] = [];
      for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
      }
      
      // 如果没有内容，至少发送一个空块
      if (chunks.length === 0) {
        chunks.push("");
      }

      // 发送流式块
      for (let i = 0; i < chunks.length; i++) {
        const isLastChunk = i === chunks.length - 1;
        const chunkContext = {
          to: payload.contactId,
          text: chunks[i],
          channelType: "cradle" as const,
          chatType: "direct" as const,
          replyToId: messageId, // 使用 messageId 作为 replyToId，让前端关联到同一条消息
          isStreamChunk: true,
          isStreamEnd: isLastChunk,
          originalContext: {
            messageId: messageId,
            channelType: "cradle" as const,
            channelName: "cradle",
            chatType: "direct" as const,
            chatId: payload.contactId,
            senderId: payload.agentId,
            senderName: payload.agentName,
            recipientId: payload.contactId,
            body: chunks[i],
            timestamp: payload.timestamp + i, // 每个块稍微不同的时间戳
          },
        };

        await cradlePlugin.sendMessage(chunkContext as any);
        
        // 添加小延迟，让流式效果更明显
        if (!isLastChunk) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      this.logger.info(`[Master] Heartbeat message streamed to contact ${payload.contactId} in ${chunks.length} chunks`);
    } catch (error: any) {
      this.logger.error(`[Master] Failed to push heartbeat message: ${error}`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    workers: ProcessStats[];
    queueLength: number;
    totalMessages: number;
    isRunning: boolean;
    channels: string[];
  } {
    const workerStats: ProcessStats[] = Array.from(this.workers.entries()).map(
      ([id, worker]) => ({
        processId: id,
        processType: "worker" as ProcessType,
        status: worker.status,
        cpuUsage: worker.currentLoad,
        memoryUsage: 0,
        messageCount: worker.messageCount,
        lastActiveAt: worker.lastHeartbeat,
        startedAt: worker.lastHeartbeat - 3600000,
      }),
    );

    const totalMessages = Array.from(this.workers.values()).reduce(
      (sum, w) => sum + w.messageCount,
      0,
    );

    return {
      workers: workerStats,
      queueLength: this.messageQueue.length,
      totalMessages,
      isRunning: this.running,
      channels: Array.from(this.channelPlugins.keys()),
    };
  }
}
