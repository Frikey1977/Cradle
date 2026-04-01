/**
 * 浏览器自动化模块 - 类型定义
 */

import type { Browser, BrowserContext, Page } from "playwright-core";

// ============================================================================
// 配置类型
// ============================================================================

export interface BrowserConfig {
  enabled: boolean;
  controlPort: number;
  auth?: BrowserControlAuth;
  ssrf?: SSRFPolicy;
  profiles: Record<string, BrowserProfile>;
}

export interface BrowserControlAuth {
  token?: string;
  password?: string;
}

export interface SSRFPolicy {
  allowPrivateHosts?: boolean;
  allowLocalhost?: boolean;
  allowList?: string[];
  denyList?: string[];
}

export type BrowserProfile =
  | LocalBrowserProfile
  | ExistingSessionProfile
  | RemoteCdpProfile;

export interface LocalBrowserProfile {
  driver: "local-managed";
  cdpPort?: number;
  cdpUrl?: string;
  userDataDir?: string;
  executablePath?: string;
  headless?: boolean;
  color?: string;
}

export interface ExistingSessionProfile {
  driver: "existing-session";
  userDataDir?: string;
  color?: string;
  attachOnly: true;
}

export interface RemoteCdpProfile {
  driver: "remote-cdp";
  cdpUrl: string;
  color?: string;
}

export type ResolvedBrowserProfile = BrowserProfile & {
  name: string;
};

export interface ResolvedBrowserConfig {
  enabled: boolean;
  controlPort: number;
  auth: BrowserControlAuth;
  ssrf: SSRFPolicy;
  profiles: Record<string, ResolvedBrowserProfile>;
  defaultProfile: string;
}

// ============================================================================
// 运行时状态类型
// ============================================================================

export interface BrowserServerState {
  server: import("http").Server;
  port: number;
  resolved: ResolvedBrowserConfig;
  profiles: Map<string, ProfileRuntimeState>;
  startTime: number;
}

export interface ProfileRuntimeState {
  profile: ResolvedBrowserProfile;
  running: RunningBrowser | null;
  lastTargetId: string | null;
  pageStates: Map<string, PageState>;
}

export interface RunningBrowser {
  browser: Browser;
  context: BrowserContext;
  pages: Map<string, Page>;
  startTime: number;
}

export interface MarkedElement {
  ref: string;
  type: string;
  selector: string;
  description: string;
}

export interface PageState {
  console: BrowserConsoleMessage[];
  errors: BrowserPageError[];
  requests: BrowserNetworkRequest[];
  roleRefs: Record<string, RoleRef>;
  roleRefsMode: "role" | "aria";
  markedElements: Record<string, MarkedElement>;
}

// ============================================================================
// 标签页类型
// ============================================================================

export interface BrowserTab {
  targetId: string;
  url: string;
  title: string;
  active: boolean;
  profile: string;
}

// ============================================================================
// 快照类型
// ============================================================================

export interface RoleRef {
  role: string;
  name?: string;
  ref: string;
  children?: RoleRef[];
}

export interface SnapshotAriaResult {
  elements: AriaElement[];
  pageText: string;
}

export interface AriaElement {
  ref: string;
  role: string;
  name: string;
  value?: string;
  description?: string;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  children?: AriaElement[];
}

export interface SnapshotAiResult {
  elements: AiElement[];
  pageText: string;
}

export interface AiElement {
  ref: string;
  type: string;
  text?: string;
}

export interface SnapshotRoleResult {
  elements: RoleRef[];
  pageText: string;
}

// ============================================================================
// 操作选项类型
// ============================================================================

export interface NavigateOptions {
  timeoutMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

export interface SnapshotOptions {
  format?: "ai" | "aria" | "role";
  selector?: string;
  limit?: number;
}

export interface ClickOptions {
  button?: "left" | "right" | "middle";
  clickCount?: number;
  delayMs?: number;
  timeoutMs?: number;
  /** CSS selector for the element to click */
  selector?: string;
}

export interface TypeOptions {
  delayMs?: number;
  submit?: boolean;
  clear?: boolean;
  timeoutMs?: number;
}

export interface HoverOptions {
  timeoutMs?: number;
}

export interface ScrollOptions {
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  timeoutMs?: number;
}

export interface DragOptions {
  timeoutMs?: number;
  steps?: number;
}

export interface SelectOptions {
  timeoutMs?: number;
}

export interface PressOptions {
  delayMs?: number;
}

export interface FormField {
  ref: string;
  value: string;
}

export interface FillFormOptions {
  timeoutMs?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  type?: "png" | "jpeg";
  quality?: number;
}

export interface PdfOptions {
  format?: string;
  printBackground?: boolean;
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
}

export interface EvaluateOptions {
  timeoutMs?: number;
}

export interface PerformanceTraceResult {
  entries: PerformanceEntry[];
}

export interface WaitOptions {
  selector?: string;
  timeoutMs?: number;
  state?: "visible" | "hidden" | "attached" | "detached";
  url?: string;
  urlPattern?: string;
}

// ============================================================================
// 调试类型
// ============================================================================

export interface BrowserConsoleMessage {
  type: string;
  text: string;
  timestamp: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export interface BrowserPageError {
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
}

export interface BrowserNetworkRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  resourceType?: string;
  status?: number;
  ok?: boolean;
  failureText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

// ============================================================================
// 存储类型
// ============================================================================

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

// ============================================================================
// 下载类型
// ============================================================================

export interface DownloadOptions {
  timeoutMs?: number;
}

export interface WaitForDownloadOptions {
  timeoutMs?: number;
}

// ============================================================================
// 错误类型
// ============================================================================

export class BrowserError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "BrowserError";
  }
}

