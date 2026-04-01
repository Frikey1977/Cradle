/**
 * OpenAI 兼容适配器
 * 支持所有 OpenAI API 兼容的模型（OpenAI、Azure、DashScope 等）
 */

import { BaseModelAdapter } from "./base-adapter.js";
import type {
  AdapterConfig,
  ModelType,
  ModelCapability,
  MultimodalInput,
} from "./model-adapter-interface.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "../runtime/types.js";
import { getLLMLogger } from "../../utils/llm-logger.js";

export class OpenAICompatibleAdapter extends BaseModelAdapter {
  readonly modelType: ModelType = "text";
  readonly capabilities: ModelCapability[] = ["textGeneration"];
  
  constructor(config: AdapterConfig) {
    super(config);
    
    // 根据模型名称推断类型和能力
    this.inferModelTypeAndCapabilities();
  }
  
  /**
   * 根据模型名称推断类型和能力
   */
  private inferModelTypeAndCapabilities(): void {
    const modelName = this.config.modelName.toLowerCase();
    
    // 多模态模型检测
    if (
      modelName.includes("gpt-4o") ||
      modelName.includes("gpt-4-vision") ||
      modelName.includes("qwen-vl") ||
      modelName.includes("qwen2-vl") ||
      modelName.includes("llava")
    ) {
      (this as any).modelType = "multimodal";
      this.capabilities.push("visualComprehension");
    }
    
    // Omni 模型检测（支持音频）
    if (
      modelName.includes("omni") ||
      modelName.includes("qwen-audio") ||
      modelName.includes("qwen2-audio")
    ) {
      (this as any).modelType = "omni";
      this.capabilities.push("speechRecognition", "speechSynthesis");
    }
    
    // 嵌入模型检测
    if (
      modelName.includes("embedding") ||
      modelName.includes("embed")
    ) {
      (this as any).modelType = "embedding";
      this.capabilities.push("embedding");
    }
  }
  
