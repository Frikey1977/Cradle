/**
 * 任务执行器 (Executor)
 *
 * 负责执行需要工具调用的任务，具备 ReAct 自循环能力
 * 与主 Agent 配合工作：
 * - 主 Agent 负责对话、意图识别、任务规划
 * - Executor 负责执行具体任务、工具调用、Skill 执行
 *
 * 渐进式披露：
 * - 只加载匹配意图的 Skills
 * - 不加载全部 Skills 的 tools
 */

import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type { ToolDefinition, ToolCall } from "../../llm/runtime/types.js";
import type { ParsedSkill, SkillExecutionContext } from "../skills/types.js";
import { invokeSkill } from "../skills/invoker.js";
import { EventEmitter } from "events";

/**
 * Executor 配置
 */
export interface ExecutorConfig {
  agentId: string;
  maxIterations: number;
  timeout: number;
  modelConfig: {
    instanceId?: string;
    provider?: string;
    model?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * ReAct 步骤
 */
export interface ReActStep {
  iteration: number;
  thought?: string;
  action?: {
    type: "tool_call" | "complete";
    toolName?: string;
    parameters?: Record<string, unknown>;
    content?: string;
  };
  observation?: string;
  timestamp: Date;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  output: string;
  steps: ReActStep[];
  toolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    result: string;
  }>;
  duration: number;
  status: "completed" | "max_iterations" | "error" | "timeout";
  error?: string;
}

/**
 * Executor 选项
 */
export interface ExecutorOptions {
  task: string;
  tools: ToolDefinition[];
  skills: ParsedSkill[];
  context: {
    systemPrompt: string;
    conversationHistory: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    metadata?: Record<string, unknown>;
  };
  config: ExecutorConfig;
  onStep?: (step: ReActStep) => void;
  /** 工具调用开始回调 */
  onToolCall?: (event: { name: string; arguments: string; step: number; total: number }) => void;
  /** 工具调用结果回调 */
  onToolResult?: (event: { name: string; result: string; step: number; total: number }) => void;
}

/**
 * 任务执行器
 */
export class Executor extends EventEmitter {
  readonly id: string;
  private task: string;
  private tools: Map<string, ToolDefinition>;
  private skills: Map<string, ParsedSkill>;
  private context: ExecutorOptions["context"];
  private config: ExecutorConfig;
  private llmService: LLMServiceInterface;

  private iteration = 0;
  private steps: ReActStep[] = [];
  private toolCalls: ExecutionResult["toolCalls"] = [];
  private startTime = 0;
  private onToolCall?: ExecutorOptions["onToolCall"];
  private onToolResult?: ExecutorOptions["onToolResult"];

  constructor(
    id: string,
    options: ExecutorOptions,
    llmService: LLMServiceInterface
  ) {
    super();
    this.id = id;
    this.task = options.task;
    this.tools = new Map(options.tools.map((t) => [t.function.name, t]));
    this.skills = new Map(options.skills.map((s) => [s.slug, s]));
    this.context = options.context;
    this.config = options.config;
    this.llmService = llmService;
    this.onToolCall = options.onToolCall;
    this.onToolResult = options.onToolResult;

    if (options.onStep) {
      this.on("step", options.onStep);
    }
  }

