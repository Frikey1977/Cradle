/**
 * Executor - 使用 ai SDK 进行流式工具调用
 * 
 * 核心特性：
 * 1. 使用 ai SDK 的 streamText 进行流式处理
 * 2. 支持大文件输出（maxOutputTokens: 32,000）
 * 3. 流式处理 tool_call，自动参数解析
 * 4. Zod 模式验证，自动错误反馈
 * 5. 与 opencode 实现保持一致
 */

import type { ModelMessage } from "ai";
import type { ToolDefinition } from "../tools/tool-definitions.js";
import { ToolRegistry } from "../tools/new-tools.js";
import { streamWithTools, type StreamEvent, type AISDKServiceConfig } from "../../llm/service/ai-sdk-service.js";

const MAX_OUTPUT_TOKENS = 32_000;
const MAX_WRITE_RESULT_LENGTH = 500;
const MAX_EXEC_RESULT_LENGTH = 2000;  // exec 命令结果警告阈值

function truncateWriteResult(output: string, args: Record<string, any>): string {
  if (output.length <= MAX_WRITE_RESULT_LENGTH) {
    return output;
  }
  
  const filePath = args.file_path || args.filePath || 'unknown';
  const truncated = output.substring(0, MAX_WRITE_RESULT_LENGTH);
  
  return `${truncated}

... [truncated ${output.length - MAX_WRITE_RESULT_LENGTH} characters]

[Write Result Summary]
File: ${filePath}
Total characters written: ${output.length}

Note: The file has been written successfully. If this is a script or executable file that needs to be run to complete the task, please use the exec tool to execute it.`;
}

export interface ExecutorModelConfig {
  provider?: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  instanceId?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface SystemBlock {
  type: "identity" | "environment" | "skills" | "task";
  content: string;
}

export interface ExecutorSkillInfo {
  name: string;
  description?: string;
  filePath?: string;
  location?: string;
}

export interface ExecutorTaskConfig {
  description: string;
  skillSlug?: string;
  toolName?: string;
  parameters?: Record<string, unknown>;
}

export interface ExecutorOptions {
  modelConfig: ExecutorModelConfig;
  task: ExecutorTaskConfig;
  skills?: ExecutorSkillInfo[];
  tools: ToolDefinition[];
  maxSteps?: number;
  maxRetries?: number; // LLM 流错误最大重试次数
  environment?: import("../context/environment.js").Environment;
}

export interface ExecutorResult {
  success: boolean;
  output: string;
  steps: ExecutorStep[];
  error?: Error;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface ExecutorStep {
  type: "thought" | "tool_call" | "tool_result" | "text";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    args: unknown;
  };
  toolResult?: {
    callId: string;
    output: string;
  };
}

export class Executor {
  private toolRegistry: ToolRegistry;
  private messages: ModelMessage[] = [];
  private steps: ExecutorStep[] = [];
  private systemMessages: ModelMessage[] = [];
  
  constructor(
    private id: string,
    private options: ExecutorOptions
  ) {
    this.toolRegistry = new ToolRegistry();
    for (const tool of options.tools) {
      this.toolRegistry.register(tool);
    }
  }
  
