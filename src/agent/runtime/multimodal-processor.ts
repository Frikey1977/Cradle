/**
 * 多模态处理器
 *
 * 处理音频和图片消息
 */

import type { AgentMessage, AgentResponse } from "../types/index.js";
import type { LLMServiceInterface } from "./llm-service-interface.js";
import type { ContextManager } from "../context/context-manager.js";
import type { MessageRouter } from "./message-router.js";

/**
 * 多模态处理器
 */
export class MultimodalProcessor {
  private llmService: LLMServiceInterface;
  private contextModule: ContextManager;
  private router: MessageRouter;
  private agentName: string;
  private agentId: string;

  constructor(
    llmService: LLMServiceInterface,
    contextModule: ContextManager,
    router: MessageRouter,
    agentName: string,
    agentId: string
  ) {
    this.llmService = llmService;
    this.contextModule = contextModule;
    this.router = router;
    this.agentName = agentName;
    this.agentId = agentId;
  }

  /**
   * 处理音频消息
   */
  async processAudio(
    message: AgentMessage,
    context: any
  ): Promise<AgentResponse> {
    const useCollaboration = this.router.isMultiModelCollaborationEnabled();

    if (useCollaboration && "transcribeAudio" in this.llmService) {
      return this.processAudioWithCollaboration(message, context);
    } else {
      return this.processAudioEndToEnd(message, context);
    }
  }

  /**
   * 多模型协作模式处理音频
   */
  private async processAudioWithCollaboration(
    message: AgentMessage,
    context: any
  ): Promise<AgentResponse> {
    console.log(`[MultimodalProcessor:${this.agentId}] Using multi-model collaboration mode`);

    const audioData = message.audio!;
    const mainModelInfo = this.router.getMainModelInfo(context.modelConfig);
    const speechConfig = this.router.getSpeechRecognitionConfig();

    // Step 1: 语音识别
    console.log(`[MultimodalProcessor:${this.agentId}] Step 1: Speech recognition`);
    const transcribeResult = await this.llmService.transcribeAudio!(audioData.data, {
      format: audioData.format,
      instanceId: speechConfig.instanceId,
      onThinkingMessage: message.onThinkingMessage,
    });

    const recognizedText = transcribeResult.text;
    console.log(`[MultimodalProcessor:${this.agentId}] Recognized: "${recognizedText}"`);

    // 发送语音识别完成的思考消息
    const thinkingMessage = this.buildRecognitionThinkingMessage(
      transcribeResult.routeInfo,
      recognizedText
    );

    if (message.onThinkingMessage) {
      message.onThinkingMessage(thinkingMessage);
    }

    // 保存用户消息
    await this.contextModule.addUserMessage(recognizedText, {
      type: "voice",
      channel: message.channelName || message.metadata?.channelType || "web",
    });

    // Step 2: 发送主模型信息
    if (message.onThinkingMessage) {
      message.onThinkingMessage(this.buildMainModelThinkingMessage(mainModelInfo));
    }

    // Step 3: 生成回复（流式）
    const mainModelConfig = context.modelConfig.instanceId
      ? { instanceId: context.modelConfig.instanceId }
      : { provider: context.modelConfig.provider, model: context.modelConfig.model };

    const systemMessages = context.systemMessages
      ? context.systemMessages.map((block: any) => ({
          role: "system" as const,
          content: block.content,
        }))
      : [{ role: "system" as const, content: context.systemPrompt }];

    const streamGenerator = this.llmService.streamGenerate({
      model: {
        ...mainModelConfig,
        parameters: {
          ...context.modelConfig.parameters,
          temperature: context.modelConfig.parameters?.temperature ?? 0.7,
          maxTokens: context.modelConfig.parameters?.maxTokens ?? 4096,
        },
      },
      messages: [
        ...systemMessages,
        ...context.conversationHistory,
        { role: "user", content: recognizedText },
      ],
      tools: context.availableTools,
      source: "agent",
      agentName: this.agentName,
      contactName: context.contactName,
    });

    return {
      content: "",
      stream: true,
      contentEventStream: streamGenerator,
      metadata: {
        agentName: this.agentName,
        timestamp: Date.now(),
        modelUsed: context.modelConfig.instanceId || context.modelConfig.model,
        recognizedText,
        collaborationMode: true,
        pendingSpeechSynthesis: !!(message.voiceResponse && this.llmService.synthesizeSpeech),
        speechSynthesisConfig: message.voiceResponse
          ? {
              format: audioData.format,
              instanceId: this.router.getSpeechSynthesisConfig().instanceId,
              voice: message.voice,
            }
          : undefined,
      },
      thinkingMessage,
    };
  }

