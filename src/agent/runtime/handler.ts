/**
 * Agent 消息处理器
 *
 * 处理业务逻辑：ReAct 循环、工具调用、流式响应
 * 与进程管理分离，可被 Worker 调用
 */

import type { AgentMessage, AgentResponse } from "../types/index.js";
import type { ToolCall } from "../../llm/runtime/types.js";
import { AgentOrchestratorIntegration, type TaskExecutionResult } from "../orchestrator/integration.js";
import type { SkillEntry } from "../skills/index.js";
import { createExecutor, type ExecutorSkillInfo } from "../executor/index.js";
import { HandlerAgent } from "../handler/index.js";
import { executeTool } from "../tools/index.js";
import type { AgentManager } from "./agent-manager.js";
import type { LLMServiceInterface, StreamEvent } from "./llm-service-interface.js";
import { Environment } from "../context/environment.js";
import path from "path";
import type { IPCMessage } from "../../gateway/ipc/types.js";

/**
 * 工具调用结果
 */
interface ToolCallResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
}

/**
 * ReAct 执行结果
 */
interface ReActResult {
  fullContent: string;
  metadata: any;
  finalAssistantContent: string;
}

/**
 * 处理器配置
 */
interface HandlerConfig {
  agentId: string;
  agentName: string;
  workspaceDir: string;
  preferredLanguage?: string;
}

/**
 * Agent 消息处理器
 */
class AgentMessageHandler {
  private agentManager: AgentManager;
  private sendToMaster: (message: IPCMessage) => void;
  private config: HandlerConfig;

