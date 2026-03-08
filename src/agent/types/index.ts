/**
 * Agent 运行时类型定义
 */

// 导出画像类型
export * from "./profile.js";

/**
 * 多模型协作配置
 */
export interface MultiModelCollaborationConfig {
  /** 是否启用多模型协作 */
  enabled: boolean;
  /** 语音识别模型实例ID */
  speechRecognitionInstanceId?: string;
  /** 主对话模型实例ID */
  mainModelInstanceId?: string;
  /** 语音合成模型实例ID */
  speechSynthesisInstanceId?: string;
  /** 是否启用流式协作（实验性） */
  enableStreaming?: boolean;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  model: ModelConfig;
  runtime?: RuntimeConfig;
  /** 多模型协作配置 */
  multiModelCollaboration?: MultiModelCollaborationConfig;
  /** 渐进式披露配置 */
  progressiveDisclosure?: ProgressiveDisclosureConfig;
}

/**
 * 渐进式披露配置
 */
export interface ProgressiveDisclosureConfig {
  /** 是否启用渐进式披露（默认 false，使用传统模式） */
  enabled: boolean;
  /** 披露模式：metadata（主Agent意图识别） | intent（Executor按需加载） */
  mode?: "metadata" | "intent" | "full";
  /** 最大同时披露的 Body 级 Skills 数量 */
  maxBodySkills?: number;
  /** 最大同时披露的 Full 级 Skills 数量 */
  maxFullSkills?: number;
}

/**
 * 模型配置
 * 支持两种模式：
 * 1. 传统模式：provider + model（自动路由）
 * 2. 精确模式：instanceId（直接指定实例）
 */
export interface ModelConfig {
  /** 实例ID（优先使用，直接指定LLM实例） */
  instanceId?: string;
  /** 提供商（与model配合使用） */
  provider?: string;
  /** 模型名称（与provider配合使用） */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
}

/**
 * 运行时配置
 */
export interface RuntimeConfig {
  identity?: {
    emoji?: string;
    displayName?: string;
  };
  behavior?: {
    humanDelay?: {
      enabled: boolean;
      minMs?: number;
      maxMs?: number;
    };
  };
}

/**
 * Agent 个人资料
 */
export interface AgentProfile {
  facts: string[];
  preferences: {
    language?: string;
    tone?: string;
    responseStyle?: string;
  };
  welcomeMessage?: string;
}

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  enabled: boolean;
  interval: string; // 如 "30m", "1h"
  activeHours?: {
    start: string; // "09:00"
    end: string; // "18:00"
    timezone?: string;
  };
  prompt?: string;
}

/**
 * Agent 运行时状态
 */
export interface RuntimeState {
  status: 'idle' | 'running' | 'error' | 'paused';
  lastHeartbeat: Date;
  nextHeartbeat: Date;
  consecutiveErrors: number;
  currentConversation?: string;
}

/**
 * Agent 消息
 */
export interface AgentMessage {
  messageId?: string;
  agentId: string;
  contactId: string;
  content: string;
  conversationId?: string;
  channelName: string;
  timestamp: number;
  isHeartbeat?: boolean;
  /** 音频数据 */
  audio?: {
    data: string;
    format: string;
    duration?: number;
  };
  /** 图片数据（Base64数组） */
  images?: string[];
  metadata?: Record<string, any>;
  /** 是否使用流式输出 */
  stream?: boolean;
  /** 是否返回语音回复（语音对话模式） */
  voiceResponse?: boolean;
  /** 语音合成音色 */
  voice?: string;
  /** 思考消息回调函数，用于在 LLM 调用前立即发送思考消息 */
  onThinkingMessage?: (message: string) => void;
}

/**
 * Agent 响应
 */
export interface AgentResponse {
  content: string;
  actions?: Action[];
  /** 音频输出（Base64） */
  audio?: {
    data: string;
    format: string;
  };
  metadata?: {
    agentName: string;
    timestamp: number;
    modelUsed?: string;
    // 多模型协作相关
    recognizedText?: string;
    collaborationMode?: boolean;
    pendingSpeechSynthesis?: boolean;
    speechSynthesisConfig?: {
      format: string;
      instanceId?: string;
      voice?: string; // 语音合成音色
    };
    [key: string]: any;
  };
  /** 思考消息（系统消息） */
  thinkingMessage?: string;
  /** 是否为流式响应 */
  stream?: boolean;
  /** 流式内容生成器（仅在 stream=true 时有效） */
  contentStream?: AsyncGenerator<string, void, unknown>;
  /** 流式响应结束后的 tool calls（如果有） */
  streamToolCalls?: ToolCall[];
}

/**
 * 动作定义
 */
export interface Action {
  type: string;
  payload: Record<string, any>;
}

/**
 * 上下文参数
 */
export interface ContextParams {
  agentId: string;
  contactId: string;
  content: string;
  conversationId?: string;
  isHeartbeat: boolean;
  metadata?: Record<string, any>;
}

/**
 * 增强上下文
 */
export interface EnhancedContext {
  systemPrompt: string;
  modelConfig: ModelConfig;
  conversationHistory: ConversationMessage[];
  memories: Memory[];
  availableTools: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[];
  metadata: ContextMetadata;
}

/**
 * 对话消息
 */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/**
 * 记忆
 */
export interface Memory {
  id: string;
  content: string;
  type: string;
  relevance: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * 上下文元数据
 */
export interface ContextMetadata {
  agentId: string;
  contactId: string;
  isHeartbeat: boolean;
  /** 渐进式披露模式 */
  disclosureMode?: "full" | "metadata" | "intent";
  /** 匹配的 Skills（intent 模式） */
  matchedSkills?: string[];
  /** 意图匹配置信度（intent 模式） */
  intentConfidence?: number;
  /** 意图匹配原因（intent 模式） */
  intentReason?: string;
}

// 画像类型已从 ./profile.ts 导出

/**
 * LLM 请求
 */
export interface LLMRequest {
  model: ModelConfig;
  messages: ConversationMessage[];
  tools?: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  content: string;
  toolCalls?: {
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 音频输出（Base64，用于语音回复） */
  audio?: string;
  /** 扩展元数据 */
  metadata?: Record<string, any>;
}

/**
 * 工具调用
 */
export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

/**
 * Agent 数据（来自数据库）
 */
export interface AgentData {
  sid: string;
  name: string;
  config: AgentConfig;
  profile: AgentProfile;
  heartbeat?: HeartbeatConfig;
}
