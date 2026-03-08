/**
 * LLM 服务接口
 * 统一 LLMService 和 LLMClient 的接口定义
 */

import type { LLMRequest, LLMResponse, ModelConfig } from "../types/index.js";

export interface RouteInfo {
  instanceId: string;
  instanceName?: string;
  modelName: string;
  provider: string;
  billingType?: string;
}

export interface LLMServiceInterface {
  /**
   * 生成响应（非流式）
   */
  generate(request: LLMRequest): Promise<LLMResponse & { routeInfo?: RouteInfo }>;

  /**
   * 流式生成
   */
  streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown>;

  /**
   * 多模态对话（非流式）
   */
  multimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse & { routeInfo?: RouteInfo }>;

  /**
   * 多模态对话（流式）
   */
  streamMultimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string, void, unknown>;

  /**
   * 获取路由信息
   */
  getRouteInfo(options: {
    capability: string;
    complexity?: "low" | "medium" | "high";
  }): Promise<RouteInfo>;

  /**
   * 获取实例信息
   */
  getInstanceInfo(instanceId: string): { modelName: string; provider: string } | undefined;

  /**
   * 生成嵌入
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * 批量嵌入
   */
  batchEmbed(texts: string[]): Promise<number[][]>;

  /**
   * 分析图像
   */
  analyzeImage(imageBase64: string, prompt: string): Promise<string>;

  /**
   * 语音识别（STT）
   * 将音频转换为文本
   */
  transcribeAudio(
    audioData: string,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      instanceId?: string; // 指定特定实例
      onThinkingMessage?: (message: string) => void; // 思考消息回调
    }
  ): Promise<{ text: string; routeInfo?: RouteInfo }>;

  /**
   * 语音合成（TTS）
   * 将文本转换为音频
   */
  synthesizeSpeech(
    text: string,
    options?: {
      voice?: string;
      format?: string;
      speed?: number;
      instanceId?: string; // 指定特定实例
    }
  ): Promise<{ audio: string; format: string; routeInfo?: RouteInfo }>;

  /**
   * 验证配置
   */
  validateConfig(config: ModelConfig): boolean;

  /**
   * 获取可用模型
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * 获取统计信息
   */
  getStats(): any;

  /**
   * 停止服务
   */
  stop(): void;
}
