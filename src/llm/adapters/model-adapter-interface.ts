/**
 * 模型适配器接口定义
 * 每个模型类型需要实现此接口，处理特定的调用逻辑
 */

import type { ChatMessage, ChatCompletionRequest, ChatCompletionResponse, StreamChunk } from "../runtime/types.js";

/** 模型类型 */
export type ModelType = 
  | "text"           // 纯文本模型
  | "multimodal"     // 多模态模型（图文）
  | "omni"           // 全模态模型（图文音）
  | "realtime"       // 实时语音模型（WebSocket）
  | "embedding"      // 嵌入模型
  | "speech2text"    // 语音识别模型
  | "tts";           // 语音合成模型

/** 模型能力 */
export type ModelCapability =
  | "textGeneration"
  | "visualComprehension"
  | "speechRecognition"
  | "speechSynthesis"
  | "realtimeSpeech"
  | "embedding";

/** 适配器配置 */
export interface AdapterConfig {
  /** 模型名称 */
  modelName: string;
  /** 提供商 */
  provider: string;
  /** 基础 URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 模型特定参数 */
  modelParams?: Record<string, any>;
}

/** 多模态输入 */
export interface MultimodalInput {
  /** 文本提示 */
  prompt?: string;
  /** 图像列表 (Base64 或 URL) */
  images?: string[];
  /** 音频列表 (Base64 或 URL) */
  audio?: string[];
  /** 音频格式 */
  audioFormat?: string;
  /** 音频采样率（某些模型需要） */
  sampleRate?: number;
  /** 是否需要音频输出（语音合成时为 true，语音识别时为 false） */
  audioOutput?: boolean;
}

/** 语音合成选项 */
export interface TTSOptions {
  /** 文本内容 */
  text: string;
  /** 语音角色 */
  voice?: string;
  /** 输出格式 */
  format?: "pcm" | "wav" | "mp3";
  /** 语速 */
  speed?: number;
  /** 采样率 */
  sampleRate?: number;
}

/** 语音识别选项 */
export interface STTOptions {
  /** 音频数据 (Base64) */
  audio: string;
  /** 音频格式 */
  format: string;
  /** 采样率 */
  sampleRate?: number;
  /** 语言 */
  language?: string;
}

/** 实时语音会话配置 */
export interface RealtimeSessionConfig {
  /** 音频采样率 */
  sampleRate?: number;
  /** 音频格式 */
  audioFormat?: string;
  /** 语音角色 */
  voice?: string;
  /** 其他模型特定参数 */
  [key: string]: any;
}

/** 模型适配器接口 */
export interface IModelAdapter {
  /** 适配器配置 */
  readonly config: AdapterConfig;
  
  /** 模型类型 */
  readonly modelType: ModelType;
  
  /** 支持的能力列表 */
  readonly capabilities: ModelCapability[];
  
  /**
   * 初始化适配器
   */
  initialize(): Promise<void>;
  
  /**
   * 非流式对话完成
   */
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  
  /**
   * 流式对话完成
   */
  streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown>;
  
  /**
   * 多模态对话（非流式）
   * 默认实现使用 chatCompletion，子类可覆盖
   */
  multimodalChat?(input: MultimodalInput): Promise<ChatCompletionResponse>;
  
  /**
   * 多模态对话（流式）
   * 默认实现使用 streamChatCompletion，子类可覆盖
   */
  streamMultimodalChat?(input: MultimodalInput): AsyncGenerator<StreamChunk, void, unknown>;
  
  /**
   * 语音合成
   * 仅 TTS 模型需要实现
   */
  textToSpeech?(options: TTSOptions): Promise<Buffer>;
  
  /**
   * 语音识别
   * 仅 STT 模型需要实现
   */
  speechToText?(options: STTOptions): Promise<string>;
  
  /**
   * 创建实时语音会话
   * 仅实时语音模型需要实现
   */
  createRealtimeSession?(config: RealtimeSessionConfig): Promise<IRealtimeSession>;
  
  /**
   * 释放资源
   */
  dispose(): Promise<void>;
}

/** 实时语音会话接口 */
export interface IRealtimeSession {
  /** 会话 ID */
  readonly sessionId: string;
  
  /**
   * 发送音频数据
   */
  sendAudio(audioData: Buffer): Promise<void>;
  
  /**
   * 发送文本消息
   */
  sendText(text: string): Promise<void>;
  
  /**
   * 接收事件（音频/文本）
   */
  on(event: "audio" | "text" | "error" | "close", callback: (data: any) => void): void;
  
  /**
   * 关闭会话
   */
  close(): Promise<void>;
}

/** 路由决策 */
export interface RoutingDecision {
  /** 实例 ID */
  instanceId: string;
  /** 实例名称 */
  instanceName: string;
  /** 适配器实例 */
  adapter: IModelAdapter;
  /** 模型名称 */
  modelName: string;
  /** 提供商 */
  provider: string;
}
