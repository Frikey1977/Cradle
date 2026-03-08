/**
 * LLM Client
 * Worker进程中的轻量级LLM客户端
 * 
 * 职责：
 * 1. 通过IPC与Master的LLMServiceManager通信
 * 2. 提供与LLMService相同的接口（透明替换）
 * 3. 处理流式响应
 */

import type { ChildProcess } from "child_process";
import type {
  LLMRequest,
  LLMResponse,
  ModelConfig,
  ConversationMessage,
  ToolDefinition,
} from "../types/index.js";
import type {
  LLMIPCRequest,
  LLMIPCResponse,
  ChatRequestPayload,
  MultimodalRequestPayload,
  RouteRequestPayload,
  StreamChunkPayload,
  StreamEndPayload,
} from "../../llm/service/ipc-protocol.js";
import type { LLMServiceInterface } from "./llm-service-interface.js";
import {
  createChatRequest,
  createStreamChatRequest,
  createMultimodalRequest,
  createRouteRequest,
} from "../../llm/service/ipc-protocol.js";

export interface RouteInfo {
  instanceId: string;
  instanceName: string;
  modelName: string;
  provider: string;
  quotaType: string;
}

export class LLMClient implements LLMServiceInterface {
  private workerId: string;
  private agentId: string;
  private sendMessage: (message: any) => void;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    isStream: boolean;
    streamCallbacks?: {
      onChunk?: (chunk: string) => void;
      onEnd?: () => void;
    };
  }>();

  constructor(
    workerId: string,
    agentId: string,
    sendMessage: (message: any) => void
  ) {
    this.workerId = workerId;
    this.agentId = agentId;
    this.sendMessage = sendMessage;
  }

  /**
   * 初始化客户端
   */
  async initialize(): Promise<void> {
    console.log(`[LLMClient:${this.workerId}] Initialized for agent ${this.agentId}`);
  }

  /**
   * 处理来自Master的响应
   */
  handleResponse(response: LLMIPCResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn(`[LLMClient] No pending request for ${response.requestId}`);
      return;
    }

    switch (response.type) {
      case "llm:response":
        // 非流式响应
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.requestId);
        break;

      case "llm:stream-chunk":
        // 流式块
        const chunkContent = (response.payload as StreamChunkPayload).content;
        if (pending.streamCallbacks?.onChunk) {
          pending.streamCallbacks.onChunk(chunkContent);
        }
        break;

      case "llm:stream-end":
        // 流式结束
        if (pending.streamCallbacks?.onEnd) {
          pending.streamCallbacks.onEnd();
        }
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.requestId);
        break;

      case "llm:error":
        // 错误响应
        pending.reject(new Error(response.error || "Unknown error"));
        this.pendingRequests.delete(response.requestId);
        break;

      case "llm:route-response":
        // 路由响应
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.requestId);
        break;

      case "llm:transcribe-response":
        // 语音识别响应
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.requestId);
        break;

      case "llm:synthesize-response":
        // 语音合成响应
        pending.resolve(response.payload);
        this.pendingRequests.delete(response.requestId);
        break;

      default:
        console.warn(`[LLMClient] Unknown response type: ${response.type}`);
    }
  }

  /**
   * 生成响应（非流式）
   */
  async generate(
    request: LLMRequest
  ): Promise<LLMResponse & { routeInfo?: RouteInfo }> {
    const requestId = this.generateRequestId();
    
    const payload: ChatRequestPayload = {
      capability: this.inferCapability(request.model),
      complexity: this.inferComplexity(request.model),
      messages: request.messages,
      temperature: request.model.parameters?.temperature as number,
      maxTokens: request.model.parameters?.maxTokens as number,
      tools: request.tools && request.tools.length > 0 ? request.tools : undefined,
      instanceId: request.model.instanceId, // 传递实例ID
    };

    const ipcRequest = createChatRequest(
      requestId,
      this.workerId,
      this.agentId,
      payload
    );

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, isStream: false });
      this.sendMessage({
        type: "llm-request",
        payload: ipcRequest,
      });
    });
  }

  /**
   * 流式生成
   */
  async *streamGenerate(
    request: LLMRequest
  ): AsyncGenerator<string, void, unknown> {
    const requestId = this.generateRequestId();
    
    console.log(`[LLMClient] streamGenerate called`);
    console.log(`[LLMClient] request.model:`, JSON.stringify({
      instanceId: request.model.instanceId,
      provider: request.model.provider,
      model: request.model.model,
    }));
    console.log(`[LLMClient] tools count: ${request.tools?.length || 0}`);
    console.log(`[LLMClient] tools:`, JSON.stringify(request.tools?.map(t => t.function?.name)));
    
    const payload: ChatRequestPayload = {
      capability: this.inferCapability(request.model),
      complexity: this.inferComplexity(request.model),
      messages: request.messages,
      temperature: request.model.parameters?.temperature as number,
      maxTokens: request.model.parameters?.maxTokens as number,
      tools: request.tools && request.tools.length > 0 ? request.tools : undefined,
      instanceId: request.model.instanceId, // 传递实例ID
    };
    
    console.log(`[LLMClient] payload.instanceId: ${payload.instanceId}`);
    console.log(`[LLMClient] payload.tools count: ${payload.tools?.length || 0}`);

    const ipcRequest = createStreamChatRequest(
      requestId,
      this.workerId,
      this.agentId,
      payload
    );

    // 用于收集流式数据
    const chunks: string[] = [];
    let streamEnded = false;
    let finalResponse: any = null;

    // 设置流式回调
    const streamCallbacks = {
      onChunk: (chunk: string) => {
        chunks.push(chunk);
      },
      onEnd: () => {
        streamEnded = true;
      },
    };

    // 发送请求
    const responsePromise = new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          finalResponse = value;
          resolve(value);
        },
        reject,
        isStream: true,
        streamCallbacks,
      });
      
      this.sendMessage({
        type: "llm-request",
        payload: ipcRequest,
      });
    });

    // 等待流式数据
    let chunkIndex = 0;
    let yieldCount = 0;
    while (!streamEnded || chunkIndex < chunks.length) {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex];
        yieldCount++;
        if (yieldCount <= 5 || yieldCount % 50 === 0) {
          console.log(`[LLMClient] Yielding chunk ${yieldCount}: ${chunk.substring(0, 50)}...`);
        }
        yield chunk;
        chunkIndex++;
      } else {
        // 等待更多数据，同时让出事件循环
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    console.log(`[LLMClient] Stream ended, total chunks yielded: ${yieldCount}`);

    // 等待最终响应
    await responsePromise;
    
    // 流式生成器不返回最终响应
    return;
  }

  /**
   * 多模态对话（非流式）
   */
  async multimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<LLMResponse & { routeInfo?: RouteInfo }> {
    const requestId = this.generateRequestId();

    // 确定能力类型
    let capability = "textGeneration";
    if (options.images && options.images.length > 0) {
      capability = "visualComprehension";
    } else if (options.audio && options.audio.length > 0) {
      capability = "speechSynthesis";
    }

    const payload: MultimodalRequestPayload = {
      capability,
      complexity: options.complexity || "medium",
      prompt,
      images: options.images,
      audio: options.audio,
      audioFormat: options.audioFormat,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    };

    const ipcRequest = createMultimodalRequest(
      requestId,
      this.workerId,
      this.agentId,
      payload
    );

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, isStream: false });
      this.sendMessage({
        type: "llm-request",
        payload: ipcRequest,
      });
    });
  }

  /**
   * 流式多模态对话
   */
  async *streamMultimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    // 复用streamGenerate的逻辑
    const requestId = this.generateRequestId();

    let capability = "textGeneration";
    if (options.images && options.images.length > 0) {
      capability = "visualComprehension";
    } else if (options.audio && options.audio.length > 0) {
      capability = "speechSynthesis";
    }

    const payload: MultimodalRequestPayload & { stream?: boolean } = {
      capability,
      complexity: options.complexity || "medium",
      prompt,
      images: options.images,
      audio: options.audio,
      audioFormat: options.audioFormat,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stream: true, // 标记为流式请求
    };

    const ipcRequest = createMultimodalRequest(
      requestId,
      this.workerId,
      this.agentId,
      payload
    );

    const chunks: string[] = [];
    let streamEnded = false;
    let finalResponse: any = null;

    const streamCallbacks = {
      onChunk: (chunk: string) => {
        chunks.push(chunk);
      },
      onEnd: () => {
        streamEnded = true;
      },
    };

    const responsePromise = new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          finalResponse = value;
          resolve(value);
        },
        reject,
        isStream: true,
        streamCallbacks,
      });
      
      this.sendMessage({
        type: "llm-request",
        payload: ipcRequest,
      });
    });

    let chunkIndex = 0;
    while (!streamEnded || chunkIndex < chunks.length) {
      if (chunkIndex < chunks.length) {
        yield chunks[chunkIndex];
        chunkIndex++;
      } else {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    await responsePromise;
    // 不返回最终响应，只通过流式输出内容
    return;
  }

  /**
   * 获取路由信息
   */
  async getRouteInfo(options: {
    capability: string;
    complexity?: "low" | "medium" | "high";
  }): Promise<RouteInfo> {
    const requestId = this.generateRequestId();

    const payload: RouteRequestPayload = {
      capability: options.capability,
      complexity: options.complexity || "medium",
    };

    const ipcRequest = createRouteRequest(
      requestId,
      this.workerId,
      this.agentId,
      payload
    );

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, isStream: false });
      this.sendMessage({
        type: "llm-request",
        payload: ipcRequest,
      });
    });
  }

  /**
   * 获取实例信息
   */
  getInstanceInfo(_instanceId: string): { modelName: string; provider: string } | undefined {
    // LLMClient 运行在 Worker 进程中，无法直接访问 LLM 配置
    // 返回 undefined，让调用方使用配置中的信息
    return undefined;
  }

  /**
   * 生成嵌入
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // 简化实现，直接通过IPC请求
    const requestId = this.generateRequestId();
    
    this.sendMessage({
      type: "llm-request",
      payload: {
        id: requestId,
        type: "llm:embedding",
        workerId: this.workerId,
        agentId: this.agentId,
        payload: { text },
      },
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => resolve(value.embedding),
        reject,
        isStream: false,
      });
    });
  }

  /**
   * 批量嵌入
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    const requestId = this.generateRequestId();
    
    this.sendMessage({
      type: "llm-request",
      payload: {
        id: requestId,
        type: "llm:batch-embed",
        workerId: this.workerId,
        agentId: this.agentId,
        payload: { texts },
      },
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => resolve(value.embeddings),
        reject,
        isStream: false,
      });
    });
  }

  /**
   * 分析图像
   */
  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    const result = await this.multimodalChat(prompt, {
      images: [imageBase64],
      complexity: "medium",
    });
    return result.content || "";
  }

  /**
   * 验证配置
   */
  validateConfig(config: ModelConfig): boolean {
    if (!config.model) return false;
    if (config.parameters?.temperature !== undefined) {
      const temp = config.parameters.temperature as number;
      if (temp < 0 || temp > 2) return false;
    }
    return true;
  }

  /**
   * 获取可用模型
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      "deepseek-v3.2",
      "qwen3.5-plus",
      "text-embedding-v4",
      "qwen3-omni-flash",
    ];
  }

  /**
   * 语音识别（STT）
   */
  async transcribeAudio(
    audioData: string,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      instanceId?: string;
    }
  ): Promise<{ text: string; routeInfo?: RouteInfo }> {
    const requestId = this.generateRequestId();

    this.sendMessage({
      type: "llm-request",
      payload: {
        id: requestId,
        type: "llm:transcribe",
        workerId: this.workerId,
        agentId: this.agentId,
        payload: { 
          audioData, 
          format: options?.format,
          sampleRate: options?.sampleRate,
          language: options?.language,
          instanceId: options?.instanceId,
        },
      },
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => resolve(value),
        reject,
        isStream: false,
      });
    });
  }

  /**
   * 语音合成（TTS）
   */
  async synthesizeSpeech(
    text: string,
    options?: {
      voice?: string;
      format?: string;
      speed?: number;
      instanceId?: string;
    }
  ): Promise<{ audio: string; format: string; routeInfo?: RouteInfo }> {
    const requestId = this.generateRequestId();

    this.sendMessage({
      type: "llm-request",
      payload: {
        id: requestId,
        type: "llm:synthesize",
        workerId: this.workerId,
        agentId: this.agentId,
        payload: {
          text,
          voice: options?.voice,
          format: options?.format,
          speed: options?.speed,
          instanceId: options?.instanceId,
        },
      },
    });

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (value) => resolve(value),
        reject,
        isStream: false,
      });
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return {
      pendingRequests: this.pendingRequests.size,
      workerId: this.workerId,
      agentId: this.agentId,
    };
  }

  /**
   * 停止客户端
   */
  stop(): void {
    // 清理待处理的请求
    for (const [requestId, pending] of this.pendingRequests) {
      pending.reject(new Error("LLMClient stopped"));
    }
    this.pendingRequests.clear();
    console.log(`[LLMClient:${this.workerId}] Stopped`);
  }

  /**
   * 推断能力类型
   */
  private inferCapability(model: ModelConfig): string {
    const modelName = model.model?.toLowerCase() || "";
    
    if (modelName.includes("embedding")) {
      return "textEmbedding";
    }
    if (modelName.includes("omni")) {
      return "speechSynthesis";
    }
    if (modelName.includes("vl") || modelName.includes("vision")) {
      return "visualComprehension";
    }
    
    return "textGeneration";
  }

  /**
   * 推断复杂度
   */
  private inferComplexity(model: ModelConfig): "low" | "medium" | "high" {
    const modelName = model.model?.toLowerCase() || "";

    if (
      modelName.includes("deepseek") ||
      modelName.includes("gpt-4") ||
      modelName.includes("claude-3-opus")
    ) {
      return "medium";
    }

    if (
      modelName.includes("qwen3.5") ||
      modelName.includes("gpt-3.5") ||
      modelName.includes("claude-3-sonnet")
    ) {
      return "medium";
    }

    return "low";
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
