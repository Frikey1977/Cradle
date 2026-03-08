/**
 * LLM 运行时类型定义
 */

/**
 * 内容部分（用于多模态消息）
 */
export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface AudioContentPart {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
}

export type ContentPart = TextContentPart | ImageContentPart | AudioContentPart;

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具调用增量（用于流式响应）
 */
export interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * 工具选择
 */
export interface ToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * 聊天完成请求（OpenAI 兼容格式）
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | ToolChoice;
  response_format?: { type: "text" | "json_object" };
  // 语音合成相关
  modalities?: ("text" | "audio")[];
  audio?: {
    voice?: string;
    format?: string;
  };
}

/**
 * 聊天完成响应（OpenAI 兼容格式）
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // 语音合成返回的音频数据
  audio?: {
    data: string;
    format?: string;
    voice?: string;
  };
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: ToolCall[];
      // 语音合成音频数据
      audio?: {
        data?: string;
        format?: string;
        voice?: string;
      };
    };
    finish_reason: string | null;
  }[];
}

/**
 * LLM 调用结果
 */
export interface LLMCallResult {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
  audio?: string; // Base64 编码的音频数据（用于语音合成）
}

/**
 * 适配器配置
 */
export interface AdapterConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
}
