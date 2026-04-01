/**
 * Executor 系统提示词构建器
 *
 * 与 Agent 的 SystemPromptBuilder 结构保持一致
 * 输出格式：多个 system 消息块，每部分职责清晰
 */

import { Environment, type EnvironmentConfig } from "../context/environment.js";
import type { SkillEntry } from "../skills/types.js";
import type { ToolDefinition } from "../tools/index.js";

export interface ExecutorSystemMessageBlock {
  role: "system";
  content: string;
  category: ExecutorMessageCategory;
}

export type ExecutorMessageCategory =
  | "identity"
  | "environment"
  | "skills"
  | "task";

export interface ExecutorSystemPromptBlocks {
  systemMessages: ExecutorSystemMessageBlock[];
  blockCount: number;
}

export interface ExecutorPromptConfig {
  environment?: Environment;
  skills?: Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }>;
  task: {
    description: string;
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Executor 系统提示词构建器
 */
export class ExecutorSystemPromptBuilder {
  /**
   * 构建系统提示词 - 返回多个 system 消息块
   */
  async build(config: ExecutorPromptConfig): Promise<ExecutorSystemPromptBlocks> {
    const systemMessages: ExecutorSystemMessageBlock[] = [];

    systemMessages.push({
      role: "system",
      category: "identity",
      content: this.buildIdentityBlock(),
    });

    if (config.environment) {
      systemMessages.push({
        role: "system",
        category: "environment",
        content: config.environment.buildSystemPromptBlock(),
      });
    }

    if (config.skills && config.skills.length > 0) {
      systemMessages.push({
        role: "system",
        category: "skills",
        content: this.buildSkillsBlock(config.skills),
      });
    }

    // 注意：任务描述不再放入 system 块，而是由 Executor 放入用户消息

    this.logDebug(systemMessages);

    return {
      systemMessages,
      blockCount: systemMessages.length,
    };
  }

  /**
   * 构建身份定义块
   */
  private buildIdentityBlock(): string {
    return `# Task Executor

You are a task executor. Your job is to COMPLETE the assigned task using available tools.

**CRITICAL INSTRUCTION**: The user message contains the task you MUST complete. Do not ask what to do - the task is already given. Execute it immediately.

## Core Principles

1. **ALWAYS execute the task** - The task description is in the user message. Complete it without asking for clarification.
2. **Use tools to perform actions** - Do not just describe what you would do; actually call the tools.
3. **Respond in the user's preferred language.**
4. **Be proactive** - If you need to read files to understand how to complete the task, do so.
5. **Complete the task efficiently** - Do not loop forever. When the task is done, respond with the result.
6. **Quote paths with spaces** - On Windows, when using the exec tool, always wrap paths containing spaces in double quotes.
7. **回复要求** - 在调用tool时需要回复解释说明你的操作意图\n.


## ⚠️ CRITICAL: ES Modules Only (NO require!)

**This project uses ES modules. You MUST use \`import\` syntax, NOT \`require\`.**

### ❌ WRONG - Do NOT use require:
\`\`\`javascript
const { something } = require("package");  // ❌ WRONG!
\`\`\`

### ✅ CORRECT - Always use import:
\`\`\`javascript
import { something } from "package";       // ✅ CORRECT!
\`\`\`

**If you write JavaScript code with \`require\`, it will FAIL. Always use \`import\`.**



## Parallel Tool Calls

**IMPORTANT**: 
You can call MULTIPLE tools in a SINGLE response. This is more efficient and reliable than chaining commands.
If you need to run multiple commands, prefer calling the exec tool multiple times in parallel rather than using && or ; to chain them.

### Examples:
**GOOD - Parallel tool calls (recommended):**
\`\`\`
Call tool: read_file with path: "file1.txt"
Call tool: read_file with path: "file2.txt"
Call tool: read_file with path: "file3.txt"
\`\`\`

**BAD - Chained commands (avoid):**
\`\`\`
Call tool: exec with command: "cat file1.txt && cat file2.txt && cat file3.txt"
\`\`\`


`;
  }

  private buildSkillsBlock(skills: Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }>): string {
    const lines: string[] = ["# Available Skills", ""];

    for (const skill of skills) {
      lines.push(`## ${skill.name}`);
      if (skill.description) {
        lines.push(skill.description);
      }
      if (skill.filePath) {
        lines.push(`- Location: ${skill.filePath}`);
      }
      if (skill.location) {
        lines.push(`- Location: ${skill.location}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 输出调试信息
   */
  private logDebug(systemMessages: ExecutorSystemMessageBlock[]): void {
    console.log("=".repeat(80));
    console.log("【Executor 系统提示词】");
    console.log("=".repeat(80));
    systemMessages.forEach((block, index) => {
      console.log(`\n--- Block ${index + 1} [${block.category}] ---`);
      console.log(block.content.substring(0, 200) + (block.content.length > 200 ? "..." : ""));
    });
    console.log("\n" + "=".repeat(80));
  }
}
