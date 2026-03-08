/**
 * Agent 运行时核心类
 *
 * 每个 Agent 对应一个 AgentRuntime 实例
 * 运行在独立的 Worker 进程中
 *
 * 支持渐进式披露模式：
 * - 默认模式：加载所有 Skills 的 tools
 * - 渐进式披露：根据用户意图只加载匹配的 Skills 的 tools
 */

import type {
  AgentData,
  AgentConfig,
  AgentProfile,
  HeartbeatConfig,
  RuntimeState,
  AgentMessage,
  AgentResponse,
  Action,
  LLMResponse,
  ConversationMessage,
} from "../types/index.js";
import type { ToolCall } from "../../llm/runtime/types.js";
import type { ContextManager, ContextBuildMode } from "../context/context-manager.js";
import type { LLMServiceInterface } from "./llm-service-interface.js";
import { HeartbeatScheduler } from "./heartbeat-scheduler.js";
import { invokeSkill } from "../skills/invoker.js";
import { Executor, ExecutorFactory, parseExecutionIntent, type ExecutionResult } from "../executor/index.js";

/**
 * Agent 运行时
 */
export class AgentRuntime {
  // 基础信息
  readonly id: string;
  readonly name: string;
  private config: AgentConfig;
  private profile: AgentProfile;
  private heartbeatConfig?: HeartbeatConfig;

  // 运行时状态（内存中，不持久化）
  private runtime: RuntimeState;

  // 依赖服务
  private contextModule: ContextManager;
  private llmService: LLMServiceInterface;
  private heartbeatScheduler?: HeartbeatScheduler;

  // 缓存
  private cache: {
    skills?: any[];
    tools?: any[];
  } = {};

  constructor(
    data: AgentData,
    contextModule: ContextManager,
    llmService: LLMServiceInterface,
  ) {
    this.id = data.sid;
    this.name = data.name;
    this.config = data.config;
    this.profile = data.profile;
    this.heartbeatConfig = data.heartbeat;

    this.contextModule = contextModule;
    this.llmService = llmService;

    // 初始化运行时状态
    this.runtime = {
      status: "idle",
      lastHeartbeat: new Date(),
      nextHeartbeat: new Date(),
      consecutiveErrors: 0,
    };
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    console.log(`[AgentRuntime:${this.id}] Initializing...`);

    // 预加载技能缓存
    await this.loadSkillsCache();

    console.log(`[AgentRuntime:${this.id}] Initialized successfully`);
  }

  /**
   * 启动心跳
   */
  startHeartbeat(): void {
    if (!this.heartbeatConfig?.enabled) {
      console.log(`[AgentRuntime:${this.id}] Heartbeat disabled`);
      return;
    }

    console.log(
      `[AgentRuntime:${this.id}] Starting heartbeat with interval: ${this.heartbeatConfig.interval}`,
    );

    this.heartbeatScheduler = new HeartbeatScheduler(this);
    this.heartbeatScheduler.start();
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    if (this.heartbeatScheduler) {
      this.heartbeatScheduler.stop();
      this.heartbeatScheduler = undefined;
    }
  }

