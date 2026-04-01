/**
 * Skill 加载器
 * 统一从 SKILLS_DIR 加载 skill
 */

import { readFile, access, readdir } from "fs/promises";
import { join, basename } from "path";
import { platform, homedir } from "os";
import { existsSync } from "fs";
import { parseSkillFrontmatter } from "./parser.js";
import type { SkillEntry, SkillMetadata, SkillInvocationPolicy } from "./types.js";

export interface SkillLoaderOptions {
  /** Skill 目录路径，默认从 SKILLS_DIR 环境变量获取 */
  skillsDir?: string;
  /** 可选的 skill 名称过滤列表 */
  skillFilter?: string[];
}

export interface SkillLoadContext {
  os: string;
  availableBins: string[];
  env: Record<string, string>;
  config: Record<string, unknown>;
}

const DEFAULT_MAX_SKILL_FILE_BYTES = 256_000;

function getPlatform(): string {
  const p = platform();
  if (p === "win32") return "win32";
  if (p === "darwin") return "darwin";
  return "linux";
}

function compactPath(filePath: string): string {
  const home = homedir();
  if (!home) return filePath;
  const prefix = home.endsWith("/") || home.endsWith("\\") ? home : home + "/";
  if (filePath.startsWith(prefix)) {
    return "~/" + filePath.slice(prefix.length);
  }
  return filePath;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function loadSkillFromDir(dir: string, source: string): Promise<SkillEntry | null> {
  const skillMdPath = join(dir, "SKILL.md");

  try {
    if (!existsSync(skillMdPath)) {
      return null;
    }

    const stat = await access(skillMdPath).then(() => true).catch(() => false);
    if (!stat) {
      return null;
    }

    const content = await readFile(skillMdPath, "utf-8");
    const parsed = parseSkillFrontmatter(content);

    if (!parsed.name) {
      return null;
    }

    return {
      name: parsed.name,
      description: parsed.description || "",
      location: compactPath(skillMdPath),
      filePath: skillMdPath,
      baseDir: dir,
      source: source as SkillEntry["source"],
      frontmatter: parsed.frontmatter,
      metadata: parsed.metadata,
      invocation: parsed.invocation,
    };
  } catch {
    return null;
  }
}

async function loadSkillsFromDirectory(
  baseDir: string,
  source: string,
  maxSkills: number = 200
): Promise<SkillEntry[]> {
  if (!existsSync(baseDir)) {
    return [];
  }

  const skills: SkillEntry[] = [];

  try {
    const entries = await readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skills.length >= maxSkills) break;

      const skillDir = join(baseDir, entry.name);
      const skill = await loadSkillFromDir(skillDir, source);

      if (skill) {
        skills.push(skill);
      }
    }
  } catch {
    return [];
  }

  return skills;
}

function checkSkillEligibility(entry: SkillEntry, context: SkillLoadContext): boolean {
  const metadata = entry.metadata;

  if (!metadata) {
    return true;
  }

  if (metadata.always === true) {
    return true;
  }

  if (metadata.os && Array.isArray(metadata.os)) {
    if (!metadata.os.includes(context.os)) {
      return false;
    }
  }

  if (metadata.requires) {
    if (metadata.requires.bins && Array.isArray(metadata.requires.bins)) {
      for (const bin of metadata.requires.bins) {
        if (!context.availableBins.includes(bin)) {
          return false;
        }
      }
    }

    if (metadata.requires.anyBins && Array.isArray(metadata.requires.anyBins)) {
      const hasAny = metadata.requires.anyBins.some(bin => context.availableBins.includes(bin));
      if (!hasAny) {
        return false;
      }
    }

    if (metadata.requires.env && Array.isArray(metadata.requires.env)) {
      for (const envVar of metadata.requires.env) {
        if (!context.env[envVar] && !context.config[`skills.entries.${entry.name}.env.${envVar}`]) {
          return false;
        }
      }
    }

    if (metadata.requires.config && Array.isArray(metadata.requires.config)) {
      for (const configPath of metadata.requires.config) {
        const value = context.config[configPath];
        if (!value) {
          return false;
        }
      }
    }
  }

  return true;
}

export async function loadSkillEntries(
  options: SkillLoaderOptions = {},
  context: SkillLoadContext = {
    os: getPlatform(),
    availableBins: [],
    env: process.env as Record<string, string>,
    config: {},
  }
): Promise<SkillEntry[]> {
  let {
    skillsDir = process.env.SKILLS_DIR || join(process.cwd(), "workspace", "skills"),
    skillFilter,
  } = options;

  // 如果是相对路径，转换为绝对路径
  if (!skillsDir.startsWith("/") && !skillsDir.match(/^[A-Za-z]:/)) {
    skillsDir = join(process.cwd(), skillsDir);
  }

  // 只从指定的 skillsDir 加载
  const entries = await loadSkillsFromDirectory(skillsDir, "workspace");

  // 过滤符合条件的 skill
  let filteredEntries = entries.filter(entry => checkSkillEligibility(entry, context));

  if (skillFilter && skillFilter.length > 0) {
    const normalizedFilter = skillFilter.map(s => s.toLowerCase());
    filteredEntries = filteredEntries.filter(entry => normalizedFilter.includes(entry.name.toLowerCase()));
  }

  return filteredEntries;
}

export function buildSkillsPrompt(entries: SkillEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  const lines: string[] = [
    "<available_skills>",
  ];

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

export function buildSkillsSection(entries: SkillEntry[], readToolName: string = "read"): string {
  if (entries.length === 0) {
    return "";
  }

  const skillsPrompt = buildSkillsPrompt(entries);

  return [
    "## Skills (CRITICAL - MUST READ)",
    "",
    "You have access to specialized skills listed in <available_skills> below. These skills provide expert capabilities for specific tasks.",
    "",
    "**MANDATORY RULE: When a user request matches ANY skill's description, you MUST call the `executor` tool immediately.**",
    "",
    "### Decision Process:",
    "1. Read each skill's <description> in <available_skills>",
    "2. If user's request matches ANY skill description → STOP and call `executor` tool",
    "3. If no skill matches → respond normally without tools",
    "",
    "### How to use executor tool:",
    "- `skillName`: Set to the exact skill name from <name> tag (e.g., \"pptx\", \"pdf\", \"docx\")",
    "- `taskDescription`: Describe what the user wants to accomplish",
    "",
    "**DO NOT** respond with text like \"I will create...\" or \"Let me help you...\" - **CALL THE TOOL INSTEAD**.",
    "",
    "**IMPORTANT**: Skills are NOT direct tools. You must use the `executor` tool to invoke a skill. Never call a skill name directly as a tool.",
    "",
    skillsPrompt,
    "",
  ].join("\n");
}

export function getSkillInstallPath(slug: string, skillsDir?: string): string {
  const base = skillsDir || process.env.SKILLS_DIR || join(process.cwd(), "workspace", "skills");
  return join(base, slug);
}

export async function loadSkillBySlug(
  slug: string,
  skillsDir?: string
): Promise<SkillEntry | null> {
  const skillDir = getSkillInstallPath(slug, skillsDir);
  return loadSkillFromDir(skillDir, "direct");
}

export async function readSkillContent(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}