/**
 * Channel 插件接口
 *
 * 采用单端口多路复用架构，每个 Channel 插件自治处理协议细节
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { Duplex } from "stream";
import type { InboundMessageContext, OutboundMessageContext } from "./types.js";

/**
 * Channel 配置
 */
export interface ChannelConfig {
  /** 通道唯一标识 (name 字段) */
  name: string;
  /** 通道类型 */
  type: string;
  /** 是否启用 */
  enabled: boolean;
  /** 服务端配置 */
  config: Record<string, unknown>;
  /** 客户端配置 */
  clientConfig?: Record<string, unknown>;
}

/**
 * Channel 插件接口
 *
 * 所有 Channel 插件必须实现此接口
 */
export interface ChannelPlugin {
  /**
   * 获取通道名称
   */
  getName(): string;

  /**
   * 获取通道类型
   */
  getType(): string;

  /**
   * 初始化插件
   * @param config 通道配置
   */
  initialize(config: ChannelConfig): Promise<void>;

  /**
   * 处理 WebSocket 连接升级
   * @param request HTTP 升级请求
   * @param socket TCP socket
   * @param head 初始数据
   */
  handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void;

  /**
   * 处理 Webhook 请求
   * @param request HTTP 请求
   * @param response HTTP 响应
   */
  handleWebhook(request: IncomingMessage, response: ServerResponse): void;

  /**
   * 发送消息到客户端
   * @param context 出站消息上下文
   */
  sendMessage(context: OutboundMessageContext): Promise<void>;

  /**
   * 关闭插件
   */
  shutdown(): Promise<void>;
}

/**
 * Channel 插件基类
 */
export abstract class BaseChannelPlugin implements ChannelPlugin {
  protected config?: ChannelConfig;
  protected initialized = false;

  abstract getName(): string;
  abstract getType(): string;

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config;
    await this.onInitialize();
    this.initialized = true;
  }

  abstract handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void;

  abstract handleWebhook(request: IncomingMessage, response: ServerResponse): void;

  abstract sendMessage(context: OutboundMessageContext): Promise<void>;

  async shutdown(): Promise<void> {
    await this.onShutdown();
    this.initialized = false;
  }

  /**
   * 初始化钩子，子类可重写
   */
  protected async onInitialize(): Promise<void> {
    // 默认空实现
  }

  /**
   * 关闭钩子，子类可重写
   */
  protected async onShutdown(): Promise<void> {
    // 默认空实现
  }

  /**
   * 生成唯一 ID
   */
  protected generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
