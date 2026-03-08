/**
 * LLM Service IPC 通信协议
 * 定义Worker和Master之间通信的消息格式
 */

// 请求类型
export type LLMRequestType = 
  | "llm:chat"
  | "llm:stream-chat"
  | "llm:multimodal"
  | "llm:route"
  | "llm:quota-stats"
  | "llm:transcribe"
  | "llm:synthesize";

// 响应类型
export type LLMResponseType =
  | "llm:response"
  | "llm:stream-chunk"
  | "llm:stream-end"
  | "llm:error"
  | "llm:route-response"
  | "llm:quota-stats-response"
  | "llm:transcribe-response"
  | "llm:synthesize-response";

// 基础请求接口
export interface LLMIPCRequest {
  id: string;
  type: LLMRequestType;
  workerId: string;
  agentId: string;
  payload: any;
}

// 基础响应接口
export interface LLMIPCResponse {
  id: string;
  requestId: string;
  type: LLMResponseType;
  workerId: string;
  agentId: string;
  payload: any;
  error?: string;
}

// 具体请求类型

export interface ChatRequestPayload {
  capability: string;
  complexity?: "low" | "medium" | "high";
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  instanceId?: string; // 指定特定实例
}

export interface StreamChatRequestPayload extends ChatRequestPayload {}

export interface MultimodalRequestPayload {
  capability: string;
  complexity?: "low" | "medium" | "high";
  prompt: string;
  images?: string[];
  audio?: string[];
  audioFormat?: string;
  temperature?: number;
  maxTokens?: number;
  instanceId?: string; // 指定特定实例
}

export interface RouteRequestPayload {
  capability: string;
  complexity?: "low" | "medium" | "high";
  requireRealtime?: boolean;
}

// 具体响应类型

export interface ChatResponsePayload {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  routeInfo: {
    instanceId: string;
    instanceName: string;
    modelName: string;
    provider: string;
    quotaType: string;
  };
}

export interface StreamChunkPayload {
  content: string;
  finishReason?: string;
}

export interface StreamEndPayload {
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  routeInfo: {
    instanceId: string;
    instanceName: string;
    modelName: string;
    provider: string;
    quotaType: string;
  };
}

export interface RouteResponsePayload {
  instanceId: string;
  instanceName: string;
  modelName: string;
  provider: string;
  quotaType: string;
}

export interface QuotaStatsPayload {
  [configId: string]: {
    totalKeys: number;
    activeKeys: number;
    totalQuota: number;
    usedQuota: number;
    quotaType: string;
  };
}

// 消息工厂函数

export function createChatRequest(
  id: string,
  workerId: string,
  agentId: string,
  payload: ChatRequestPayload
): LLMIPCRequest {
  return {
    id,
    type: "llm:chat",
    workerId,
    agentId,
    payload,
  };
}

export function createStreamChatRequest(
  id: string,
  workerId: string,
  agentId: string,
  payload: StreamChatRequestPayload
): LLMIPCRequest {
  return {
    id,
    type: "llm:stream-chat",
    workerId,
    agentId,
    payload,
  };
}

export function createMultimodalRequest(
  id: string,
  workerId: string,
  agentId: string,
  payload: MultimodalRequestPayload
): LLMIPCRequest {
  return {
    id,
    type: "llm:multimodal",
    workerId,
    agentId,
    payload,
  };
}

export function createRouteRequest(
  id: string,
  workerId: string,
  agentId: string,
  payload: RouteRequestPayload
): LLMIPCRequest {
  return {
    id,
    type: "llm:route",
    workerId,
    agentId,
    payload,
  };
}

export function createResponse(
  requestId: string,
  workerId: string,
  agentId: string,
  payload: any
): LLMIPCResponse {
  return {
    id: generateMessageId(),
    requestId,
    type: "llm:response",
    workerId,
    agentId,
    payload,
  };
}

export function createStreamChunk(
  requestId: string,
  workerId: string,
  agentId: string,
  payload: StreamChunkPayload
): LLMIPCResponse {
  return {
    id: generateMessageId(),
    requestId,
    type: "llm:stream-chunk",
    workerId,
    agentId,
    payload,
  };
}

export function createStreamEnd(
  requestId: string,
  workerId: string,
  agentId: string,
  payload: StreamEndPayload
): LLMIPCResponse {
  return {
    id: generateMessageId(),
    requestId,
    type: "llm:stream-end",
    workerId,
    agentId,
    payload,
  };
}

export function createErrorResponse(
  requestId: string,
  workerId: string,
  agentId: string,
  error: string
): LLMIPCResponse {
  return {
    id: generateMessageId(),
    requestId,
    type: "llm:error",
    workerId,
    agentId,
    payload: {},
    error,
  };
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
