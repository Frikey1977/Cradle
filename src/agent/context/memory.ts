/**
 * Memory 提示词构建模块
 * 负责将历史记忆转换为 Markdown 格式的系统提示词
 */

import type { ShortTermMemoryEntry } from "../memory/types.js";

/**
 * Memory 提示词构建器
 */
export class MemoryPromptBuilder {
  /**
   * 构建记忆部分的提示词
   */
  build(memories: ShortTermMemoryEntry[]): string {
    if (!memories || memories.length === 0) {
      return "";
    }

    const parts: string[] = [];

    parts.push("---");
    parts.push("");
    parts.push("# 你们的历史记忆");

    // 近期对话
    parts.push("");
    parts.push("## 近期对话");

    for (const entry of memories) {
      const role = entry.role === "user" ? "user" : "agent";
      // 使用 ISO 8601 格式，大模型最容易理解
      const timestamp = new Date(entry.timestamp).toISOString();
      parts.push("");
      parts.push(`### ${role}：${entry.channel}：${timestamp}`);
      parts.push(entry.content);
    }

    // 相关记忆索引（预留，暂未实现）
    parts.push("");
    parts.push("## 相关记忆索引");
    parts.push("（暂未实现）");

    return parts.join("\n");
  }
}