  async execute(): Promise<ExecutorResult> {
    console.log(`[Executor:${this.id}] Starting execution`);

    const maxSteps = this.options.maxSteps ?? 50;
    const maxRetries = this.options.maxRetries ?? 3; // LLM 流错误最大重试次数
    let stepCount = 0;
    let consecutiveErrors = 0; // 连续错误计数
    let finalOutput = "";
    let finalUsage = { prompt: 0, completion: 0, total: 0 };

    const { ExecutorSystemPromptBuilder } = await import("./executor-system-prompt-builder.js");
    const promptBuilder = new ExecutorSystemPromptBuilder();
    const promptBlocks = await promptBuilder.build({
      environment: this.options.environment,
      skills: this.options.skills,
      task: this.options.task,
    });

    // 将 system 消息作为独立的 ModelMessage 块（不包含任务描述）
    this.systemMessages = promptBlocks.systemMessages.map(b => ({
      role: "system" as const,
      content: b.content,
    }));

    // 构建用户消息，包含任务描述
    const taskDescription = this.options.task.description;
    const userMessage = this.buildUserMessage(taskDescription);

    this.messages.push({
      role: "user",
      content: userMessage,
    });

    try {
      while (stepCount < maxSteps) {
        stepCount++;
        console.log(`[Executor:${this.id}] Step ${stepCount}/${maxSteps}`);

        let stepResult;
        try {
          stepResult = await this.callLLMStream();
          consecutiveErrors = 0; // 成功执行，重置错误计数
        } catch (streamError) {
          consecutiveErrors++;
          console.error(`[Executor:${this.id}] LLM stream error (consecutive: ${consecutiveErrors}/${maxRetries}):`, streamError);
          
          if (consecutiveErrors >= maxRetries) {
            throw new Error(`LLM stream failed after ${maxRetries} retries: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
          }
          
          // 添加错误信息到消息历史，让 LLM 知道发生了什么
          this.messages.push({
            role: "assistant",
            content: `系统错误: ${streamError instanceof Error ? streamError.message : String(streamError)}。正在重试...`,
          });
          
          // 跳过本轮，继续下一次循环（会自动重试）
          continue;
        }

        if (stepResult.usage) {
          finalUsage.prompt += stepResult.usage.prompt || 0;
          finalUsage.completion += stepResult.usage.completion || 0;
          finalUsage.total += stepResult.usage.total || 0;
        }

        if (stepResult.text) {
          finalOutput = stepResult.text;
          this.steps.push({
            type: "text",
            content: stepResult.text,
          });
        }

        if (!stepResult.hasToolCalls) {
          console.log(`[Executor:${this.id}] Execution finished with text output`);
          break;
        }
        
        console.log(`[Executor:${this.id}] Step ${stepCount} completed, continuing to next step...`);
      }

      console.log(`[Executor:${this.id}] Execution completed after ${stepCount} steps`);
      return {
        success: true,
        output: finalOutput || "Task completed successfully",
        steps: this.steps,
        usage: finalUsage,
      };

    } catch (error) {
      console.error(`[Executor:${this.id}] Execution failed:`, error);
      return {
        success: false,
        output: finalOutput || "",
        steps: this.steps,
        error: error instanceof Error ? error : new Error(String(error)),
        usage: finalUsage,
      };
    }
  }
  
  private async callLLMStream(): Promise<{
    text: string;
    hasToolCalls: boolean;
    usage?: { prompt: number; completion: number; total: number };
  }> {
    console.log(`[Executor:${this.id}] Calling LLM with ${this.messages.length} messages`);

    const config: AISDKServiceConfig = {
      provider: this.options.modelConfig.provider || "openai",
      baseUrl: this.options.modelConfig.baseUrl || "",
      apiKey: this.options.modelConfig.apiKey || "",
      modelName: this.options.modelConfig.modelName || "gpt-4",
      instanceId: this.options.modelConfig.instanceId || "default",
    };

    let fullText = "";
    let hasError = false;
    let errorMessage = "";
    const toolCalls: Array<{
      id: string;
      name: string;
      args: unknown;
    }> = [];
    const toolResults: Array<{
      callId: string;
      output: string;
    }> = [];
    let finalUsage: { prompt: number; completion: number; total: number } | undefined;

    // 组合消息：system 消息块 + 用户/助手消息
    const allMessages: ModelMessage[] = [
      ...this.systemMessages,
      ...this.messages as ModelMessage[],
    ];
    
    // 统计 tool messages
    const toolMessageCount = this.messages.filter(m => m.role === 'tool').length;
    if (toolMessageCount > 0) {
      console.log(`[Executor:${this.id}] Sending ${this.messages.length} messages to LLM (${toolMessageCount} tool results)`);
    }

    const stream = streamWithTools(config, {
      messages: allMessages,
      tools: this.toolRegistry.getAll(),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      source: "executor",
    });

    try {
      for await (const event of stream) {
        switch (event.type) {
          case "text":
            if (event.content) {
              fullText += event.content;
            }
            break;

          case "reasoning":
            // 处理推理内容，可选择性记录或忽略
            break;

          case "tool-call":
            if (event.toolCall) {
              toolCalls.push({
                id: event.toolCall.id,
                name: event.toolCall.name,
                args: event.toolCall.args,
              });
              this.steps.push({
                type: "tool_call",
                toolCall: {
                  id: event.toolCall.id,
                  name: event.toolCall.name,
                  args: event.toolCall.args,
                },
              });
            }
            break;

          case "finish":
          case "step-finish":
            if (event.usage) {
              finalUsage = event.usage;
            }
            break;

          case "error":
            if (event.error) {
              console.error(`[Executor:${this.id}] LLM stream error:`, event.error.message || event.error);
              hasError = true;
              errorMessage = event.error instanceof Error ? event.error.message : String(event.error);
            }
            break;
        }
      }
    } catch (streamLoopError) {
      console.error(`[Executor:${this.id}] Stream loop error:`, streamLoopError);
      hasError = true;
      errorMessage = streamLoopError instanceof Error ? streamLoopError.message : String(streamLoopError);
    }

    // 处理 LLM 流错误（如网络问题、服务不可用等）
    if (hasError) {
      console.warn(`[Executor:${this.id}] LLM stream encountered an error, but continuing with tool execution if available`);
      // 不立即抛出错误，而是记录并继续处理已接收到的 toolCalls
      // 这样即使部分流数据丢失，也能继续执行
    }

    // 执行所有工具调用（无论是否有流错误）
    if (toolCalls.length > 0) {
      console.log(`[Executor:${this.id}] Executing ${toolCalls.length} tool calls`);
    }
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const tool = this.toolRegistry.get(toolCall.name);
      let toolOutput: string;
      let toolSuccess = false;

      if (tool) {
        try {
          const result = await tool.execute(toolCall.args, {
            toolCallId: toolCall.id,
          });
          toolOutput = result.output;
          toolSuccess = true;
          
          if (toolCall.name === 'write' && toolOutput.length > MAX_WRITE_RESULT_LENGTH) {
            toolOutput = truncateWriteResult(toolOutput, toolCall.args as Record<string, any>);
          }
          
          // 对 exec 命令的结果进行长度检查，超过阈值时输出警告
          if (toolCall.name === 'exec' && toolOutput.length > MAX_EXEC_RESULT_LENGTH) {
            console.warn(`[Executor:${this.id}] Exec result length (${toolOutput.length}) exceeds warning threshold (${MAX_EXEC_RESULT_LENGTH}). Consider optimizing the command output.`);
          }
        } catch (error) {
          // 工具执行失败，将错误信息格式化为 tool_result 返回给 LLM
          const errorMsg = error instanceof Error ? error.message : String(error);
          toolOutput = `工具执行失败: ${errorMsg}\n\n请分析错误原因并修正后重试。常见错误：\n1. 命令参数错误 - 检查参数格式和必填项\n2. 文件路径错误 - 确保路径存在且有权限\n3. 网络问题 - 检查网络连接\n4. 依赖缺失 - 确认所需工具已安装`;
          console.error(`[Executor:${this.id}] Tool execution failed: ${toolCall.name}`, error);
        }
      } else {
        toolOutput = `错误: 工具 "${toolCall.name}" 未找到。可用工具: ${this.toolRegistry.getAll().map(t => t.id).join(', ')}`;
        console.error(`[Executor:${this.id}] Tool not found: ${toolCall.name}`);
      }

      toolResults.push({
        callId: toolCall.id,
        output: toolOutput,
      });

      this.steps.push({
        type: "tool_result",
        toolResult: {
          callId: toolCall.id,
          output: toolOutput,
        },
      });
    }

    if (toolCalls.length > 0) {
      // Assistant 消息包含 text 和 tool_calls (使用 Vercel AI SDK 格式)
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
        content: fullText,
      });
    }

    return {
      text: fullText,
      hasToolCalls: toolCalls.length > 0,
      usage: finalUsage,
    };
  }
  
  /**
   * 构建用户消息，包含任务描述
   */
  private buildUserMessage(taskDescription: string): string {
    const lines: string[] = [];


    lines.push(taskDescription);

    // 如果有指定 skill，添加相关信息
    if (this.options.task.skillSlug) {
      const skill = this.options.skills?.find(s => s.name === this.options.task.skillSlug);
      if (skill) {
        lines.push(`## 使用 Skill: ${skill.name}`);
        if (skill.location || skill.filePath) {
          lines.push(`- 路径: ${skill.location || skill.filePath}`);
        }
        lines.push("");
        lines.push("**重要提示**:");
        lines.push(`1. 如果尚未读取，请先读取 ${skill.location || skill.filePath}/SKILL.md`);
        lines.push("2. 严格按照 SKILL.md 的指引执行");
        lines.push("3. 完成后验证结果是否符合预期");
        lines.push("");
      }
    }

    // 如果有指定工具和参数
    if (this.options.task.toolName) {
      lines.push(`## 使用工具: ${this.options.task.toolName}`);
      if (this.options.task.parameters) {
        lines.push("**参数**:");
        lines.push("```json");
        lines.push(JSON.stringify(this.options.task.parameters, null, 2));
        lines.push("```");
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("请立即执行上述任务。");

    return lines.join("\n");
  }

  getSteps(): ExecutorStep[] {
    return [...this.steps];
  }

  getMessages(): ModelMessage[] {
    return [...this.messages];
  }
}

export async function createExecutor(
  options: ExecutorOptions
): Promise<Executor> {
  const id = `executor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return new Executor(id, options);
}
