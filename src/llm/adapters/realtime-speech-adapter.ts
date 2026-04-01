/**
 * 实时语音适配器
 * 使用 WebSocket 连接进行实时语音对话
 * 支持 Qwen-Realtime 等实时语音模型
 */

import { BaseModelAdapter } from "./base-adapter.js";
import type {
  AdapterConfig,
  ModelType,
  ModelCapability,
  RealtimeSessionConfig,
  IRealtimeSession,
} from "./model-adapter-interface.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "../runtime/types.js";
import WebSocket from "ws";

/** 实时语音会话实现 */
class RealtimeSpeechSession implements IRealtimeSession {
  readonly sessionId: string;
  private ws: WebSocket;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private connected = false;
  
  constructor(sessionId: string, ws: WebSocket) {
    this.sessionId = sessionId;
    this.ws = ws;
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit(message.type || "message", message);
      } catch (e) {
        this.emit("error", { error: "Failed to parse message", raw: data.toString() });
      }
    });
    
    this.ws.on("error", (error) => {
      this.emit("error", { error: error.message });
    });
    
    this.ws.on("close", () => {
      this.connected = false;
      this.emit("close", {});
    });
    
    this.ws.on("open", () => {
      this.connected = true;
    });
  }
  
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`[RealtimeSession] Error in ${event} handler:`, e);
      }
    }
  }
  
  on(event: "audio" | "text" | "error" | "close", callback: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }
  
  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.connected) {
      throw new Error("WebSocket not connected");
    }
    
    // 发送音频数据（Base64 编码）
    this.ws.send(JSON.stringify({
      type: "audio",
      data: audioData.toString("base64"),
    }));
  }
  
  async sendText(text: string): Promise<void> {
    if (!this.connected) {
      throw new Error("WebSocket not connected");
    }
    
    this.ws.send(JSON.stringify({
      type: "text",
      data: text,
    }));
  }
  
  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.connected = false;
  }
}

export class RealtimeSpeechAdapter extends BaseModelAdapter {
  readonly modelType: ModelType = "realtime";
  readonly capabilities: ModelCapability[] = ["realtimeSpeech", "speechRecognition", "speechSynthesis"];
  
  private wsUrl: string;
  private activeSessions: Map<string, RealtimeSpeechSession> = new Map();
  
  constructor(config: AdapterConfig) {
    super(config);
    
    // 构建 WebSocket URL
    // 将 http/https 转换为 ws/wss
    const baseUrl = config.baseUrl.replace(/^http/, "ws");
    this.wsUrl = `${baseUrl}/realtime`;
  }
  
  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // 验证 WebSocket 连接
    console.log(`[RealtimeSpeechAdapter] WebSocket URL: ${this.wsUrl}`);
  }
  
  /**
   * 非流式对话 - 实时语音模型不支持
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    throw new Error("Realtime speech models do not support chatCompletion. Use createRealtimeSession instead.");
  }
  
  /**
   * 流式对话 - 实时语音模型不支持
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    throw new Error("Realtime speech models do not support streamChatCompletion. Use createRealtimeSession instead.");
  }
  
  /**
   * 创建实时语音会话
   */
  async createRealtimeSession(config: RealtimeSessionConfig): Promise<IRealtimeSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 构建 WebSocket 连接 URL
    const url = new URL(this.wsUrl);
    url.searchParams.append("model", this.config.modelName);
    url.searchParams.append("api_key", this.config.apiKey);
    
    // 添加配置参数
    if (config.sampleRate) {
      url.searchParams.append("sample_rate", config.sampleRate.toString());
    }
    if (config.audioFormat) {
      url.searchParams.append("format", config.audioFormat);
    }
    if (config.voice) {
      url.searchParams.append("voice", config.voice);
    }
    
    // 建立 WebSocket 连接
    const ws = new WebSocket(url.toString(), {
      headers: this.config.headers,
    });
    
    // 等待连接建立
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 10000);
      
      ws.once("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      
      ws.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // 创建会话
    const session = new RealtimeSpeechSession(sessionId, ws);
    this.activeSessions.set(sessionId, session);
    
    // 监听会话关闭，清理资源
    session.on("close", () => {
      this.activeSessions.delete(sessionId);
    });
    
    console.log(`[RealtimeSpeechAdapter] Created session: ${sessionId}`);
    return session;
  }
  
  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    // 关闭所有活动会话
    for (const [sessionId, session] of this.activeSessions) {
      console.log(`[RealtimeSpeechAdapter] Closing session: ${sessionId}`);
      await session.close();
    }
    this.activeSessions.clear();
    
    await super.dispose();
  }
}
