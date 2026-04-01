/**
 * Skill 模块入口
 * 导出所有 Skill 相关功能
 *
 * 采用 OpenClaw 兼容的 LLM 理解执行模式
 */

export type {
  SkillInstallSpec,
  SkillMetadata,
  SkillInvocationPolicy,
  ParsedSkillFrontmatter,
  SkillCommandSpec,
  SkillEntry,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillParameterDef,
  SkillCommandDef,
  ParsedSkill,
  SkillSnapshot,
} from "./types.js";

export { parseSkill, parseInstallSpec, parseSkillFrontmatter } from "./parser.js";

export {
  loadSkillEntries,
  buildSkillsPrompt,
  buildSkillsSection,
  getSkillInstallPath,
  loadSkillBySlug,
  readSkillContent,
  type SkillLoaderOptions,
  type SkillLoadContext,
} from "./loader.js";