  /**
   * 处理消息（普通消息或心跳消息）
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    const isHeartbeat = message.isHeartbeat || false;
    const messageType = isHeartbeat ? "heartbeat" : "message";

    console.log(
      `[AgentRuntime:${this.id}] Handling ${messageType} from ${message.contactId}, stream=${message.stream}, hasAudio=${!!message.audio}, hasImages=${message.images?.length || 0}`,
    );

    // 更新状态
    this.runtime.status = "running";

    // 声明变量用于 ReAct 循环
    let messages: any[] = [];
    let availableTools: any[] = [];

    try {
      // 初始化记忆管理器（如果不是心跳消息）
      if (!isHeartbeat && message.contactId) {
        await this.contextModule.initializeMemoryManager(message.contactId, message.conversationId);
      }

      // 1. 确定上下文构建模式
      const disclosureMode = this.getContextBuildMode();
      console.log(`[AgentRuntime:${this.id}] Context build mode: ${disclosureMode}`);

      // 1.1 构建上下文（根据渐进式披露配置选择模式）
      const context = await this.contextModule.build({
        agentId: this.id,
        contactId: message.contactId,
        content: message.content,
        conversationId: message.conversationId,
        isHeartbeat: isHeartbeat,
        metadata: message.metadata,
      }, disclosureMode);

      // 1.5 覆盖 modelConfig 为 Agent 配置中的模型配置
      // 
      // 注意：这里直接修改 context 对象是安全的，因为：
      // 1. ContextManager.build() 每次返回新的 context 对象
      // 2. Master 的消息队列确保同一 Agent 同一时间只处理一个消息
      // 3. JavaScript 单线程，不存在并发修改问题
      //
      // ContextManager 返回的是默认配置，需要使用 Agent 的实际配置
      context.modelConfig = {
        ...context.modelConfig,
        ...this.config.model,
      };
      console.log(`[AgentRuntime:${this.id}] Using model config:`, {
        instanceId: context.modelConfig.instanceId,
        provider: context.modelConfig.provider,
        model: context.modelConfig.model,
      });

      // 3. 调用 LLM
      let llmResponse: LLMResponse;
      
      // 检查是否为多模态消息（包含音频或图片）
      console.log(`[AgentRuntime:${this.id}] Checking multimodal: audio=${!!message.audio}, images=${message.images?.length || 0}`);
      
      let thinkingMessage: string | undefined;
      
      // 检查是否启用多模型协作模式
      const useMultiModelCollaboration = this.config.multiModelCollaboration?.enabled ?? false;
      console.log(`[AgentRuntime:${this.id}] Multi-model collaboration config:`, {
        enabled: this.config.multiModelCollaboration?.enabled,
        speechRecognitionInstanceId: this.config.multiModelCollaboration?.speechRecognitionInstanceId,
        speechSynthesisInstanceId: this.config.multiModelCollaboration?.speechSynthesisInstanceId,
        useMultiModelCollaboration,
        hasTranscribeAudio: !!this.llmService.transcribeAudio,
      });
      
      // 获取主模型信息（用于多模型协作模式）
      const mainModelInfo = context.modelConfig.instanceId 
        ? {
            id: context.modelConfig.instanceId,
            name: context.modelConfig.model || '主模型',
            provider: context.modelConfig.provider,
          }
        : {
            id: 'N/A',
            name: context.modelConfig.model,
            provider: context.modelConfig.provider,
          };
      
      // 处理多模态消息（音频或图片）
      if (message.audio && !message.images) {
        // 纯语音输入
        console.log(`[AgentRuntime:${this.id}] Audio input detected, routing to audio-capable model`);

        if (useMultiModelCollaboration && this.llmService.transcribeAudio) {
          // ===== 多模型协作模式 =====
          console.log(`[AgentRuntime:${this.id}] Using multi-model collaboration mode`);
          console.log(`[AgentRuntime:${this.id}] Audio data length: ${message.audio.data.length}, format: ${message.audio.format}`);
          console.log(`[AgentRuntime:${this.id}] Speech recognition instanceId: ${this.config.multiModelCollaboration?.speechRecognitionInstanceId}`);
          console.log(`[AgentRuntime:${this.id}] Main model for response:`, mainModelInfo);

          // Step 1: 语音识别（Qwen-Omni）
          console.log(`[AgentRuntime:${this.id}] Step 1: Speech recognition`);
          const transcribeResult = await this.llmService.transcribeAudio(message.audio.data, {
            format: message.audio.format,
            instanceId: this.config.multiModelCollaboration?.speechRecognitionInstanceId,
            onThinkingMessage: message.onThinkingMessage,
          });

          const recognizedText = transcribeResult.text;
          console.log(`[AgentRuntime:${this.id}] ========================================`);
          console.log(`[AgentRuntime:${this.id}] RECOGNIZED TEXT: "${recognizedText}"`);
          console.log(`[AgentRuntime:${this.id}] ========================================`);
          console.log(`[AgentRuntime:${this.id}] Recognition route info:`, transcribeResult.routeInfo);

          // 发送语音识别完成的思考消息（包含语音识别模型信息）
          const recognitionRouteInfo = transcribeResult.routeInfo;
          thinkingMessage = [
            `🎤 语音识别完成`,
            `📝 ${recognizedText}`,
            `🎯 语音识别模型信息:`,
            `   ID: ${recognitionRouteInfo?.instanceId || '自动路由'}`,
            `   名称: ${recognitionRouteInfo?.modelName || '未知'}`,
            `   提供商: ${recognitionRouteInfo?.provider || '未知'}`,
          ].join('\n');

          if (message.onThinkingMessage) {
            message.onThinkingMessage(thinkingMessage);
          }

          // 保存用户消息到短期记忆（使用转录后的文字）
          if (!isHeartbeat) {
            await this.contextModule.addUserMessage(recognizedText, {
              type: "voice",
              channel: message.channelName || message.metadata?.channelType || "web",
            });
          }

          // Step 2: 对话生成（流式输出）
          // 在调用主模型之前，发送主模型信息
          if (message.onThinkingMessage) {
            const mainModelThinkingMessage = [
              `🧠 主模型信息:`,
              `   ID: ${mainModelInfo.id}`,
              `   名称: ${mainModelInfo.name}`,
              `   提供商: ${mainModelInfo.provider}`,
            ].join('\n');
            message.onThinkingMessage(mainModelThinkingMessage);
          }

          // 构建主模型配置：优先使用 context.modelConfig.instanceId（Agent配置的模型）
          const mainModelConfig = context.modelConfig.instanceId
            ? { instanceId: context.modelConfig.instanceId }
            : {
                provider: context.modelConfig.provider,
                model: context.modelConfig.model,
              };
          console.log(`[AgentRuntime:${this.id}] Step 2: Generate response with main model:`, mainModelInfo);
          console.log(`[AgentRuntime:${this.id}] mainModelConfig:`, JSON.stringify(mainModelConfig));
          
          // 收集完整内容用于语音合成
          let finalContent = "";
          console.log(`[AgentRuntime:${this.id}] Sending ${context.availableTools?.length || 0} tools to LLM for speech response`);
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
              { role: "system", content: context.systemPrompt },
              ...context.conversationHistory,
              { role: "user", content: recognizedText },
            ],
            tools: context.availableTools,
            // 不强制设置 tool_choice，让模型自动决定
          });

          // 返回流式响应，但标记为多模型协作模式
          // 语音合成将在流式结束后异步进行
          return {
            content: "", // 初始为空，内容通过流式生成
            stream: true,
            contentStream: streamGenerator,
            metadata: {
              agentName: this.name,
              timestamp: Date.now(),
              modelUsed: context.modelConfig.instanceId || context.modelConfig.model,
              recognizedText,
              collaborationMode: true,
              // 标记需要延迟语音合成
              pendingSpeechSynthesis: !!(message.voiceResponse && this.llmService.synthesizeSpeech),
              speechSynthesisConfig: message.voiceResponse ? {
                format: message.audio.format,
                instanceId: this.config.multiModelCollaboration?.speechSynthesisInstanceId,
                voice: message.voice, // 传递音色选择
              } : undefined,
            },
            thinkingMessage,
          };
        } else {
          // ===== 端到端模式（原有逻辑）=====
          console.log(`[AgentRuntime:${this.id}] Using end-to-end mode`);

          // 先进行语音识别（如果可用），用于返回识别文本给前端
          let recognizedText: string | undefined;
          if (this.llmService.transcribeAudio) {
            console.log(`[AgentRuntime:${this.id}] Step 1: Speech recognition for end-to-end mode`);
            try {
              const transcribeResult = await this.llmService.transcribeAudio(message.audio.data, {
                format: message.audio.format,
                onThinkingMessage: message.onThinkingMessage,
              });
              recognizedText = transcribeResult.text;
              console.log(`[AgentRuntime:${this.id}] Recognized text for end-to-end mode: ${recognizedText}`);
            } catch (error) {
              console.error(`[AgentRuntime:${this.id}] Speech recognition failed in end-to-end mode:`, error);
            }
          }

          // 保存用户消息到短期记忆（使用转录后的文字，如果有）
          if (!isHeartbeat && recognizedText) {
            await this.contextModule.addUserMessage(recognizedText, {
              type: "voice",
              channel: message.channelName || message.metadata?.channelType || "web",
            });
          }

          // 先获取路由信息，发送思考消息
          const routeInfo = await this.llmService.getRouteInfo({
            capability: "speechSynthesis",
            complexity: this.inferComplexity(context.modelConfig),
          });

          // 构建并发送思考消息（在 LLM 调用前）
          thinkingMessage = [
            `🎤 消息类型: 语音输入 (${message.audio.format}, ${message.audio.data.length} chars)`,
            recognizedText ? `📝 识别文本: ${recognizedText}` : '',
            `🤖 Agent: ${this.name} (${this.id})`,
            `🎯 路由实例: ${routeInfo.instanceName || routeInfo.instanceId}`,
            `📡 调用模型: ${routeInfo.modelName}`,
            `🏢 提供商: ${routeInfo.provider}`,
            `⏳ 状态: 正在调用 LLM...`,
          ].filter(Boolean).join('\n');

          // 立即发送思考消息（通过回调函数）
          console.log(`[AgentRuntime:${this.id}] Checking onThinkingMessage callback:`, !!message.onThinkingMessage);
          if (message.onThinkingMessage) {
            console.log(`[AgentRuntime:${this.id}] Calling onThinkingMessage callback`);
            message.onThinkingMessage(thinkingMessage);
            console.log(`[AgentRuntime:${this.id}] onThinkingMessage callback called`);
          }

          const audioData = [message.audio.data];

          // 根据 stream 参数选择流式或非流式
          if (message.stream) {
            // 流式输出
            console.log(`[AgentRuntime:${this.id}] Using streaming mode for audio`);
            const streamGenerator = this.llmService.streamMultimodalChat(
              message.content || "请听这段语音，告诉我用户说了什么，然后以友好、自然的方式回复用户。",
              {
                audio: audioData,
                audioFormat: message.audio.format,
                complexity: this.inferComplexity(context.modelConfig),
                temperature: context.modelConfig.parameters?.temperature as number,
                maxTokens: context.modelConfig.parameters?.maxTokens as number,
              }
            );

            // 返回流式响应
            return {
              content: "",
              stream: true,
              contentStream: streamGenerator,
              metadata: {
                agentName: this.name,
                timestamp: Date.now(),
                modelUsed: routeInfo.modelName,
                // 端到端模式下也返回识别文本（如果可用）
                recognizedText,
                collaborationMode: true, // 标记为协作模式，以便发送识别结果
              },
              thinkingMessage,
            };
          } else {
            // 非流式输出
            const response = await this.llmService.multimodalChat(
              message.content || "请听这段语音，告诉我用户说了什么，然后以友好、自然的方式回复用户。",
              {
                audio: audioData,
                audioFormat: message.audio.format,
                complexity: this.inferComplexity(context.modelConfig),
                temperature: context.modelConfig.parameters?.temperature as number,
                maxTokens: context.modelConfig.parameters?.maxTokens as number,
              }
            );

            llmResponse = response;
            // 在非流式端到端模式下，添加识别文本到响应的 metadata 中
            if (recognizedText) {
              if (!llmResponse.metadata) {
                llmResponse.metadata = {
                  agentName: this.name,
                  timestamp: Date.now(),
                };
              }
              llmResponse.metadata.recognizedText = recognizedText;
              llmResponse.metadata.collaborationMode = true;
            }
          }
        }
      } else if (message.images && message.images.length > 0) {
        // 使用多模态对话处理图片
        console.log(`[AgentRuntime:${this.id}] Using multimodal chat for images`);
        
        // 先获取路由信息，发送思考消息
        const routeInfo = await this.llmService.getRouteInfo({
          capability: "visualComprehension",
          complexity: this.inferComplexity(context.modelConfig),
        });
        
        // 构建并发送思考消息（在 LLM 调用前）
        thinkingMessage = [
          `📷 消息类型: 图片输入 (${message.images.length} 张)`,
          `🤖 Agent: ${this.name} (${this.id})`,
          `🎯 路由实例: ${routeInfo.instanceName || routeInfo.instanceId}`,
          `📡 调用模型: ${routeInfo.modelName}`,
          `🏢 提供商: ${routeInfo.provider}`,
          `⏳ 状态: 正在调用 LLM...`,
        ].join('\n');
        
        // 立即发送思考消息（通过回调函数）
        if (message.onThinkingMessage) {
          message.onThinkingMessage(thinkingMessage);
        }
        
        const images = message.images;
        
        // 根据 stream 参数选择流式或非流式
        if (message.stream) {
          // 流式输出
          console.log(`[AgentRuntime:${this.id}] Using streaming mode for images`);
          const streamGenerator = this.llmService.streamMultimodalChat(
            message.content || "请描述这张图片",
            {
              images,
              complexity: this.inferComplexity(context.modelConfig),
              temperature: context.modelConfig.parameters?.temperature as number,
              maxTokens: context.modelConfig.parameters?.maxTokens as number,
            }
          );
          
          // 返回流式响应
          return {
            content: "",
            stream: true,
            contentStream: streamGenerator,
            metadata: {
              agentName: this.name,
              timestamp: Date.now(),
              modelUsed: routeInfo.modelName,
            },
            thinkingMessage,
          };
        } else {
          // 非流式输出
          const response = await this.llmService.multimodalChat(
            message.content || "请描述这张图片",
            {
              images,
              complexity: this.inferComplexity(context.modelConfig),
              temperature: context.modelConfig.parameters?.temperature as number,
              maxTokens: context.modelConfig.parameters?.maxTokens as number,
            }
          );
          
          llmResponse = response;
        }
      } else {
        // 2. 构建消息列表
        messages = this.buildMessages(context, message);
        
        // 保存 tools 用于 ReAct 循环
        availableTools = context.availableTools;
        
        // 获取路由信息用于显示
        // 如果指定了 instanceId，从实例配置获取真实信息；否则调用路由
        let routeInfo: { instanceId: string; instanceName?: string; modelName: string; provider: string };
        
        if (context.modelConfig.instanceId) {
          // 使用配置的 instanceId，从数据库获取真实实例信息
          const instanceInfo = await this.contextModule.getLLMInstanceInfo(context.modelConfig.instanceId);
          routeInfo = {
            instanceId: context.modelConfig.instanceId,
            instanceName: context.modelConfig.instanceId,
            modelName: instanceInfo?.modelName || context.modelConfig.model || "unknown",
            provider: instanceInfo?.provider || context.modelConfig.provider || "unknown",
          };
        } else {
          // 调用自动路由获取信息
          routeInfo = await this.llmService.getRouteInfo({
            capability: "textGeneration",
            complexity: this.inferComplexity(context.modelConfig),
          });
        }
        
        // 构建并发送思考消息（在 LLM 调用前）
        thinkingMessage = [
          `📝 消息类型: 文本输入`,
          `🤖 Agent: ${this.name} (${this.id})`,
          `🎯 路由实例: ${routeInfo.instanceName || routeInfo.instanceId}`,
          `📡 调用模型: ${routeInfo.modelName}`,
          `🏢 提供商: ${routeInfo.provider}`,
          `⏳ 状态: 正在调用 LLM...`,
        ].join('\n');
        
        // 立即发送思考消息（通过回调函数）
        if (message.onThinkingMessage) {
          message.onThinkingMessage(thinkingMessage);
        }

        // 保存用户消息到短期记忆（文本消息）
        if (!isHeartbeat && message.content) {
          await this.contextModule.addUserMessage(message.content, {
            type: "text",
            channel: message.channelName || message.metadata?.channelType || "web",
          });
        }

        // 根据 stream 参数选择流式或非流式
        console.log(`[AgentRuntime:${this.id}] Checking stream mode: message.stream=${message.stream}`);
        console.log(`[AgentRuntime:${this.id}] context.modelConfig:`, JSON.stringify({
          instanceId: context.modelConfig.instanceId,
          provider: context.modelConfig.provider,
          model: context.modelConfig.model,
        }));
        console.log(`[AgentRuntime:${this.id}] Tools count: ${context.availableTools?.length || 0}`);
        console.log(`[AgentRuntime:${this.id}] Tools being sent:`, JSON.stringify(context.availableTools?.map(t => t.function.name)));
        if (message.stream) {
          // 流式输出
          console.log(`[AgentRuntime:${this.id}] Using streaming mode for text message`);
          const streamGenerator = this.llmService.streamGenerate({
            model: context.modelConfig,
            messages: messages,
            tools: context.availableTools,
            // 不强制设置 tool_choice，让模型自动决定
          });
          console.log(`[AgentRuntime:${this.id}] Stream generator created: ${!!streamGenerator}`);
          
          // 返回流式响应
          // 包含 messages 和 tools 用于 ReAct 循环
          return {
            content: "", // 初始为空，内容通过流式生成
            stream: true,
            contentStream: streamGenerator,
            metadata: {
              agentName: this.name,
              timestamp: Date.now(),
              modelUsed: routeInfo.modelName,
              // ReAct 支持：保存消息历史和工具列表
              messages: messages,
              availableTools: availableTools,
            },
            thinkingMessage,
          };
        } else {
          // 非流式输出
          console.log(`[AgentRuntime:${this.id}] Using non-streaming mode for text message`);
          console.log(`[AgentRuntime:${this.id}] Sending ${context.availableTools?.length || 0} tools to LLM`);
          const response = await this.llmService.generate({
            model: context.modelConfig,
            messages: messages,
            tools: context.availableTools,
            // 不强制设置 tool_choice，让模型自动决定
          });
          
          console.log(`[AgentRuntime:${this.id}] LLM Response:`, JSON.stringify({
            content: response.content?.substring(0, 100),
            hasToolCalls: !!response.toolCalls,
            toolCallsCount: response.toolCalls?.length || 0,
            toolCalls: response.toolCalls?.map(tc => ({
              name: tc.function?.name,
              args: tc.function?.arguments
            }))
          }, null, 2));
          
          llmResponse = response;
        }
      }

      // 4. 处理响应（仅非流式模式）
      // 传入 messages 和 tools 以支持 ReAct 多轮推理
      const response = await this.processResponse(llmResponse, isHeartbeat, thinkingMessage, messages, availableTools);

      // 4.1 保存助手回复到短期记忆（如果不是心跳消息且非流式）
      if (!isHeartbeat && response.content && !response.stream) {
        const metadata: Record<string, any> = {
          type: response.audio ? "voice" : "text",
          // 通道信息（从原始消息中获取）
          channel: message.channelName || message.metadata?.channelType || "web",
        };
        await this.contextModule.addAssistantMessage(response.content, metadata);
      }

      // 5. 更新状态
      this.runtime.status = "idle";
      this.runtime.consecutiveErrors = 0;

      console.log(
        `[AgentRuntime:${this.id}] ${messageType} processed successfully`,
      );

      return response;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * 推断任务复杂度
   */
  private inferComplexity(model: any): "low" | "medium" | "high" {
    const modelName = (model.model || "").toLowerCase();

    // 大模型用于复杂任务
    if (
      modelName.includes("deepseek") ||
      modelName.includes("gpt-4") ||
      modelName.includes("claude-3-opus")
    ) {
      return "medium";
    }

    // 中等模型
    if (
      modelName.includes("qwen3.5") ||
      modelName.includes("gpt-3.5") ||
      modelName.includes("claude-3-sonnet")
    ) {
      return "medium";
    }

    // 默认低复杂度
    return "low";
  }

