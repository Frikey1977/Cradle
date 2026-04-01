/**
 * 通道插件基类
 * 
 * 简化版的 BaseChannel 抽象类
 * 参考 OpenClaw 设计，移除 84 个适配器接口
 */

import type {
  InboundMessageContext,
  OutboundMessageContext,
  ChatType,
  ChannelCapabilities,
} from "./types.js";
import type { ProcessResult } from "../core/types.js";

/**
 * 通道配置选项
 */
export interface ChannelPluginOptions {
  /** 通道ID */
  channelId: string;
  /** 通道名称 */
  channelName: string;
  /** 通道配置 */
  config: Record<string, unknown>;
  /** 凭证信息 */
  credentials?: Record<string, string>;
  /** 企业ID */
  enterpriseId?: string;
}

/**
 * 通道插件基类
 * 
 * 所有通道插件必须继承此类
 */
export abstract class BaseChannel {
  /** 通道ID */
  protected readonly channelId: string;
  /** 通道名称 */
  protected readonly channelName: string;
  /** 通道配置 */
  protected config: Record<string, unknown>;
  /** 凭证信息 */
  protected credentials?: Record<string, string>;
  /** 企业ID */
  protected enterpriseId?: string;
  /** 是否已初始化 */
  protected initialized = false;
  /** 是否正在运行 */
  protected running = false;

  constructor(options: ChannelPluginOptions) {
    this.channelId = options.channelId;
    this.channelName = options.channelName;
    this.config = options.config;
    this.credentials = options.credentials;
    this.enterpriseId = options.enterpriseId;
  }

  /**
   * 获取通道类型标识
   * 例如: "webui", "dingtalk", "telegram"
   */
  abstract getChannelType(): string;

  /**
   * 获取通道能力声明
   */
  abstract getCapabilities(): ChannelCapabilities;

  /**
   * 初始化通道
   * 验证配置、建立连接等
   */
  async initialize(): Promise<ProcessResult> {
    try {
      await this.onInitialize();
      this.initialized = true;
      return {
        success: true,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "INIT_FAILED",
          message: error instanceof Error ? error.message : "初始化失败",
        },
        processingTime: 0,
      };
    }
  }

  /**
   * 启动通道
   * 开始接收消息
   */
  async start(): Promise<ProcessResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: {
          code: "NOT_INITIALIZED",
          message: "通道未初始化",
        },
        processingTime: 0,
      };
    }

    try {
      await this.onStart();
      this.running = true;
      return {
        success: true,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "START_FAILED",
          message: error instanceof Error ? error.message : "启动失败",
        },
        processingTime: 0,
      };
    }
  }

  /**
   * 停止通道
   * 停止接收消息
   */
  async stop(): Promise<ProcessResult> {
    try {
      await this.onStop();
      this.running = false;
      return {
        success: true,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "STOP_FAILED",
          message: error instanceof Error ? error.message : "停止失败",
        },
        processingTime: 0,
      };
    }
  }

  /**
   * 发送消息
   * @param context 出站消息上下文
   */
  abstract sendMessage(context: OutboundMessageContext): Promise<ProcessResult>;

  /**
   * 标准化目标地址
   * 将各种格式的地址转换为标准格式
   * @param raw 原始地址
   */
  abstract normalizeTarget(raw: string): string | undefined;

  /**
   * 解析入站消息
   * 将原始消息转换为标准格式
   * @param raw 原始消息数据
   */
  abstract parseInboundMessage(raw: unknown): InboundMessageContext | undefined;

  /**
   * 格式化出站消息
   * 将标准格式转换为通道特定格式
   * @param context 出站消息上下文
   */
  abstract formatOutboundMessage(context: OutboundMessageContext): unknown;

  /**
   * 检查是否为有效的目标ID
   * @param raw 原始地址
   */
  abstract looksLikeTargetId(raw: string): boolean;

  /**
   * 获取通道状态
   */
  getStatus(): {
    initialized: boolean;
    running: boolean;
    channelId: string;
    channelType: string;
  } {
    return {
      initialized: this.initialized,
      running: this.running,
      channelId: this.channelId,
      channelType: this.getChannelType(),
    };
  }

  /**
   * 更新配置
   * @param config 新配置
   */
  updateConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 更新凭证
   * @param credentials 新凭证
   */
  updateCredentials(credentials: Record<string, string>): void {
    this.credentials = { ...this.credentials, ...credentials };
  }

  /**
   * 初始化钩子（子类可覆盖）
   */
  protected async onInitialize(): Promise<void> {
    // 默认空实现
  }

  /**
   * 启动钩子（子类可覆盖）
   */
  protected async onStart(): Promise<void> {
    // 默认空实现
  }

  /**
   * 停止钩子（子类可覆盖）
   */
  protected async onStop(): Promise<void> {
    // 默认空实现
  }
}

/**
 * 通道插件工厂函数类型
 */
export type ChannelPluginFactory = (
  options: ChannelPluginOptions,
) => BaseChannel;

/**
 * 通道插件注册表
 */
export class ChannelPluginRegistry {
  private static plugins = new Map<string, ChannelPluginFactory>();

  /**
   * 注册通道插件
   * @param type 通道类型
   * @param factory 工厂函数
   */
  static register(type: string, factory: ChannelPluginFactory): void {
    this.plugins.set(type.toLowerCase(), factory);
  }

  /**
   * 创建通道实例
   * @param type 通道类型
   * @param options 配置选项
   */
  static create(type: string, options: ChannelPluginOptions): BaseChannel | undefined {
    const factory = this.plugins.get(type.toLowerCase());
    return factory?.(options);
  }

  /**
   * 检查是否支持某通道类型
   * @param type 通道类型
   */
  static has(type: string): boolean {
    return this.plugins.has(type.toLowerCase());
  }

  /**
   * 获取所有支持的通道类型
   */
  static getSupportedTypes(): string[] {
    return Array.from(this.plugins.keys());
  }
}
