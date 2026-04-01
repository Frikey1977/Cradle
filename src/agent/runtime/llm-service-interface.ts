/**
 * LLM 服务接口
 * 统一 LLMService 和 LLMClient 的接口定义
 */

import type { ModelMessage } from "ai";
import type { LLMRequest, LLMResponse, ModelConfig } from "../types/index.js";
import type { ToolDefinition } from "../tools/tool-definitions.js";

export interface RouteInfo {
  instanceId: string;
  instanceName?: string;
  modelName: string;
  provider: string;
  billingType?: string;
}

export interface StreamEvent {
  type: "text" | "tool-call" | "tool-result" | "error" | "finish" | "step-finish" | "reasoning";
  content?: string;
  reasoning?: string;
  toolCall?: {
    id: string;
    name: string;
    args: unknown;
  };
  toolResult?: {
    callId: string;
    output: string;
  };
  error?: Error;
  finishReason?: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface StreamWithToolsRequest {
  messages: ModelMessage[];
  tools: ToolDefinition[];
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  source?: "agent" | "orchestrator" | "executor" | "handler" | "react" | "heartbeat";
  agentName?: string;
  worktaskId?: string;
  instanceId?: string;
  capability?: string;
}

export interface LLMServiceInterface {
  /**
   * 生成响应（非流式）
   */
  generate(request: LLMRequest): Promise<LLMResponse & { routeInfo?: RouteInfo }>;

  /**
   * 流式生成
   * 返回 StreamEvent 事件流，支持文本和 tool calls
   */
  streamGenerate(request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown>;

  /**
   * 流式工具调用（基于 Vercel AI SDK）
   * 支持自动工具调用循环、参数验证和结果处理
   */
  streamWithTools?(request: StreamWithToolsRequest): AsyncGenerator<StreamEvent, void, unknown>;

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
      source?: "agent" | "orchestrator" | "executor";
      agentName?: string;
      worktaskId?: string;
      contactName?: string;
    }
  ): Promise<LLMResponse & { routeInfo?: RouteInfo }>;

  streamMultimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
      source?: "agent" | "orchestrator" | "executor";
      agentName?: string;
      worktaskId?: string;
      contactName?: string;
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
   * 获取实例完整配置（包括 baseUrl, apiKey 等）
   */
  getInstanceConfig(instanceId: string): Promise<{ 
    modelName: string; 
    provider: string; 
    baseUrl: string; 
    apiKey: string;
    instanceId: string;
  } | undefined>;

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
      instanceId?: string;
      onThinkingMessage?: (message: string) => void;
    }
  ): Promise<{ text: string; routeInfo?: RouteInfo }>;

  /**
   * 语音合成（TTS）
   * 将文本转换为音频
   */
  synthesizeSpeech?(
    text: string,
    options?: {
      voice?: string;
      format?: string;
      speed?: number;
      instanceId?: string;
    }
  ): Promise<{ audio: string; format: string; routeInfo?: RouteInfo }>;

  /**
   * 验证配置
   */
  validateConfig?(config: ModelConfig): boolean;

  /**
   * 获取可用模型
   */
  getAvailableModels?(): Promise<string[]>;

  /**
   * 获取统计信息
   */
  getStats(): any;

  /**
   * 获取配额统计
   */
  getQuotaStats?(instanceId?: string): any;

  /**
   * 停止服务
   */
  stop(): Promise<void>;
}
