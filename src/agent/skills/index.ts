/**
 * Skill 模块入口
 * 导出所有 Skill 相关功能
 */

// 类型定义
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
} from "./types.js";

// 解析器
export { parseSkill, parseInstallSpec } from "./parser.js";

// 加载器
export {
  loadSkillFromFile,
  loadSkillBySlug,
  loadSkillFromRecord,
  buildSkillEntry,
  isSkillAvailable,
  buildSkillPrompt,
  buildSkillsPrompt,
  // 路径工具
  getSkillInstallPath,
  getSkillMdFilePath,
} from "./loader.js";

// 执行器
export { executeSkillCommand, executeRawCommand } from "./executor.js";

// Skill 调用器
export {
  invokeSkill,
  isSkillAvailableForAgent,
  getAgentAvailableSkills,
  type SkillInvokeResult,
} from "./invoker.js";

// 渐进式披露管理器
export {
  SkillDisclosureManager,
  buildMetadataPrompt,
  buildBodyPrompt,
  type DisclosureLevel,
  type SkillDisclosureState,
  type DisclosureConfig,
  type SkillMetadataInfo,
  type SkillBodyInfo,
  type IntentMatchResult,
} from "./disclosure-manager.js";
