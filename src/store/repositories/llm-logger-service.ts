/**
 * LLM 日志服务
 * 集成数据库日志记录，替代原有的文件日志
 */

import type { LLMCallSource, LLMLogEntry as OriginalEntry } from "../../utils/llm-logger.js";
import { getLLMLogRepository } from "./llm-logs.js";

// 请求记录缓存（用于关联请求和响应）
const requestCache = new Map<string, number>();

/**
 * 生成请求缓存键
 */
function getCacheKey(instanceId: string, source: LLMCallSource): string {
  return `${source}:${instanceId}`;
}

/**
 * 记录 LLM 请求
 */
export async function logRequestToDB(
  entry: Omit<OriginalEntry, "timestamp" | "type">,
): Promise<void> {
  try {
    console.log("[LLMLoggerService] logRequestToDB called:", entry.model, entry.source);
    const repo = await getLLMLogRepository();
    const id = await repo.logRequest(entry);
    console.log("[LLMLoggerService] Request logged with id:", id);

    // 缓存请求ID用于后续关联
    if (entry.instanceId && entry.source) {
      const key = getCacheKey(entry.instanceId, entry.source!);
      requestCache.set(key, id);
      console.log("[LLMLoggerService] Cache key set:", key, "->", id);

      // 清理过期缓存（保留最近100条）
      if (requestCache.size > 100) {
        const firstKey = requestCache.keys().next().value;
        if (firstKey) {
          requestCache.delete(firstKey);
        }
      }
    }
  } catch (error) {
    console.error("[LLMLoggerService] Failed to log request:", error);
  }
}

/**
 * 记录 LLM 响应
 */
export async function logResponseToDB(
  entry: Omit<OriginalEntry, "timestamp" | "type">,
): Promise<void> {
  try {
    console.log("[LLMLoggerService] logResponseToDB called:", entry.model, entry.source);
    const repo = await getLLMLogRepository();

    // 尝试关联请求
    let requestId: number | undefined;
    if (entry.instanceId && entry.source) {
      const key = getCacheKey(entry.instanceId, entry.source);
      requestId = requestCache.get(key);
      console.log("[LLMLoggerService] Looking for cache key:", key, "found:", requestId);
      if (requestId) {
        requestCache.delete(key); // 使用后清理
      }
    }

    const id = await repo.logResponse({ ...entry, requestId });
    console.log("[LLMLoggerService] Response logged with id:", id, "requestId:", requestId);
  } catch (error) {
    console.error("[LLMLoggerService] Failed to log response:", error);
  }
}

/**
 * 记录 LLM 错误
 */
export async function logErrorToDB(
  entry: Omit<OriginalEntry, "timestamp" | "type">,
): Promise<void> {
  try {
    const repo = await getLLMLogRepository();

    // 尝试关联请求
    let requestId: number | undefined;
    if (entry.instanceId && entry.source) {
      const key = getCacheKey(entry.instanceId, entry.source);
      requestId = requestCache.get(key);
      if (requestId) {
        requestCache.delete(key);
      }
    }

    await repo.logError({ ...entry, requestId });
  } catch (error) {
    console.error("[LLMLoggerService] Failed to log error:", error);
  }
}

/**
 * 清理请求缓存
 */
export function clearRequestCache(): void {
  requestCache.clear();
}
