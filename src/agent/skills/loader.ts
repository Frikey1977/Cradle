/**
 * Skill 加载器
 * 负责从文件系统加载 Skill 并构建可执行对象
 *
 * Skill 物理路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */

import { readFile, access } from "fs/promises";
import { join } from "path";
import { parseSkill } from "./parser.js";
import type { ParsedSkill, SkillEntry } from "./types.js";

// 工作空间路径（从环境变量获取，与 system/skills/service.ts 保持一致）
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "f:\\Cradle workspace";
const SKILLS_DIR = process.env.SKILLS_DIR || "skills";

/**
 * 获取 Skill 安装路径
 * 路径规则：{workspace_dir}/skills/{slug}
 */
export function getSkillInstallPath(slug: string): string {
  return join(WORKSPACE_DIR, SKILLS_DIR, slug);
}

/**
 * 获取 SKILL.md 文件路径
 * 路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */
export function getSkillMdFilePath(slug: string): string {
  return join(getSkillInstallPath(slug), "SKILL.md");
}

/**
 * 从文件系统加载 Skill
 * @param skillPath - Skill 文件夹完整路径
 */
export async function loadSkillFromFile(skillPath: string): Promise<ParsedSkill | null> {
  try {
    const skillMdPath = join(skillPath, "SKILL.md");
    await access(skillMdPath);

    const content = await readFile(skillMdPath, "utf-8");
    const slug = skillPath.split("/").pop() || skillPath.split("\\").pop() || "unknown";

    return parseSkill(content, slug, skillPath);
  } catch {
    return null;
  }
}

/**
 * 根据 slug 加载 Skill
 * 路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */
export async function loadSkillBySlug(slug: string): Promise<ParsedSkill | null> {
  const skillPath = getSkillInstallPath(slug);
  const skillMdPath = join(skillPath, "SKILL.md");

  try {
    await access(skillMdPath);
    const content = await readFile(skillMdPath, "utf-8");
    return parseSkill(content, slug, skillPath);
  } catch {
    return null;
  }
}

/**
 * 从数据库 Skill 记录加载
 * 路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */
export async function loadSkillFromRecord(slug: string): Promise<ParsedSkill | null> {
  return loadSkillBySlug(slug);
}

/**
 * 构建 Skill 条目（用于 Agent 运行时）
 */
export function buildSkillEntry(parsedSkill: ParsedSkill, config?: Record<string, unknown>): SkillEntry {
  return {
    skill: {
      name: parsedSkill.name,
      description: parsedSkill.description,
      slug: parsedSkill.slug,
      content: parsedSkill.content,
    },
    frontmatter: {},
    metadata: parsedSkill.metadata,
    invocation: parsedSkill.invocation,
    config,
  };
}

/**
 * 验证 Skill 是否可用
 */
export function isSkillAvailable(skill: ParsedSkill, env: Record<string, string>): boolean {
  const { requires } = skill.metadata;

  if (!requires) {
    return true;
  }

  // 检查必需的环境变量
  if (requires.env) {
    for (const envVar of requires.env) {
      if (!env[envVar]) {
        return false;
      }
    }
  }

  // 检查必需的配置项
  if (requires.config) {
    // 配置项检查在运行时进行
    // 这里只检查 metadata 中是否有标记
  }

  return true;
}

/**
 * 获取 Skill 的系统提示词片段
 * 包含清晰的命令和参数说明，便于 LLM 识别
 */
export function buildSkillPrompt(skill: ParsedSkill): string {
  const lines: string[] = [];

  // Emoji 和名称
  const emoji = skill.metadata.emoji || "🔧";
  lines.push(`${emoji} **${skill.name}** (slug: \`${skill.slug}\`)`);
  lines.push("");

  // 描述
  if (skill.description) {
    lines.push(skill.description);
    lines.push("");
  }

  // 可用命令
  if (skill.commands.length > 0) {
    lines.push("**Available Commands:**");
    lines.push("");

    for (const cmd of skill.commands) {
      lines.push(`- \`${cmd.name}\`${cmd.description ? `: ${cmd.description}` : ""}`);

      if (cmd.parameters.length > 0) {
        lines.push("  Parameters:");
        for (const param of cmd.parameters) {
          const required = param.required ? "(required)" : "(optional)";
          lines.push(`    - \`${param.name}\`: ${param.description || "No description"} ${required}`);
        }
      }
    }
    lines.push("");
  }

  // 使用说明（仅包含 When to Use 部分，不包含完整文档）
  if (skill.whenToUse && skill.whenToUse.length > 0) {
    lines.push("**When to Use:**");
    lines.push("");
    for (const item of skill.whenToUse) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 构建多个 Skill 的系统提示词
 */
export function buildSkillsPrompt(skills: ParsedSkill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("# Available Skills");
  lines.push("");

  for (const skill of skills) {
    lines.push(buildSkillPrompt(skill));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
