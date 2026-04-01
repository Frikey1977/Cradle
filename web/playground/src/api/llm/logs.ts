/**
 * LLM 日志查看 API 接口
 */
import { requestClient } from "#/api/request";

export type LLMCallSource = "agent" | "orchestrator" | "executor" | "handler";

export namespace LlmLogsApi {
  /** 日志条目 */
  export interface LogEntry {
    timestamp: string;
    type: "request" | "response" | "error";
    hasToolCalls?: boolean;
    model?: string;
    provider?: string;
    instanceId?: string;
    source?: LLMCallSource;
    requestBody?: {
      model?: string;
      messages?: Array<{
        role: string;
        content?: string;
        name?: string;
      }>;
      tools?: any[];
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    };
    responseData?: {
      stream?: boolean;
      chunks?: number;
      hasToolCalls?: boolean;
      streamId?: string;
      toolCalls?: Array<{
        index: number;
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
      fullContent?: string;
    };
    error?: string;
    duration?: number;
    toolCalls?: any[];
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
  }

  /** 日志列表查询参数 */
  export interface LogsQuery {
    page?: number;
    pageSize?: number;
    date?: string;
    type?: "request" | "response" | "error";
    keyword?: string;
  }

  /** 日志列表结果 */
  export interface LogsListResult {
    list: LogEntry[];
    total: number;
    fileName: string;
  }

  /** 可用的日志日期列表 */
  export interface LogDatesResult {
    dates: string[];
  }
}

/**
 * 获取日志列表
 */
export async function getLogsList(
  params: LlmLogsApi.LogsQuery,
): Promise<LlmLogsApi.LogsListResult> {
  return requestClient.get("/llm/logs", { params });
}

/**
 * 获取可用的日志日期列表
 */
export async function getLogDates(): Promise<LlmLogsApi.LogDatesResult> {
  return requestClient.get("/llm/logs/dates");
}

/**
 * 获取日志文件内容（原始）
 */
export async function getLogFileRaw(date: string): Promise<string> {
  return requestClient.get(`/llm/logs/raw/${date}`, {
    responseType: "text",
  });
}

/**
 * 删除指定日期的日志文件
 * 注意：requestClient 的拦截器会自动提取 data 字段，所以返回的是 { deleted: number }
 */
export async function deleteLogFile(date: string): Promise<{ deleted: number }> {
  return requestClient.delete(`/llm/logs/${date}`);
}