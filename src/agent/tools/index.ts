/**
 * 工具模块导出
 * 
 * 使用 ai SDK 和 Zod 模式
 * 提供类型安全、自动验证和更好的错误处理
 */

export { defineTool, toAISDKTool, type ToolDefinition, type ToolResult } from "./tool-definitions.js";
export { type ToolContext } from "./tool-context.js";
export { ReadTool, WriteTool, ExecTool, ToolRegistry, ALL_TOOLS } from "./new-tools.js";
export { BrowserTool, ALL_BROWSER_TOOLS } from "./browser-tool.js";

export { 
  buildOrchestratorTool, 
  buildExecutorTool, 
  buildHandlerTool, 
  buildAgentTools,
  type OrchestratorToolParams,
  type ExecutorToolParams,
  type HandlerToolParams,
} from "./agent-tools.js";

export type { ToolExecutionContext } from "./types.js";

import { ReadTool, WriteTool, ExecTool } from "./new-tools.js";
import { BrowserTool } from "./browser-tool.js";
import type { ToolDefinition } from "./tool-definitions.js";

const TOOL_MAP: Record<string, ToolDefinition> = {
  read: ReadTool,
  write: WriteTool,
  exec: ExecTool,
  browser: BrowserTool,
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: Record<string, unknown>
): Promise<string> {
  const tool = TOOL_MAP[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    const result = await tool.execute(args, {
      toolCallId: `call-${Date.now()}`,
      ...ctx,
    });
    return result.output;
  } catch (error) {
    throw new Error(`Tool "${name}" execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