  /**
   * 保存助手消息到短期记忆（供流式响应完成后调用）
   */
  async saveAssistantMessage(content: string, contactId: string, channel?: string, isVoice?: boolean): Promise<void> {
    console.log(`[AgentRuntime:${this.id}] [DEBUG] saveAssistantMessage called: contentLength=${content?.length || 0}, contactId=${contactId}, channel=${channel}, isVoice=${isVoice}`);

    try {
      // 确保记忆管理器已初始化
      let memoryManager = this.contextModule.getMemoryManager();
      console.log(`[AgentRuntime:${this.id}] [DEBUG] Current memory manager: ${memoryManager ? 'exists' : 'null'}`);

      if (!memoryManager) {
        console.log(`[AgentRuntime:${this.id}] [DEBUG] Initializing memory manager for contact: ${contactId}`);
        await this.contextModule.initializeMemoryManager(contactId);
        memoryManager = this.contextModule.getMemoryManager();
        console.log(`[AgentRuntime:${this.id}] [DEBUG] Memory manager after initialization: ${memoryManager ? 'exists' : 'null'}`);
      }

      if (!memoryManager) {
        console.error(`[AgentRuntime:${this.id}] [DEBUG] Memory manager still null after initialization!`);
        return;
      }

      // 检查记忆管理器的 contactId 是否匹配
      console.log(`[AgentRuntime:${this.id}] [DEBUG] Memory manager contactId: ${memoryManager.contactId}, target contactId: ${contactId}`);
      if (memoryManager.contactId !== contactId) {
        console.warn(`[AgentRuntime:${this.id}] [DEBUG] ContactId mismatch! Re-initializing memory manager...`);
        await this.contextModule.initializeMemoryManager(contactId);
        memoryManager = this.contextModule.getMemoryManager();
      }

      console.log(`[AgentRuntime:${this.id}] [DEBUG] Calling addAssistantMessage...`);
      await this.contextModule.addAssistantMessage(content, {
        type: isVoice ? "voice" : "text",
        channel: channel || "web",
      });
      console.log(`[AgentRuntime:${this.id}] [DEBUG] Assistant message saved to short-term memory successfully`);
    } catch (error) {
      console.error(`[AgentRuntime:${this.id}] [DEBUG] Failed to save assistant message:`, error);
    }
  }