  /**
   * 流式执行任务（ReAct 循环）
   * 返回 AsyncGenerator，支持流式输出
   */
  async *streamExecute(): AsyncGenerator<string, ExecutionResult, unknown> {
    this.startTime = Date.now();
    this.iteration = 0;
    this.steps = [];
    this.toolCalls = [];

    console.log(`[Executor:${this.id}] Starting streaming execution: ${this.task}`);
    console.log(`[Executor:${this.id}] Available tools: ${Array.from(this.tools.keys()).join(", ")}`);

    let finalContent = "";

    try {
      while (this.iteration < this.config.maxIterations) {
        this.iteration++;
        console.log(`[Executor:${this.id}] Starting iteration ${this.iteration}`);

        // 检查超时
        if (Date.now() - this.startTime > this.config.timeout * 1000) {
          return this.buildResult(finalContent, "timeout", "Execution timed out");
        }

        // 执行一步流式 ReAct（直接在这里处理，不用 yield*）
        const step: ReActStep = {
          iteration: this.iteration,
          timestamp: new Date(),
        };

        // 构建消息
        const messages = this.buildMessages();

        // 调用 LLM 流式生成
        console.log(`[Executor:${this.id}] Calling LLM for iteration ${this.iteration}`);
        const stream = this.llmService.streamGenerate({
          model: this.config.modelConfig,
          messages,
          tools: Array.from(this.tools.values()),
        });

        let content = "";
        let toolCalls: ToolCall[] = [];

        // 处理流式输出 - 实时 yield 每个 chunk
        for await (const chunk of stream) {
          // 检查是否是 tool_calls 标记
          if (typeof chunk === "string" && chunk.startsWith('{"__tool_calls":')) {
            try {
              const parsed = JSON.parse(chunk);
              if (parsed.__tool_calls && Array.isArray(parsed.__tool_calls)) {
                toolCalls = parsed.__tool_calls;
                console.log(`[Executor:${this.id}] Detected ${toolCalls.length} tool calls`);
                continue;
              }
            } catch {
              // 不是有效的 JSON，作为普通内容处理
            }
          }

          content += chunk;
          finalContent += chunk;
          // 立即 yield 每个 chunk
          yield chunk;
        }

        // 记录步骤
        step.thought = content;
        this.steps.push(step);
        this.emit("step", step);

        // 处理工具调用
        if (toolCalls.length > 0) {
          step.action = {
            type: "tool_call",
            toolName: toolCalls[0].function.name,
            parameters: {},
          };

          // 执行所有工具调用并收集结果
          const toolResults: { id: string; name: string; result: string }[] = [];

          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            const toolName = toolCall.function.name;

            // 解析参数
            let params: Record<string, unknown> = {};
            const args = toolCall.function.arguments;
            if (typeof args === "string") {
              try {
                params = JSON.parse(args);
              } catch {
                params = {};
              }
            } else if (args && typeof args === "object") {
              params = args;
            }

            // 发送工具调用开始事件
            console.log(`[Executor:${this.id}] Executing tool: ${toolName}`);
            this.onToolCall?.({
              name: toolName,
              arguments: typeof args === "string" ? args : JSON.stringify(args),
              step: i + 1,
              total: toolCalls.length,
            });

            // 执行工具
            const result = await this.executeTool(toolCall);
            step.observation = result;
            toolResults.push({ id: toolCall.id, name: toolName, result });

            // 发送工具调用结果事件
            console.log(`[Executor:${this.id}] Tool result: ${result.substring(0, 100)}`);
            this.onToolResult?.({
              name: toolName,
              result: result.substring(0, 500),
              step: i + 1,
              total: toolCalls.length,
            });
          }

          // 将工具调用和结果添加到上下文历史（用于下一轮 ReAct）
          this.context.conversationHistory.push({
            role: "assistant",
            content: content || "",
          } as any);
          (this.context.conversationHistory[this.context.conversationHistory.length - 1] as any).tool_calls = toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));

          // 添加 tool 执行结果
          for (const tr of toolResults) {
            this.context.conversationHistory.push({
              role: "tool",
              content: tr.result,
            } as any);
            (this.context.conversationHistory[this.context.conversationHistory.length - 1] as any).tool_call_id = tr.id;
          }

          // 继续下一轮循环
          console.log(`[Executor:${this.id}] Continuing to next iteration...`);
        } else {
          // 完成
          step.action = {
            type: "complete",
            content: content,
          };
          console.log(`[Executor:${this.id}] Task completed`);
          return this.buildResult(finalContent, "completed");
        }
      }

