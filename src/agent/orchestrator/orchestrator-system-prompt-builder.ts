import { Environment, type EnvironmentConfig } from "../context/environment.js";
import type { SkillEntry } from "../skills/types.js";
import type { ToolDefinition } from "../tools/index.js";

export interface OrchestratorSystemMessageBlock {
  role: "system";
  content: string;
  category: OrchestratorMessageCategory;
}

export type OrchestratorMessageCategory =
  | "identity"
  | "environment"
  | "skills"
  | "tools"
  | "behavior";

export interface OrchestratorSystemPromptBlocks {
  systemMessages: OrchestratorSystemMessageBlock[];
  blockCount: number;
}

export interface OrchestratorPromptConfig {
  environment?: Environment;
  skills: SkillEntry[];
  tools: ToolDefinition[];
}

/**
 * Orchestrator 系统提示词构建器
 */
export class OrchestratorSystemPromptBuilder {
  /**
   * 构建任务分析系统提示词
   */
  async buildAnalysisPrompt(config: OrchestratorPromptConfig): Promise<OrchestratorSystemPromptBlocks> {
    const systemMessages: OrchestratorSystemMessageBlock[] = [];

    systemMessages.push({
      role: "system",
      category: "identity",
      content: this.buildAnalysisIdentityBlock(),
    });

    if (config.environment) {
      systemMessages.push({
        role: "system",
        category: "environment",
        content: config.environment.buildSystemPromptBlock(),
      });
    }

    const skillsContent = this.buildSkillsBlock(config.skills);
    if (skillsContent) {
      systemMessages.push({
        role: "system",
        category: "skills",
        content: skillsContent,
      });
    }

    const toolsContent = this.buildToolsBlock(config.tools);
    if (toolsContent) {
      systemMessages.push({
        role: "system",
        category: "tools",
        content: toolsContent,
      });
    }

    systemMessages.push({
      role: "system",
      category: "behavior",
      content: this.buildAnalysisBehaviorBlock(),
    });

    this.logDebug(systemMessages, "任务分析");

    return {
      systemMessages,
      blockCount: systemMessages.length,
    };
  }

  private buildAnalysisIdentityBlock(): string {
    return `# 任务编排器

你是一个任务编排器，负责分析任务并制定执行计划。`;
  }

  /**
   * 构建技能块
   */
  private buildSkillsBlock(skills: SkillEntry[]): string {
    if (!skills || skills.length === 0) {
      return "";
    }

    const lines: string[] = ["# 可用 Skills", ""];

    for (const skill of skills) {
      lines.push(`- ${skill.name}: ${skill.description}`);
    }

    return lines.join("\n");
  }

  /**
   * 构建工具块
   */
  private buildToolsBlock(tools: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return "";
    }

    const toolNames = tools.map(t => t.id);

    return `# 可用工具

${toolNames.join(", ")}`;
  }

  /**
   * 构建任务分析行为准则块
   */
  private buildAnalysisBehaviorBlock(): string {
    return `# 任务分解原则

**核心原则：一个 Skill = 一个步骤**

1. **如果任务可以使用单个 Skill 完成**
   - 只生成一个步骤
   - description 描述最终目标即可
   - Executor 内部会通过 ReAct 循环自动处理完整流程（读取SKILL.md → 执行 → 验证）

2. **如果任务需要多个 Skills 协作**
   - 每个 Skill 对应一个步骤
   - 步骤之间通过 dependencies 标识依赖关系
   - 但每个 Skill 步骤内部仍是完整执行

3. **不要过度拆分**
   - ❌ 错误：读取SKILL.md → 生成脚本 → 执行脚本 → 验证（4个步骤）
   - ✅ 正确：使用pptx Skill生成PPT（1个步骤）

# 输出格式

输出 JSON 格式：
\`\`\`json
{
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "description": "明确的最终目标描述",
      "type": "executor",
      "dependencies": [],
      "config": {
        "skillSlug": "skill名称（如适用）",
        "toolName": "工具名称（如适用）"
      }
    }
  ],
  "canParallelize": boolean,
  "hasSequentialDependency": boolean,
  "dependencies": []
}
\`\`\``;
  }

  /**
   * 输出调试信息
   */
  private logDebug(systemMessages: OrchestratorSystemMessageBlock[], context: string): void {
    console.log("=".repeat(80));
    console.log(`【Orchestrator 系统提示词 - ${context}】`);
    console.log("=".repeat(80));
    systemMessages.forEach((block, index) => {
      console.log(`\n--- Block ${index + 1} [${block.category}] ---`);
      console.log(block.content.substring(0, 200) + (block.content.length > 200 ? "..." : ""));
    });
    console.log("\n" + "=".repeat(80));
  }
}
