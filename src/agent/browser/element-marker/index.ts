/**
 * 元素标记系统 - 模块导出
 * 
 * 提供人工标记页面互动元素的能力，生成精准的配置文件
 * 支持快照增强和操作组批处理
 */

// 类型定义
export type {
  ElementInteractionType,
  MarkedElement,
  ActionGroup,
  PageConfig,
  SiteConfig,
  MarkingSession,
  MarkerConfig,
  ElementMarkResult,
  EnhancedSnapshotResult,
  BatchActionRequest,
  BatchActionResult,
} from "./types.js";

// 配置管理
export { ElementConfigManager, globalConfigManager } from "./config-manager.js";

// 快照增强
export { SnapshotEnhancer, globalSnapshotEnhancer } from "./snapshot-enhancer.js";

// 标记脚本
export { getElementMarkerScript, ELEMENT_MARKER_SCRIPT } from "./marker-script.js";