export class BrowserProfileUnavailableError extends BrowserError {
  constructor(profile: string) {
    super(`Browser profile '${profile}' is unavailable`, "PROFILE_UNAVAILABLE");
    this.name = "BrowserProfileUnavailableError";
  }
}

export class BrowserNavigationBlockedError extends BrowserError {
  constructor(url: string, reason: string) {
    super(`Navigation to '${url}' blocked: ${reason}`, "NAVIGATION_BLOCKED");
    this.name = "BrowserNavigationBlockedError";
  }
}

export class BrowserTimeoutError extends BrowserError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, "TIMEOUT");
    this.name = "BrowserTimeoutError";
  }
}

export class BrowserElementNotFoundError extends BrowserError {
  constructor(ref: string) {
    super(`Element with ref '${ref}' not found`, "ELEMENT_NOT_FOUND");
    this.name = "BrowserElementNotFoundError";
  }
}

// ============================================================================
// HTTP API 请求/响应类型
// ============================================================================

export interface NavigateRequest {
  url: string;
  timeoutMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

export interface ActRequest {
  kind: "click" | "type" | "hover" | "drag" | "select" | "press";
  ref?: string;
  text?: string;
  startRef?: string;
  endRef?: string;
  values?: string[];
  key?: string;
  button?: "left" | "right" | "middle";
  clickCount?: number;
  delayMs?: number;
  submit?: boolean;
  clear?: boolean;
  timeoutMs?: number;
}

export interface WaitRequest {
  selector?: string;
  timeoutMs?: number;
  state?: "visible" | "hidden" | "attached" | "detached";
  url?: string;
  urlPattern?: string;
}

export interface ScreenshotRequest {
  fullPage?: boolean;
  selector?: string;
  type?: "png" | "jpeg";
  quality?: number;
}

export interface EvaluateRequest {
  fn: string;
  args?: unknown[];
  timeoutMs?: number;
}

export interface SetCookiesRequest {
  cookies: Cookie[];
}

export interface SetStorageRequest {
  data: Record<string, unknown>;
}

export interface DownloadRequest {
  ref: string;
  filename?: string;
}

export interface UploadRequest {
  ref: string;
  files: string[];
}

export interface SetOfflineRequest {
  offline: boolean;
}

export interface SetHeadersRequest {
  headers: Record<string, string>;
}

export interface SetCredentialsRequest {
  username: string;
  password: string;
}

export interface SetGeolocationRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface SetMediaRequest {
  muted?: boolean;
  video?: boolean;
  audio?: boolean;
}

export interface SetTimezoneRequest {
  timezoneId: string;
}

export interface SetLocaleRequest {
  locale: string;
}

export interface SetDeviceRequest {
  userAgent: string;
  viewport?: {
    width: number;
    height: number;
  };
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

// ============================================================================
// 驱动接口
// ============================================================================

export interface BrowserDriver {
  readonly name: string;
  readonly profile: ResolvedBrowserProfile;

  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;

  listTabs(): Promise<BrowserTab[]>;
  openTab(url: string): Promise<BrowserTab>;
  focusTab(targetId: string): Promise<void>;
  closeTab(targetId: string): Promise<void>;

  navigate(url: string, opts?: NavigateOptions): Promise<{ url: string }>;

  snapshotAria(opts?: SnapshotOptions): Promise<SnapshotAriaResult>;
  snapshotAi(opts?: SnapshotOptions): Promise<SnapshotAiResult>;
  snapshotRole(opts?: SnapshotOptions): Promise<SnapshotRoleResult>;

  click(ref: string, opts?: ClickOptions): Promise<void>;
  type(ref: string, text: string, opts?: TypeOptions): Promise<void>;
  hover(ref: string, opts?: HoverOptions): Promise<void>;
  drag(startRef: string, endRef: string, opts?: DragOptions): Promise<void>;
  select(ref: string, values: string[], opts?: SelectOptions): Promise<void>;
  press(key: string, opts?: PressOptions): Promise<void>;

  fillForm(fields: FormField[], opts?: FillFormOptions): Promise<void>;

  screenshot(opts?: ScreenshotOptions): Promise<Buffer>;

  evaluate(fn: string, opts?: EvaluateOptions): Promise<unknown>;

  wait(opts: WaitOptions): Promise<void>;

  getConsoleMessages(): Promise<BrowserConsoleMessage[]>;
  getPageErrors(): Promise<BrowserPageError[]>;
  getNetworkRequests(): Promise<BrowserNetworkRequest[]>;

  getCookies(): Promise<Cookie[]>;
  setCookies(cookies: Cookie[]): Promise<void>;
  clearCookies(): Promise<void>;
  getStorage(kind: "local" | "session"): Promise<Record<string, unknown>>;
  setStorage(kind: "local" | "session", data: Record<string, unknown>): Promise<void>;
  clearStorage(kind: "local" | "session"): Promise<void>;

  download(ref: string, filename: string): Promise<void>;
  waitForDownload(filename: string, opts?: WaitForDownloadOptions): Promise<string>;

  pdf(): Promise<Buffer>;

  resize(width: number, height: number): Promise<void>;

  highlight(ref: string): Promise<void>;
  traceStart(): Promise<void>;
  traceStop(): Promise<Buffer>;

  getActivePage(): import("playwright-core").Page | null;
  
  /**
   * 获取当前活动页面（异步）
   * 通过 CDP 检测真实的活动页面，并确保页面在最前面
   */
  ensureActivePage(): Promise<import("playwright-core").Page | null>;
}
