/**
 * Skill 调用器
 * 负责执行 Skill 命令
 */

import { executeSkillCommand } from "./executor.js";
import type { ParsedSkill, SkillExecutionContext, SkillExecutionResult } from "./types.js";

/**
 * Agent Skill 调用结果
 */
export type SkillInvokeResult =
  | {
      success: true;
      output: string;
      duration: number;
    }
  | {
      success: false;
      error: string;
      duration: number;
    };

/**
 * 调用 Skill
 *
 * Skill 物理路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */
export async function invokeSkill(
  agentId: string,
  skillSlug: string,
  commandName: string,
  params: Record<string, unknown>,
  context?: Partial<SkillExecutionContext>,
): Promise<SkillInvokeResult> {
  const startTime = Date.now();

  try {
    // 1. 从文件系统加载 Skill（路径规则：{workspace_dir}/skills/{slug}/SKILL.md）
    const { loadSkillBySlug } = await import("./loader.js");
    const skill = await loadSkillBySlug(skillSlug);

    if (!skill) {
      return {
        success: false,
        error: `Skill "${skillSlug}" not found at ${process.env.WORKSPACE_DIR || "f:\\Cradle workspace"}\\skills\\${skillSlug}\\SKILL.md`,
        duration: Date.now() - startTime,
      };
    }

    // 2. 构建执行上下文
    const executionContext: SkillExecutionContext = {
      agentId,
      workspaceDir: context?.workspaceDir || process.cwd(),
      env: { ...process.env, ...context?.env } as Record<string, string>,
      config: context?.config,
    };

    // 3. 执行命令
    const result = await executeSkillCommand(skill, commandName, params, executionContext);

    if (result.success) {
      return {
        success: true,
        output: result.output,
        duration: result.duration,
      };
    } else {
      return {
        success: false,
        error: result.error || `Command failed with exit code ${result.exitCode}`,
        duration: result.duration,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 验证 Skill 是否可用于 Agent
 */
export async function isSkillAvailableForAgent(agentId: string, skillSlug: string): Promise<boolean> {
  const { loadAgentSkills } = await import("../context/skills.js");
  const skills = await loadAgentSkills(agentId);
  return skills.some((s) => s.slug === skillSlug);
}

/**
 * 获取 Agent 可用的 Skill 列表
 */
export async function getAgentAvailableSkills(agentId: string): Promise<
  Array<{
    slug: string;
    name: string;
    description: string;
    emoji?: string;
  }>
> {
  const { loadAgentSkills } = await import("../context/skills.js");
  const skills = await loadAgentSkills(agentId);

  return skills.map((skill) => ({
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    emoji: skill.metadata.emoji,
  }));
}
