/**
 * LLM 调用日志记录器
 * 将 LLM 的请求和响应记录到日志文件和数据库
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export type LLMCallSource = "agent" | "orchestrator" | "executor" | "handler" | "react" | "heartbeat";

/**
 * LLM 调用日志条目
 */
export interface LLMLogEntry {
  timestamp: string;
  type: "request" | "response" | "error";
  hasToolCalls?: boolean;
  model?: string;
  provider?: string;
  instanceId?: string;
  requestBody?: any;
  responseData?: any;
  error?: string;
  duration?: number;
  toolCalls?: any[];
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  source?: LLMCallSource;
  agentName?: string;
  worktaskId?: string;
  contactName?: string;
}

/**
 * LLM 日志记录器
 * 同时写入文件和数据库
 */
export class LLMLogger {
  private logDir: string;
  private currentLogFile: string;
  private enabled: boolean;
  private dbWriteEnabled: boolean = true;

  constructor(logDir?: string) {
    const projectRoot = this.findProjectRoot();
    this.logDir = logDir || join(projectRoot, "logs", "llm");
    this.enabled = true;

    this.ensureLogDir();

    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    this.currentLogFile = join(this.logDir, `llm-${dateStr}.jsonl`);

    console.log(`[LLMLogger] Log file: ${this.currentLogFile}`);
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd();

    while (currentDir !== dirname(currentDir)) {
      if (existsSync(join(currentDir, "package.json"))) {
        return currentDir;
      }
      currentDir = dirname(currentDir);
    }

    return process.cwd();
  }

  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 记录 LLM 请求
   */
  logRequest(entry: Omit<LLMLogEntry, "timestamp" | "type">): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry: LLMLogEntry = {
      ...entry,
      timestamp,
      type: "request",
    };

    this.writeLog(logEntry);
    this.writeToDB(logEntry);
  }

  /**
   * 记录 LLM 响应
   */
  async logResponse(entry: Omit<LLMLogEntry, "timestamp" | "type">): Promise<void> {
    if (!this.enabled) return;

    const hasToolCalls = entry.responseData?.toolCalls && entry.responseData.toolCalls.length > 0;
    const timestamp = new Date().toISOString();

    const logEntry: LLMLogEntry = {
      ...entry,
      timestamp,
      type: "response",
      hasToolCalls: hasToolCalls || undefined,
    };

    this.writeLog(logEntry);
    await this.writeToDB(logEntry);
  }

  /**
   * 记录错误
   */
  async logError(entry: Omit<LLMLogEntry, "timestamp" | "type">): Promise<void> {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry: LLMLogEntry = {
      ...entry,
      timestamp,
      type: "error",
    };

    this.writeLog(logEntry);
    await this.writeToDB(logEntry);
  }

  /**
   * 写入日志文件
   */
  private writeLog(entry: LLMLogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + "\n";
      appendFileSync(this.currentLogFile, logLine, "utf-8");
    } catch (error) {
      console.error("[LLMLogger] Failed to write log file:", error);
    }
  }

  /**
   * 写入数据库
   */
  private async writeToDB(entry: LLMLogEntry): Promise<void> {
    if (!this.dbWriteEnabled) return;

    try {
      const { getLLMLogRepository } = await import("../store/repositories/llm-logs.js");
      const repo = await getLLMLogRepository();

      if (entry.type === "request") {
        await repo.logRequest({
          model: entry.model,
          provider: entry.provider,
          instanceId: entry.instanceId,
          requestBody: entry.requestBody,
          source: entry.source,
          agentName: entry.agentName,
          worktaskId: entry.worktaskId,
          contactName: entry.contactName,
        });
      } else if (entry.type === "response") {
        const tokenUsage = entry.tokenUsage || { prompt: 0, completion: 0, total: 0 };
        await repo.logResponse({
          model: entry.model,
          provider: entry.provider,
          instanceId: entry.instanceId,
          responseData: entry.responseData,
          duration: entry.duration,
          tokenPrompt: tokenUsage.prompt || 0,
          tokenCompletion: tokenUsage.completion || 0,
          tokenTotal: tokenUsage.total || 0,
          source: entry.source,
          agentName: entry.agentName,
          worktaskId: entry.worktaskId,
          contactName: entry.contactName,
          hasToolCalls: entry.hasToolCalls,
        });
      } else if (entry.type === "error") {
        await repo.logError({
          model: entry.model,
          provider: entry.provider,
          instanceId: entry.instanceId,
          error: entry.error,
          duration: entry.duration,
          source: entry.source,
          agentName: entry.agentName,
          worktaskId: entry.worktaskId,
          contactName: entry.contactName,
        });
      }
    } catch (error) {
      console.error("[LLMLogger] Failed to write to DB:", error);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDbWriteEnabled(enabled: boolean): void {
    this.dbWriteEnabled = enabled;
  }

  getCurrentLogFile(): string {
    return this.currentLogFile;
  }
}

let globalLogger: LLMLogger | null = null;

export function getLLMLogger(logDir?: string): LLMLogger {
  if (!globalLogger) {
    globalLogger = new LLMLogger(logDir);
  }
  return globalLogger;
}

export function resetLLMLogger(): void {
  globalLogger = null;
}
