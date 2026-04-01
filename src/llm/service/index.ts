/**
 * LLM 服务模块导出
 * 
 * 这是重构后的 LLM 服务模块，使用 ai SDK 进行流式对话
 * 提供流式工具调用、自动参数验证和更好的错误处理
 */

// 新架构导出（推荐）
export {
  streamWithTools,
  type AISDKServiceConfig,
  type StreamRequest,
  type StreamEvent,
} from "./ai-sdk-service.js";

// 旧架构导出（兼容）
export { LLMServiceManager, type RoutingTask, type RoutingDecision } from "./llm-service-manager.js";
