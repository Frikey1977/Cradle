/**
 * Skill 渐进式披露管理器
 *
 * 实现三级披露策略：
 * - Metadata: 名称、描述、When to Use（始终可见）
 * - Body: 完整命令列表和参数（触发后可见）
 * - Full: 完整内容（执行时可见）
 *
 * 配合主Agent/Executor架构：
 * - 主Agent只看到 Metadata 级信息，用于意图识别
 * - Executor 根据意图加载 Body/Full 级信息，执行任务
 */

import type { ParsedSkill, SkillCommandDef } from "./types.js";

/**
 * 披露级别
 */
export type DisclosureLevel = "metadata" | "body" | "full";

/**
 * Skill 披露状态
 */
export interface SkillDisclosureState {
  slug: string;
  level: DisclosureLevel;
  disclosedAt: Date;
  triggerReason?: string;
}

/**
 * 披露配置
 */
export interface DisclosureConfig {
  maxBodySkills: number;
  maxFullSkills: number;
  autoDiscloseKeywords: string[];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: DisclosureConfig = {
  maxBodySkills: 5,
  maxFullSkills: 2,
  autoDiscloseKeywords: [],
};

/**
 * Skill Metadata 级信息（用于主Agent意图识别）
 */
export interface SkillMetadataInfo {
  slug: string;
  name: string;
  description: string;
  emoji?: string;
  whenToUse?: string[];
  keywords: string[];
}

/**
 * Skill Body 级信息（用于 Executor 执行）
 */
export interface SkillBodyInfo extends SkillMetadataInfo {
  commands: SkillCommandDef[];
  content: string;
}

/**
 * 意图识别结果
 */
export interface IntentMatchResult {
  matched: boolean;
  skillSlugs: string[];
  confidence: number;
  reason: string;
}

/**
 * Skill 渐进式披露管理器
 */
export class SkillDisclosureManager {
  private skills: Map<string, ParsedSkill> = new Map();
  private disclosureStates: Map<string, SkillDisclosureState> = new Map();
  private config: DisclosureConfig;
  private metadataCache: Map<string, SkillMetadataInfo> = new Map();

  constructor(config: Partial<DisclosureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化：加载所有 Skill
   */
  async initialize(skills: ParsedSkill[]): Promise<void> {
    this.skills.clear();
    this.disclosureStates.clear();
    this.metadataCache.clear();

    for (const skill of skills) {
      this.skills.set(skill.slug, skill);
      this.metadataCache.set(skill.slug, this.extractMetadata(skill));
    }

    console.log(`[SkillDisclosureManager] Initialized with ${skills.length} skills`);
  }

  /**
   * 提取 Skill Metadata 级信息
   */
  private extractMetadata(skill: ParsedSkill): SkillMetadataInfo {
    const keywords = this.extractKeywords(skill);

    return {
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      emoji: skill.metadata.emoji,
      whenToUse: skill.whenToUse,
      keywords,
    };
  }

  /**
   * 从 Skill 中提取关键词
   */
  private extractKeywords(skill: ParsedSkill): string[] {
    const keywords = new Set<string>();

    keywords.add(skill.name.toLowerCase());
    keywords.add(skill.slug.toLowerCase());

    const nameWords = skill.name.toLowerCase().split(/\s+/);
    nameWords.forEach((w) => keywords.add(w));

    if (skill.whenToUse) {
      skill.whenToUse.forEach((item) => {
        const words = item.toLowerCase().split(/\s+/);
        words.forEach((w) => {
          if (w.length > 2) keywords.add(w);
        });
      });
    }

    if (skill.description) {
      const words = skill.description.toLowerCase().split(/\s+/);
      words.forEach((w) => {
        if (w.length > 3) keywords.add(w);
      });
    }

    for (const cmd of skill.commands) {
      keywords.add(cmd.name.toLowerCase());
      const cmdWords = cmd.name.toLowerCase().split(/[-_]/);
      cmdWords.forEach((w) => keywords.add(w));
    }

    return Array.from(keywords);
  }

  /**
   * 获取所有 Skill 的 Metadata 级信息
   * 用于主 Agent 的意图识别
   */
  getAllMetadata(): SkillMetadataInfo[] {
    return Array.from(this.metadataCache.values());
  }

  /**
   * 意图匹配：根据用户消息识别需要的 Skills
   */
  matchIntent(userMessage: string): IntentMatchResult {
    const message = userMessage.toLowerCase();
    const matchedSlugs: string[] = [];
    let maxConfidence = 0;
    let matchReason = "";

    for (const [slug, metadata] of this.metadataCache) {
      let confidence = 0;
      let reason = "";

      if (message.includes(metadata.name.toLowerCase())) {
        confidence = 0.9;
        reason = `名称匹配: ${metadata.name}`;
      }

      if (metadata.whenToUse) {
        for (const scenario of metadata.whenToUse) {
          const scenarioWords = scenario.toLowerCase().split(/\s+/);
          const matchCount = scenarioWords.filter((w) => message.includes(w)).length;
          if (matchCount > 0) {
            const scenarioConfidence = Math.min(0.8, matchCount / scenarioWords.length + 0.3);
            if (scenarioConfidence > confidence) {
              confidence = scenarioConfidence;
              reason = `场景匹配: ${scenario}`;
            }
          }
        }
      }

      for (const keyword of metadata.keywords) {
        if (message.includes(keyword) && keyword.length > 3) {
          const keywordConfidence = 0.5 + keyword.length / 20;
          if (keywordConfidence > confidence) {
            confidence = Math.min(0.7, keywordConfidence);
            reason = `关键词匹配: ${keyword}`;
          }
        }
      }

      if (confidence >= 0.4) {
        matchedSlugs.push(slug);
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          matchReason = reason;
        }
      }
    }

    return {
      matched: matchedSlugs.length > 0,
      skillSlugs: matchedSlugs,
      confidence: maxConfidence,
      reason: matchReason,
    };
  }

