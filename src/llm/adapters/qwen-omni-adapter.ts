/**
 * Qwen-Omni 专用适配器
 * 处理 Qwen-Omni 模型的特殊音频输入格式要求
 */

import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
import type { AdapterConfig, MultimodalInput, ModelType, ModelCapability } from "./model-adapter-interface.js";
import type { ChatCompletionResponse, StreamChunk } from "../runtime/types.js";

export class QwenOmniAdapter extends OpenAICompatibleAdapter {
  readonly modelType: ModelType = "omni";
  readonly capabilities: ModelCapability[] = [
    "textGeneration",
    "visualComprehension",
    "speechRecognition",
    "speechSynthesis",
  ];
  
  constructor(config: AdapterConfig) {
    super(config);
    
    // Qwen-Omni 特定参数
    this.config.modelParams = {
      ...this.config.modelParams,
      // 可以在这里添加 Omni 特定的默认参数
    };
  }
  
  /**
   * 构建多模态消息
   * Qwen-Omni 使用特定的 input_audio 格式
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
    
    // 添加音频 - Qwen-Omni 特定格式
    if (input.audio) {
      for (const audio of input.audio) {
        const audioFormat = input.audioFormat || "wav";
        
        // Qwen-Omni 要求 data 字段是完整的 data URL 格式
        const audioData = audio.startsWith("data:")
          ? audio  // 已经是 data url 格式: data:audio/wav;base64,xxx
          : `data:audio/${audioFormat};base64,${audio}`;  // 包装成 data url
        
        content.push({
          type: "input_audio",
          input_audio: {
            data: audioData,
            format: audioFormat,
          },
        });
      }
    }
    
    return [{ role: "user", content }];
  }
  
  /**
   * 多模态对话（非流式）
   */
  async multimodalChat(input: MultimodalInput): Promise<ChatCompletionResponse> {
    const messages = this.buildMultimodalMessages(input);
    
    return this.chatCompletion({
      model: this.config.modelName,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    });
  }
  
  /**
   * 多模态对话（流式）
   */
  async *streamMultimodalChat(input: MultimodalInput): AsyncGenerator<StreamChunk, void, unknown> {
    const messages = this.buildMultimodalMessages(input);
    
    yield* this.streamChatCompletion({
      model: this.config.modelName,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    });
  }
}
