/**
 * Gateway Agent 模块
 *
 * 导出 Agent 相关的类型和接口
 */

// 类型定义
export type {
  AgentStatus,
  AgentRuntime,
  AgentProcessRequest,
  AgentProcessResult,
  AgentAction,
  IAgent,
  AgentFactory,
  MemoryRetrievalRequest,
  MemoryEntry,
  MemoryRetrievalResult,
  ToolDefinition,
  ToolCallRequest,
  ToolCallResult,
} from "./types.js";

// 注册表
export { AgentRegistry } from "./types.js";
