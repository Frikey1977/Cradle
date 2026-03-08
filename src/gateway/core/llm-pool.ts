/**
 * LLM Pool 进程
 * 
 * 职责：
 * 1. 管理多个 LLM 连接
 * 2. 处理流式输出
 * 3. 负载均衡
 * 4. Token 使用统计
 */

import type { IPCMessage, LLMRequestMessage, LLMResponseMessage } from "../ipc/types.js";

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** 提供商 */
  provider: "openai" | "anthropic" | "azure" | "local" | string;
  /** 模型名称 */
  model: string;
  /** API Key */
  apiKey: string;
  /** API 基础 URL */
  baseUrl?: string;
  /** 最大并发数 */
  maxConcurrency: number;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * LLM 连接
 */
interface LLMConnection {
  id: string;
  config: LLMConfig;
  status: "idle" | "busy" | "error";
  currentRequests: number;
  totalRequests: number;
  totalTokens: number;
}

/**
 * 进行中的请求
 */
interface PendingRequest {
  requestId: string;
  agentId: string;
  connectionId: string;
  startTime: number;
  stream: boolean;
}

/**
 * Token 使用统计
 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * LLM Pool 进程
 */
export class LLMPool {
  private configs: LLMConfig[];
  private connections: LLMConnection[] = [];
  private pendingRequests = new Map<string, PendingRequest>();
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  };
  private running = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private masterId = "master";
  private requestQueue: LLMRequestMessage[] = [];

  constructor(configs: LLMConfig[]) {
    this.configs = configs;
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
   * 启动 LLM Pool
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.logger.info("[LLM Pool] Starting...");

    // 初始化连接
    await this.initializeConnections();

    // 注册到 Master
    await this.registerWithMaster();

    // 启动心跳
    this.startHeartbeat();

    this.running = true;

    this.logger.info(`[LLM Pool] Started with ${this.connections.length} connections`);
  }

  /**
   * 停止 LLM Pool
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info("[LLM Pool] Stopping...");

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // 关闭所有连接
    this.connections = [];

    this.running = false;

    this.logger.info("[LLM Pool] Stopped");
  }

  /**
   * 处理 LLM 请求
   */
  async handleRequest(request: LLMRequestMessage): Promise<void> {
    const { requestId, agentId, messages, stream, temperature, maxTokens } = request.payload;

    this.logger.debug?.(`[LLM Pool] Handling request ${requestId} from agent ${agentId}`);

    // 1. 选择连接
    const connection = this.selectConnection();
    if (!connection) {
      // 没有可用连接，加入队列
      this.requestQueue.push(request);
      this.logger.warn(`[LLM Pool] No available connection, request ${requestId} queued`);
      return;
    }

    // 2. 标记连接为忙碌
    connection.status = "busy";
    connection.currentRequests++;

    // 3. 记录请求
    const pendingRequest: PendingRequest = {
      requestId,
      agentId,
      connectionId: connection.id,
      startTime: Date.now(),
      stream,
    };
    this.pendingRequests.set(requestId, pendingRequest);

    // 4. 发送请求
    try {
      if (stream) {
        await this.handleStreamingRequest(request, connection);
      } else {
        await this.handleNonStreamingRequest(request, connection);
      }
    } catch (error) {
      this.logger.error(`[LLM Pool] Request ${requestId} failed: ${String(error)}`);

      // 发送错误响应
      this.sendErrorResponse(request, error);

      // 标记连接为错误
      connection.status = "error";
    } finally {
      // 清理
      connection.currentRequests--;
      if (connection.currentRequests === 0) {
        connection.status = "idle";
      }
      this.pendingRequests.delete(requestId);

      // 处理队列
      this.processQueue();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    connections: number;
    idleConnections: number;
    busyConnections: number;
    pendingRequests: number;
    totalTokens: number;
    queueLength: number;
  } {
    return {
      connections: this.connections.length,
      idleConnections: this.connections.filter((c) => c.status === "idle").length,
      busyConnections: this.connections.filter((c) => c.status === "busy").length,
      pendingRequests: this.pendingRequests.size,
      totalTokens: this.connections.reduce((sum, c) => sum + c.totalTokens, 0),
      queueLength: this.requestQueue.length,
    };
  }

  /**
   * 初始化连接
   */
  private async initializeConnections(): Promise<void> {
    for (const config of this.configs) {
      for (let i = 0; i < config.maxConcurrency; i++) {
        const connection: LLMConnection = {
          id: `${config.provider}_${i}`,
          config,
          status: "idle",
          currentRequests: 0,
          totalRequests: 0,
          totalTokens: 0,
        };
        this.connections.push(connection);
      }
    }
  }

  /**
   * 选择连接（负载均衡）
   */
  private selectConnection(): LLMConnection | undefined {
    // 简单的轮询策略
    const availableConnections = this.connections.filter(
      (c) => c.status === "idle" && c.currentRequests < c.config.maxConcurrency,
    );

    if (availableConnections.length === 0) {
      return undefined;
    }

    // 选择当前请求数最少的
    return availableConnections.reduce((min, conn) =>
      conn.currentRequests < min.currentRequests ? conn : min,
    );
  }

  /**
   * 处理流式请求
   */
  private async handleStreamingRequest(
    request: LLMRequestMessage,
    connection: LLMConnection,
  ): Promise<void> {
    const { requestId, agentId } = request.payload;

    this.logger.debug?.(`[LLM Pool] Handling streaming request ${requestId}`);

    // 模拟流式响应
    // 实际实现中需要调用 LLM API 的流式接口
    const chunks = [
      "您好",
      "！",
      "我",
      "是",
      " AI",
      " 助手",
      "，",
      "很",
      "高兴",
      "为您",
      "服务",
      "。",
    ];

    for (const chunk of chunks) {
      const response: LLMResponseMessage = {
        id: this.generateMessageId(),
        type: "llm-response",
        from: "llm-pool",
        to: `agent-${agentId}`,
        timestamp: Date.now(),
        payload: {
          requestId,
          chunk,
          done: false,
        },
      };

      this.sendToAgent(agentId, response);

      // 模拟延迟
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 发送完成标记
    const finalResponse: LLMResponseMessage = {
      id: this.generateMessageId(),
      type: "llm-response",
      from: "llm-pool",
      to: `agent-${agentId}`,
      timestamp: Date.now(),
      payload: {
        requestId,
        content: chunks.join(""),
        done: true,
        usage: {
          promptTokens: 100,
          completionTokens: chunks.length * 2,
          totalTokens: 100 + chunks.length * 2,
        },
      },
    };

    this.sendToAgent(agentId, finalResponse);

    // 更新统计
    connection.totalRequests++;
    connection.totalTokens += 100 + chunks.length * 2;
  }

  /**
   * 处理非流式请求
   */
  private async handleNonStreamingRequest(
    request: LLMRequestMessage,
    connection: LLMConnection,
  ): Promise<void> {
    const { requestId, agentId, messages } = request.payload;

    this.logger.debug?.(`[LLM Pool] Handling non-streaming request ${requestId}`);

    // 模拟非流式响应
    // 实际实现中需要调用 LLM API
    const content = "您好！我是 AI 助手，很高兴为您服务。";

    const response: LLMResponseMessage = {
      id: this.generateMessageId(),
      type: "llm-response",
      from: "llm-pool",
      to: `agent-${agentId}`,
      timestamp: Date.now(),
      payload: {
        requestId,
        content,
        done: true,
        usage: {
          promptTokens: messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
          completionTokens: content.length / 4,
          totalTokens: (messages.reduce((sum, m) => sum + m.content.length, 0) + content.length) / 4,
        },
      },
    };

    this.sendToAgent(agentId, response);

    // 更新统计
    connection.totalRequests++;
    connection.totalTokens += Math.floor(
      (messages.reduce((sum, m) => sum + m.content.length, 0) + content.length) / 4,
    );
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const connection = this.selectConnection();
      if (!connection) {
        break;
      }

      const request = this.requestQueue.shift();
      if (request) {
        void this.handleRequest(request);
      }
    }
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(request: LLMRequestMessage, error: unknown): void {
    const { requestId, agentId } = request.payload;

    const response: LLMResponseMessage = {
      id: this.generateMessageId(),
      type: "llm-response",
      from: "llm-pool",
      to: `agent-${agentId}`,
      timestamp: Date.now(),
      payload: {
        requestId,
        done: true,
        error: error instanceof Error ? error.message : String(error),
      },
    };

    this.sendToAgent(agentId, response);
  }

  /**
   * 注册到 Master
   */
  private async registerWithMaster(): Promise<void> {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "register",
      from: "llm-pool",
      to: this.masterId,
      timestamp: Date.now(),
      payload: {
        processType: "llm-pool",
        processId: "llm-pool",
        capabilities: ["llm-inference", "streaming"],
      },
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const stats = this.getStats();

      this.sendToMaster({
        id: this.generateMessageId(),
        type: "heartbeat",
        from: "llm-pool",
        to: this.masterId,
        timestamp: Date.now(),
        payload: {
          status: stats.pendingRequests > 0 ? "busy" : "idle",
          load: stats.pendingRequests / (stats.connections || 1),
          memory: stats.totalTokens,
        },
      });
    }, 10000);
  }

  /**
   * 发送消息到 Master
   */
  private sendToMaster(message: IPCMessage): void {
    this.logger.debug?.(`[LLM Pool] Sending ${message.type} to Master`);
  }

  /**
   * 发送消息到 Agent
   */
  private sendToAgent(agentId: string, message: IPCMessage): void {
    this.logger.debug?.(`[LLM Pool] Sending ${message.type} to Agent ${agentId}`);
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
