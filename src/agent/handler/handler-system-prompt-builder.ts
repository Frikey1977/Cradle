import { Environment } from "../context/environment.js";

export interface HandlerSystemMessageBlock {
  role: "system";
  content: string;
  category: HandlerMessageCategory;
}

export type HandlerMessageCategory =
  | "identity"
  | "environment"
  | "behavior";

export interface HandlerSystemPromptBlocks {
  systemMessages: HandlerSystemMessageBlock[];
  blockCount: number;
}

export interface HandlerPromptConfig {
  environment?: Environment;
}

export class HandlerSystemPromptBuilder {
  async build(config: HandlerPromptConfig): Promise<HandlerSystemPromptBlocks> {
    const systemMessages: HandlerSystemMessageBlock[] = [];

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

    systemMessages.push({
      role: "system",
      category: "behavior",
      content: this.buildBehaviorBlock(),
    });

    console.log("=".repeat(80));
    console.log("【Handler 系统提示词 - System Prompt Blocks】");
    console.log("=".repeat(80));
    systemMessages.forEach((block, index) => {
      console.log(`\n--- Block ${index + 1} [${block.category}] ---`);
      console.log(block.content.substring(0, 200) + (block.content.length > 200 ? "..." : ""));
    });
    console.log("\n" + "=".repeat(80));

    return {
      systemMessages,
      blockCount: systemMessages.length,
    };
  }

  private buildIdentityBlock(): string {
    return `# Handler Agent

你是一个轻量级任务处理器，负责执行明确的操作指令。`;
  }

  private buildBehaviorBlock(): string {
    return `# 核心行为准则

## 工具使用规范（极其重要）
1. **主动执行** - 不要只是描述你会做什么，而是直接调用工具执行
2. **语言一致** - 使用与用户首选语言一致的回复
3. **高效完成** - 任务完成后直接返回结果，不要无限循环
4. **回复规则** - 回复内容支持Markdown格式，用用户友好的方式回复
5. **信息安全** - 所有用户文件操作都应该在用户工作目录下进行
6. **异常处理** - 如果用户文件夹不存在，使用 exec 工具先创建它。Windows 系统使用 mkdir /s 命令（/s 参数会递归创建所有父目录）
7. **路径引号** - 在 Windows 下使用 exec 工具时，如果路径包含空格，必须用双引号包裹整个路径。例如：dir "F:\\01. cradle-main\\cradle" 而不是 dir F:\\01. cradle-main\\cradle
8. **回复要求** - 在调用tool时需要回复解释说明你的操作意图
`;
  }
}
