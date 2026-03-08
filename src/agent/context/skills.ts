/**
 * Context Skills 集成模块
 * 负责将 Skills 集成到 Agent 上下文中
 * 包括加载 Agent 的 Skills 和构建系统提示词
 *
 * 支持渐进式披露：
 * - Metadata 级：用于主 Agent 意图识别（不加载 tools）
 * - Body 级：用于 Executor 执行（加载指定 Skills 的 tools）
 */

import { getPositionSkills } from "../../organization/positions/service.js";
import { getSkillBySlug } from "../../system/skills/service.js";
import { loadSkillFromRecord, buildSkillPrompt } from "../skills/loader.js";
import type { ParsedSkill, SkillCommandDef } from "../skills/types.js";
import {
  SkillDisclosureManager,
  buildMetadataPrompt,
  buildBodyPrompt,
  type SkillMetadataInfo,
  type SkillBodyInfo,
  type IntentMatchResult,
} from "../skills/disclosure-manager.js";

export { SkillDisclosureManager, buildMetadataPrompt, buildBodyPrompt };
export type { SkillMetadataInfo, SkillBodyInfo, IntentMatchResult };

let disclosureManagerInstance: SkillDisclosureManager | null = null;

export function getDisclosureManager(): SkillDisclosureManager {
  if (!disclosureManagerInstance) {
    disclosureManagerInstance = new SkillDisclosureManager();
  }
  return disclosureManagerInstance;
}

export async function initializeDisclosureManager(agentId: string): Promise<SkillDisclosureManager> {
  const manager = getDisclosureManager();
  const skills = await loadAgentSkills(agentId);
  await manager.initialize(skills);
  return manager;
}

/**
 * 加载 Agent 的 Skills
 * 通过 Agent 的 position_id 获取关联的 Skills
 *
 * Skill 物理路径规则：{workspace_dir}/skills/{slug}/SKILL.md
 */
export async function loadAgentSkills(agentId: string): Promise<ParsedSkill[]> {
  // 1. 获取 Agent 的 position_id
  const { getAgentById } = await import("../../organization/agents/service.js");
  const agent = await getAgentById(agentId);

  if (!agent?.positionId) {
    return [];
  }

  // 2. 获取岗位的 Skill 配置
  const positionSkills = await getPositionSkills(agent.positionId);
  
  const skills: ParsedSkill[] = [];

  // 3. 加载每个 Skill
  for (const ps of positionSkills) {
    // 跳过禁用的 Skill
    if (ps.invocation === "disabled") {
      continue;
    }

    // 跳过没有 skillSlug 的配置
    if (!ps.skillSlug) {
      continue;
    }

    // 从数据库获取 Skill 记录（验证存在性和获取 slug）
    const skillRecord = await getSkillBySlug(ps.skillSlug);
    if (!skillRecord) {
      continue;
    }

    // 从文件系统加载 SKILL.md（路径规则：{workspace_dir}/skills/{slug}/SKILL.md）
    const { loadSkillBySlug } = await import("../skills/loader.js");
    const parsed = await loadSkillBySlug(skillRecord.slug);

    if (!parsed) {
      continue;
    }

    // 合并岗位级配置
    if (ps.config) {
      parsed.metadata = { ...parsed.metadata, ...ps.config };
    }

    skills.push(parsed);
  }

  return skills;
}

/**
 * 构建 Agent 的系统提示词（Metadata 级）
 * 用于主 Agent 的意图识别，不包含 tools
 */
