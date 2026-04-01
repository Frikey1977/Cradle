/**
 * Gateway 入口文件
 *
 * 导出所有 Gateway 模块，提供统一的接口
 */

// 核心模块
export {
  // Master/Worker
  GatewayMaster,
  GatewayWorker,
  type MasterConfig,
  type WorkerConfig,
} from "./core/index.js";

// 通道模块
export {
  // 基类
  BaseChannel,
  ChannelPluginRegistry,
  type ChannelPluginOptions,
  // 类型
  type ChannelConfig,
  type ChannelCapabilities,
  type InboundMessageContext,
  type OutboundMessageContext,
  type ChatType,
} from "./channels/index.js";

// 通道插件
export { WebUIChannel } from "./channels/plugins/webui-channel.js";
export { DingTalkChannel } from "./channels/plugins/dingtalk-channel.js";

// Agent 模块
export {
  type IAgent,
  type AgentProcessRequest,
  type AgentProcessResult,
  type AgentAction,
  type AgentRegistry,
  type MemoryEntry,
  type MemoryRetrievalResult,
  type ToolDefinition,
  type ToolCallRequest,
  type ToolCallResult,
} from "./agent/index.js";

// IPC 模块
export {
  type IPCMessage,
  type ProcessStats,
  type ProcessType,
} from "./ipc/types.js";

// 核心类型
export type {
  MessageRole,
  ContentType,
  ContentBlock,
  StandardMessage,
  ConversationContext,
  AgentConfig,
  StrangerPolicy,
  StrangerInfo,
  RouteDecision,
  ProcessResult,
  LLMRequestConfig,
  LLMResponse,
  GatewayConfig,
} from "./core/types.js";

// 工具函数
export {
  DEFAULT_GATEWAY_CONFIG,
  generateId,
  createStandardMessage,
  createConversationContext,
} from "./core/types.js";

/**
 * Gateway 版本
 */
export const VERSION = "1.0.0";

/**
 * Gateway 信息
 */
export const GATEWAY_INFO = {
  name: "Cradle Gateway",
  version: VERSION,
  description: "Multi-channel message gateway for Cradle",
} as const;