  constructor(
    agentManager: AgentManager,
    sendToMaster: (message: IPCMessage) => void,
    config: HandlerConfig
  ) {
    this.agentManager = agentManager;
    this.sendToMaster = sendToMaster;
    this.config = config;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createIPCMessage(type: string, payload: any): IPCMessage {
    return {
      id: this.generateMessageId(),
      type,
      from: this.config.agentId,
      to: "master",
      timestamp: Date.now(),
      payload,
    };
  }

  /**
   * 处理入站消息
   */
  async handleMessage(
    messageId: string,
    agentMessage: AgentMessage,
    modelConfig?: any,
    maxIterations?: number,
    availableTools?: any[],
    availableSkills?: SkillEntry[]
  ): Promise<void> {
    const llmService = this.agentManager.getLLMService();

    // 记录上一次发送的思考消息内容
    let lastThinkingMessage = "";

    // 设置思考消息回调函数
    const onThinkingMessage = (thinkingMessage: string) => {
      if (thinkingMessage === lastThinkingMessage) return;
      lastThinkingMessage = thinkingMessage;

      this.sendToMaster(this.createIPCMessage("agent-stream-start", {
        requestId: messageId,
        agentId: this.config.agentId,
        thinkingMessage,
        timestamp: Date.now(),
      }));
    };

    try {
      const response = await this.agentManager.handleMessage(agentMessage);

      // 从 response.metadata 获取 availableTools 和 availableSkills
      const availableTools = response.metadata?.availableTools || [];
      const availableSkills = response.metadata?.availableSkills || [];

      if (response.stream && (response.contentEventStream || response.contentStream)) {
        // 流式输出 - 优先使用 contentEventStream
        const stream = response.contentEventStream || response.contentStream;
        await this.handleStreamingResponse(
          messageId,
          stream!,
          response.metadata?.messages || [],
          availableTools,
          agentMessage,
          lastThinkingMessage,
          response.thinkingMessage,
          response.metadata,
          modelConfig || {},
          maxIterations || 5,
          availableSkills,
          llmService
        );
      } else {
        // 非流式输出
        if (!lastThinkingMessage && response.thinkingMessage) {
          onThinkingMessage(response.thinkingMessage);
        }

        // 多模型协作模式：发送语音识别结果
        if (response.metadata?.collaborationMode && response.metadata?.recognizedText) {
          this.sendToMaster(this.createIPCMessage("agent-recognition-result", {
            requestId: messageId,
            agentId: this.config.agentId,
            recognizedText: response.metadata.recognizedText,
            timestamp: Date.now(),
          }));
        }

        this.sendResponse(messageId, response);
      }
    } catch (error) {
      console.error(`[AgentHandler:${this.config.agentId}] Error handling message:`, error);
      this.sendError(messageId, error as Error);
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamingResponse(
    messageId: string,
    initialStream: AsyncGenerator<StreamEvent | string>,
    messages: any[],
    availableTools: any[],
    agentMessage: AgentMessage,
    lastThinkingMessage: string,
    initialThinkingMessage: string | undefined,
    initialMetadata: any,
    modelConfig: any,
    maxIterations: number,
    availableSkills: SkillEntry[],
    llmService: LLMServiceInterface
  ): Promise<void> {
    let fullContent = "";
    let finalAssistantContent = "";
    let currentMetadata = initialMetadata;

    const onThinkingMessage = (thinkingMessage: string) => {
      if (thinkingMessage === lastThinkingMessage) return;
      this.sendToMaster(this.createIPCMessage("agent-stream-start", {
        requestId: messageId,
        agentId: this.config.agentId,
        thinkingMessage,
        timestamp: Date.now(),
      }));
    };

    if (!lastThinkingMessage && initialThinkingMessage) {
      onThinkingMessage(initialThinkingMessage);
    }

    // 发送语音识别结果
    if (currentMetadata?.collaborationMode && currentMetadata?.recognizedText) {
      this.sendToMaster(this.createIPCMessage("agent-recognition-result", {
        requestId: messageId,
        agentId: this.config.agentId,
        recognizedText: currentMetadata.recognizedText,
        timestamp: Date.now(),
      }));
    }

    let toolCalls: ToolCall[] | undefined;
    let iterationContent = "";

    try {
      for await (const event of initialStream) {
        // 处理 StreamEvent 对象
        if (typeof event === "object" && event !== null && "type" in event) {
          const streamEvent = event as StreamEvent;
          
          switch (streamEvent.type) {
            case "text":
              if (streamEvent.content) {
                iterationContent += streamEvent.content;
                fullContent += streamEvent.content;
                this.sendStreamChunk(messageId, streamEvent.content);
              }
              break;

            case "tool-call":
              if (streamEvent.toolCall) {
                if (!toolCalls) {
                  toolCalls = [];
                }
                toolCalls.push({
                  id: streamEvent.toolCall.id,
                  type: "function",
                  function: {
                    name: streamEvent.toolCall.name,
                    arguments: typeof streamEvent.toolCall.args === "string" 
                      ? streamEvent.toolCall.args 
                      : JSON.stringify(streamEvent.toolCall.args),
                  },
                });
                console.log(`[AgentHandler:${this.config.agentId}] Detected tool call: ${streamEvent.toolCall.name}`);
              }
              break;
          }
          continue;
        }

        // 兼容旧格式：字符串
        const chunk = event as unknown as string;
        if (typeof chunk === "string" && chunk.startsWith('{"__tool_calls":')) {
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.__tool_calls && Array.isArray(parsed.__tool_calls)) {
              toolCalls = parsed.__tool_calls;
              console.log(`[AgentHandler:${this.config.agentId}] Detected ${toolCalls?.length || 0} tool calls`);
              continue;
            }
          } catch {
            // ignore
          }
        }

        iterationContent += chunk;
        fullContent += chunk;
        this.sendStreamChunk(messageId, chunk);
      }
    } catch (streamError) {
      console.error(`[AgentHandler:${this.config.agentId}] Error in initial stream:`, streamError);
    }

    if (!toolCalls || toolCalls.length === 0) {
      console.log(`[AgentHandler:${this.config.agentId}] No tool calls, checking speech synthesis`);

      if (currentMetadata?.collaborationMode && currentMetadata?.pendingSpeechSynthesis) {
        await this.handleSpeechSynthesis(messageId, fullContent, currentMetadata, llmService);
      } else {
        this.sendStreamEnd(messageId, fullContent, currentMetadata);
      }

      await this.saveAssistantMessage(finalAssistantContent || fullContent, agentMessage);
      return;
    }

    // 执行工具调用
    const reactResult = await this.executeToolCalls(
      messageId,
      toolCalls,
      messages,
      availableTools,
      agentMessage,
      modelConfig,
      maxIterations,
      availableSkills,
      llmService,
      fullContent,
      currentMetadata,
      currentMetadata?.environment
    );

    fullContent = reactResult.fullContent;
    finalAssistantContent = reactResult.finalAssistantContent;
    currentMetadata = reactResult.metadata;

    // 多模型协作模式：语音合成
    if (currentMetadata?.collaborationMode && currentMetadata?.pendingSpeechSynthesis) {
      await this.handleSpeechSynthesis(messageId, fullContent, currentMetadata, llmService);
    } else {
      this.sendStreamEnd(messageId, fullContent, currentMetadata);
    }

    await this.saveAssistantMessage(finalAssistantContent || fullContent, agentMessage);
  }

  /**
   * 执行工具调用
   */
  private async executeToolCalls(
    messageId: string,
    toolCalls: ToolCall[],
    messages: any[],
    availableTools: any[],
    agentMessage: AgentMessage,
    modelConfig: any,
    maxIterations: number,
    availableSkills: SkillEntry[],
    llmService: LLMServiceInterface,
    initialFullContent: string,
    initialMetadata: any,
    environment?: Environment
  ): Promise<ReActResult> {
    const executorTools = availableTools.filter(
      (t: any) => t.function?.name !== "delegate_task" &&
                  t.function?.name !== "executor" &&
                  t.function?.name !== "orchestrator" &&
                  t.function?.name !== "handler"
    );

    const toolCallPromises = toolCalls.map(async (toolCall) => {
      return this.processSingleToolCall(
        toolCall,
        availableSkills,
        availableTools,
        executorTools,
        modelConfig,
        agentMessage,
        environment
      );
    });

    const results = await Promise.all(toolCallPromises);

    console.log(`[AgentHandler:${this.config.agentId}] All tool calls completed:`,
      results.map(r => `${r.toolName}:${r.success}`)
    );

    const successCount = results.filter(r => r.success).length;

    let resultContent = "";
    if (results.length === 1) {
      const r = results[0];
      resultContent = r.success ? (r.output || "任务执行完成") : `执行失败：${r.error || r.output}`;
    } else {
      resultContent = `已完成 ${successCount}/${results.length} 个任务：\n\n`;
      for (const r of results) {
        if (r.success) {
          resultContent += `✅ ${r.toolName}: ${r.output?.substring(0, 200) || "完成"}${r.output && r.output.length > 200 ? "..." : ""}\n`;
        } else {
          resultContent += `❌ ${r.toolName}: ${r.error || "失败"}\n`;
        }
      }
    }

    const fullContent = initialFullContent + resultContent;

    this.sendStreamChunk(messageId, resultContent);

    return {
      fullContent,
      metadata: initialMetadata,
      finalAssistantContent: resultContent,
    };
  }

  /**
   * 处理单个工具调用
   */
  private async processSingleToolCall(
    toolCall: ToolCall,
    availableSkills: SkillEntry[],
    availableTools: any[],
    executorTools: any[],
    modelConfig: any,
    agentMessage: AgentMessage,
    environment?: Environment
  ): Promise<ToolCallResult> {
    const toolName = toolCall.function?.name;
    console.log(`[AgentHandler:${this.config.agentId}] Processing tool call: ${toolName}`);

    if (toolName === "handler") {
      return this.processHandlerTool(toolCall, agentMessage, modelConfig, environment);
    }

    if (toolName === "executor") {
      return this.processExecutorTool(toolCall, availableSkills, executorTools, modelConfig, agentMessage, environment);
    }

    if (toolName === "orchestrator") {
      return this.processOrchestratorTool(toolCall, availableSkills, availableTools, modelConfig, agentMessage, environment);
    }

    // 其他工具直接执行
    try {
      const result = await this.executeToolCall(toolCall);
      return { toolName: toolName || "unknown", success: true, output: result };
    } catch (error) {
      return {
        toolName: toolName || "unknown",
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理 handler 工具
   */
  private async processHandlerTool(
    toolCall: ToolCall,
    agentMessage: AgentMessage,
    modelConfig: any,
    environment?: Environment
  ): Promise<ToolCallResult> {
    console.log(`[AgentHandler:${this.config.agentId}] Handler Agent execution`);

    if (!environment) {
      return {
        toolName: "handler",
        success: false,
        output: "",
        error: "Environment not available - context not properly initialized",
      };
    }

    let taskDescription: string;
    try {
      const args = JSON.parse(toolCall.function?.arguments || "{}");
      taskDescription = args.taskDescription || args.task || agentMessage.content;
    } catch {
      taskDescription = agentMessage.content;
    }

    const llmService = this.agentManager.getLLMService();

    const handlerAgent = new HandlerAgent(
      `handler-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      {
        task: taskDescription,
        config: {
          agentId: this.config.agentId,
          maxIterations: 15,
          timeout: 60,
          modelConfig: modelConfig,
          environment: environment,
        },
        onProgress: (event) => {
          console.log(`[HandlerAgent] Progress: ${event.status} - ${event.message || ""}`);
        },
      },
      llmService
    );

    try {
      const result = await handlerAgent.execute();
      return {
        toolName: "handler",
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        toolName: "handler",
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理 executor 工具
   */
  private async processExecutorTool(
    toolCall: ToolCall,
    availableSkills: SkillEntry[],
    executorTools: any[],
    modelConfig: any,
    agentMessage: AgentMessage,
    environment?: Environment
  ): Promise<ToolCallResult> {
    console.log(`[AgentHandler:${this.config.agentId}] Executor tool call`);

    if (!environment) {
      return {
        toolName: "executor",
        success: false,
        output: "",
        error: "Environment not available - context not properly initialized",
      };
    }

    let targetSkillName: string | null = null;
    let taskDescription: string;
    try {
      const args = JSON.parse(toolCall.function?.arguments || "{}");
      targetSkillName = args.skillName || null;
      taskDescription = args.taskDescription || agentMessage.content;
    } catch {
      taskDescription = agentMessage.content;
    }

    const relevantSkills = targetSkillName
      ? availableSkills.filter((s: SkillEntry) => s.name === targetSkillName)
      : [];

    console.log(`[AgentHandler:${this.config.agentId}] Using skill: ${targetSkillName || "none"}, found: ${relevantSkills.length}`);

    const llmService = this.agentManager.getLLMService();
    
    // 获取实例配置，底层会自动处理实例不存在的情况
    const targetInstanceId = modelConfig.instanceId || "auto";
    const instanceConfig = await llmService.getInstanceConfig(targetInstanceId);
    if (!instanceConfig) {
      return {
        toolName: "executor",
        success: false,
        output: "",
        error: `No available LLM instance found`,
      };
    }

    const executor = await createExecutor({
      modelConfig: {
        provider: instanceConfig.provider,
        baseUrl: instanceConfig.baseUrl,
        apiKey: instanceConfig.apiKey,
        modelName: instanceConfig.modelName,
        instanceId: instanceConfig.instanceId,
      },
      task: {
        description: taskDescription,
        skillSlug: targetSkillName || undefined,
      },
      skills: relevantSkills.map(s => ({
        name: s.name,
        description: s.description,
        filePath: s.filePath,
        location: s.location,
      })),
      tools: executorTools,
      maxSteps: 20,
      environment: environment,
    });

    try {
      const result = await executor.execute();
      return {
        toolName: "executor",
        success: result.success,
        output: result.output,
        error: result.error?.message,
      };
    } catch (error) {
      return {
        toolName: "executor",
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理 orchestrator 工具
   */
  private async processOrchestratorTool(
    toolCall: ToolCall,
    availableSkills: SkillEntry[],
    availableTools: any[],
    modelConfig: any,
    agentMessage: AgentMessage,
    environment?: Environment
  ): Promise<ToolCallResult> {
    console.log(`[AgentHandler:${this.config.agentId}] Orchestrator tool call`);

    if (!environment) {
      return {
        toolName: "orchestrator",
        success: false,
        output: "",
        error: "Environment not available - context not properly initialized",
      };
    }

    let targetSkillNames: string[] = [];
    let taskDescription: string;
    try {
      const args = JSON.parse(toolCall.function?.arguments || "{}");
      targetSkillNames = args.skills || [];
      taskDescription = args.taskDescription || agentMessage.content;
    } catch {
      taskDescription = agentMessage.content;
    }

    const relevantSkills = availableSkills.filter((s: SkillEntry) =>
      targetSkillNames.includes(s.name)
    );

    console.log(`[AgentHandler:${this.config.agentId}] Using skills:`, targetSkillNames, `found: ${relevantSkills.length}`);

    const llmService = this.agentManager.getLLMService();
    const orchestratorIntegration = new AgentOrchestratorIntegration(llmService);

    try {
      const result: TaskExecutionResult = await orchestratorIntegration.executeWithOrchestrator({
        task: taskDescription,
        tools: availableTools,
        skills: relevantSkills,
        systemPrompt: "",
        conversationHistory: [{ role: "user" as const, content: taskDescription }],
        config: {
          agentId: this.config.agentId,
          contactId: agentMessage.contactId || "",
          conversationId: agentMessage.conversationId || "",
          modelConfig: modelConfig,
          maxIterations: 15,
          timeout: 300,
          environment: environment,
        },
      });

      return {
        toolName: "orchestrator",
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        toolName: "orchestrator",
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行单个工具调用
   */
  private async executeToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: args } = toolCall.function;

    console.log(`[AgentHandler:${this.config.agentId}] ========================================`);
    console.log(`[AgentHandler:${this.config.agentId}] 🚀 EXECUTING TOOL CALL`);
    console.log(`[AgentHandler:${this.config.agentId}] ========================================`);
    console.log(`[AgentHandler:${this.config.agentId}] 📌 Tool Name: ${name}`);
    console.log(`[AgentHandler:${this.config.agentId}] 📋 Raw Arguments: ${args}`);

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = args ? JSON.parse(args) : {};
    } catch {
      // ignore parse error
    }

    try {
      return await executeTool(name, parsedArgs);
    } catch (error) {
      console.error(`[AgentHandler:${this.config.agentId}] Tool execution failed:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 处理语音合成
   */
  private async handleSpeechSynthesis(
    messageId: string,
    fullContent: string,
    metadata: any,
    llmService: LLMServiceInterface
  ): Promise<void> {
    console.log(`[AgentHandler:${this.config.agentId}] Collaboration mode: synthesizing speech`);

    const config = metadata.speechSynthesisConfig;

    const synthesisThinkingMessage = [
      `🔊 语音合成`,
      `📝 ${fullContent.substring(0, 50)}${fullContent.length > 50 ? "..." : ""}`,
      `🎯 合成模型信息:`,
      `   ID: ${config?.instanceId || "自动路由"}`,
      `   名称: Qwen3-Omni-Flash`,
      `   提供商: alibaba`,
    ].join("\n");

    this.sendToMaster(this.createIPCMessage("agent-stream-start", {
      requestId: messageId,
      agentId: this.config.agentId,
      thinkingMessage: synthesisThinkingMessage,
      timestamp: Date.now(),
    }));

    try {
      if (!config) {
        throw new Error("Speech synthesis config not found");
      }

      console.log(`[AgentHandler:${this.config.agentId}] Calling synthesizeSpeech with voice: ${config.voice}`);
      
      if (!llmService.synthesizeSpeech) {
        throw new Error("Speech synthesis not supported");
      }
      
      const synthesisResult = await llmService.synthesizeSpeech(fullContent, {
        format: config.format,
        instanceId: config.instanceId,
        voice: config.voice,
      });

      const audioBytes = Math.floor(synthesisResult.audio.length * 0.75);
      const audioDuration = Math.ceil(audioBytes / 2000);

      this.sendToMaster(this.createIPCMessage("agent-stream-end", {
        requestId: messageId,
        agentId: this.config.agentId,
        content: fullContent,
        metadata: metadata,
        timestamp: Date.now(),
        audio: synthesisResult.audio,
        audioFormat: synthesisResult.format,
        audioDuration: audioDuration,
      }));
    } catch (error) {
      console.error(`[AgentHandler:${this.config.agentId}] Speech synthesis failed:`, error);
      this.sendStreamEnd(messageId, fullContent, metadata);
    }
  }

  /**
   * 保存助手消息
   */
  private async saveAssistantMessage(content: string, agentMessage: AgentMessage): Promise<void> {
    if (!content || content.length === 0) return;

    console.log(`[AgentHandler:${this.config.agentId}] Saving assistant message, length=${content.length}`);
    try {
      await this.agentManager.saveAssistantMessage(
        content,
        agentMessage.contactId,
        agentMessage.channelName,
        false
      );
    } catch (saveError) {
      console.error(`[AgentHandler:${this.config.agentId}] Failed to save assistant message:`, saveError);
    }
  }

  /**
   * 发送流式数据块
   */
  private sendStreamChunk(messageId: string, chunk: string): void {
    this.sendToMaster(this.createIPCMessage("agent-stream-chunk", {
      requestId: messageId,
      agentId: this.config.agentId,
      chunk,
      timestamp: Date.now(),
    }));
  }

  /**
   * 发送流式结束
   */
  private sendStreamEnd(messageId: string, content: string, metadata: any): void {
    this.sendToMaster(this.createIPCMessage("agent-stream-end", {
      requestId: messageId,
      agentId: this.config.agentId,
      content,
      metadata,
      timestamp: Date.now(),
    }));
  }

  /**
   * 发送响应
   */
  private sendResponse(requestId: string, response: AgentResponse): void {
    this.sendToMaster(this.createIPCMessage("agent-response", {
      requestId,
      agentId: this.config.agentId,
      response,
      timestamp: Date.now(),
    }));
  }

  /**
   * 发送错误
   */
  private sendError(requestId: string, error: Error): void {
    this.sendToMaster(this.createIPCMessage("agent-error", {
      requestId,
      agentId: this.config.agentId,
      error: error.message,
      timestamp: Date.now(),
    }));
  }
}

export { AgentMessageHandler };
export type { HandlerConfig, ToolCallResult, ReActResult };
