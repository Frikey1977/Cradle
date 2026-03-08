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
      // 不强制设置 tool_choice，让模型自动决定
      // if (request.tool_choice) {
      //   requestBody.tool_choice = request.tool_choice;
      // }
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
    
    console.log(`[OpenAIAdapter] Sending request to ${url}:`);
    console.log(`[OpenAIAdapter] Request body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const data = await response.json();
    console.log(`[OpenAIAdapter] Received response:`);
    console.log(`[OpenAIAdapter] Response data:`, JSON.stringify(data, null, 2));
    
    // 特别检查 tool_calls
    const responseData = data as any;
    const toolCalls = responseData.choices?.[0]?.message?.tool_calls;
    console.log(`[OpenAIAdapter] Has tool_calls: ${!!toolCalls}, count: ${toolCalls?.length || 0}`);
    
    return this.normalizeResponse(data);
  }
  
  /**
   * 流式对话完成
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    // 构建请求体，包含语音合成相关参数
    const requestBody: any = {
      model: request.model || this.config.modelName,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      stream: true,
      ...this.config.modelParams,
    };
    
    // 传递 tools（如果有）- 不强制设置 tool_choice
    if (request.tools && request.tools.length > 0) {
      requestBody.tools = request.tools;
    }
    
    // 传递语音合成相关参数（如果存在）
    if (request.modalities) {
      requestBody.modalities = request.modalities;
    }
    if (request.audio) {
      requestBody.audio = request.audio;
    }
    
    console.log(`[OpenAIAdapter] Stream request body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    yield* this.parseSSEStream(response);
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
