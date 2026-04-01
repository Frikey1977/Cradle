/**
 * Handler Agent - 轻量级 ReAct 执行器
 *
 * 职责：
 * - 执行简单的文件读写和命令操作
 * - ReAct 循环（自主决策和执行）
 * - 自动处理常见问题（如目录不存在则创建）
 *
 * 架构：
 * - HandlerContextManager: 上下文管理（系统提示词构建、环境信息）
 * - HandlerSystemPromptBuilder: 系统提示词分块构建
 *
 * 与 Executor 的区别：
 * - 无 Skill 支持
 * - 更轻量的系统提示
 * - 更少的上下文开销
 */

import { EventEmitter } from "events";
import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type { ToolDefinition } from "../tools/index.js";
import { Environment, type EnvironmentConfig } from "../context/environment.js";
import { ALL_TOOLS } from "../tools/index.js";
import {
  HandlerContextManager,
  type HandlerContext,
} from "./handler-context-manager.js";
import { streamWithTools } from "../../llm/service/ai-sdk-service.js";
import type { ModelMessage } from "ai";

export interface HandlerAgentConfig {
  agentId: string;
  maxIterations: number;
  timeout: number;
  modelConfig: {
    instanceId?: string;
    provider?: string;
    model?: string;
    parameters?: Record<string, unknown>;
  };
  environment?: Environment;
}

export interface HandlerAgentOptions {
  task: string;
  config: HandlerAgentConfig;
  onProgress?: (event: HandlerProgressEvent) => void;
}

export interface HandlerProgressEvent {
  handlerId: string;
  status: "running" | "completed" | "failed" | "timeout";
  iteration?: number;
  maxIterations?: number;
  thought?: string;
  action?: string;
  observation?: string;
  message?: string;
}

export interface HandlerResult {
  success: boolean;
  output: string;
  status: "completed" | "failed" | "timeout" | "max_iterations";
  error?: string;
  iterations: number;
  duration: number;
}

export class HandlerAgent extends EventEmitter {
  readonly id: string;
  readonly task: string;

  private tools: ToolDefinition[];
  private config: HandlerAgentConfig;
  private llmService: LLMServiceInterface;
  private contextManager: HandlerContextManager;

  private iteration = 0;
  private messages: ModelMessage[] = [];
  private startTime = 0;

  private onProgress?: HandlerAgentOptions["onProgress"];

  constructor(
    id: string,
    options: HandlerAgentOptions,
    llmService: LLMServiceInterface
  ) {
    super();
    this.id = id;
    this.task = options.task;
    this.config = options.config;
    this.llmService = llmService;
    this.onProgress = options.onProgress;

    this.tools = ALL_TOOLS;

    this.contextManager = new HandlerContextManager({
      handlerId: this.id,
      environment: this.config.environment,
    });
  }

