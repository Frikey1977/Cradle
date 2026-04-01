/**
 * 工具定义层 - 使用 Zod 模式和 ai SDK
 * 
 * 这是重构后的工具定义，使用 Zod 进行类型验证，
 * 并与 ai SDK 集成，提供自动参数验证和错误处理
 */

import { z } from "zod";
import { tool } from "ai";
import type { ToolContext } from "./tool-context.js";

// 工具执行结果
export interface ToolResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
}

// 工具定义接口
export interface ToolDefinition {
  id: string;
  description: string;
  parameters: z.ZodType;
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

// 创建工具的辅助函数
export function defineTool<T extends z.ZodType>(
  id: string,
  definition: {
    description: string;
    parameters: T;
    execute: (
      args: z.infer<T>,
      ctx: ToolContext
    ) => Promise<ToolResult>;
  }
): ToolDefinition {
  return {
    id,
    description: definition.description,
    parameters: definition.parameters,
    execute: async (args: unknown, ctx: ToolContext) => {
      // 验证参数
      const parsed = definition.parameters.safeParse(args);
      if (!parsed.success) {
        const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(
          `Invalid arguments for tool "${id}": ${errors}. ` +
          `Please fix the arguments and try again.`
        );
      }
      // 执行工具
      return definition.execute(parsed.data, ctx);
    },
  };
}

// 转换为 ai SDK 工具格式
export function toAISDKTool(def: ToolDefinition) {
  return tool({
    description: def.description,
    inputSchema: def.parameters,
    execute: async (input, options) => {
      // 创建工具上下文
      const ctx: ToolContext = {
        toolCallId: options.toolCallId,
        abortSignal: options.abortSignal,
        // 其他上下文信息可以通过闭包或额外参数传递
      };
      
      const result = await def.execute(input, ctx);
      return {
        output: result.output,
        title: result.title,
        metadata: result.metadata,
      };
    },
  });
}

// 工具上下文 - 从 tool-context.js 重新导出
export type { ToolContext } from "./tool-context.js";