export async function buildAgentSystemPrompt(
  agentId: string,
  basePrompt?: string,
): Promise<string> {
  const lines: string[] = [];

  // 基础提示词
  if (basePrompt) {
    lines.push(basePrompt);
    lines.push("");
  }

  // 加载 Skills
  const skills = await loadAgentSkills(agentId);

  if (skills.length > 0) {
    lines.push("# Your Skills");
    lines.push("");
    lines.push("You have access to the following skills. Use them when appropriate:");
    lines.push("");

    for (const skill of skills) {
      lines.push(buildSkillPrompt(skill));
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push("## How to Use Skills");
    lines.push("");
    lines.push("=== CRITICAL INSTRUCTIONS ===");
    lines.push("You are an AI assistant with access to external functions/tools.");
    lines.push("When a user asks for something that matches a function above, you MUST use that function.");
    lines.push("Do not answer directly - always use the appropriate function.");
    lines.push("===========================");
    lines.push("");
    lines.push("Rules:");
    lines.push("1. Read the user's request carefully");
    lines.push("2. Check if any available function matches the request");
    lines.push("3. If a function matches, YOU MUST CALL IT using the tools/function_call mechanism");
    lines.push("4. NEVER respond with plain text when a function is available for the task");
    lines.push("5. Functions are listed in the 'tools' section of this message");
    lines.push("");
    lines.push("EXACT MATCHING EXAMPLES:");
    lines.push("- User says 'ping' → MUST call: skill_test-echo_ping-test");
    lines.push("- User says 'echo hello world' → MUST call: skill_test-echo_echo-message with message='hello world'");
    lines.push("- User says 'reverse hello' → MUST call: skill_test-echo_reverse-text with text='hello'");
    lines.push("- User says 'count' → MUST call: skill_test-echo_count-characters");
    lines.push("");
    lines.push("⚠️ WARNING: If you respond with text instead of calling the function, you are not following instructions.");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 构建 Metadata 级系统提示词（用于主 Agent）
 * 只包含 Skill 名称、描述、使用场景，不包含 tools
 */
export async function buildMetadataSystemPrompt(
  agentId: string,
  basePrompt?: string,
): Promise<string> {
  const lines: string[] = [];

  if (basePrompt) {
    lines.push(basePrompt);
    lines.push("");
  }

  const manager = await initializeDisclosureManager(agentId);
  const metadataList = manager.getAllMetadata();
  const metadataPrompt = buildMetadataPrompt(metadataList);

  if (metadataPrompt) {
    lines.push(metadataPrompt);
  }

  return lines.join("\n");
}

/**
 * 构建 Executor 系统提示词（Body 级）
 * 包含指定 Skills 的完整命令和参数
 */
export async function buildExecutorSystemPrompt(
  skillSlugs: string[],
  basePrompt?: string,
): Promise<string> {
  const lines: string[] = [];

  if (basePrompt) {
    lines.push(basePrompt);
    lines.push("");
  }

  const manager = getDisclosureManager();
  const bodyList = manager.discloseToBody(skillSlugs, "Executor request");
  const bodyPrompt = buildBodyPrompt(bodyList);

  if (bodyPrompt) {
    lines.push(bodyPrompt);
  }

  return lines.join("\n");
}

/**
 * 将 Skills 转换为 Tool 定义（用于 Executor）
 * 每个 command 作为一个独立的 tool
 */
export function convertSkillsToTools(skills: ParsedSkill[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  const tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> = [];

  for (const skill of skills) {
    for (const cmd of skill.commands) {
      tools.push({
        type: "function",
        function: {
          name: `skill_${skill.slug}_${cmd.name}`,
          description: `${skill.description}\n\nCommand: ${cmd.description || cmd.name}`,
          parameters: {
            type: "object",
            properties: cmd.parameters.reduce((acc, param) => {
              acc[param.name] = {
                type: param.type,
                description: param.description || `Parameter: ${param.name}`,
              };
              return acc;
            }, {} as Record<string, unknown>),
            required: cmd.parameters.filter((p) => p.required).map((p) => p.name),
          },
        },
      });
    }
  }

  return tools;
}

/**
 * 根据意图匹配获取 Tools
 * 用于 Executor 按需加载
 */
export async function getToolsForIntent(
  agentId: string,
  userMessage: string,
): Promise<{
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  matchedSkills: string[];
  intentResult: IntentMatchResult;
}> {
  const manager = await initializeDisclosureManager(agentId);
  const intentResult = manager.matchIntent(userMessage);

  let tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> = [];

  if (intentResult.matched) {
    const bodyList = manager.discloseToBody(intentResult.skillSlugs, `Intent match: ${intentResult.reason}`);
    const skills = intentResult.skillSlugs
      .map((slug) => {
        const body = bodyList.find((b) => b.slug === slug);
        if (!body) return null;
        return {
          slug,
          name: body.name,
          description: body.description,
          metadata: { emoji: body.emoji },
          content: body.content,
          commands: body.commands,
          invocation: { userInvocable: true, disableModelInvocation: false },
          baseDir: "",
        } as ParsedSkill;
      })
      .filter((s): s is ParsedSkill => s !== null);

    tools = convertSkillsToTools(skills);
  }

  return {
    tools,
    matchedSkills: intentResult.skillSlugs,
    intentResult,
  };
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
  const skills = await loadAgentSkills(agentId);

  return skills.map((skill) => ({
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    emoji: skill.metadata.emoji,
  }));
}
