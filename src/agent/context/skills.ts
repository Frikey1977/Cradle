/**
 * Context Skills 集成模块
 * 负责将 Skills 集成到 Agent 上下文中
 *
 * 采用 OpenClaw 兼容的 LLM 理解执行模式：
 * - 只注入 Skill 列表（name + description + location）
 * - LLM 通过 read 工具读取完整 SKILL.md
 * - LLM 理解后自主决定如何执行
 */

import { getPositionSkills } from "../../organization/positions/service.js";
import { getSkillBySlug } from "../../system/skills/service.js";
import {
  loadSkillEntries,
  buildSkillsSection,
  loadSkillBySlug,
  readSkillContent,
  type SkillEntry,
  type SkillLoaderOptions,
} from "../skills/index.js";
import { join } from "path";

export type { SkillEntry, SkillLoaderOptions };

export async function loadAgentSkillEntries(
  agentId: string,
  options?: Partial<SkillLoaderOptions>
): Promise<SkillEntry[]> {
  const { getAgentById } = await import("../../organization/agents/service.js");
  const agent = await getAgentById(agentId);

  console.log(`[Skills] Loading skills for agent ${agentId}, positionId: ${agent?.positionId}`);

  if (!agent?.positionId) {
    console.log(`[Skills] No positionId found for agent ${agentId}`);
    return [];
  }

  const positionSkills = await getPositionSkills(agent.positionId);
  console.log(`[Skills] Found ${positionSkills.length} position skills from DB:`, positionSkills.map(ps => ({ slug: ps.skillSlug, invocation: ps.invocation })));

  const skillSlugs = positionSkills
    .filter(ps => ps.invocation !== "disabled" && ps.skillSlug)
    .map(ps => ps.skillSlug!);

  console.log(`[Skills] Filtered skill slugs:`, skillSlugs);

  if (skillSlugs.length === 0) {
    console.log(`[Skills] No enabled skills found`);
    return [];
  }

  // 只从 SKILLS_DIR 加载 skill，不再从 skills-main 加载
  const allEntries = await loadSkillEntries({
    ...options,
    skillFilter: skillSlugs,
  });

  console.log(`[Skills] Loaded ${allEntries.length} skill entries:`, allEntries.map(e => e.name));

  return allEntries;
}

export async function buildAgentSkillsSection(
  agentId: string,
  readToolName: string = "read"
): Promise<string> {
  // 只从agent position加载skills，不再回退到所有可用skills
  const entries = await loadAgentSkillEntries(agentId);
  
  console.log(`[buildAgentSkillsSection] Agent ${agentId}: built section with ${entries.length} skills:`, entries.map(e => e.name));
  
  return buildSkillsSection(entries, readToolName);
}

export async function loadSkillEntryBySlug(slug: string): Promise<SkillEntry | null> {
  return loadSkillBySlug(slug);
}

export async function getSkillContent(filePath: string): Promise<string> {
  return readSkillContent(filePath);
}

export function buildSkillsPromptFromEntries(entries: SkillEntry[]): string {
  const lines: string[] = ["<available_skills>"];

  for (const entry of entries) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(entry.name)}</name>`);
    lines.push(`    <description>${escapeXml(entry.description)}</description>`);
    lines.push(`    <location>${escapeXml(entry.location)}</location>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");
  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export {
  buildSkillsSection,
  loadSkillEntries,
};