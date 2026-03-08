/**
 * 基础模型适配器抽象类
 * 提供通用的 HTTP 请求处理和流式解析逻辑
 */

import type {
  IModelAdapter,
  AdapterConfig,
  ModelType,
  ModelCapability,
  MultimodalInput,
  TTSOptions,
  STTOptions,
  RealtimeSessionConfig,
  IRealtimeSession,
} from "./model-adapter-interface.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "../runtime/types.js";

/** 请求重试配置 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

/** 基础适配器配置 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000,
};

export abstract class BaseModelAdapter implements IModelAdapter {
  readonly config: AdapterConfig;
  abstract readonly modelType: ModelType;
  abstract readonly capabilities: ModelCapability[];
  
  protected retryConfig: RetryConfig;
  protected initialized = false;
  
  constructor(config: AdapterConfig, retryConfig?: Partial<RetryConfig>) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }
  
  /**
   * 初始化适配器
   * 子类可以覆盖此方法进行特定初始化
   */
  async initialize(): Promise<void> {
    // 验证配置
    if (!this.config.apiKey) {
      throw new Error(`API Key is required for adapter: ${this.config.modelName}`);
    }
    if (!this.config.baseUrl) {
      throw new Error(`Base URL is required for adapter: ${this.config.modelName}`);
    }
    this.initialized = true;
  }
  
  /**
   * 非流式对话完成
   * 子类必须实现此方法
   */
  abstract chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  
  /**
   * 流式对话完成
   * 子类必须实现此方法
   */
  abstract streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown>;
  
  /**
   * 多模态对话（非流式）
   * 默认实现：构建标准消息后调用 chatCompletion
   * 特殊模型（如 Qwen-Omni）可以覆盖此方法
   */
  async multimodalChat(input: MultimodalInput): Promise<ChatCompletionResponse> {
    const messages = this.buildMultimodalMessages(input);
    return this.chatCompletion({
      model: this.config.modelName,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });
  }
  
  /**
   * 多模态对话（流式）
   * 默认实现：构建标准消息后调用 streamChatCompletion
   */
  async *streamMultimodalChat(input: MultimodalInput): AsyncGenerator<StreamChunk, void, unknown> {
    const messages = this.buildMultimodalMessages(input);
    yield* this.streamChatCompletion({
      model: this.config.modelName,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });
  }
  
  /**
   * 构建多模态消息
   * 子类可以覆盖此方法以支持特定的消息格式
   */
  protected buildMultimodalMessages(input: MultimodalInput): any[] {
    const content: any[] = [];
    
    // 添加文本
    if (input.prompt) {
      content.push({ type: "text", text: input.prompt });
    }
    
    // 添加图像
    if (input.images) {
      for (const image of input.images) {
        content.push({
          type: "image_url",
          image_url: {
            url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
          },
        });
      }
    }
    
    // 添加音频（默认使用 input_audio 格式，OpenAI 兼容）
    if (input.audio) {
      for (const audio of input.audio) {
        const audioData = audio.startsWith("data:")
          ? audio
          : `data:audio/${input.audioFormat || "wav"};base64,${audio}`;
        content.push({
          type: "input_audio",
          input_audio: {
            data: audioData,
            format: input.audioFormat || "wav",
          },
        });
      }
    }
    
    return [{ role: "user", content }];
  }
  
  /**
   * 语音合成
   * 默认抛出错误，TTS 模型需要覆盖此方法
   */
  async textToSpeech(options: TTSOptions): Promise<Buffer> {
    throw new Error(`textToSpeech is not supported by ${this.config.modelName}`);
  }
  
  /**
   * 语音识别
   * 默认抛出错误，STT 模型需要覆盖此方法
   */
  async speechToText(options: STTOptions): Promise<string> {
    throw new Error(`speechToText is not supported by ${this.config.modelName}`);
  }
  
  /**
   * 创建实时语音会话
   * 默认抛出错误，实时语音模型需要覆盖此方法
   */
  async createRealtimeSession(config: RealtimeSessionConfig): Promise<IRealtimeSession> {
    throw new Error(`createRealtimeSession is not supported by ${this.config.modelName}`);
  }
  
  /**
   * 释放资源
   * 子类可以覆盖此方法进行资源清理
   */
  async dispose(): Promise<void> {
    this.initialized = false;
  }
  
  /**
   * 带重试的 HTTP 请求
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.retryConfig.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (retryCount < this.retryConfig.maxRetries) {
        console.warn(`[BaseModelAdapter] Request failed, retrying (${retryCount + 1}/${this.retryConfig.maxRetries})...`);
        await this.sleep(this.retryConfig.retryDelay * (retryCount + 1));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }
  
  /**
   * 解析 SSE 流
   */
  protected async *parseSSEStream(response: Response): AsyncGenerator<StreamChunk, void, unknown> {
    if (!response.body) {
      throw new Error("Response body is null");
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmed = line.trim();
          // 处理 SSE 格式: data: {...}
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]" || !data) continue;
            
            // 如果数据本身以 "data:" 开头，说明有多层嵌套，需要再次提取
            let jsonData = data;
            if (data.startsWith("data:")) {
              jsonData = data.slice(5).trim();
            }
            
            try {
              const chunk = JSON.parse(jsonData);
              // 调试：检查是否有 tool_calls
              const deltaToolCalls = chunk.choices?.[0]?.delta?.tool_calls;
              if (deltaToolCalls) {
                console.log(`[BaseModelAdapter] SSE chunk has tool_calls:`, JSON.stringify(deltaToolCalls));
              }
              yield this.normalizeStreamChunk(chunk);
            } catch (e) {
              console.warn("[BaseModelAdapter] Failed to parse SSE data:", jsonData);
            }
          } else if (trimmed) {
            // 尝试直接解析非 data: 开头的行（某些提供商可能不使用标准 SSE 格式）
            try {
              const chunk = JSON.parse(trimmed);
              yield this.normalizeStreamChunk(chunk);
            } catch {
              // 忽略无法解析的行
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * 标准化流式块
   * 将不同提供商的响应格式转换为统一格式
   */
  protected normalizeStreamChunk(rawChunk: any): StreamChunk {
    // OpenAI 兼容格式
    return {
      id: rawChunk.id || `chunk-${Date.now()}`,
      object: rawChunk.object || "chat.completion.chunk",
      created: rawChunk.created || Math.floor(Date.now() / 1000),
      model: rawChunk.model || this.config.modelName,
      choices: rawChunk.choices?.map((c: any) => ({
        index: c.index || 0,
        delta: {
          role: c.delta?.role,
          content: c.delta?.content || "",
          // 保留 tool_calls（用于 function calling）
          ...(c.delta?.tool_calls && { tool_calls: c.delta.tool_calls }),
          // 保留音频数据（用于语音合成）
          ...(c.delta?.audio && { audio: c.delta.audio }),
        },
        finish_reason: c.finish_reason,
      })) || [],
    };
  }
  
  /**
   * 标准化响应
   */
  protected normalizeResponse(rawResponse: any): ChatCompletionResponse {
    return {
      id: rawResponse.id || `resp-${Date.now()}`,
      object: rawResponse.object || "chat.completion",
      created: rawResponse.created || Math.floor(Date.now() / 1000),
      model: rawResponse.model || this.config.modelName,
      choices: rawResponse.choices?.map((c: any) => ({
        index: c.index || 0,
        message: {
          role: c.message?.role || "assistant",
          content: c.message?.content || "",
          // 保留 tool_calls（用于 function calling）
          ...(c.message?.tool_calls && { tool_calls: c.message.tool_calls }),
        },
        finish_reason: c.finish_reason,
      })) || [],
      usage: rawResponse.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      // 语音合成返回的音频数据
      ...(rawResponse.audio && {
        audio: {
          data: rawResponse.audio.data,
          format: rawResponse.audio.format,
          voice: rawResponse.audio.voice,
        },
      }),
    };
  }
  
  /**
   * 构建请求头
   */
  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
  }
  
  /**
   * 延迟
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 检查是否支持某能力
   */
  hasCapability(capability: ModelCapability): boolean {
    return this.capabilities.includes(capability);
  }
}
