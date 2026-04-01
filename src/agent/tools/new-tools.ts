/**
 * 重构后的工具实现 - 使用 Zod 模式和 ai SDK
 * 
 * 包含：
 * - read: 读取文件
 * - write: 写入文件
 * - exec: 执行命令
 */

import { z } from "zod";
import { defineTool, type ToolDefinition } from "./tool-definitions.js";
import type { ToolContext } from "./tool-context.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import { executeExec } from "./exec.js";

// Read 工具
export const ReadTool = defineTool("read", {
  description: `Read a file from the filesystem. Use this to read SKILL.md files when you need to use a skill.

Usage:
- The file_path must be an absolute path (not relative)
- Use this tool to read files before editing them`,
  parameters: z.object({
    file_path: z.string().describe("The absolute path to the file to read"),
  }),
  async execute(args, ctx) {
    const { file_path } = args;
    
    try {
      const content = await readFile(file_path, "utf-8");
      return {
        title: `Read: ${file_path}`,
        output: content,
        metadata: {
          file_path,
          size: content.length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to read file "${file_path}": ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Write 工具
export const WriteTool = defineTool("write", {
  description: `Write content to a file. Creates the file if it doesn't exist, overwrites if it does.

Usage:
- The file_path must be an absolute path (not relative)
- The content can be any text, including code, markdown, etc.
- Parent directories will be created automatically if they don't exist
- IMPORTANT: For large files with special characters, the content will be handled correctly`,
  parameters: z.object({
    file_path: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
    content: z.string().describe("The content to write to the file"),
  }),
  async execute(args, ctx) {
    const { file_path, content } = args;
    
    try {
      // 确保父目录存在
      const dir = dirname(file_path);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      // 写入文件
      await writeFile(file_path, content, "utf-8");
      
      return {
        title: `Write: ${file_path}`,
        output: `Successfully wrote ${content.length} characters to ${file_path}`,
        metadata: {
          file_path,
          size: content.length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to write file "${file_path}": ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Exec 工具
export const ExecTool = defineTool("exec", {
  description: `Execute a shell command in the terminal.

Usage:
- Use this for running commands like npm install, node script.js, python script.py, etc.
- Keep commands simple and focused
- For complex operations, prefer writing a script file first with 'write', then executing it
- The command will be executed in the specified working directory (or current directory if not specified)
- If the command fails, analyze the error message and try to fix the issue
- Use detached=true for long-running commands (like starting a server or browser) to avoid blocking`,
  parameters: z.object({
    command: z.string().describe("The shell command to execute"),
    cwd: z.string().optional().describe("The working directory for the command (optional, defaults to current directory)"),
    detached: z.boolean().optional().describe("Run command in background (detached mode). Use for long-running commands like starting servers or browsers. Returns immediately with PID."),
  }),
  async execute(args, ctx) {
    const { command, cwd, detached } = args;

    try {
      const output = await executeExec(command, { cwd, context: { workspaceDir: cwd }, detached });

      return {
        title: `Exec: ${command.slice(0, 50)}${command.length > 50 ? "..." : ""}`,
        output: output,
        metadata: {
          command,
          cwd,
          detached: detached || false,
          exitCode: 0,
        },
      };
    } catch (error: any) {
      // 格式化错误信息，包含更多上下文帮助 LLM 理解问题
      const errorMsg = error.message || String(error);
      const enhancedError = `命令执行失败: ${command}\n\n错误详情:\n${errorMsg}\n\n建议:\n1. 检查命令语法是否正确\n2. 确认所有必需参数已提供\n3. 检查文件路径是否存在\n4. 确认有执行权限\n5. 尝试简化命令或分步执行`;

      throw new Error(enhancedError);
    }
  },
});

// 导出所有工具
export const ALL_TOOLS: ToolDefinition[] = [ReadTool, WriteTool, ExecTool];

// 工具注册表
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  
  constructor() {
    // 注册默认工具
    for (const tool of ALL_TOOLS) {
      this.tools.set(tool.id, tool);
    }
  }
  
  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }
  
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }
  
  unregister(id: string): boolean {
    return this.tools.delete(id);
  }
  
  has(id: string): boolean {
    return this.tools.has(id);
  }
  
  toAISDKTools() {
    const result: Record<string, ReturnType<typeof import("./tool-definitions.js").toAISDKTool>> = {};
    for (const [id, tool] of this.tools) {
      result[id] = toAISDKTool(tool);
    }
    return result;
  }
}

import { toAISDKTool } from "./tool-definitions.js";