  /**
   * 获取消息处理信息（用于系统消息）
   */
  getProcessingInfo(message: AgentMessage, modelConfig: any): string {
    const parts: string[] = [];
    
    // 消息类型
    if (message.audio) {
      parts.push(`📢 消息类型: 语音输入 (${message.audio.format}, ${message.audio.data.length} chars)`);
    } else if (message.images && message.images.length > 0) {
      parts.push(`📷 消息类型: 图片输入 (${message.images.length} 张)`);
    } else {
      parts.push(`💬 消息类型: 文本输入`);
    }
    
    // 路由信息
    parts.push(`🤖 Agent: ${this.name} (${this.id})`);
    parts.push(`🎯 模型: ${modelConfig.model || 'unknown'}`);
    parts.push(`📡 提供商: ${modelConfig.provider || 'unknown'}`);
    
    return parts.join('\n');
  }

  /**
   * 执行心跳（由 HeartbeatScheduler 调用）
   */
  async executeHeartbeat(): Promise<void> {
    // 检查是否在活跃时间窗
    if (!this.isWithinActiveHours()) {
      console.log(
        `[AgentRuntime:${this.id}] Outside active hours, skipping heartbeat`,
      );
      this.scheduleNextHeartbeat();
      return;
    }

    // 检查是否正在处理消息
    if (this.runtime.status === "running") {
      console.log(`[AgentRuntime:${this.id}] Busy, skipping heartbeat`);
      this.scheduleNextHeartbeat();
      return;
    }

    // 构建心跳消息
    const heartbeatMessage: AgentMessage = {
      agentId: this.id,
      contactId: "system",
      content: this.heartbeatConfig?.prompt || "检查当前需要处理的事项",
      conversationId: `heartbeat-${Date.now()}`,
      channelName: "internal",
      timestamp: Date.now(),
      isHeartbeat: true,
    };

    try {
      // 执行心跳
      const response = await this.handleMessage(heartbeatMessage);

      // HEARTBEAT_OK 抑制检查
      if (!this.shouldSuppressResponse(response)) {
        // 投递给用户
        await this.deliverResponse(response);
      } else {
        console.log(
          `[AgentRuntime:${this.id}] Heartbeat response suppressed`,
        );
      }

      // 更新心跳时间
      this.runtime.lastHeartbeat = new Date();
    } catch (error) {
      console.error(`[AgentRuntime:${this.id}] Heartbeat failed:`, error);
    }

    // 调度下次心跳
    this.scheduleNextHeartbeat();
  }

