/**
 * Agent Worker 进程入口
 *
 * 每个 Worker 进程管理一个 Agent
 * 通过环境变量 AGENT_ID 指定管理的 Agent
 */

console.log('[AgentWorker] Worker process starting...');

import { AgentManager } from "./agent-manager.js";
import type { AgentMessage, AgentResponse } from "../types/index.js";
import type { ToolCall } from "../../llm/runtime/types.js";
import { invokeSkill } from "../skills/invoker.js";
import { Executor, type ExecutorOptions } from "../executor/index.js";

console.log('[AgentWorker] Imports loaded successfully');

/**
 * IPC 消息
 */
interface IPCMessage {
  id: string;
  type: string;
  payload: any;
}

/**
 * Agent Worker
 */
class AgentWorker {
  private agentId: string;
  private agentManager?: AgentManager;
  private running = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒发送一次心跳

  constructor() {
    // 从环境变量获取 Agent ID
    this.agentId = process.env.AGENT_ID || "";

    if (!this.agentId) {
      throw new Error("AGENT_ID environment variable is required");
    }

    console.log(`[AgentWorker] Created for agent: ${this.agentId}`);
  }

  /**
   * 启动 Worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn(`[AgentWorker:${this.agentId}] Already running`);
      return;
    }

    console.log(`[AgentWorker:${this.agentId}] Starting...`);

    try {
      // 创建 AgentManager（传入 IPC 发送函数）
      this.agentManager = new AgentManager({
        agentId: this.agentId,
        sendToMaster: (message) => this.sendToMaster(message),
      });

      // 初始化
      await this.agentManager.initialize();

      // 设置 IPC 监听
      this.setupIPC();

      this.running = true;

      // 启动心跳
      this.startHeartbeat();

      // 通知 Master 就绪
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "worker-ready",
        payload: {
          agentId: this.agentId,
          status: "ready",
          timestamp: Date.now(),
        },
      });

      console.log(`[AgentWorker:${this.agentId}] Started successfully`);
    } catch (error) {
      console.error(
        `[AgentWorker:${this.agentId}] Failed to start:`,
        error,
      );

      // 通知 Master 启动失败
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "worker-error",
        payload: {
          agentId: this.agentId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * 停止 Worker
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log(`[AgentWorker:${this.agentId}] Stopping...`);

    this.running = false;

    // 停止心跳
    this.stopHeartbeat();

    // 停止 AgentManager
    if (this.agentManager) {
      await this.agentManager.stop();
    }

    console.log(`[AgentWorker:${this.agentId}] Stopped`);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    // 立即发送第一个心跳
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "heartbeat",
      payload: {
        agentId: this.agentId,
        timestamp: Date.now(),
      },
    });

    // 启动定时心跳
    this.heartbeatTimer = setInterval(() => {
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "heartbeat",
        payload: {
          agentId: this.agentId,
          timestamp: Date.now(),
        },
      });
    }, this.HEARTBEAT_INTERVAL);

    console.log(`[AgentWorker:${this.agentId}] Heartbeat started`);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
      console.log(`[AgentWorker:${this.agentId}] Heartbeat stopped`);
    }
  }

  /**
   * 处理入站消息
   */
  private async handleInboundMessage(message: IPCMessage): Promise<void> {
    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized`);
      return;
    }

    // inbound 消息的 payload 结构: { messageId, context, channelConfig }
    const { messageId, context } = message.payload;

    console.log(
      `[AgentWorker:${this.agentId}] Received inbound message: ${messageId}, context.messageId: ${context.messageId}, audio: ${!!context.audio}, images: ${context.images?.length || 0}`,
    );

    // 从 context 顶层获取 stream 参数（不是从 metadata）
    const stream = context.stream !== false;
    console.log(`[AgentWorker:${this.agentId}] Stream mode: ${stream}, context.stream: ${context.stream}`);

    // 构建 AgentMessage
    // 使用 payload.messageId 确保与 pendingMessages 的 key 一致
    const agentMessage: AgentMessage = {
      messageId: messageId || context.messageId,
      agentId: this.agentId, // 设置目标 Agent ID
      contactId: context.senderId,
      content: context.body,
      channelName: context.channelName || context.channelType,
      timestamp: context.timestamp,
      metadata: {
        channelType: context.channelType,
        channelName: context.channelName,
        chatType: context.chatType,
        chatId: context.chatId,
        senderName: context.senderName,
        recipientId: context.recipientId,
      },
      stream,
      voice: context.voice, // 传递语音合成音色
    };

    // 传递多媒体数据
    if (context.audio) {
      console.log(`[AgentWorker:${this.agentId}] Adding audio: ${context.audio.data.length} chars`);
      agentMessage.audio = context.audio;
      // 语音回复开关：优先使用 context.voiceResponse，如果不存在则默认启用
      agentMessage.voiceResponse = context.voiceResponse !== false;
      // 语音合成音色
      agentMessage.voice = context.voice;
      console.log(`[AgentWorker:${this.agentId}] Voice response enabled: ${agentMessage.voiceResponse}, voice: ${agentMessage.voice}`);
    }
    if (context.images && context.images.length > 0) {
      console.log(`[AgentWorker:${this.agentId}] Adding ${context.images.length} images`);
      agentMessage.images = context.images;
    }

    // 记录上一次发送的思考消息内容
    let lastThinkingMessage = "";

    // 设置思考消息回调函数 - 在 LLM 调用前立即发送
    agentMessage.onThinkingMessage = (thinkingMessage: string) => {
      // 如果内容没有变化，不重复发送
      if (thinkingMessage === lastThinkingMessage) return;
      lastThinkingMessage = thinkingMessage;
      
      console.log(`[AgentWorker:${this.agentId}] Sending thinking message immediately`);
      
      // 发送思考消息到 Master
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-stream-start",
        payload: {
          requestId: messageId,
          agentId: this.agentId,
          thinkingMessage,
          timestamp: Date.now(),
        },
      });
    };

    try {
      // 处理消息
      console.error(`[AgentWorker:${this.agentId}] About to call agentManager.handleMessage`);
      const response = await this.agentManager.handleMessage(agentMessage);
      console.error(`[AgentWorker:${this.agentId}] agentManager.handleMessage returned`);

      // 检查是否为流式响应
      if (response.stream && response.contentStream) {
        // 流式输出：分块发送内容（支持 ReAct 多轮循环）
        console.log(`[AgentWorker:${this.agentId}] Streaming response started (with ReAct support)`);
        console.log(`[AgentWorker:${this.agentId}] Response metadata:`, JSON.stringify({
          hasMessages: !!response.metadata?.messages,
          messagesCount: response.metadata?.messages?.length || 0,
          hasTools: !!response.metadata?.availableTools,
          toolsCount: response.metadata?.availableTools?.length || 0,
          toolNames: response.metadata?.availableTools?.map((t: any) => t.function?.name) || [],
        }));
        
        // 获取 ReAct 所需的信息
        const messages: any[] = response.metadata?.messages || [];
        const availableTools: any[] = response.metadata?.availableTools || [];
        
        // 执行流式 ReAct 循环
        const reactResult = await this.executeStreamingReAct(
          messageId,
          response.contentStream,
          messages,
          availableTools,
          agentMessage,
          lastThinkingMessage,
          response.thinkingMessage,
          response.metadata
        );
        
        let fullContent = reactResult.fullContent;
        let finalAssistantContent = reactResult.finalAssistantContent;
        const finalMetadata = reactResult.metadata;
        
        // 多模型协作模式：流式结束后进行语音合成
        if (finalMetadata?.collaborationMode && finalMetadata?.pendingSpeechSynthesis) {
          console.log(`[AgentWorker:${this.agentId}] Collaboration mode: synthesizing speech after streaming`);
          
          const config = finalMetadata.speechSynthesisConfig;
          console.log(`[AgentWorker:${this.agentId}] Speech synthesis config:`, JSON.stringify(config, null, 2));
          
          // Step 3: 发送语音合成的思考消息（显示完整模型信息）
          const synthesisThinkingMessage = [
            `🔊 语音合成`,
            `📝 ${fullContent.substring(0, 50)}${fullContent.length > 50 ? '...' : ''}`,
            `🎯 合成模型信息:`,
            `   ID: ${config?.instanceId || '自动路由'}`,
            `   名称: Qwen3-Omni-Flash`,
            `   提供商: alibaba`,
          ].join('\n');
          
          // 发送思考消息
          this.sendToMaster({
            id: this.generateMessageId(),
            type: "agent-stream-start",
            payload: {
              requestId: messageId,
              agentId: this.agentId,
              thinkingMessage: synthesisThinkingMessage,
              timestamp: Date.now(),
            },
          });
          
          try {
            const llmService = this.agentManager.getLLMService();
            if (!config) {
              throw new Error("Speech synthesis config not found");
            }
            console.log(`[AgentWorker:${this.agentId}] Calling synthesizeSpeech with voice: ${config.voice}`);
            const synthesisResult = await llmService.synthesizeSpeech(fullContent, {
              format: config.format,
              instanceId: config.instanceId,
              voice: config.voice, // 传递音色选择
            });
            
            // 计算音频时长（MP3 格式估算：大约 16kbps）
            // base64 解码后的长度 = base64 长度 * 0.75
            const audioBytes = Math.floor(synthesisResult.audio.length * 0.75);
            // MP3 大约 16kbps = 2KB/s，所以时长 = 字节数 / 2000
            const audioDuration = Math.ceil(audioBytes / 2000);
            
            // 发送带音频的流式结束消息
            this.sendToMaster({
              id: this.generateMessageId(),
              type: "agent-stream-end",
              payload: {
                requestId: messageId,
                agentId: this.agentId,
                content: fullContent,
                metadata: finalMetadata,
                timestamp: Date.now(),
                audio: synthesisResult.audio,
                audioFormat: synthesisResult.format,
                audioDuration: audioDuration,
              },
            });
            console.log(`[AgentWorker:${this.agentId}] Speech synthesized and sent with stream-end`);
          } catch (error) {
            console.error(`[AgentWorker:${this.agentId}] Speech synthesis failed:`, error);
            // 发送不带音频的流式结束消息
            this.sendToMaster({
              id: this.generateMessageId(),
              type: "agent-stream-end",
              payload: {
                requestId: messageId,
                agentId: this.agentId,
                content: fullContent,
                metadata: finalMetadata,
                timestamp: Date.now(),
              },
            });
          }
        } else {
          // 发送流式结束消息
          this.sendToMaster({
            id: this.generateMessageId(),
            type: "agent-stream-end",
            payload: {
              requestId: messageId,
              agentId: this.agentId,
              content: fullContent,
              metadata: finalMetadata,
              timestamp: Date.now(),
            },
          });
        }
        
        console.log(`[AgentWorker:${this.agentId}] Streaming response completed, ${fullContent.length} chars`);
        
        // 保存助手消息到短期记忆
        // 使用 finalAssistantContent（只包含 LLM 回复，不包含工具调用结果）
        // 如果 finalAssistantContent 为空，则使用 fullContent
        const contentToSave = finalAssistantContent || fullContent;
        if (contentToSave && contentToSave.length > 0) {
          console.log(`[AgentWorker:${this.agentId}] [DEBUG] Saving assistant message to short-term memory, contentLength=${contentToSave.length}`);
          try {
            await this.agentManager.saveAssistantMessage(
              contentToSave,
              agentMessage.contactId,
              agentMessage.channelName,
              false // isVoice - 流式响应的文本内容
            );
            console.log(`[AgentWorker:${this.agentId}] [DEBUG] Assistant message saved to short-term memory successfully`);
          } catch (saveError) {
            console.error(`[AgentWorker:${this.agentId}] [DEBUG] Failed to save assistant message:`, saveError);
          }
        } else {
          console.log(`[AgentWorker:${this.agentId}] [DEBUG] Not saving assistant message: content is empty`);
        }
      } else {
        // 非流式输出：如果还没有发送思考消息，在这里发送
        if (!lastThinkingMessage && response.thinkingMessage) {
          agentMessage.onThinkingMessage(response.thinkingMessage);
        }
        
        // 多模型协作模式：发送语音识别结果到前端（非流式情况）
        if (response.metadata?.collaborationMode && response.metadata?.recognizedText) {
          console.log(`[AgentWorker:${this.agentId}] Sending recognized text to frontend (non-stream):`, response.metadata.recognizedText);
          this.sendToMaster({
            id: this.generateMessageId(),
            type: "agent-recognition-result",
            payload: {
              requestId: messageId,
              agentId: this.agentId,
              recognizedText: response.metadata.recognizedText,
              timestamp: Date.now(),
            },
          });
        }
        
        // 直接发送完整响应
        this.sendResponse(messageId, response);
      }
    } catch (error) {
      console.error(
        `[AgentWorker:${this.agentId}] Error handling message:`,
        error,
      );

      // 发送错误响应 - 使用 messageId 作为 requestId
      this.sendError(messageId, error as Error);
    }
  }

  /**
   * 发送响应
   */
  private sendResponse(requestId: string, response: AgentResponse): void {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "agent-response",
      payload: {
        requestId,
        agentId: this.agentId,
        response,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 发送错误
   */
  private sendError(requestId: string, error: Error): void {
    this.sendToMaster({
      id: this.generateMessageId(),
      type: "agent-error",
      payload: {
        requestId,
        agentId: this.agentId,
        error: error.message,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 执行 Tool Call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    
    console.log(`[AgentWorker:${this.agentId}] ========================================`);
    console.log(`[AgentWorker:${this.agentId}] 🚀 EXECUTING TOOL CALL`);
    console.log(`[AgentWorker:${this.agentId}] ========================================`);
    console.log(`[AgentWorker:${this.agentId}] 📌 Tool Name: ${name}`);
    console.log(`[AgentWorker:${this.agentId}] 📋 Raw Arguments: ${args}`);
    
    // 解析 skill 调用: skill_<slug>_<command>
    const match = name.match(/^skill_(.+?)_(.+)$/);
    if (!match) {
      console.error(`[AgentWorker:${this.agentId}] ❌ Invalid tool name format: ${name}`);
      return `Error: Invalid tool name format: ${name}`;
    }
    
    const [, slug, commandName] = match;
    console.log(`[AgentWorker:${this.agentId}] 🔍 Parsed - Slug: ${slug}, Command: ${commandName}`);
    
    try {
      const parsedArgs = args ? JSON.parse(args) : {};
      console.log(`[AgentWorker:${this.agentId}] 📦 Parsed Arguments:`, JSON.stringify(parsedArgs, null, 2));
      
      // 调用 skill
      console.log(`[AgentWorker:${this.agentId}] ⏳ Invoking skill...`);
      const result = await invokeSkill(
        this.agentId,
        slug,
        commandName,
        parsedArgs,
        {
          workspaceDir: process.cwd(),
          env: {},
        }
      );
      
      console.log(`[AgentWorker:${this.agentId}] ✅ Skill execution completed`);
      console.log(`[AgentWorker:${this.agentId}] 📊 Success: ${result.success}`);
      if (result.success) {
        console.log(`[AgentWorker:${this.agentId}] 📄 Output: ${result.output.substring(0, 200)}${result.output.length > 200 ? '...' : ''}`);
      } else {
        console.error(`[AgentWorker:${this.agentId}] ❌ Error: ${result.error}`);
      }
      console.log(`[AgentWorker:${this.agentId}] ========================================`);
      
      if (result.success) {
        return result.output;
      } else {
        return `Error: ${result.error}`;
      }
    } catch (error) {
      console.error(`[AgentWorker:${this.agentId}] Tool execution failed:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 执行流式 ReAct 循环（使用 Executor）
   * 支持多轮工具调用和推理
   */
  private async executeStreamingReAct(
    messageId: string,
    initialStream: AsyncGenerator<string>,
    messages: any[],
    availableTools: any[],
    agentMessage: AgentMessage,
    lastThinkingMessage: string,
    initialThinkingMessage: string | undefined,
    initialMetadata: any,
    maxIterations: number = 5
  ): Promise<{ fullContent: string; metadata: any; finalAssistantContent: string }> {
    let fullContent = "";
    let finalAssistantContent = "";
    let currentMetadata = initialMetadata;
    
    // 发送初始思考消息
    if (!lastThinkingMessage && initialThinkingMessage) {
      agentMessage.onThinkingMessage?.(initialThinkingMessage);
    }
    
    // 多模型协作模式：发送语音识别结果到前端
    if (currentMetadata?.collaborationMode && currentMetadata?.recognizedText) {
      console.log(`[AgentWorker:${this.agentId}] Sending recognized text to frontend:`, currentMetadata.recognizedText);
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-recognition-result",
        payload: {
          requestId: messageId,
          agentId: this.agentId,
          recognizedText: currentMetadata.recognizedText,
          timestamp: Date.now(),
        },
      });
    }
    
