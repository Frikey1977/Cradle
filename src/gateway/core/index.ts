/**
 * Gateway 核心模块
 *
 * 导出核心类型和工具函数
 */

// 类型定义
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
} from "./types.js";

// 工具函数
export {
  DEFAULT_GATEWAY_CONFIG,
  generateId,
  createStandardMessage,
  createConversationContext,
} from "./types.js";

// Worker
export { GatewayWorker, type WorkerConfig } from "./worker.js";

// Master
export { GatewayMaster, type MasterConfig } from "./master.js";