  /**
   * 非流式对话完成
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    // 从 modelParams 中移除 stream_options，因为它只在 stream: true 时有效
    const { stream_options, ...restModelParams } = this.config.modelParams || {};
    
    const requestBody: any = {
      ...restModelParams,
      model: request.model || this.config.modelName,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      stream: false,
    };
    
    // 传递 tools 和 tool_choice（如果有）
    if (request.tools && request.tools.length > 0) {
      requestBody.tools = request.tools;
      // 设置 tool_choice 为 auto，让模型自动决定是否使用工具
      requestBody.tool_choice = "auto";
    }
    
    // 传递其他参数
    if (request.response_format) {
      requestBody.response_format = request.response_format;
    }
    if (request.modalities) {
      requestBody.modalities = request.modalities;
    }
    if (request.audio) {
      requestBody.audio = request.audio;
    }
    
    const logger = getLLMLogger();
    const startTime = Date.now();

    // 截断过长的日志内容
    const MAX_LOG_LENGTH = 10000;
    const truncate = (str: string, maxLen: number): string => {
      if (!str || str.length <= maxLen) return str;
      return str.substring(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
    };

    logger.logRequest({
      model: requestBody.model,
      provider: this.config.provider,
      instanceId: this.config.instanceId,
      requestBody: {
        ...requestBody,
        messages: requestBody.messages?.map((m: any) => ({
          ...m,
          content: typeof m.content === 'string' ? truncate(m.content, MAX_LOG_LENGTH) : m.content,
        })),
      },
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
      contactName: request.contactName,
    });

    console.log(`[OpenAIAdapter] Sending request to ${url}:`);
    console.log(`[OpenAIAdapter] Request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 记录错误
        logger.logError({
          model: requestBody.model,
          provider: this.config.provider,
          instanceId: this.config.instanceId,
          error: `HTTP ${response.status}: ${errorText}`,
          duration: Date.now() - startTime,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const duration = Date.now() - startTime;

      // 特别检查 tool_calls
      const toolCalls = (data.choices as any[])?.[0]?.message?.tool_calls;
      const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      console.log(`[OpenAIAdapter] Received response:`);
      console.log(`[OpenAIAdapter] Response data:`, JSON.stringify(data, null, 2));
      console.log(`[OpenAIAdapter] Has tool_calls: ${!!toolCalls}, count: ${toolCalls?.length || 0}`);

      // 截断工具调用参数到 300 字符
      const TOOL_ARGS_MAX_LENGTH = 300;
      const truncateToolCalls = (toolCalls: any[] | undefined): any[] | undefined => {
        if (!toolCalls) return undefined;
        return toolCalls.map((tc: any) => ({
          ...tc,
          function: tc.function ? {
            ...tc.function,
            arguments: tc.function.arguments && tc.function.arguments.length > TOOL_ARGS_MAX_LENGTH
              ? tc.function.arguments.substring(0, TOOL_ARGS_MAX_LENGTH) + `...[truncated ${tc.function.arguments.length - TOOL_ARGS_MAX_LENGTH} chars]`
              : tc.function.arguments,
          } : undefined,
        }));
      };

      logger.logResponse({
        model: requestBody.model,
        provider: this.config.provider,
        instanceId: this.config.instanceId,
        responseData: {
          ...data,
          choices: (data.choices as any[])?.map((c: any) => ({
            ...c,
            message: c.message ? {
              ...c.message,
              content: c.message.content && c.message.content.length > 10000
                ? c.message.content.substring(0, 10000) + '...[truncated]'
                : c.message.content,
            } : undefined,
          })),
        },
        duration: duration,
        toolCalls: truncateToolCalls(toolCalls),
        tokenUsage: usage ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
        } : undefined,
        source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
        contactName: request.contactName,
      });

      return this.normalizeResponse(data);
    } catch (error) {
      // 记录异常
      logger.logError({
        model: requestBody.model,
        provider: this.config.provider,
        instanceId: this.config.instanceId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
  
  /**
   * 流式对话完成
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const requestBody: any = {
      model: request.model || this.config.modelName,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      ...this.config.modelParams,
    };
    
    if (request.tools && request.tools.length > 0) {
      requestBody.tools = request.tools;
      requestBody.tool_choice = "auto";
    }
    
    if (request.modalities) {
      requestBody.modalities = request.modalities;
    }
    if (request.audio) {
      requestBody.audio = request.audio;
    }
    
    const logger = getLLMLogger();
    const startTime = Date.now();

    // 截断过长的日志内容
    const MAX_LOG_LENGTH = 10000;
    const truncate = (str: string, maxLen: number): string => {
      if (!str || str.length <= maxLen) return str;
      return str.substring(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
    };

    logger.logRequest({
      model: requestBody.model,
      provider: this.config.provider,
      instanceId: this.config.instanceId,
      requestBody: {
        ...requestBody,
        messages: requestBody.messages?.map((m: any) => ({
          ...m,
          content: typeof m.content === 'string' ? truncate(m.content, MAX_LOG_LENGTH) : m.content,
        })),
      },
      source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
        contactName: request.contactName,
    });

    console.log(`[OpenAIAdapter] Stream request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.logError({
          model: requestBody.model,
          provider: this.config.provider,
          instanceId: this.config.instanceId,
          error: `HTTP ${response.status}: ${errorText}`,
          duration: Date.now() - startTime,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const streamId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[OpenAIAdapter] [${streamId}] Starting stream response`);

      const chunks: any[] = [];
      const toolCallsMap = new Map<number, any>();
      let hasToolCalls = false;
      let streamUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      try {
        for await (const chunk of this.parseSSEStream(response, logger, requestBody.model, startTime)) {
          chunks.push(chunk);

          if (chunk.usage) {
            streamUsage = chunk.usage;
          }

          const deltaToolCalls = chunk.choices?.[0]?.delta?.tool_calls;
          if (deltaToolCalls && deltaToolCalls.length > 0) {
            hasToolCalls = true;
            for (const delta of deltaToolCalls) {
              const deltaAny = delta as any;
              const index = deltaAny.index || 0;
              const existing = toolCallsMap.get(index);
              if (existing) {
                if (deltaAny.id) existing.id = deltaAny.id;
                if (deltaAny.type) existing.type = deltaAny.type;
                if (deltaAny.function?.name) {
                  existing.function = existing.function || {};
                  existing.function.name = deltaAny.function.name;
                }
                if (deltaAny.function?.arguments) {
                  existing.function = existing.function || {};
                  existing.function.arguments = (existing.function.arguments || '') + deltaAny.function.arguments;
                }
              } else {
                toolCallsMap.set(index, {
                  index: index,
                  id: deltaAny.id || '',
                  type: deltaAny.type || 'function',
                  function: {
                    name: deltaAny.function?.name || '',
                    arguments: deltaAny.function?.arguments || '',
                  },
                });
              }
            }
          }

          yield chunk;
        }
      } finally {
        const duration = Date.now() - startTime;
        
        const fullContent = chunks
          .map(c => c.choices?.[0]?.delta?.content)
          .filter(Boolean)
          .join('');
        
        const fullReasoningContent = chunks
          .map(c => c.choices?.[0]?.delta?.reasoning_content)
          .filter(Boolean)
          .join('');
        
        const mergedToolCalls = Array.from(toolCallsMap.values()).sort((a: any, b: any) => a.index - b.index);
        
        const TOOL_ARGS_MAX_LENGTH = 300;
        const truncatedToolCalls = mergedToolCalls.length > 0 
          ? mergedToolCalls.map((tc: any) => ({
              ...tc,
              function: tc.function ? {
                ...tc.function,
                arguments: tc.function.arguments && tc.function.arguments.length > TOOL_ARGS_MAX_LENGTH
                  ? tc.function.arguments.substring(0, TOOL_ARGS_MAX_LENGTH) + `...[truncated ${tc.function.arguments.length - TOOL_ARGS_MAX_LENGTH} chars]`
                  : tc.function.arguments,
              } : undefined,
            }))
          : undefined;
        
        logger.logResponse({
          model: requestBody.model,
          provider: this.config.provider,
          instanceId: this.config.instanceId,
          responseData: {
            stream: true,
            chunks: chunks.length,
            hasToolCalls: hasToolCalls,
            streamId: streamId,
            toolCalls: truncatedToolCalls,
            fullContent: fullContent.length > 10000 ? fullContent.substring(0, 10000) + '...[truncated]' : fullContent,
            reasoningContent: fullReasoningContent.length > 10000 ? fullReasoningContent.substring(0, 10000) + '...[truncated]' : fullReasoningContent || undefined,
          },
          duration: duration,
          tokenUsage: streamUsage ? {
            prompt: streamUsage.prompt_tokens,
            completion: streamUsage.completion_tokens,
            total: streamUsage.total_tokens,
          } : undefined,
          source: request.source,
          agentName: request.agentName,
          worktaskId: request.worktaskId,
          contactName: request.contactName,
        });
        
        console.log(`[OpenAIAdapter] [${streamId}] Stream completed: ${chunks.length} chunks, duration: ${duration}ms, hasToolCalls: ${hasToolCalls}, contentLength: ${fullContent.length}, reasoningLength: ${fullReasoningContent.length}, usage: ${streamUsage ? JSON.stringify(streamUsage) : 'N/A'}`);
      }
    } catch (error) {
      logger.logError({
        model: requestBody.model,
        provider: this.config.provider,
        instanceId: this.config.instanceId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
  
  /**
   * 多模态对话（非流式）
   * 对于 OpenAI 兼容模型，使用标准消息格式
   */
  async multimodalChat(input: MultimodalInput): Promise<ChatCompletionResponse> {
    // 构建 OpenAI 兼容的多模态消息
    const content: any[] = [];
    
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
            detail: "auto",
          },
        });
      }
    }
    
    // OpenAI 目前不支持音频输入（除了 GPT-4o Audio）
    // 如果有音频，需要特殊处理
    if (input.audio && this.modelType === "omni") {
      // GPT-4o Audio 使用特定格式
      for (const audio of input.audio) {
        content.push({
          type: "input_audio",
          input_audio: {
            data: audio.startsWith("data:") ? audio.split(",")[1] : audio,
            format: input.audioFormat || "wav",
          },
        });
      }
    }
    
    // 构建请求，对于纯语音识别（有音频输入但没有音频输出需求），只返回文本
    const request: ChatCompletionRequest = {
      model: this.config.modelName,
      messages: [{ role: "user", content }],
      temperature: 0.7,
      max_tokens: 2048,
    };
    
    // 如果是语音识别（有音频输入但没有要求音频输出），设置 modalities 为 ["text"]
    if (input.audio && !input.audioOutput) {
      request.modalities = ["text"];
    }
    
    return this.chatCompletion(request);
  }
  
  /**
   * 多模态对话（流式）
   */
  async *streamMultimodalChat(input: MultimodalInput): AsyncGenerator<StreamChunk, void, unknown> {
    const content: any[] = [];
    
    if (input.prompt) {
      content.push({ type: "text", text: input.prompt });
    }
    
    if (input.images) {
      for (const image of input.images) {
        content.push({
          type: "image_url",
          image_url: {
            url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
            detail: "auto",
          },
        });
      }
    }
    
    if (input.audio && this.modelType === "omni") {
      for (const audio of input.audio) {
        content.push({
          type: "input_audio",
          input_audio: {
            data: audio.startsWith("data:") ? audio.split(",")[1] : audio,
            format: input.audioFormat || "wav",
          },
        });
      }
    }
    
    yield* this.streamChatCompletion({
      model: this.config.modelName,
      messages: [{ role: "user", content }],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });
  }
}
