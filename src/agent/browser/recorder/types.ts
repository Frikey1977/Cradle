/**
 * 浏览器操作录制器 - 记录用户操作用于 LLM 学习
 */

export interface RecordedAction {
  id: string;
  timestamp: number;
  type: ActionType;
  selector?: string;
  element?: ElementInfo;
  value?: string;
  url: string;
  pageTitle?: string;
  screenshot?: string;
  pageSnapshot?: PageSnapshot;
  strictMatch?: boolean;
}

export type ActionType =
  | "click"
  | "dblclick"
  | "input"
  | "keydown"
  | "scroll"
  | "navigate"
  | "select"
  | "hover"
  | "drag"
  | "paste"
  | "mousemove";

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  text?: string;
  ariaLabel?: string;
  href?: string;
  src?: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: Array<{
    selector: string;
    tagName: string;
    text?: string;
    role?: string;
    ariaLabel?: string;
  }>;
}

export interface RecordingSession {
  id: string;
  name?: string;
  description?: string;
  startTime: number;
  endTime?: number;
  actions: RecordedAction[];
  metadata: {
    profile: string;
    startUrl: string;
    tags?: string[];
  };
}

export interface RecorderConfig {
  captureScreenshot?: boolean;
  captureSnapshot?: boolean;
  ignoreSelectors?: string[];
  maxActions?: number;
}

export function generateActionId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function getDefaultStrictMatch(type: ActionType): boolean {
  switch (type) {
    case "click":
    case "dblclick":
    case "select":
      return true;
    case "hover":
    case "mousemove":
    case "scroll":
      return false;
    case "input":
    case "keydown":
    case "paste":
      return true;
    case "navigate":
    case "drag":
      return false;
    default:
      return true;
  }
}

export function createRecordedAction(
  type: ActionType,
  data: Partial<RecordedAction>
): RecordedAction {
  return {
    id: generateActionId(),
    timestamp: Date.now(),
    type,
    url: data.url || "",
    pageTitle: data.pageTitle,
    selector: data.selector,
    element: data.element,
    value: data.value,
    screenshot: data.screenshot,
    pageSnapshot: data.pageSnapshot,
    strictMatch: data.strictMatch ?? getDefaultStrictMatch(type),
  };
}

export function formatActionForLLM(action: RecordedAction): string {
  const parts: string[] = [];

  parts.push(`[${new Date(action.timestamp).toISOString()}]`);
  parts.push(`操作类型: ${action.type}`);

  if (action.url) {
    parts.push(`页面: ${action.url}`);
  }

  if (action.pageTitle) {
    parts.push(`页面标题: ${action.pageTitle}`);
  }

  if (action.type === "mousemove" && action.value) {
    try {
      const mouseData = JSON.parse(action.value);
      parts.push(`鼠标轨迹点数: ${mouseData.pointCount}`);
      if (mouseData.points && mouseData.points.length > 0) {
        const first = mouseData.points[0];
        const last = mouseData.points[mouseData.points.length - 1];
        parts.push(`起点: (${first.x}, ${first.y})`);
        parts.push(`终点: (${last.x}, ${last.y})`);
      }
    } catch {
      parts.push(`鼠标轨迹数据: ${action.value}`);
    }
    return parts.join("\n");
  }

  if (action.selector) {
    parts.push(`元素选择器: ${action.selector}`);
  }

  if (action.element) {
    const elem = action.element;
    const elemDesc: string[] = [];
    elemDesc.push(`标签: ${elem.tagName}`);
    if (elem.id) elemDesc.push(`ID: ${elem.id}`);
    if (elem.className) elemDesc.push(`类名: ${elem.className}`);
    if (elem.text) elemDesc.push(`文本: "${elem.text.substring(0, 50)}"`);
    if (elem.placeholder) elemDesc.push(`占位符: "${elem.placeholder}"`);
    if (elem.ariaLabel) elemDesc.push(`Aria标签: "${elem.ariaLabel}"`);
    if (elem.href) elemDesc.push(`链接: ${elem.href}`);
    parts.push(`元素信息: ${elemDesc.join(", ")}`);
  }

  if (action.value !== undefined) {
    parts.push(`输入值: "${action.value}"`);
  }

  if (action.strictMatch !== undefined) {
    parts.push(`严格匹配: ${action.strictMatch ? "是" : "否"}`);
  }

  return parts.join("\n");
}

export function formatSessionForLLM(session: RecordingSession): string {
  const lines: string[] = [];

  lines.push(`# 操作录制会话`);
  lines.push(``);

  if (session.name) {
    lines.push(`名称: ${session.name}`);
  }

  if (session.description) {
    lines.push(`描述: ${session.description}`);
  }

  lines.push(`开始时间: ${new Date(session.startTime).toISOString()}`);
  lines.push(`操作数量: ${session.actions.length}`);
  lines.push(`起始URL: ${session.metadata.startUrl}`);
  lines.push(``);

  lines.push(`## 操作序列`);
  lines.push(``);

  session.actions.forEach((action, index) => {
    lines.push(`### 操作 ${index + 1}`);
    lines.push(formatActionForLLM(action));
    lines.push(``);
  });

  return lines.join("\n");
}