  /**
   * 获取运行时状态
   */
  getRuntimeState(): RuntimeState {
    return { ...this.runtime };
  }

  /**
   * 获取 Agent 配置
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * 获取心跳配置
   */
  getHeartbeatConfig(): HeartbeatConfig | undefined {
    return this.heartbeatConfig ? { ...this.heartbeatConfig } : undefined;
  }

  /**
   * 停止 Agent
   */
  async stop(): Promise<void> {
    console.log(`[AgentRuntime:${this.id}] Stopping...`);

    this.stopHeartbeat();
    this.runtime.status = "idle";

    console.log(`[AgentRuntime:${this.id}] Stopped`);
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    context: any,
    message: AgentMessage,
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [
      { role: "system", content: context.systemPrompt },
      ...context.conversationHistory,
    ];

    // 输出完整的消息列表（用于调试）
    console.log("\n" + "=".repeat(80));
    console.log("【完整消息列表 - Full Messages】");
    console.log("=".repeat(80));
    console.log(JSON.stringify(messages, null, 2));
    console.log("=".repeat(80) + "\n");

    // 构建用户消息内容
    const userContent: any[] = [];

    // 添加文本内容
    if (message.content) {
      userContent.push({ type: "text", text: message.content });
    }

    // 添加图片
    if (message.images && message.images.length > 0) {
      for (const imageBase64 of message.images) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: imageBase64.startsWith("data:")
              ? imageBase64
              : `data:image/jpeg;base64,${imageBase64}`,
          },
        });
      }
    }

    // 添加音频（通过多模态API处理）
    if (message.audio) {
      console.log(`[AgentRuntime:${this.id}] Adding audio data: ${message.audio.data.length} chars, format: ${message.audio.format}`);
      // 音频数据会在 LLMService 中特殊处理
      userContent.push({
        type: "input_audio",
        input_audio: {
          data: message.audio.data,
          format: message.audio.format,
        },
      });
    }

    // 如果只有纯文本，简化格式
    if (userContent.length === 1 && userContent[0].type === "text") {
      messages.push({ role: "user", content: message.content || "" });
    } else if (userContent.length > 0) {
      messages.push({ role: "user", content: userContent as any });
    }

    return messages;
  }

  /**
   * 处理 LLM 响应
   * 包括处理 tool calls 和普通响应
   * 支持 ReAct 多轮推理：工具结果会反馈给 LLM 进行下一轮推理
   */
  private async processResponse(
    llmResponse: LLMResponse,
    isHeartbeat: boolean,
    thinkingMessage?: string,
    messages?: any[],
    availableTools?: any[],
    maxIterations: number = 5,
  ): Promise<AgentResponse> {
    // 检查是否有 tool calls
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      console.log(`[AgentRuntime:${this.id}] Processing ${llmResponse.toolCalls.length} tool calls (ReAct mode)`);
      
      // 执行所有 tool calls
      const allToolResults: string[] = [];
      const allToolCalls: ToolCall[] = [];
      
      for (const toolCall of llmResponse.toolCalls) {
        const result = await this.executeToolCall(toolCall);
        allToolResults.push(result);
        allToolCalls.push(toolCall);
        
        console.log(`[AgentRuntime:${this.id}] Tool ${toolCall.function.name} result: ${result}`);
      }
      
      // ReAct 循环：将工具结果反馈给 LLM 进行下一轮推理
      if (messages && availableTools && maxIterations > 0) {
        console.log(`[AgentRuntime:${this.id}] ReAct: Feeding tool results back to LLM for next reasoning step`);
        
        // 添加 assistant 的 tool_calls 到消息历史
        messages.push({
          role: "assistant",
          content: llmResponse.content || null,
          tool_calls: llmResponse.toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });
        
        // 添加 tool 执行结果到消息历史
        for (let i = 0; i < llmResponse.toolCalls.length; i++) {
          messages.push({
            role: "tool",
            tool_call_id: llmResponse.toolCalls[i].id,
            content: allToolResults[i],
          });
        }
        
        // 再次调用 LLM 进行下一轮推理
        console.log(`[AgentRuntime:${this.id}] ReAct: Calling LLM again with tool results`);
        const nextResponse = await this.llmService.generate({
          model: this.config.model,
          messages: messages,
          tools: availableTools,
        });
        
        console.log(`[AgentRuntime:${this.id}] ReAct: Next response has ${nextResponse.toolCalls?.length || 0} tool calls`);
        
        // 递归处理下一轮响应
        return this.processResponse(
          nextResponse,
          isHeartbeat,
          thinkingMessage,
          messages,
          availableTools,
          maxIterations - 1,
        );
      }
      
      // 达到最大迭代次数或没有消息历史，直接返回结果
      return {
        content: allToolResults.join("\n\n"),
        actions: [{
          type: "tool_result",
          payload: { results: allToolResults },
        }],
        metadata: {
          agentName: this.name,
          timestamp: Date.now(),
          modelUsed: this.config.model.model,
          toolCalls: allToolCalls,
        },
        thinkingMessage,
      };
    }

    // 普通响应处理
    const content = llmResponse.content;
    const actions = this.parseActions(content);

    // 构建音频数据（如果有）
    let audio: { data: string; format: string } | undefined;
    if (llmResponse.audio) {
      audio = {
        data: llmResponse.audio,
        format: "wav",
      };
    }

    return {
      content: content,
      actions: actions,
      metadata: {
        agentName: this.name,
        timestamp: Date.now(),
        modelUsed: this.config.model.model,
        recognizedText: (llmResponse as any).recognizedText,
        collaborationMode: (llmResponse as any).collaborationMode,
      },
      thinkingMessage,
      audio,
    };
  }

  /**
   * 执行 Tool Call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    
    console.log(`[AgentRuntime:${this.id}] Executing tool: ${name}`, args);
    
    // 解析 skill 调用: skill_<slug>_<command>
    const match = name.match(/^skill_(.+?)_(.+)$/);
    if (!match) {
      return `Error: Invalid tool name format: ${name}`;
    }
    
    const [, slug, commandName] = match;
    
    // 解析参数（从 JSON 字符串转为对象）
    let parsedArgs: Record<string, unknown> = {};
    try {
      if (args) {
        parsedArgs = JSON.parse(args);
      }
    } catch {
      // 如果解析失败，使用空对象
    }
    
    try {
      // 调用 skill
      const result = await invokeSkill(
        this.id,
        slug,
        commandName,
        parsedArgs,
        {
          workspaceDir: process.cwd(),
          env: {},
        }
      );
      
      if (result.success) {
        return result.output;
      } else {
        return `Error: ${result.error}`;
      }
    } catch (error) {
      console.error(`[AgentRuntime:${this.id}] Tool execution failed:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 解析动作
   */
  private parseActions(content: string): Action[] {
    const actions: Action[] = [];

    // 简单的动作解析逻辑
    // 实际实现中可能需要更复杂的解析
    if (content.includes("[ACTION:")) {
      const actionMatches = content.match(/\[ACTION:(\w+)\](.*?)\[\/ACTION\]/g);
      if (actionMatches) {
        for (const match of actionMatches) {
          const typeMatch = match.match(/\[ACTION:(\w+)\]/);
          if (typeMatch) {
            actions.push({
              type: typeMatch[1],
              payload: { raw: match },
            });
          }
        }
      }
    }

    // 默认添加回复动作
    if (actions.length === 0) {
      actions.push({
        type: "reply",
        payload: { text: content },
      });
    }

    return actions;
  }

  /**
   * 检查是否应该抑制响应（HEARTBEAT_OK 抑制）
   */
  private shouldSuppressResponse(response: AgentResponse): boolean {
    const content = response.content.trim();

    // 纯 HEARTBEAT_OK → 完全抑制
    if (content === "HEARTBEAT_OK") {
      return true;
    }

    // HEARTBEAT_OK + 短内容 → 抑制
    if (content.includes("HEARTBEAT_OK") && content.length < 300) {
      return true;
    }

    // 其他情况 → 不抑制
    return false;
  }

  /**
   * 投递响应（实际实现中需要与 Gateway 集成）
   */
  private async deliverResponse(response: AgentResponse): Promise<void> {
    // TODO: 与 Gateway 集成，实际投递消息
    console.log(
      `[AgentRuntime:${this.id}] Delivering response:`,
      response.content.substring(0, 100) + "...",
    );
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    this.runtime.consecutiveErrors++;
    this.runtime.status = "error";

    console.error(
      `[AgentRuntime:${this.id}] Error (${this.runtime.consecutiveErrors}/5):`,
      error.message,
    );

    // 连续错误超过阈值，暂停 Agent
    if (this.runtime.consecutiveErrors >= 5) {
      console.error(
        `[AgentRuntime:${this.id}] Too many consecutive errors, pausing agent`,
      );
      this.runtime.status = "paused";
      this.stopHeartbeat();

      // TODO: 通知管理员
      this.alertAdmin({
        agentId: this.id,
        reason: "Consecutive errors exceeded threshold",
        error: error.message,
      });
    }
  }

  /**
   * 检查是否在活跃时间窗
   */
  private isWithinActiveHours(): boolean {
    if (!this.heartbeatConfig?.activeHours) {
      return true;
    }

    const { start, end, timezone = "Asia/Shanghai" } =
      this.heartbeatConfig.activeHours;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    return currentTime >= start && currentTime <= end;
  }

  /**
   * 调度下次心跳
   */
  private scheduleNextHeartbeat(): void {
    if (this.heartbeatScheduler) {
      this.heartbeatScheduler.scheduleNext();
    }
  }

  /**
   * 获取上下文构建模式
   * 根据渐进式披露配置决定
   */
  private getContextBuildMode(): ContextBuildMode {
    const disclosureConfig = this.config.progressiveDisclosure;

    // 默认启用渐进式披露（intent 模式）
    // 只有明确设置 enabled: false 时才使用 full 模式
    if (disclosureConfig?.enabled === false) {
      return "full";
    }

    return disclosureConfig?.mode || "intent";
  }

  /**
   * 预加载技能缓存
   */
  private async loadSkillsCache(): Promise<void> {
    // TODO: 从数据库加载技能
    this.cache.skills = [];
  }

  /**
   * 通知管理员
   */
  private alertAdmin(alert: {
    agentId: string;
    reason: string;
    error: string;
  }): void {
    console.error(`[AgentRuntime:${this.id}] ALERT:`, alert);
    // TODO: 实现实际的通知机制（邮件、钉钉等）
  }
}
