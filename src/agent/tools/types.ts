export interface ToolExecutionContext {
  workspaceDir?: string;
}

export interface ToolResult {
  success: boolean;
  result: string;
  error?: string;
}

export interface ToolExecutor {
  execute(toolName: string, params: Record<string, unknown>, context: ToolExecutionContext): Promise<string>;
}
