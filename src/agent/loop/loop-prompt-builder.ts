/**
 * 循环提示词构建器
 *
 * 负责构建长程循环任务的提示词，包括：
 * - 循环上下文信息
 * - 历史执行摘要
 * - 下一轮任务指引
 */

import type { Worktask, LoopState, ExecutorResult, WorktaskTodo } from "../worktask/types.js";

export interface LoopContext {
  worktask: Worktask;
  lastExecutorResult?: ExecutorResult;
  lastObservation?: string;
  accumulatedData?: Record<string, unknown>;
}

export interface LoopPromptOptions {
  includeHistory?: boolean;
  maxHistoryLength?: number;
  includeAccumulatedData?: boolean;
  customInstructions?: string[];
}

export class LoopPromptBuilder {
  private maxHistoryLength: number;

  constructor(maxHistoryLength: number = 10) {
    this.maxHistoryLength = maxHistoryLength;
  }

  buildLoopContextPrompt(context: LoopContext, options: LoopPromptOptions = {}): string {
    const { worktask, lastExecutorResult, lastObservation, accumulatedData } = context;
    const {
      includeHistory = true,
      maxHistoryLength = this.maxHistoryLength,
      includeAccumulatedData = true,
      customInstructions = [],
    } = options;

    const sections: string[] = [];

    sections.push(this.buildHeaderSection(worktask));

    sections.push(this.buildLoopStateSection(worktask.loopState));

    if (includeHistory && worktask.executors.length > 0) {
      sections.push(this.buildHistorySection(worktask, maxHistoryLength));
    }

    if (lastExecutorResult || lastObservation) {
      sections.push(this.buildLastResultSection(lastExecutorResult, lastObservation));
    }

    if (includeAccumulatedData && accumulatedData && Object.keys(accumulatedData).length > 0) {
      sections.push(this.buildAccumulatedDataSection(accumulatedData));
    }

    sections.push(this.buildTodoStatusSection(worktask.todos));

    sections.push(this.buildNextActionSection(worktask));

    if (customInstructions.length > 0) {
      sections.push(this.buildCustomInstructionsSection(customInstructions));
    }

    return sections.filter(Boolean).join("\n\n");
  }

  private buildHeaderSection(worktask: Worktask): string {
    const lines: string[] = [
      "## 循环任务上下文",
      "",
      `**任务ID**: ${worktask.id}`,
      `**任务描述**: ${worktask.task}`,
      `**当前状态**: ${worktask.status}`,
    ];

    if (worktask.driver) {
      lines.push(`**驱动类型**: ${worktask.driver.type}`);
      if (worktask.driver.nextTriggerTime) {
        lines.push(`**下次触发时间**: ${worktask.driver.nextTriggerTime.toISOString()}`);
      }
    }

    return lines.join("\n");
  }

  private buildLoopStateSection(loopState?: LoopState): string {
    if (!loopState) {
      return [
        "## 循环状态",
        "",
        "**当前轮次**: 1",
        "**状态**: 首次执行",
      ].join("\n");
    }

    const lines: string[] = [
      "## 循环状态",
      "",
      `**当前轮次**: ${loopState.loopCount + 1}${loopState.maxLoops ? ` / ${loopState.maxLoops}` : ""}`,
    ];

    if (loopState.lastDecision) {
      lines.push(`**上次决策**: ${this.translateDecision(loopState.lastDecision)}`);
    }

    if (loopState.lastDecisionReason) {
      lines.push(`**决策原因**: ${loopState.lastDecisionReason}`);
    }

    if (loopState.pauseReason) {
      lines.push(`**暂停原因**: ${loopState.pauseReason}`);
    }

    if (loopState.waitingForUserInput) {
      lines.push("**状态**: 等待用户输入");
    }

    if (loopState.userConfirmRequired) {
      lines.push("**需要用户确认**: 是");
    }

    return lines.join("\n");
  }

  private buildHistorySection(worktask: Worktask, maxLength: number): string {
    const executors = worktask.executors.slice(-maxLength);
    
    if (executors.length === 0) {
      return "";
    }

    const lines: string[] = [
      "## 执行历史摘要",
      "",
    ];

    executors.forEach((executor, index) => {
      const status = executor.status === "completed" ? "✅" : executor.status === "failed" ? "❌" : "⏳";
      const duration = executor.duration ? ` (${Math.round(executor.duration / 1000)}s)` : "";
      
      lines.push(`### 第 ${index + 1} 次执行 ${status}${duration}`);
      lines.push(`**任务**: ${executor.task.substring(0, 100)}${executor.task.length > 100 ? "..." : ""}`);
      
      if (executor.result) {
        const output = executor.result.output || "";
        const truncatedOutput = output.length > 200 ? output.substring(0, 200) + "..." : output;
        lines.push(`**结果**: ${truncatedOutput}`);
      }

      if (executor.error) {
        lines.push(`**错误**: ${executor.error.message}`);
      }

      lines.push("");
    });

    return lines.join("\n");
  }

