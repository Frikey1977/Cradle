/**
 * Agent 上下文模块
 *
 * 导出上下文相关类
 */

export { ContextManager } from "./context-manager.js";

export { ProfileLoader } from "./profile-loader.js";

export {
  SystemPromptBuilder,
  type SystemMessageCategory,
  type SystemPromptBlocks,
} from "./system-prompt-builder.js";

export {
  loadAgentSkillEntries,
  buildAgentSkillsSection,
  loadSkillEntryBySlug,
  getSkillContent,
  buildSkillsPromptFromEntries,
  buildSkillsSection,
  loadSkillEntries,
  type SkillEntry,
  type SkillLoaderOptions,
} from "./skills.js";

export {
  buildEnvironmentInfo,
  formatEnvironmentBlock,
  type EnvironmentInfo,
  type EnvironmentConfig,
} from "./environment.js";