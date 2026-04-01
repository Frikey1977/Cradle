/**
 * 元素标记系统 - 类型定义
 * 
 * 用于人工标记页面互动元素，生成精准的配置文件
 */

/** 元素交互类型 */
export type ElementInteractionType = 
  | "click"      // 点击
  | "input"      // 输入
  | "hover"      // 悬停
  | "select"     // 选择
  | "submit"     // 提交
  | "scroll"     // 滚动
  | "drag"       // 拖拽
  | "focus"      // 聚焦
  | "other";     // 其他

/** 标记的元素信息 */
export interface MarkedElement {
  /** 元素引用ID，格式为 r1, r2, r3... */
  ref: string;
  
  /** 元素交互类型 */
  type: ElementInteractionType;
  
  /** 元素描述（人工输入） */
  description: string;
  
  /** 精准CSS选择器 */
  selector: string;
  
  /** 选择器类型 */
  selectorType: "css" | "xpath" | "id" | "data-attribute";
  
  /** 元素标签名 */
  tagName: string;
  
  /** 元素层级路径（面包屑） */
  breadcrumb: string[];
  
  /** 元素在页面中的位置 */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** 元素属性 */
  attributes: Record<string, string>;
  
  /** 元素文本内容 */
  text?: string;
  
  /** 占位符（input元素） */
  placeholder?: string;
  
  /** 是否为操作组的一部分 */
  isGroup?: boolean;
  
  /** 所属操作组ID */
  groupId?: string;
  
  /** 在操作组中的顺序 */
  groupOrder?: number;
  
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/** 操作组定义 */
export interface ActionGroup {
  /** 组ID */
  id: string;
  
  /** 组名称 */
  name: string;
  
  /** 组描述 */
  description: string;
  
  /** 组内元素引用列表（按执行顺序） */
  elementRefs: string[];
  
  /** 组执行间隔（毫秒） */
  delayBetweenActions?: number;
  
  /** 执行前等待条件 */
  preCondition?: {
    selector?: string;
    visible?: boolean;
    timeout?: number;
  };
  
  /** 执行后验证 */
  postValidation?: {
    selector?: string;
    textContains?: string;
    timeout?: number;
  };
}

/** 页面配置 */
export interface PageConfig {
  /** 页面URL匹配模式（支持通配符） */
  urlPattern: string;
  
  /** 页面类型标识 */
  pageType: string;
  
  /** 页面描述 */
  description: string;
  
  /** 标记的元素列表 */
  elements: MarkedElement[];
  
  /** 操作组定义 */
  actionGroups?: ActionGroup[];
  
  /** 页面特定脚本（注入页面执行） */
  pageScript?: string;
  
  /** 快照处理脚本 */
  snapshotScript?: string;
  
  /** 最后更新时间 */
  updatedAt: string;
  
  /** 版本号 */
  version: number;
}

/** 站点配置 */
export interface SiteConfig {
  /** 站点域名 */
  domain: string;
  
  /** 站点显示名称 */
  displayName: string;
  
  /** 站点描述 */
  description?: string;
  
  /** 页面配置列表 */
  pages: PageConfig[];
  
  /** 全局脚本（所有页面注入） */
  globalScript?: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 最后更新时间 */
  updatedAt: string;
  
  /** 版本号 */
  version: number;
}

/** 标记会话状态 */
export interface MarkingSession {
  /** 会话ID */
  id: string;
  
  /** 目标站点域名 */
  domain: string;
  
  /** 当前页面URL */
  currentUrl: string;
  
  /** 是否正在标记 */
  isActive: boolean;
  
  /** 已标记的元素 */
  elements: MarkedElement[];
  
  /** 当前操作组 */
  currentGroup?: ActionGroup;
  
  /** 元素计数器 */
  elementCounter: number;
  
  /** 开始时间 */
  startTime: number;
}

/** 标记器配置 */
export interface MarkerConfig {
  /** 触发键（默认右Alt） */
  triggerKey: string;
  
  /** 高亮颜色 */
  highlightColor: string;
  
  /** 已标记元素高亮颜色 */
  markedColor: string;
  
  /** 选择时高亮颜色 */
  selectedColor: string;
  
  /** 最大标记元素数 */
  maxElements: number;
  
  /** 配置文件保存路径 */
  configPath: string;
}

/** 元素标记结果 */
export interface ElementMarkResult {
  success: boolean;
  element?: MarkedElement;
  error?: string;
}

/** 快照增强结果 */
export interface EnhancedSnapshotResult {
  /** 原始快照内容 */
  originalSnapshot: string;
  
  /** 标记的元素列表（带ref索引） */
  markedElements: MarkedElement[];
  
  /** 可用的操作组 */
  actionGroups: ActionGroup[];
  
  /** 页面特定数据 */
  pageData?: Record<string, unknown>;
  
  /** 使用的配置 */
  config: SiteConfig | null;
}

/** 批处理操作请求 */
export interface BatchActionRequest {
  /** 操作组ID或元素引用列表 */
  actions: string[] | { ref: string; type: ElementInteractionType; value?: string }[];
  
  /** 执行间隔 */
  delayMs?: number;
  
  /** 超时时间 */
  timeoutMs?: number;
}

/** 批处理操作结果 */
export interface BatchActionResult {
  success: boolean;
  results: {
    ref: string;
    success: boolean;
    error?: string;
  }[];
}
