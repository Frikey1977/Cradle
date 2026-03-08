/**
 * Agent 上下文模块
 *
 * 导出上下文相关类
 */

// 新的 ContextManager（推荐）
export { ContextManager } from "./context-manager.js";

// 画像加载器
export { ProfileLoader } from "./profile-loader.js";

// 系统提示词构建器
export { SystemPromptBuilder } from "./system-prompt-builder.js";

// 兼容旧代码的别名
/** @deprecated 使用 ContextManager 替代 */
export { ContextModule } from "./context-manager.js";