  private buildLastResultSection(
    lastResult?: ExecutorResult,
    lastObservation?: string
  ): string {
    const lines: string[] = ["## 最近执行结果", ""];

    if (lastResult) {
      lines.push("### 执行输出");
      if (lastResult.success) {
        lines.push(`**状态**: 成功`);
      } else {
        lines.push(`**状态**: 失败`);
        if (lastResult.error) {
          lines.push(`**错误**: ${lastResult.error.message}`);
        }
      }
      lines.push("");
      
      if (lastResult.output) {
        const truncated = lastResult.output.length > 500
          ? lastResult.output.substring(0, 500) + "\n...[已截断]"
          : lastResult.output;
        lines.push("```");
        lines.push(truncated);
        lines.push("```");
      }
    }

    if (lastObservation) {
      lines.push("");
      lines.push("### 观察");
      lines.push(lastObservation);
    }

    return lines.join("\n");
  }

  private buildAccumulatedDataSection(data: Record<string, unknown>): string {
    const lines: string[] = ["## 累积数据", ""];

    for (const [key, value] of Object.entries(data)) {
      const valueStr = typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
      
      const truncated = valueStr.length > 300
        ? valueStr.substring(0, 300) + "..."
        : valueStr;
      
      lines.push(`### ${key}`);
      lines.push("```");
      lines.push(truncated);
      lines.push("```");
      lines.push("");
    }

    return lines.join("\n");
  }

  private buildTodoStatusSection(todos: WorktaskTodo[]): string {
    if (todos.length === 0) {
      return "";
    }

    const lines: string[] = ["## Todo 状态", ""];

    const statusEmoji: Record<string, string> = {
      pending: "⏸️",
      in_progress: "🔄",
      completed: "✅",
      failed: "❌",
      skipped: "⏭️",
    };

    todos.forEach((todo) => {
      const emoji = statusEmoji[todo.status] || "❓";
      lines.push(`${emoji} ${todo.content.substring(0, 80)}${todo.content.length > 80 ? "..." : ""}`);
    });

    const completed = todos.filter((t) => t.status === "completed").length;
    const total = todos.length;
    lines.push("");
    lines.push(`**进度**: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);

    return lines.join("\n");
  }

  private buildNextActionSection(worktask: Worktask): string {
    const lines: string[] = [
      "## 下一步行动指引",
      "",
      "请根据以上上下文信息，决定下一步行动：",
      "",
      "**可选决策**:",
      "- `continue`: 继续执行下一轮任务",
      "- `pause`: 暂停任务，等待特定条件或用户输入",
      "- `exit`: 完成任务，退出循环",
      "",
    ];

    if (worktask.loopState?.maxLoops) {
      const remaining = worktask.loopState.maxLoops - (worktask.loopState.loopCount || 0);
      lines.push(`**剩余轮次**: ${remaining}`);
      lines.push("");
    }

    lines.push("请分析当前状态，做出决策并说明原因。");

    return lines.join("\n");
  }

  private buildCustomInstructionsSection(instructions: string[]): string {
    const lines: string[] = ["## 自定义指令", ""];

    instructions.forEach((instruction, index) => {
      lines.push(`${index + 1}. ${instruction}`);
    });

    return lines.join("\n");
  }

  buildDecisionPrompt(context: LoopContext): string {
    const { worktask, lastExecutorResult, lastObservation } = context;

    const lines: string[] = [
      "请分析当前任务执行状态，并做出循环决策。",
      "",
      "## 当前状态",
      `- 循环轮次: ${(worktask.loopState?.loopCount || 0) + 1}`,
      `- 任务状态: ${worktask.status}`,
      `- Todo 完成度: ${worktask.todos.filter((t) => t.status === "completed").length}/${worktask.todos.length}`,
      "",
    ];

    if (lastObservation) {
      lines.push("## 最近观察");
      lines.push(lastObservation);
      lines.push("");
    }

    if (lastExecutorResult && !lastExecutorResult.success) {
      lines.push("## 执行错误");
      lines.push(lastExecutorResult.error?.message || "未知错误");
      lines.push("");
    }

    lines.push("## 请输出决策");
    lines.push("以 JSON 格式输出决策结果：");
    lines.push("```json");
    lines.push("{");
    lines.push('  "action": "continue|pause|exit",');
    lines.push('  "reason": "决策原因说明",');
    lines.push('  "nextTask": "如果继续，下一轮要执行的任务描述（可选）",');
    lines.push('  "pauseReason": "如果暂停，暂停原因说明（可选）",');
    lines.push('  "userConfirmRequired": false,');
    lines.push('  "userConfirmData": {}');
    lines.push("}");
    lines.push("```");

    return lines.join("\n");
  }

  buildResumePrompt(worktask: Worktask): string {
    const lines: string[] = [
      "## 任务恢复",
      "",
      `任务从暂停状态恢复，继续执行。`,
      "",
      `**任务描述**: ${worktask.task}`,
      `**暂停原因**: ${worktask.loopState?.pauseReason || "未知"}`,
      `**当前轮次**: ${(worktask.loopState?.loopCount || 0) + 1}`,
      "",
    ];

    const pendingTodos = worktask.todos.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    );

    if (pendingTodos.length > 0) {
      lines.push("## 待处理项");
      pendingTodos.forEach((todo) => {
        lines.push(`- ${todo.content}`);
      });
      lines.push("");
    }

    lines.push("请继续执行任务。");

    return lines.join("\n");
  }

  private translateDecision(decision: string): string {
    const map: Record<string, string> = {
      continue: "继续执行",
      pause: "暂停",
      exit: "退出",
    };
    return map[decision] || decision;
  }
}

export const loopPromptBuilder = new LoopPromptBuilder();
