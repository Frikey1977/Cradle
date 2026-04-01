/**
 * ReAct (Reasoning + Acting) 循环处理器
 * 当 Agent 的 mode=agent 时，执行完整的 ReAct 循环
 */

import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type { ConversationMessage } from "../types/index.js";
import type { Environment } from "../context/environment.js";

export interface ReActStep {
  thought: string;
  action?: {
    name: string;
    input: Record<string, any>;
  };
  observation?: string;
}

export interface ReActResult {
  output: string;
  steps: ReActStep[];
  finalAnswer: string;
}

export interface ReActConfig {
  maxIterations: number;
  modelConfig: {
    provider?: string;
    model?: string;
    instanceId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  systemPrompt?: string;
  availableTools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

export class ReActLoop {
  private llmService: LLMServiceInterface;
  private config: ReActConfig;
  private steps: ReActStep[] = [];

  constructor(llmService: LLMServiceInterface, config: ReActConfig) {
    this.llmService = llmService;
    this.config = config;
  }

  /**
   * 执行 ReAct 循环
   */
  async execute(
    task: string,
    context: {
      contactId?: string;
      conversationId?: string;
      environment?: Environment;
      agentName?: string;
    }
  ): Promise<ReActResult> {
    this.steps = [];
    let currentIteration = 0;
    let isComplete = false;
    let finalAnswer = "";

    // 构建 ReAct 系统提示词
    const systemPrompt = this.buildReActSystemPrompt();

    // 构建初始消息
    const messages: ConversationMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Task: ${task}` },
    ];

    while (currentIteration < this.config.maxIterations && !isComplete) {
      currentIteration++;
      console.log(`[ReAct] Iteration ${currentIteration}/${this.config.maxIterations}`);

      // 1. 思考阶段 - 调用 LLM 生成思考过程
      const llmResponse = await this.llmService.generate({
        model: {
          ...(this.config.modelConfig.instanceId
            ? { instanceId: this.config.modelConfig.instanceId }
            : {
                provider: this.config.modelConfig.provider || "default",
                model: this.config.modelConfig.model || "default",
              }),
          parameters: {
            temperature: this.config.modelConfig.temperature ?? 0.7,
            maxTokens: this.config.modelConfig.maxTokens ?? 4096,
          },
        },
        messages,
        source: "react",
        agentName: context.agentName || "Agent",
      });

      const content = llmResponse.content || "";

      // 2. 解析思考过程和行动
      const step = this.parseReActStep(content);
      this.steps.push(step);

      // 3. 如果有行动，执行它
      if (step.action) {
        console.log(`[ReAct] Action: ${step.action.name}`);
        const observation = await this.executeAction(step.action, context);
        step.observation = observation;

        // 添加观察结果到消息历史
        messages.push({
          role: "assistant",
          content: `Thought: ${step.thought}\nAction: ${step.action.name}\nAction Input: ${JSON.stringify(step.action.input)}`,
        });
        messages.push({
          role: "user",
          content: `Observation: ${observation}`,
        });
      } else {
        // 4. 没有行动，说明任务完成
        isComplete = true;
        finalAnswer = step.thought;
        messages.push({
          role: "assistant",
          content: `Thought: ${step.thought}`,
        });
      }
    }

    return {
      output: finalAnswer,
      steps: this.steps,
      finalAnswer,
    };
  }

  /**
   * 构建 ReAct 系统提示词
   */
  private buildReActSystemPrompt(): string {
    const toolDescriptions = this.config.availableTools
      ?.map(
        (tool) =>
          `- ${tool.name}: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters)}`
      )
      .join("\n") || "No tools available";

    return `You are an AI assistant that uses the ReAct (Reasoning + Acting) approach to solve tasks.

You must follow this format in your responses:

Thought: [Your reasoning about what to do next]
Action: [Tool name to use, or "FinalAnswer" if you're ready to provide the final answer]
Action Input: [JSON object with the tool parameters, or empty if FinalAnswer]

Available Tools:
${toolDescriptions}

When you have enough information to answer the user's question, use:
Thought: [Your final reasoning]
Action: FinalAnswer
Action Input: {"answer": "Your complete answer here"}

Remember:
1. Always start with "Thought:"
2. If you need to use a tool, specify "Action:" and "Action Input:"
3. If you're ready to answer, use "Action: FinalAnswer"
4. Be thorough in your reasoning before taking actions`;
  }

  /**
   * 解析 ReAct 步骤
   */
  private parseReActStep(content: string): ReActStep {
    const thoughtMatch = content.match(/Thought:\s*([^\n]+(?:\n(?!(Action|Observation):)[^\n]+)*)/i);
    const actionMatch = content.match(/Action:\s*(\w+)/i);
    const actionInputMatch = content.match(/Action Input:\s*(\{[^}]*\}|\[[^\]]*\])/i);

    const thought = thoughtMatch?.[1]?.trim() || content;

    if (actionMatch && actionMatch[1] !== "FinalAnswer") {
      let actionInput: Record<string, any> = {};
      if (actionInputMatch) {
        try {
          actionInput = JSON.parse(actionInputMatch[1]);
        } catch {
          actionInput = { raw: actionInputMatch[1] };
        }
      }

      return {
        thought,
        action: {
          name: actionMatch[1],
          input: actionInput,
        },
      };
    }

    return { thought };
  }

  /**
   * 执行行动
   */
  private async executeAction(
    action: { name: string; input: Record<string, any> },
    context: {
      contactId?: string;
      conversationId?: string;
      environment?: Environment;
    }
  ): Promise<string> {
    // 根据工具名称执行不同的操作
    switch (action.name) {
      case "search":
        // 模拟搜索工具
        return `Search results for "${action.input.query}": Found relevant information.`;

      case "calculator":
        // 模拟计算器工具
        try {
          // 简单的表达式计算
          const result = eval(action.input.expression);
          return `Result: ${result}`;
        } catch {
          return `Error: Invalid expression "${action.input.expression}"`;
        }

      case "browser":
        // 浏览器工具 - 可以调用 browser skill
        return `Browser action "${action.input.action}" executed on ${action.input.url || "current page"}.`;

      case "file_read":
        // 文件读取工具
        return `Content of file "${action.input.path}": [File content would be here]`;

      case "file_write":
        // 文件写入工具
        return `File "${action.input.path}" written successfully.`;

      default:
        // 尝试从 availableTools 中找到对应的工具
        const tool = this.config.availableTools?.find((t) => t.name === action.name);
        if (tool) {
          return `Tool "${action.name}" executed with input: ${JSON.stringify(action.input)}`;
        }
        return `Unknown tool: ${action.name}`;
    }
  }
}
