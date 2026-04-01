/**
 * 消息路由器
 *
 * 根据消息类型路由到相应的处理器
 */

import type { AgentMessage, AgentResponse } from "../types/index.js";
import type { LLMServiceInterface } from "./llm-service-interface.js";
import type { ContextManager } from "../context/context-manager.js";
import type { AgentConfig } from "../types/index.js";

/**
 * 路由结果
 */
export interface RouteResult {
  type: "audio" | "image" | "text";
  handler: string;
}

/**
 * 消息路由器
 */
export class MessageRouter {
  private llmService: LLMServiceInterface;
  private config: AgentConfig;
  private agentName: string;
  private agentId: string;

  constructor(
    llmService: LLMServiceInterface,
    config: AgentConfig,
    agentName: string,
    agentId: string
  ) {
    this.llmService = llmService;
    this.config = config;
    this.agentName = agentName;
    this.agentId = agentId;
  }

  /**
   * 判断消息类型
   */
  classify(message: AgentMessage): RouteResult {
    if (message.audio && !message.images) {
      return { type: "audio", handler: "audio" };
    }
    if (message.images && message.images.length > 0) {
      return { type: "image", handler: "image" };
    }
    return { type: "text", handler: "text" };
  }

  /**
   * 检查是否启用多模型协作
   */
  isMultiModelCollaborationEnabled(): boolean {
    return this.config.multiModelCollaboration?.enabled ?? false;
  }

  /**
   * 获取语音识别配置
   */
  getSpeechRecognitionConfig() {
    return {
      instanceId: this.config.multiModelCollaboration?.speechRecognitionInstanceId,
      enabled: this.isMultiModelCollaborationEnabled(),
    };
  }

  /**
   * 获取语音合成配置
   */
  getSpeechSynthesisConfig() {
    return {
      instanceId: this.config.multiModelCollaboration?.speechSynthesisInstanceId,
      enabled: this.isMultiModelCollaborationEnabled(),
    };
  }

  /**
   * 获取主模型信息
   */
  getMainModelInfo(contextModelConfig: any) {
    return contextModelConfig.instanceId
      ? {
          id: contextModelConfig.instanceId,
          name: contextModelConfig.model || "主模型",
          provider: contextModelConfig.provider,
        }
      : {
          id: "N/A",
          name: contextModelConfig.model,
          provider: contextModelConfig.provider,
        };
  }

  /**
   * 构建思考消息
   */
  buildThinkingMessage(
    messageType: string,
    routeInfo: any,
    extraInfo?: Record<string, any>
  ): string {
    const parts: string[] = [];

    switch (messageType) {
      case "audio":
        parts.push(`🎤 消息类型: 语音输入`);
        break;
      case "image":
        parts.push(`📷 消息类型: 图片输入`);
        break;
      default:
        parts.push(`📝 消息类型: 文本输入`);
    }

    parts.push(`🤖 Agent: ${this.agentName} (${this.agentId})`);
    parts.push(`🎯 路由实例: ${routeInfo.instanceName || routeInfo.instanceId}`);
    parts.push(`📡 调用模型: ${routeInfo.modelName}`);
    parts.push(`🏢 提供商: ${routeInfo.provider}`);
    parts.push(`⏳ 状态: 正在调用 LLM...`);

    if (extraInfo) {
      Object.entries(extraInfo).forEach(([key, value]) => {
        if (value !== undefined) {
          parts.push(`${key}: ${value}`);
        }
      });
    }

    return parts.join("\n");
  }

  /**
   * 获取 LLM 服务
   */
  getLLMService(): LLMServiceInterface {
    return this.llmService;
  }

  /**
   * 获取配置
   */
  getConfig(): AgentConfig {
    return this.config;
  }
}
