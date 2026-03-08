/**
 * DingTalk Channel 插件
 *
 * 处理钉钉机器人的 Webhook 和 WebSocket 连接
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { Duplex } from "stream";
import {
  BaseChannelPlugin,
  type ChannelConfig,
} from "../channel-plugin.js";
import type {
  InboundMessageContext,
  OutboundMessageContext,
} from "../types.js";

/**
 * DingTalk Channel 配置
 */
interface DingTalkChannelConfig {
  /** Webhook 路径 */
  webhookPath?: string;
  /** 应用凭证 */
  appKey?: string;
  appSecret?: string;
  /** 机器人凭证 */
  robotCode?: string;
  robotSecret?: string;
}

/**
 * DingTalk Channel 插件
 *
 * 处理钉钉机器人的消息收发
 */
export class DingTalkChannel extends BaseChannelPlugin {
  private channelConfig?: DingTalkChannelConfig;

  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  } = {
    info: (msg: string) => console.log(`[DingTalkChannel] ${msg}`),
    warn: (msg: string) => console.warn(`[DingTalkChannel] ${msg}`),
    error: (msg: string) => console.error(`[DingTalkChannel] ${msg}`),
    debug: (msg: string) => console.debug(`[DingTalkChannel] ${msg}`),
  };

  /**
   * 设置日志记录器
   */
  setLogger(logger: typeof this.logger): void {
    this.logger = logger;
  }

  getName(): string {
    return this.config?.name || "dingtalk";
  }

  getType(): string {
    return "dingtalk";
  }

  protected async onInitialize(): Promise<void> {
    if (!this.config) {
      throw new Error("Channel not configured");
    }

    // 解析配置
    this.channelConfig = this.config.config as DingTalkChannelConfig;

    this.logger.info("DingTalk channel initialized");
  }

  handleWebSocketUpgrade(
    _request: IncomingMessage,
    _socket: Duplex,
    _head: Buffer,
  ): void {
    // DingTalk 主要使用 Webhook，WebSocket 暂不支持
    this.logger.warn("WebSocket upgrade not supported for DingTalk channel");
  }

  handleWebhook(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    
    this.logger.info(`Received webhook request: ${url.pathname}`);

    // 处理钉钉回调
    if (request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        try {
          const data = JSON.parse(body);
          this.logger.debug?.(`Webhook data: ${JSON.stringify(data)}`);
          
          // TODO: 处理钉钉消息
          
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: true }));
        } catch (error) {
          this.logger.error(`Failed to parse webhook data: ${error}`);
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
        }
      });
    } else {
      response.writeHead(405, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ success: false, error: "Method not allowed" }));
    }
  }

  async sendMessage(context: OutboundMessageContext): Promise<void> {
    this.logger.info(`Sending message to: ${context.to}`);
    // TODO: 实现钉钉消息发送
    throw new Error("Not implemented");
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down DingTalk channel");
    this.initialized = false;
  }
}