  async execute(): Promise<HandlerResult> {
    this.startTime = Date.now();
    this.iteration = 0;
    this.messages = [];

    console.log(`[HandlerAgent:${this.id}] Starting execution: ${this.task}`);
    console.log(`[HandlerAgent:${this.id}] Available tools: ${this.tools.map(t => t.id).join(", ")}`);

    this.reportProgress({
      handlerId: this.id,
      status: "running",
      message: "开始执行任务",
    });

    try {
      const result = await this.runWithTimeout();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[HandlerAgent:${this.id}] Execution error:`, errorMessage);

      this.reportProgress({
        handlerId: this.id,
        status: "failed",
        message: errorMessage,
      });

      return this.buildResult("", "failed", errorMessage);
    }
  }

  private async runWithTimeout(): Promise<HandlerResult> {
    const timeoutMs = this.config.timeout * 1000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve(this.buildResult("", "timeout", "执行超时"));
      }, timeoutMs);

      this.runReActLoop()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async runReActLoop(): Promise<HandlerResult> {
    const context = await this.contextManager.build();

    for (const block of context.systemMessages) {
      this.messages.push({
        role: "system",
        content: block.content,
      });
    }

    this.messages.push({
      role: "user",
      content: this.task,
    });

    let finalContent = "";
    let stepCount = 0;
    const maxSteps = this.config.maxIterations;

    while (stepCount < maxSteps) {
      stepCount++;

      if (this.isTimedOut()) {
        return this.buildResult(finalContent, "timeout", "执行超时");
      }

      this.reportProgress({
        handlerId: this.id,
        status: "running",
        iteration: stepCount,
        maxIterations: maxSteps,
        message: `ReAct 迭代 ${stepCount}`,
      });

      const stepResult = await this.executeStreamStep();
      finalContent = stepResult.text || finalContent;

      if (!stepResult.hasToolCalls) {
        return this.buildResult(finalContent, "completed");
      }
    }

    return this.buildResult(finalContent, "max_iterations", `达到最大迭代次数 ${maxSteps}`);
  }

  private async executeStreamStep(): Promise<{
    text: string;
    hasToolCalls: boolean;
  }> {
    // 获取实例配置，底层会自动处理实例不存在的情况
    const targetInstanceId = this.config.modelConfig.instanceId || "auto";
    const instanceConfig = await this.llmService.getInstanceConfig(targetInstanceId);
    if (!instanceConfig) {
      throw new Error(`No available LLM instance found`);
    }
    
    const config = {
      provider: instanceConfig.provider,
      baseUrl: instanceConfig.baseUrl,
      apiKey: instanceConfig.apiKey,
      modelName: instanceConfig.modelName,
      instanceId: instanceConfig.instanceId,
    };

    let fullText = "";
    let hasToolCalls = false;
    const toolCalls: Array<{ id: string; name: string; args: unknown }> = [];
    const toolResults: Array<{ callId: string; output: string }> = [];

    const stream = streamWithTools(config as any, {
      messages: this.messages as ModelMessage[],
      tools: this.tools,
      maxOutputTokens: 4096,
      source: "handler",
    });

    for await (const event of stream) {
      if (event.type === "text" && event.content) {
        fullText += event.content;
      } else if (event.type === "tool-call" && event.toolCall) {
        hasToolCalls = true;
        toolCalls.push({
          id: event.toolCall.id,
          name: event.toolCall.name,
          args: event.toolCall.args,
        });
      } else if (event.type === "error" && event.error) {
        console.error(`[HandlerAgent:${this.id}] LLM error:`, event.error);
      }
    }

    if (hasToolCalls) {
      for (const toolCall of toolCalls) {
        const tool = this.tools.find(t => t.id === toolCall.name);
        let toolOutput: string;

        if (tool) {
          try {
            const result = await tool.execute(toolCall.args, { toolCallId: toolCall.id });
            toolOutput = result.output;
          } catch (error) {
            toolOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          toolOutput = `Error: Tool "${toolCall.name}" not found`;
        }

        toolResults.push({
          callId: toolCall.id,
          output: toolOutput,
        });

        console.log(`[HandlerAgent:${this.id}] Tool result: ${toolOutput.substring(0, 200)}...`);
      }

      this.messages.push({
        role: "assistant",
        content: [
          ...(fullText ? [{ type: "text" as const, text: fullText }] : []),
          ...toolCalls.map(tc => ({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.args,
          })),
        ],
      });

      for (const result of toolResults) {
        const toolCall = toolCalls.find(tc => tc.id === result.callId);
        this.messages.push({
          role: "tool",
          content: [{
            type: "tool-result" as const,
            toolCallId: result.callId,
            toolName: toolCall?.name || "unknown",
            output: {
              type: "text" as const,
              value: result.output,
            },
          }],
        });
      }
    } else if (fullText) {
      this.messages.push({
        role: "assistant",
        content: [{ type: "text" as const, text: fullText }],
      });
    }

    return { text: fullText, hasToolCalls };
  }

  private isTimedOut(): boolean {
    return Date.now() - this.startTime > this.config.timeout * 1000;
  }

  private reportProgress(event: HandlerProgressEvent): void {
    this.onProgress?.({ ...event, handlerId: this.id });
    this.emit("progress", event);
  }

  private buildResult(
    output: string,
    status: HandlerResult["status"],
    error?: string
  ): HandlerResult {
    return {
      success: status === "completed",
      output,
      status,
      error,
      iterations: this.iteration,
      duration: Date.now() - this.startTime,
    };
  }
}
