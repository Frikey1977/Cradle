/**
 * 循环决策器
 *
 * 负责分析任务执行状态，决定是否继续、暂停或退出循环
 * 决策由 LLM 驱动，框架只提供决策能力
 */

import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type {
  Worktask,
  LoopDecision,
  LoopState,
  ExecutorResult,
} from "../worktask/types.js";
import { LoopPromptBuilder, type LoopContext } from "./loop-prompt-builder.js";

export interface DecisionContext {
  worktask: Worktask;
  lastExecutorResult?: ExecutorResult;
  lastObservation?: string;
  accumulatedData?: Record<string, unknown>;
}

export interface DecisionOptions {
  maxRetries?: number;
  timeout?: number;
}

export class LoopDecisionMaker {
  private llmService: LLMServiceInterface;
  private promptBuilder: LoopPromptBuilder;

  constructor(llmService: LLMServiceInterface, promptBuilder?: LoopPromptBuilder) {
    this.llmService = llmService;
    this.promptBuilder = promptBuilder || new LoopPromptBuilder();
  }

  async makeDecision(
    context: DecisionContext,
    modelConfig: {
      provider?: string;
      baseUrl: string;
      apiKey: string;
      modelName: string;
      instanceId?: string;
    },
    options: DecisionOptions = {}
  ): Promise<LoopDecision> {
    const { worktask, lastExecutorResult, lastObservation, accumulatedData } = context;
    const { maxRetries = 2 } = options;

    if (this.shouldAutoExit(worktask, lastExecutorResult)) {
      return {
        action: "exit",
        reason: "所有任务已完成或达到自动退出条件",
      };
    }

    if (this.shouldAutoPause(worktask)) {
      return {
        action: "pause",
        reason: worktask.loopState?.pauseReason || "需要等待用户输入或外部条件",
        userConfirmRequired: worktask.loopState?.userConfirmRequired,
        userConfirmData: worktask.loopState?.userConfirmData,
      };
    }

    if (this.hasReachedMaxLoops(worktask)) {
      return {
        action: "exit",
        reason: `已达到最大循环次数 ${worktask.loopState?.maxLoops}`,
      };
    }

    const loopContext: LoopContext = {
      worktask,
      lastExecutorResult,
      lastObservation,
      accumulatedData,
    };

    const decisionPrompt = this.promptBuilder.buildDecisionPrompt(loopContext);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.llmService.generate({
          model: modelConfig,
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(),
            },
            {
              role: "user",
              content: decisionPrompt,
            },
          ],
          source: "orchestrator",
          agentName: worktask.agentId,
          worktaskId: worktask.id,
        });

        const decision = this.parseDecision(response.content || "");
        
        if (decision) {
          return decision;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[LoopDecisionMaker] Decision attempt ${attempt + 1} failed:`, lastError.message);
      }
    }

    if (lastError) {
      console.error(`[LoopDecisionMaker] All decision attempts failed, defaulting to pause`);
    }

    return {
      action: "pause",
      reason: `决策失败: ${lastError?.message || "无法解析决策结果"}，暂停等待人工干预`,
    };
  }

  private shouldAutoExit(worktask: Worktask, lastResult?: ExecutorResult): boolean {
    const allTodosCompleted = worktask.todos.length > 0 &&
      worktask.todos.every((t) => t.status === "completed" || t.status === "skipped");

    if (allTodosCompleted) {
      return true;
    }

    if (worktask.driver?.type === "cron" || worktask.driver?.type === "polling") {
      return false;
    }

    if (lastResult?.success && worktask.todos.length === 0) {
      return true;
    }

    return false;
  }

  private shouldAutoPause(worktask: Worktask): boolean {
    if (worktask.status === "paused") {
      return true;
    }

    if (worktask.loopState?.waitingForUserInput) {
      return true;
    }

    if (worktask.loopState?.userConfirmRequired) {
      return true;
    }

    return false;
  }

  private hasReachedMaxLoops(worktask: Worktask): boolean {
    const maxLoops = worktask.loopState?.maxLoops;
    const currentLoop = worktask.loopState?.loopCount || 0;
    
    return maxLoops !== undefined && currentLoop >= maxLoops;
  }

  private getSystemPrompt(): string {
    return `你是一个任务循环决策器。你的职责是分析任务执行状态，决定下一步行动。

## 决策类型

1. **continue** - 继续执行下一轮任务
   - 当还有未完成的工作时
   - 当需要继续监控或轮询时
   - 当任务需要迭代处理时

2. **pause** - 暂停任务
   - 当需要等待用户输入时
   - 当需要等待外部条件时
   - 当遇到需要人工干预的情况时
   - 当需要用户确认时

3. **exit** - 完成任务，退出循环
   - 当所有任务都已完成时
   - 当达到预期目标时
   - 当无法继续执行时

## 输出格式

请以 JSON 格式输出决策结果，包含以下字段：
- action: "continue" | "pause" | "exit"
- reason: 决策原因说明
- nextTask?: 如果继续，下一轮要执行的任务描述
- pauseReason?: 如果暂停，暂停原因
- userConfirmRequired?: 是否需要用户确认
- userConfirmData?: 用户确认所需的数据
- nextTriggerTime?: 下次触发时间（ISO格式字符串）

请仔细分析任务状态，做出最合理的决策。`;
  }

  private parseDecision(content: string): LoopDecision | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.action || !["continue", "pause", "exit"].includes(parsed.action)) {
        return null;
      }

      const decision: LoopDecision = {
        action: parsed.action,
        reason: parsed.reason || "未提供原因",
        nextTask: parsed.nextTask,
        pauseReason: parsed.pauseReason,
        userConfirmRequired: parsed.userConfirmRequired,
        userConfirmData: parsed.userConfirmData,
      };

      if (parsed.nextTriggerTime) {
        try {
          decision.nextTriggerTime = new Date(parsed.nextTriggerTime);
        } catch {
          // 忽略无效日期
        }
      }

      return decision;
    } catch (error) {
      console.warn("[LoopDecisionMaker] Failed to parse decision:", error);
      return null;
    }
  }

  analyzeExecutionTrend(worktask: Worktask): {
    successRate: number;
    avgDuration: number;
    errorPattern?: string;
  } {
    const executors = worktask.executors;
    
    if (executors.length === 0) {
      return { successRate: 0, avgDuration: 0 };
    }

    const successCount = executors.filter((e) => e.status === "completed").length;
    const successRate = successCount / executors.length;

    const durations = executors
      .filter((e) => e.duration)
      .map((e) => e.duration!);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const recentErrors = executors
      .filter((e) => e.status === "failed" && e.error)
      .slice(-3)
      .map((e) => e.error!.message);

    let errorPattern: string | undefined;
    if (recentErrors.length >= 2) {
      const commonWords = this.findCommonWords(recentErrors);
      if (commonWords.length > 0) {
        errorPattern = commonWords.join(", ");
      }
    }

    return { successRate, avgDuration, errorPattern };
  }

  private findCommonWords(strings: string[]): string[] {
    if (strings.length === 0) return [];

    const wordCounts = new Map<string, number>();
    
    strings.forEach((str) => {
      const words = str.toLowerCase().split(/\s+/);
      new Set(words).forEach((word) => {
        if (word.length > 3) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      });
    });

    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= strings.length * 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
  }

  shouldRetry(worktask: Worktask, maxConsecutiveErrors: number = 3): boolean {
    const recentExecutors = worktask.executors.slice(-maxConsecutiveErrors);
    
    if (recentExecutors.length < maxConsecutiveErrors) {
      return true;
    }

    const allFailed = recentExecutors.every((e) => e.status === "failed");
    
    return !allFailed;
  }
}

export function createLoopDecisionMaker(
  llmService: LLMServiceInterface,
  promptBuilder?: LoopPromptBuilder
): LoopDecisionMaker {
  return new LoopDecisionMaker(llmService, promptBuilder);
}