  /**
   * 披露到 Body 级别
   * 用于 Executor 加载需要的 Skills
   */
  discloseToBody(skillSlugs: string[], reason?: string): SkillBodyInfo[] {
    const result: SkillBodyInfo[] = [];
    const currentBodyCount = this.countByLevel("body");

    for (const slug of skillSlugs) {
      if (currentBodyCount + result.length >= this.config.maxBodySkills) {
        console.warn(
          `[SkillDisclosureManager] Max body skills reached (${this.config.maxBodySkills}), skipping ${slug}`
        );
        break;
      }

      const skill = this.skills.get(slug);
      if (!skill) {
        console.warn(`[SkillDisclosureManager] Skill not found: ${slug}`);
        continue;
      }

      const metadata = this.metadataCache.get(slug)!;
      result.push({
        ...metadata,
        commands: skill.commands,
        content: skill.content,
      });

      this.disclosureStates.set(slug, {
        slug,
        level: "body",
        disclosedAt: new Date(),
        triggerReason: reason,
      });
    }

    console.log(
      `[SkillDisclosureManager] Disclosed ${result.length} skills to body level: ${result.map((s) => s.slug).join(", ")}`
    );

    return result;
  }

  /**
   * 披露到 Full 级别
   * 用于实际执行时加载完整内容
   */
  discloseToFull(skillSlug: string, reason?: string): ParsedSkill | null {
    const currentFullCount = this.countByLevel("full");

    if (currentFullCount >= this.config.maxFullSkills) {
      console.warn(
        `[SkillDisclosureManager] Max full skills reached (${this.config.maxFullSkills}), cannot disclose ${skillSlug}`
      );
      return null;
    }

    const skill = this.skills.get(skillSlug);
    if (!skill) {
      console.warn(`[SkillDisclosureManager] Skill not found: ${skillSlug}`);
      return null;
    }

    this.disclosureStates.set(skillSlug, {
      slug: skillSlug,
      level: "full",
      disclosedAt: new Date(),
      triggerReason: reason,
    });

    console.log(`[SkillDisclosureManager] Disclosed ${skillSlug} to full level`);

    return skill;
  }

  /**
   * 获取已披露的 Skills
   */
  getDisclosedSkills(level?: DisclosureLevel): SkillDisclosureState[] {
    const states = Array.from(this.disclosureStates.values());
    if (level) {
      return states.filter((s) => s.level === level);
    }
    return states;
  }

  /**
   * 统计指定级别的 Skill 数量
   */
  private countByLevel(level: DisclosureLevel): number {
    return Array.from(this.disclosureStates.values()).filter((s) => s.level === level).length;
  }

  /**
   * 重置披露状态（用于新会话）
   */
  reset(): void {
    this.disclosureStates.clear();
    console.log(`[SkillDisclosureManager] Disclosure states reset`);
  }

  /**
   * 获取 Skill 的披露状态
   */
  getDisclosureState(skillSlug: string): SkillDisclosureState | undefined {
    return this.disclosureStates.get(skillSlug);
  }

  /**
   * 检查 Skill 是否已披露
   */
  isDisclosed(skillSlug: string, minLevel?: DisclosureLevel): boolean {
    const state = this.disclosureStates.get(skillSlug);
    if (!state) return false;

    if (!minLevel) return true;

    const levels: DisclosureLevel[] = ["metadata", "body", "full"];
    const currentIndex = levels.indexOf(state.level);
    const minIndex = levels.indexOf(minLevel);

    return currentIndex >= minIndex;
  }
}

/**
 * 构建 Metadata 级系统提示词
 * 用于主 Agent 的意图识别
 */
export function buildMetadataPrompt(metadataList: SkillMetadataInfo[]): string {
  if (metadataList.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("# Available Skills");
  lines.push("");
  lines.push("You have access to these skills. Use them when appropriate:");
  lines.push("");

  for (const meta of metadataList) {
    const emoji = meta.emoji || "🔧";
    lines.push(`- **${emoji} ${meta.name}**: ${meta.description || meta.slug}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("When a user request matches a skill, call the appropriate tool function.");

  return lines.join("\n");
}

/**
 * 构建 Body 级系统提示词
 * 用于 Executor 的任务执行
 */
export function buildBodyPrompt(bodyList: SkillBodyInfo[]): string {
  if (bodyList.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("# Available Skills (Full Details)");
  lines.push("");
  lines.push("You are an executor with access to the following skills. Execute tasks using the available tools:");
  lines.push("");

  for (const body of bodyList) {
    const emoji = body.emoji || "🔧";
    lines.push(`## ${emoji} ${body.name} (\`${body.slug}\`)`);
    if (body.description) {
      lines.push(body.description);
    }

    if (body.commands.length > 0) {
      lines.push("");
      lines.push("**Commands:**");
      for (const cmd of body.commands) {
        lines.push(`- \`${cmd.name}\`: ${cmd.description || "No description"}`);
        if (cmd.parameters.length > 0) {
          const params = cmd.parameters
            .map((p) => `${p.name}${p.required ? "*" : ""}`)
            .join(", ");
          lines.push(`  Parameters: ${params}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
