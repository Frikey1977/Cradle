/**
 * 语音识别专用适配器
 * 用于 ASR 模型（如 Paraformer）
 * 这些模型通常有专门的 API 格式
 */

import { BaseModelAdapter } from "./base-adapter.js";
import type {
  AdapterConfig,
  ModelType,
  ModelCapability,
  STTOptions,
} from "./model-adapter-interface.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "../runtime/types.js";

export class SpeechRecognitionAdapter extends BaseModelAdapter {
  readonly modelType: ModelType = "speech2text";
  readonly capabilities: ModelCapability[] = ["speechRecognition"];
  
  /**
   * 非流式对话 - ASR 模型不支持标准对话
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    throw new Error("Speech recognition models do not support chatCompletion. Use speechToText instead.");
  }
  
  /**
   * 流式对话 - ASR 模型不支持
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    throw new Error("Speech recognition models do not support streamChatCompletion. Use speechToText instead.");
  }
  
  /**
   * 语音识别
   * 调用 ASR 模型将音频转换为文本
   */
  async speechToText(options: STTOptions): Promise<string> {
    const url = `${this.config.baseUrl}/audio/transcriptions`;
    
    // 构建 multipart/form-data 请求
    const boundary = `----FormBoundary${Date.now()}`;
    const audioBuffer = Buffer.from(options.audio, "base64");
    
    const body = this.buildMultipartBody(boundary, {
      file: {
        buffer: audioBuffer,
        filename: `audio.${options.format}`,
        contentType: this.getAudioContentType(options.format),
      },
      model: this.config.modelName,
      sample_rate: options.sampleRate?.toString(),
      language: options.language,
    });
    
    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...this.config.headers,
      },
      body,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const data = await response.json() as any;
    
    // 标准化响应格式
    return data.text || data.result || data.transcription || "";
  }
  
  /**
   * 构建 multipart/form-data 请求体
   */
  private buildMultipartBody(
    boundary: string,
    fields: Record<string, any>
  ): Buffer {
    const chunks: Buffer[] = [];
    
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      
      if (typeof value === "object" && value.buffer) {
        // 文件字段
        chunks.push(Buffer.from(
          `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n` +
          `Content-Type: ${value.contentType}\r\n\r\n`
        ));
        chunks.push(value.buffer);
        chunks.push(Buffer.from("\r\n"));
      } else {
        // 普通字段
        chunks.push(Buffer.from(
          `Content-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
        ));
      }
    }
    
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return Buffer.concat(chunks);
  }
  
  /**
   * 获取音频内容的 MIME 类型
   */
  private getAudioContentType(format: string): string {
    const mimeTypes: Record<string, string> = {
      "wav": "audio/wav",
      "mp3": "audio/mpeg",
      "webm": "audio/webm",
      "ogg": "audio/ogg",
      "m4a": "audio/mp4",
      "pcm": "audio/pcm",
    };
    return mimeTypes[format.toLowerCase()] || "audio/wav";
  }
  
  /**
   * 多模态对话（非流式）
   * 对于 ASR 模型，将音频转为文本后返回
   */
  async multimodalChat(input: import("./model-adapter-interface.js").MultimodalInput): Promise<ChatCompletionResponse> {
    if (!input.audio || input.audio.length === 0) {
      throw new Error("Speech recognition model requires audio input");
    }
    
    // 识别音频
    const transcription = await this.speechToText({
      audio: input.audio[0],
      format: input.audioFormat || "wav",
      sampleRate: input.sampleRate,
    });
    
    // 返回标准响应格式
    return {
      id: `asr-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: this.config.modelName,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: transcription,
        },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
}