    // 处理初始流
    let toolCalls: ToolCall[] | undefined;
    let iterationContent = "";
    
    try {
      for await (const chunk of initialStream) {
        // 检查是否是 tool_calls 标记
        if (typeof chunk === "string" && chunk.startsWith('{"__tool_calls":')) {
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.__tool_calls && Array.isArray(parsed.__tool_calls)) {
              toolCalls = parsed.__tool_calls;
              console.log(`[AgentWorker:${this.agentId}] 🔧 DETECTED ${toolCalls?.length || 0} TOOL CALLS FROM LLM`);
              continue;
            }
          } catch {
            // 不是有效的 JSON，作为普通内容处理
          }
        }
        
        iterationContent += chunk;
        fullContent += chunk;
        this.sendToMaster({
          id: this.generateMessageId(),
          type: "agent-stream-chunk",
          payload: {
            requestId: messageId,
            agentId: this.agentId,
            chunk,
            timestamp: Date.now(),
          },
        });
      }
    } catch (streamError) {
      console.error(`[AgentWorker:${this.agentId}] Error in initial stream:`, streamError);
      return { fullContent, metadata: currentMetadata, finalAssistantContent: iterationContent };
    }
    
    // 如果没有工具调用，直接返回
    if (!toolCalls || toolCalls.length === 0) {
      console.log(`[AgentWorker:${this.agentId}] No tool calls, returning directly`);
      return { fullContent, metadata: currentMetadata, finalAssistantContent: iterationContent };
    }
    
    // 有工具调用，创建 Executor 执行
    console.log(`[AgentWorker:${this.agentId}] Creating Executor for ${toolCalls.length} tool calls`);
    
    // 获取 Agent 配置
    const agentConfig = (this.agentManager as any).agent?.getConfig?.();
    const modelConfig = agentConfig?.model || {
      provider: "openai",
      model: currentMetadata?.modelUsed || "gpt-3.5-turbo",
      parameters: {
        temperature: 0.7,
        maxTokens: 4096,
      },
    };
    
    // 创建 Executor
    const executorOptions: ExecutorOptions = {
      task: agentMessage.content,
      tools: availableTools,
      skills: [],
      context: {
        systemPrompt: "",
        conversationHistory: messages.map((m: any) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content || "",
        })),
      },
      config: {
        agentId: this.agentId,
        maxIterations: maxIterations,
        timeout: 300,
        modelConfig: modelConfig,
      },
      onToolCall: (event) => {
        // 发送工具调用开始事件
        this.sendToMaster({
          id: this.generateMessageId(),
          type: "agent-tool-call",
          payload: {
            requestId: messageId,
            agentId: this.agentId,
            toolCall: event,
            timestamp: Date.now(),
          },
        });
      },
      onToolResult: (event) => {
        // 发送工具调用结果事件
        this.sendToMaster({
          id: this.generateMessageId(),
          type: "agent-tool-result",
          payload: {
            requestId: messageId,
            agentId: this.agentId,
            toolResult: event,
            timestamp: Date.now(),
          },
        });
      },
    };
    
    const llmService = this.agentManager!.getLLMService();
    const executor = new Executor(`executor-${Date.now()}`, executorOptions, llmService);
    
    // 执行流式 ReAct
    try {
      const stream = executor.streamExecute();
      let chunkCount = 0;
      
      for await (const chunk of stream) {
        chunkCount++;
        fullContent += chunk;
        finalAssistantContent += chunk;
        this.sendToMaster({
          id: this.generateMessageId(),
          type: "agent-stream-chunk",
          payload: {
            requestId: messageId,
            agentId: this.agentId,
            chunk,
            timestamp: Date.now(),
          },
        });
        
        // 每 10 个 chunk 让出事件循环，确保 IPC 消息能及时处理
        if (chunkCount % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      // 流式执行完成
      console.log(`[AgentWorker:${this.agentId}] Executor streaming completed, total chunks: ${chunkCount}`);
      
    } catch (executorError) {
      console.error(`[AgentWorker:${this.agentId}] Executor error:`, executorError);
    }
    
    return { fullContent, metadata: currentMetadata, finalAssistantContent };
  }

  /**
   * 处理状态查询
   */
  private handleStatusQuery(): void {
    if (!this.agentManager) {
      this.sendToMaster({
        id: this.generateMessageId(),
        type: "agent-status",
        payload: {
          agentId: this.agentId,
          status: "not-initialized",
          timestamp: Date.now(),
        },
      });
      return;
    }

    const status = this.agentManager.getAgentStatus();

    this.sendToMaster({
      id: this.generateMessageId(),
      type: "agent-status",
      payload: {
        agentId: this.agentId,
        status: status?.status || "unknown",
        details: status,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 设置 IPC 监听
   */
  private setupIPC(): void {
    if (!process.send) {
      console.warn(`[AgentWorker:${this.agentId}] IPC not available`);
      return;
    }

    process.on("message", (message: IPCMessage) => {
      this.handleIPCMessage(message);
    });

    // 处理进程信号
    process.on("SIGTERM", () => {
      console.log(`[AgentWorker:${this.agentId}] Received SIGTERM`);
      this.stop().then(() => {
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log(`[AgentWorker:${this.agentId}] Received SIGINT`);
      this.stop().then(() => {
        process.exit(0);
      });
    });
  }

  /**
   * 处理 IPC 消息
   */
  private handleIPCMessage(message: IPCMessage): void {
    switch (message.type) {
      case "inbound":
        this.handleInboundMessage(message);
        break;

      case "status-query":
        this.handleStatusQuery();
        break;

      case "stop":
        this.stop();
        break;

      case "llm-response":
        // 处理来自 Master 的 LLM 响应
        this.handleLLMResponse(message);
        break;

      default:
        console.warn(
          `[AgentWorker:${this.agentId}] Unknown message type: ${message.type}`,
        );
    }
  }

  /**
   * 处理 LLM 响应（来自 Master）
   */
  private handleLLMResponse(message: IPCMessage): void {
    if (!this.agentManager) {
      console.error(`[AgentWorker:${this.agentId}] AgentManager not initialized for LLM response`);
      return;
    }

    // 转发给 LLMClient 处理
    const llmClient = (this.agentManager as any).llmClient;
    if (llmClient && llmClient.handleResponse) {
      llmClient.handleResponse(message.payload);
    }
  }

  /**
   * 发送消息给 Master
   */
  private sendToMaster(message: IPCMessage): void {
    if (process.send) {
      process.send(message);
    } else {
      console.log(
        `[AgentWorker:${this.agentId}] IPC not available, message:`,
        message,
      );
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 启动 Worker
 */
async function main(): Promise<void> {
  const worker = new AgentWorker();

  try {
    await worker.start();
  } catch (error) {
    console.error("[AgentWorker] Failed to start:", error);
    process.exit(1);
  }
}

// 启动
main();