      // 达到最大迭代次数
      return this.buildResult(finalContent, "max_iterations", `Reached max iterations (${this.config.maxIterations})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor:${this.id}] Streaming execution error:`, errorMessage);
      return this.buildResult(finalContent, "error", errorMessage);
    }
  }

  /**
   * 执行任务（ReAct 循环）- 非流式版本
   */
  async execute(): Promise<ExecutionResult> {
    this.startTime = Date.now();
    this.iteration = 0;
    this.steps = [];
    this.toolCalls = [];

    console.log(`[Executor:${this.id}] Starting execution: ${this.task}`);
    console.log(`[Executor:${this.id}] Available tools: ${Array.from(this.tools.keys()).join(", ")}`);

    try {
      while (this.iteration < this.config.maxIterations) {
        this.iteration++;

        // 检查超时
        if (Date.now() - this.startTime > this.config.timeout * 1000) {
          return this.buildResult("", "timeout", "Execution timed out");
        }

        // 执行一步 ReAct
        const step = await this.executeStep();

        // 记录步骤
        this.steps.push(step);
        this.emit("step", step);

        console.log(`[Executor:${this.id}] Step ${this.iteration}: ${step.action?.type}`);

        // 检查是否完成
        if (step.action?.type === "complete") {
          return this.buildResult(step.action.content || "", "completed");
        }
      }

      // 达到最大迭代次数
      return this.buildResult("", "max_iterations", `Reached max iterations (${this.config.maxIterations})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor:${this.id}] Execution error:`, errorMessage);
      return this.buildResult("", "error", errorMessage);
    }
  }

  /**
   * 执行一步 ReAct
   */
  private async executeStep(): Promise<ReActStep> {
    const step: ReActStep = {
      iteration: this.iteration,
      timestamp: new Date(),
    };

    // 构建消息
    const messages = this.buildMessages();

    // 调用 LLM
    const response = await this.llmService.generate({
      model: this.config.modelConfig,
      messages,
      tools: Array.from(this.tools.values()),
    });

    // 解析响应
    if (response.toolCalls && response.toolCalls.length > 0) {
      // 工具调用
      const toolCall = response.toolCalls[0];
      
      // 解析参数
      let params: Record<string, unknown> = {};
      const args = toolCall.function.arguments;
      if (typeof args === "string") {
        try {
          params = JSON.parse(args);
        } catch {
          params = {};
        }
      } else if (args && typeof args === "object") {
        params = args;
      }
      
      step.thought = response.content;
      step.action = {
        type: "tool_call",
        toolName: toolCall.function.name,
        parameters: params,
      };

      // 执行工具
      step.observation = await this.executeTool(toolCall);
    } else {
      // 完成
      step.thought = response.content;
      step.action = {
        type: "complete",
        content: response.content,
      };
    }

    return step;
  }

  /**
   * 构建消息
   */
  private buildMessages(): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

    // 系统提示词（简化的工具使用说明）
    messages.push({
      role: "system",
      content: this.buildSystemPrompt(),
    });

    // 任务描述（不需要重复添加用户消息）
    messages.push({
      role: "user",
      content: this.task,
    });

    // 添加之前的 ReAct 步骤（工具调用和结果）
    for (const step of this.steps) {
      if (step.thought) {
        messages.push({ role: "assistant", content: step.thought });
      }
      if (step.observation) {
        messages.push({ role: "user", content: `Observation: ${step.observation}` });
      }
    }

    return messages;
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    const lines: string[] = [];

    lines.push("# Task Executor");
    lines.push("");
    lines.push("You are a task executor. Complete the given task using the available tools.");
    lines.push("");
    lines.push("## Language Rule");
    lines.push("**CRITICAL: You MUST respond in the EXACT SAME LANGUAGE as the user's input.**");
    lines.push("- If user writes in Chinese, respond in Chinese");
    lines.push("- If user writes in English, respond in English");
    lines.push("- If user writes in French, respond in French");
    lines.push("- Never switch to a different language");
    lines.push("");
    lines.push("## Instructions");
    lines.push("1. Analyze the task requirements");
    lines.push("2. Use tools to complete the task step by step");
    lines.push("3. When the task is complete, respond with the final result");
    lines.push("4. Be concise and direct - no need for explanations unless asked");
    lines.push("");

    // 工具信息放在最后
    lines.push("## Available Tools");
    lines.push("");

    for (const [name, tool] of this.tools) {
      lines.push(`### ${name}`);
      lines.push(tool.function.description);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 执行工具
   */
  private async executeTool(toolCall: ToolCall): Promise<string> {
    const toolName = toolCall.function.name;
    const args = toolCall.function.arguments;

    // 解析参数（可能是字符串或对象）
    let params: Record<string, unknown> = {};
    if (typeof args === "string") {
      try {
        params = JSON.parse(args);
      } catch {
        params = {};
      }
    } else if (args && typeof args === "object") {
      params = args;
    }

    console.log(`[Executor:${this.id}] Executing tool: ${toolName}`, params);

    try {
      // 解析 Skill 命令
      const match = toolName.match(/^skill_(.+)_(.+)$/);
      if (match) {
        const skillSlug = match[1];
        const commandName = match[2];

        const result = await invokeSkill(
          this.config.agentId,
          skillSlug,
          commandName,
          params
        );

        const output = result.success ? result.output : `Error: ${result.error}`;

        this.toolCalls.push({
          toolName,
          parameters: params,
          result: output,
        });

        return output;
      }

      // 未知工具
      return `Error: Unknown tool ${toolName}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.toolCalls.push({
        toolName,
        parameters: params,
        result: `Error: ${errorMessage}`,
      });
      return `Error: ${errorMessage}`;
    }
  }

  /**
   * 构建结果
   */
  private buildResult(
    output: string,
    status: ExecutionResult["status"],
    error?: string
  ): ExecutionResult {
    return {
      success: status === "completed",
      output,
      steps: this.steps,
      toolCalls: this.toolCalls,
      duration: Date.now() - this.startTime,
      status,
      error,
    };
  }
}

/**
 * Executor 工厂
 */
export class ExecutorFactory {
  private llmService: LLMServiceInterface;

  constructor(llmService: LLMServiceInterface) {
    this.llmService = llmService;
  }

  /**
   * 创建 Executor 实例
   */
  async create(options: ExecutorOptions): Promise<Executor> {
    const id = `executor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[ExecutorFactory] Creating executor ${id}`);
    console.log(`[ExecutorFactory] Task: ${options.task}`);
    console.log(`[ExecutorFactory] Tools: ${options.tools.length}`);
    console.log(`[ExecutorFactory] Skills: ${options.skills.length}`);

    return new Executor(id, options, this.llmService);
  }
}

/**
 * 意图识别结果（用于判断是否需要 Executor）
 */
export interface IntentAnalysisResult {
  needsExecution: boolean;
  skillSlugs: string[];
  taskDescription: string;
  confidence: number;
}

/**
 * 分析用户意图，判断是否需要执行
 */
export function parseExecutionIntent(response: string): IntentAnalysisResult | null {
  // 匹配 EXECUTE: <skill-slug> 格式
  const executeMatch = response.match(/EXECUTE:\s*([a-zA-Z0-9_-]+)/i);

  if (executeMatch) {
    const skillSlug = executeMatch[1];

    // 提取任务描述（EXECUTE 行之后的内容）
    const lines = response.split("\n");
    const executeIndex = lines.findIndex((l) => l.match(/EXECUTE:/i));
    const taskLines = lines.slice(executeIndex + 1).filter((l) => l.trim());
    const taskDescription = taskLines.join(" ").trim() || `Execute ${skillSlug}`;

    return {
      needsExecution: true,
      skillSlugs: [skillSlug],
      taskDescription,
      confidence: 0.9,
    };
  }

  // 匹配多个 Skills: EXECUTE: skill1, skill2
  const multiExecuteMatch = response.match(/EXECUTE:\s*([a-zA-Z0-9_,-\s]+)/i);
  if (multiExecuteMatch) {
    const skillSlugs = multiExecuteMatch[1]
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const lines = response.split("\n");
    const executeIndex = lines.findIndex((l) => l.match(/EXECUTE:/i));
    const taskLines = lines.slice(executeIndex + 1).filter((l) => l.trim());
    const taskDescription = taskLines.join(" ").trim() || `Execute ${skillSlugs.join(", ")}`;

    return {
      needsExecution: true,
      skillSlugs,
      taskDescription,
      confidence: 0.85,
    };
  }

  return null;
}
