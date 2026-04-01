/**
 * 浏览器自动化模块 - 基础驱动抽象类
 */

import type { BrowserDriver } from "../types.js";
import type { ResolvedBrowserProfile } from "../types.js";

export abstract class BaseDriver implements BrowserDriver {
  abstract readonly name: string;
  abstract readonly profile: ResolvedBrowserProfile;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract isRunning(): Promise<boolean>;

  abstract listTabs(): Promise<import("../types.js").BrowserTab[]>;
  abstract openTab(url: string): Promise<import("../types.js").BrowserTab>;
  abstract focusTab(targetId: string): Promise<void>;
  abstract closeTab(targetId: string): Promise<void>;

  abstract navigate(
    url: string,
    opts?: import("../types.js").NavigateOptions
  ): Promise<{ url: string }>;

  abstract snapshotAria(
    opts?: import("../types.js").SnapshotOptions
  ): Promise<import("../types.js").SnapshotAriaResult>;
  abstract snapshotAi(
    opts?: import("../types.js").SnapshotOptions
  ): Promise<import("../types.js").SnapshotAiResult>;
  abstract snapshotRole(
    opts?: import("../types.js").SnapshotOptions
  ): Promise<import("../types.js").SnapshotRoleResult>;
  abstract snapshotPlatform(
    opts?: import("../types.js").SnapshotOptions
  ): Promise<import("../types.js").SnapshotPlatformResult>;

  abstract click(
    ref: string,
    opts?: import("../types.js").ClickOptions
  ): Promise<void>;
  abstract type(
    ref: string,
    text: string,
    opts?: import("../types.js").TypeOptions
  ): Promise<void>;
  abstract hover(
    ref: string,
    opts?: import("../types.js").HoverOptions
  ): Promise<void>;
  abstract drag(
    startRef: string,
    endRef: string,
    opts?: import("../types.js").DragOptions
  ): Promise<void>;
  abstract select(
    ref: string,
    values: string[],
    opts?: import("../types.js").SelectOptions
  ): Promise<void>;
  abstract press(
    key: string,
    opts?: import("../types.js").PressOptions
  ): Promise<void>;

  abstract fillForm(
    fields: import("../types.js").FormField[],
    opts?: import("../types.js").FillFormOptions
  ): Promise<void>;

  abstract screenshot(
    opts?: import("../types.js").ScreenshotOptions
  ): Promise<Buffer>;

  abstract evaluate(
    fn: string,
    opts?: import("../types.js").EvaluateOptions
  ): Promise<unknown>;

  abstract wait(opts: import("../types.js").WaitOptions): Promise<void>;

  abstract getConsoleMessages(): Promise<import("../types.js").BrowserConsoleMessage[]>;
  abstract getPageErrors(): Promise<import("../types.js").BrowserPageError[]>;
  abstract getNetworkRequests(): Promise<import("../types.js").BrowserNetworkRequest[]>;

  abstract getCookies(): Promise<import("../types.js").Cookie[]>;
  abstract setCookies(cookies: import("../types.js").Cookie[]): Promise<void>;
  abstract clearCookies(): Promise<void>;
  abstract getStorage(
    kind: "local" | "session"
  ): Promise<Record<string, unknown>>;
  abstract setStorage(
    kind: "local" | "session",
    data: Record<string, unknown>
  ): Promise<void>;
  abstract clearStorage(kind: "local" | "session"): Promise<void>;

  abstract download(ref: string, filename: string): Promise<void>;
  abstract waitForDownload(
    filename: string,
    opts?: import("../types.js").WaitForDownloadOptions
  ): Promise<string>;

  abstract pdf(): Promise<Buffer>;

  abstract resize(width: number, height: number): Promise<void>;

  abstract highlight(ref: string): Promise<void>;
  abstract traceStart(): Promise<void>;
  abstract traceStop(): Promise<Buffer>;

  abstract getActivePage(): import("playwright-core").Page | null;
  
  abstract ensureActivePage(): Promise<import("playwright-core").Page | null>;
}