  /**
   * 端到端模式处理音频
   */
  private async processAudioEndToEnd(
    message: AgentMessage,
    context: any
  ): Promise<AgentResponse> {
    console.log(`[MultimodalProcessor:${this.agentId}] Using end-to-end mode`);

    const audioData = message.audio!;

    // 先进行语音识别（如果可用）
    let recognizedText: string | undefined;
    if (this.llmService.transcribeAudio) {
      try {
        const result = await this.llmService.transcribeAudio(audioData.data, {
          format: audioData.format,
          onThinkingMessage: message.onThinkingMessage,
        });
        recognizedText = result.text;
        console.log(`[MultimodalProcessor:${this.agentId}] Recognized: ${recognizedText}`);
      } catch (error) {
        console.error(`[MultimodalProcessor:${this.agentId}] Speech recognition failed:`, error);
      }
    }

    // 保存用户消息
    if (recognizedText) {
      await this.contextModule.addUserMessage(recognizedText, {
        type: "voice",
        channel: message.channelName || message.metadata?.channelType || "web",
      });
    }

    // 获取路由信息并发送思考消息
    const routeInfo = await this.llmService.getRouteInfo({ capability: "speechSynthesis" });
    const thinkingMessage = this.router.buildThinkingMessage("audio", routeInfo, {
      "📝 识别文本": recognizedText || "N/A",
    });

    if (message.onThinkingMessage) {
      message.onThinkingMessage(thinkingMessage);
    }

    // 调用多模态 LLM
    const audioArray = [audioData.data];

    if (message.stream) {
      const streamGenerator = this.llmService.streamMultimodalChat(
        message.content || "请听这段语音，告诉我用户说了什么，然后以友好、自然的方式回复用户。",
        {
          audio: audioArray,
          audioFormat: audioData.format,
          temperature: context.modelConfig.parameters?.temperature as number,
          maxTokens: context.modelConfig.parameters?.maxTokens as number,
          source: "agent",
          agentName: this.agentName,
          contactName: context.contactName,
        }
      );

      return {
        content: "",
        stream: true,
        contentStream: streamGenerator,
        metadata: {
          agentName: this.agentName,
          timestamp: Date.now(),
          modelUsed: routeInfo.modelName,
          recognizedText,
          collaborationMode: true,
        },
        thinkingMessage,
      };
    } else {
      const response = await this.llmService.multimodalChat(
        message.content || "请听这段语音，告诉我用户说了什么，然后以友好、自然的方式回复用户。",
        {
          audio: audioArray,
          audioFormat: audioData.format,
          temperature: context.modelConfig.parameters?.temperature as number,
          maxTokens: context.modelConfig.parameters?.maxTokens as number,
          source: "agent",
          agentName: this.agentName,
          contactName: context.contactName,
        }
      );

      // 转换 audio 格式
      const agentResponse: AgentResponse = {
        content: response.content || "",
        metadata: {
          agentName: this.agentName,
          timestamp: Date.now(),
          ...response.metadata,
          recognizedText,
          collaborationMode: true,
        },
        thinkingMessage,
      };

      // 如果响应包含音频，转换格式
      if (response.audio && typeof response.audio === "string") {
        agentResponse.audio = {
          data: response.audio,
          format: audioData.format,
        };
      }

      return agentResponse;
    }
  }

  /**
   * 处理图片消息
   */
  async processImages(
    message: AgentMessage,
    context: any
  ): Promise<AgentResponse> {
    console.log(`[MultimodalProcessor:${this.agentId}] Processing ${message.images?.length} images`);

    const routeInfo = await this.llmService.getRouteInfo({ capability: "visualComprehension" });
    const thinkingMessage = this.router.buildThinkingMessage("image", routeInfo, {
      "📷 图片数量": `${message.images?.length} 张`,
    });

    if (message.onThinkingMessage) {
      message.onThinkingMessage(thinkingMessage);
    }

    const images = message.images!;

    if (message.stream) {
      const streamGenerator = this.llmService.streamMultimodalChat(
        message.content || "请描述这张图片",
        {
          images,
          temperature: context.modelConfig.parameters?.temperature as number,
          maxTokens: context.modelConfig.parameters?.maxTokens as number,
          source: "agent",
          agentName: this.agentName,
          contactName: context.contactName,
        }
      );

      return {
        content: "",
        stream: true,
        contentStream: streamGenerator,
        metadata: {
          agentName: this.agentName,
          timestamp: Date.now(),
          modelUsed: routeInfo.modelName,
        },
        thinkingMessage,
      };
    } else {
      const response = await this.llmService.multimodalChat(
        message.content || "请描述这张图片",
        {
          images,
          temperature: context.modelConfig.parameters?.temperature as number,
          maxTokens: context.modelConfig.parameters?.maxTokens as number,
          source: "agent",
          agentName: this.agentName,
          contactName: context.contactName,
        }
      );

      // 转换 audio 格式（如果存在）
      const agentResponse: AgentResponse = {
        content: response.content || "",
        metadata: {
          agentName: this.agentName,
          timestamp: Date.now(),
          ...response.metadata,
        },
        thinkingMessage,
      };

      // 如果响应包含音频，转换格式
      if (response.audio && typeof response.audio === "string") {
        agentResponse.audio = {
          data: response.audio,
          format: "mp3", // 默认格式
        };
      }

      return agentResponse;
    }
  }

  /**
   * 构建语音识别思考消息
   */
  private buildRecognitionThinkingMessage(routeInfo: any, recognizedText: string): string {
    return [
      `🎤 语音识别完成`,
      `📝 ${recognizedText}`,
      `🎯 语音识别模型信息:`,
      `   ID: ${routeInfo?.instanceId || "自动路由"}`,
      `   名称: ${routeInfo?.modelName || "未知"}`,
      `   提供商: ${routeInfo?.provider || "未知"}`,
    ].join("\n");
  }

  /**
   * 构建主模型思考消息
   */
  private buildMainModelThinkingMessage(mainModelInfo: any): string {
    return [
      `🧠 主模型信息:`,
      `   ID: ${mainModelInfo.id}`,
      `   名称: ${mainModelInfo.name}`,
      `   提供商: ${mainModelInfo.provider}`,
    ].join("\n");
  }
}
