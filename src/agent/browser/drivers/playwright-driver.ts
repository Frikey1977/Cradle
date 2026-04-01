/**
 * 浏览器自动化模块 - Playwright CDP 驱动
 */

import { chromium, type Browser, type BrowserContext, type Page, type Locator } from "playwright-core";
import { spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import http from "http";
import { globalSnapshotEnhancer } from "../element-marker/snapshot-enhancer.js";
import type {
  ResolvedBrowserProfile,
  LocalBrowserProfile,
  BrowserTab,
  NavigateOptions,
  SnapshotOptions,
  SnapshotAriaResult,
  SnapshotAiResult,
  SnapshotRoleResult,
  ClickOptions,
  TypeOptions,
  HoverOptions,
  DragOptions,
  SelectOptions,
  PressOptions,
  FormField,
  FillFormOptions,
  ScreenshotOptions,
  EvaluateOptions,
  WaitOptions,
  BrowserConsoleMessage,
  BrowserPageError,
  BrowserNetworkRequest,
  Cookie,
  WaitForDownloadOptions,
  RoleRef,
  AriaElement,
  AiElement,
  PageState,
} from "../types.js";
import { BaseDriver } from "./base-driver.js";
import { assertBrowserNavigationAllowed } from "../utils/ssrf.js";
import { getDefaultUserDataDir, getDefaultExecutablePath } from "../config.js";
import type { SSRFPolicy } from "../types.js";

export class PlaywrightDriver extends BaseDriver {
  readonly name = "playwright";
  readonly profile: ResolvedBrowserProfile & { driver: "local-managed" };

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private activePageId: string | null = null;
  private browserProcess: ChildProcess | null = null;
  private pageStates: Map<string, PageState> = new Map();
  private ssrfPolicy: SSRFPolicy;
  private downloads: Map<string, string> = new Map();
  private tracing: boolean = false;

  constructor(profile: ResolvedBrowserProfile, ssrfPolicy: SSRFPolicy) {
    super();
    if (profile.driver !== "local-managed") {
      throw new Error(`PlaywrightDriver requires local-managed profile, got ${profile.driver}`);
    }
    this.profile = profile as ResolvedBrowserProfile & { driver: "local-managed" };
    this.ssrfPolicy = ssrfPolicy;
  }

  async start(): Promise<void> {
    if (this.browser) {
      return;
    }

    const localProfile = this.profile;
    const cdpPort = localProfile.cdpPort ?? 18800;
    const cdpUrl = localProfile.cdpUrl;

    // 如果提供了 cdpUrl，直接连接到远程浏览器
    if (cdpUrl) {
      try {
        console.log(`[PlaywrightDriver] Connecting to remote browser at ${cdpUrl}`);
        
        // 支持 ws:// 或 wss:// 协议的 WebSocket URL
        if (cdpUrl.startsWith('ws://') || cdpUrl.startsWith('wss://')) {
          this.browser = await chromium.connect(cdpUrl);
        } else {
          // 使用 CDP 协议连接（更稳定，兼容性更好）
          console.log(`[PlaywrightDriver] Using CDP protocol to connect`);
          this.browser = await chromium.connectOverCDP(cdpUrl);
        }
        
        const contexts = this.browser.contexts();
        console.log(`[PlaywrightDriver] Found ${contexts.length} contexts`);
        
        if (contexts.length > 0) {
          // 优先使用包含用户可见页面的上下文（非空页面）
          for (const ctx of contexts) {
            const ctxPages = ctx.pages();
            // 查找包含非 chrome:// 页面的上下文
            const hasUserPage = ctxPages.some(p => {
              const url = p.url();
              return url && !url.startsWith("chrome://") && !url.startsWith("chrome-extension://");
            });
            if (hasUserPage || !this.context) {
              this.context = ctx;
              if (hasUserPage) break; // 找到包含用户页面的上下文，优先使用
            }
          }
        } else {
          this.context = await this.browser.newContext();
        }

        this.setupContextListeners();
        
        const pages = this.context!.pages();
        console.log(`[PlaywrightDriver] Found ${pages.length} pages in selected context`);
        
        for (const page of pages) {
          const targetId = this.generatePageId();
          this.pages.set(targetId, page);
          this.pageStates.set(targetId, this.createEmptyPageState());
          this.setupPageListeners(targetId, page);
        }

        // 优先激活用户可见的页面（非 Chrome 内部页面，但允许 new-tab-page）
        if (pages.length > 0) {
          let selectedPageId: string | null = null;
          
          for (const [targetId, page] of this.pages) {
            const url = page.url();
            // 排除真正的 Chrome 内部页面，但保留 new-tab-page
            const isChromeInternal = url && (
              (url.startsWith("chrome://") && !url.includes("new-tab-page")) ||
              url.startsWith("chrome-extension://") ||
              url.startsWith("devtools://")
            );
            if (url && !isChromeInternal) {
              selectedPageId = targetId;
              break;
            }
          }
          
          // 如果没有找到用户页面，使用第一个非内部页面
          if (!selectedPageId) {
            for (const [targetId, page] of this.pages) {
              const url = page.url();
              if (!url.startsWith("chrome://omnibox") && !url.startsWith("chrome-extension://")) {
                selectedPageId = targetId;
                break;
              }
            }
          }
          
          // 不自动激活页面，只记录当前活动的页面
          this.activePageId = selectedPageId ?? this.pages.keys().next().value ?? null;
        }
        
        console.log(`[PlaywrightDriver] Connected to remote browser successfully`);
        return;
      } catch (e) {
        throw new Error(`Failed to connect to remote browser at ${cdpUrl}: ${e}`);
      }
    }

    // 否则尝试连接本地浏览器
    try {
      this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
      
      const contexts = this.browser.contexts();
      console.log(`[PlaywrightDriver] Found ${contexts.length} contexts`);
      
      if (contexts.length > 0) {
        // 优先使用包含用户可见页面的上下文（非空页面）
        for (const ctx of contexts) {
          const ctxPages = ctx.pages();
          // 查找包含非 Chrome 内部页面的上下文（允许 new-tab-page）
          const hasUserPage = ctxPages.some(p => {
            const url = p.url();
            const isChromeInternal = url && (
              (url.startsWith("chrome://") && !url.includes("new-tab-page")) ||
              url.startsWith("chrome-extension://") ||
              url.startsWith("devtools://")
            );
            return url && !isChromeInternal;
          });
          if (hasUserPage || !this.context) {
            this.context = ctx;
            if (hasUserPage) break; // 找到包含用户页面的上下文，优先使用
          }
        }
      } else {
        this.context = await this.browser.newContext();
      }

      this.setupContextListeners();
      
      const pages = this.context!.pages();
      console.log(`[PlaywrightDriver] Found ${pages.length} pages in selected context`);
      
      for (const page of pages) {
        const targetId = this.generatePageId();
        this.pages.set(targetId, page);
        this.pageStates.set(targetId, this.createEmptyPageState());
        this.setupPageListeners(targetId, page);
      }

      // 优先激活用户可见的页面（非 Chrome 内部页面，但允许 new-tab-page）
      if (pages.length > 0) {
        let selectedPageId: string | null = null;
        
        for (const [targetId, page] of this.pages) {
          const url = page.url();
          // 排除真正的 Chrome 内部页面，但保留 new-tab-page
          const isChromeInternal = url && (
            (url.startsWith("chrome://") && !url.includes("new-tab-page")) ||
            url.startsWith("chrome-extension://") ||
            url.startsWith("devtools://")
          );
          if (url && !isChromeInternal) {
            selectedPageId = targetId;
            break;
          }
        }
        
        // 如果没有找到用户页面，使用第一个非内部页面
        if (!selectedPageId) {
          for (const [targetId, page] of this.pages) {
            const url = page.url();
            if (!url.startsWith("chrome://omnibox") && !url.startsWith("chrome-extension://")) {
              selectedPageId = targetId;
              break;
            }
          }
        }
        
        // 不自动激活页面，只记录当前活动的页面
        this.activePageId = selectedPageId ?? this.pages.keys().next().value ?? null;
      }
      
      return;
    } catch (e) {
      // Browser not running, will start a new one
    }

    const userDataDir = localProfile.userDataDir ?? getDefaultUserDataDir(localProfile);
    
    try {
      if (!existsSync(userDataDir)) {
        mkdirSync(userDataDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create browser data directory '${userDataDir}': ${error}`);
    }

    const executablePath = localProfile.executablePath ?? getDefaultExecutablePath();
    
    if (!executablePath) {
      throw new Error("No browser executable found. Please install Chrome, Brave, or Edge.");
    }

    const args = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-hang-monitor",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--disable-blink-features=AutomationControlled",
    ];

    if (localProfile.headless) {
      args.push("--headless=new");
    }

    this.browserProcess = spawn(executablePath, args, {
      detached: true,
      stdio: "ignore",
    });

    this.browserProcess.unref();

    await this.waitForBrowserReady(cdpPort, 30000);

    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    
    const contexts = this.browser.contexts();
    if (contexts.length > 0) {
      this.context = contexts[0];
    } else {
      this.context = await this.browser.newContext();
    }

    this.setupContextListeners();
    
    const pages = this.context.pages();
    for (const page of pages) {
      const targetId = this.generatePageId();
      this.pages.set(targetId, page);
      this.pageStates.set(targetId, this.createEmptyPageState());
      this.setupPageListeners(targetId, page);
    }

    if (pages.length > 0) {
      this.activePageId = this.pages.keys().next().value ?? null;
    }
  }

  private async waitForBrowserReady(port: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          return;
        }
      } catch {
        // Browser not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Browser did not become ready within ${timeoutMs}ms`);
  }

  private async getChromeWebSocketUrl(cdpUrl: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const url = new URL(cdpUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || '9222',
        path: '/json/version',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const version = JSON.parse(data);
            // Chrome 返回的 webSocketDebuggerUrl 是 ws:// 格式
            if (version.webSocketDebuggerUrl) {
              resolve(version.webSocketDebuggerUrl);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.pages.clear();
      this.pageStates.clear();
      this.activePageId = null;
    }

    if (this.browserProcess) {
      this.browserProcess.kill();
      this.browserProcess = null;
    }
  }

  async isRunning(): Promise<boolean> {
    return this.browser !== null && this.browser.isConnected();
  }

  private async getActivePageInternal(): Promise<Page> {
    const page = await this.ensureActivePage();
    if (!page) {
      throw new Error("No active page available");
    }
    return page;
  }
  
  /**
   * 获取当前活动页面（公共方法）
   * 通过 CDP 检测真实的活动页面，并确保页面在最前面
   */
  async ensureActivePage(): Promise<Page | null> {
    // 首先同步页面状态
    await this.syncPagesWithBrowser();
    
    // 获取真实的活动页面 targetId（通过 CDP /json/list）
    const { targets: cdpTargets, activeTargetId } = await this.getCDPPageInfo();
    
    // 尝试找到匹配的页面
    if (activeTargetId) {
      const activeTarget = cdpTargets.find((t: any) => t.id === activeTargetId);
      if (activeTarget) {
        // 通过 URL 匹配找到 Playwright 页面
        for (const [targetId, page] of this.pages) {
          if (page.url() === activeTarget.url) {
            this.activePageId = targetId;
            console.log(`[PlaywrightDriver] ensureActivePage: updated active page to ${targetId} (matches CDP active target)`);
            break;
          }
        }
      }
    }
    
    if (!this.activePageId || !this.pages.has(this.activePageId)) {
      return null;
    }
    const page = this.pages.get(this.activePageId)!;
    
    // 确保页面在最前面（活动 tab）
    await page.bringToFront();
    return page;
  }
  
  /**
   * 从 CDP 获取页面列表和活动页面信息
   * 这是获取浏览器真实状态的核心方法，被 listTabs 和 getActivePageInternal 复用
   */
  private async getCDPPageInfo(): Promise<{
    targets: Array<{ id: string; url: string; title: string; type: string }>;
    activeTargetId: string | null;
  }> {
    const cdpUrl = this.profile.cdpUrl || `http://127.0.0.1:${this.profile.cdpPort ?? 9222}`;
    const cdpEndpoint = cdpUrl.replace(/\/$/, "");
    
    let targets: Array<{ id: string; url: string; title: string; type: string }> = [];
    let activeTargetId: string | null = null;
    
    try {
      const response = await fetch(`${cdpEndpoint}/json/list`);
      if (response.ok) {
        targets = await response.json();
        
        // 找到第一个非内部页面作为活动页面
        for (const target of targets) {
          if (target.type === "page") {
            const url = target.url;
            const isChromeInternal = (
              (url.startsWith("chrome://") && !url.includes("new-tab-page")) ||
              url.startsWith("chrome-extension://") ||
              url.startsWith("devtools://")
            );
            if (!isChromeInternal) {
              activeTargetId = target.id;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.log(`[PlaywrightDriver] getCDPPageInfo: failed to fetch CDP targets: ${e}`);
    }
    
    return { targets, activeTargetId };
  }

  /**
   * 同步页面状态与浏览器实际状态（从 listTabs 提取的公共逻辑）
   */
  private async syncPagesWithBrowser(): Promise<void> {
    if (!this.browser) {
      return;
    }
    
    const allPages: Page[] = [];
    const contexts = this.browser.contexts();
    
    for (const ctx of contexts) {
      const ctxPages = ctx.pages();
      allPages.push(...ctxPages);
    }
    
    const currentPageSet = new Set(allPages);
    const existingPages = new Set(this.pages.values());
    
    // 添加新页面
    for (const page of allPages) {
      if (!existingPages.has(page)) {
        const targetId = this.generatePageId();
        this.pages.set(targetId, page);
        this.pageStates.set(targetId, this.createEmptyPageState());
        this.setupPageListeners(targetId, page);
        console.log(`[PlaywrightDriver] syncPages: added new page ${targetId} url = "${page.url()}"`);
      }
    }
    
    // 移除已关闭页面
    for (const [targetId, page] of Array.from(this.pages.entries())) {
      if (!currentPageSet.has(page)) {
        console.log(`[PlaywrightDriver] syncPages: removed stale page ${targetId}`);
        this.pages.delete(targetId);
        this.pageStates.delete(targetId);
        if (this.activePageId === targetId) {
          this.activePageId = null;
        }
      }
    }
    
    // 如果没有活动页面，选择第一个可用页面
    if (!this.activePageId && this.pages.size > 0) {
      const firstPageId = this.pages.keys().next().value;
      if (firstPageId) {
        this.activePageId = firstPageId;
        console.log(`[PlaywrightDriver] syncPages: set active page to ${this.activePageId}`);
      }
    }
  }

  getActivePage(): Page | null {
    if (!this.activePageId || !this.pages.has(this.activePageId)) {
      return null;
    }
    return this.pages.get(this.activePageId)!;
  }

  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private createEmptyPageState(): PageState {
    return {
      console: [],
      errors: [],
      requests: [],
      roleRefs: {},
      roleRefsMode: "role",
      markedElements: {},
    };
  }

  private setupContextListeners(): void {
    if (!this.context) return;

    this.context.on("page", (page) => {
      const targetId = this.generatePageId();
      this.pages.set(targetId, page);
      this.pageStates.set(targetId, this.createEmptyPageState());
      this.setupPageListeners(targetId, page);
      
      if (!this.activePageId) {
        this.activePageId = targetId;
      }
    });
  }

  private setupPageListeners(targetId: string, page: Page): void {
    const state = this.pageStates.get(targetId);
    if (!state) return;

    page.on("console", (msg) => {
      state.console.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: {
          url: msg.location().url,
          lineNumber: msg.location().lineNumber,
          columnNumber: msg.location().columnNumber,
        },
      });
    });

    page.on("pageerror", (error) => {
      state.errors.push({
        message: error.message,
        name: error.name,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });

    page.on("request", (request) => {
      state.requests.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        requestHeaders: request.headers(),
      });
    });

    page.on("response", (response) => {
      const request = response.request();
      const url = request.url();
      const req = state.requests.find(r => r.url === url && !r.status);
      if (req) {
        req.status = response.status();
        req.ok = response.ok();
        req.responseHeaders = response.headers();
      }
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      const req = state.requests.find(r => r.url === url);
      if (req) {
        req.failureText = request.failure()?.errorText;
      }
    });
  }

  async listTabs(): Promise<BrowserTab[]> {
    if (!this.browser) {
      return [];
    }
    
    // 首先同步页面状态
    await this.syncPagesWithBrowser();
    
    // 使用公共方法获取 CDP 页面信息
    const { targets: cdpTargets, activeTargetId: activeCdpTargetId } = await this.getCDPPageInfo();
    
    const pageTargets = cdpTargets.filter(t => t.type === "page");
    if (activeCdpTargetId) {
      const activeTarget = pageTargets.find(t => t.id === activeCdpTargetId);
      console.log(`[PlaywrightDriver] listTabs: SELECTED active page (first from CDP list): ${activeCdpTargetId}, title: ${activeTarget?.title || 'unknown'}`);
    }
    console.log(`[PlaywrightDriver] listTabs: CDP found ${pageTargets.length} page targets, activeCdpTargetId: ${activeCdpTargetId}`);
    
    // 构建 URL 到 targetId 的映射（用于匹配活动页面）
    const urlToTargetId = new Map<string, string>();
    
    for (const [targetId, page] of this.pages) {
      urlToTargetId.set(page.url(), targetId);
    }
    
    const tabs: BrowserTab[] = [];
    
    for (const target of pageTargets) {
      const url = target.url;
      
      const isChromeInternal = (
        (url.startsWith("chrome://") && !url.includes("new-tab-page")) ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("devtools://")
      );
      if (isChromeInternal) {
        continue;
      }
      
      const displayUrl = url || "about:blank";
      
      // 尝试通过 URL 匹配 Playwright 的 page 对象
      let targetId = urlToTargetId.get(url);
      let title = target.title || "";
      
      if (targetId) {
        const page = this.pages.get(targetId);
        if (page) {
          try {
            const pageTitle = await Promise.race([
              page.title(),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error("title timeout")), 3000)
              )
            ]);
            if (pageTitle && pageTitle.trim()) {
              title = pageTitle;
            }
          } catch {
            // title 获取超时或失败，使用 CDP 的 title
          }
        }
      } else {
        // 如果没有匹配到，使用 CDP 的 target id
        targetId = `cdp-${target.id}`;
      }
      
      // 判断是否为激活页面（通过 CDP targetId 匹配）
      const isActive = activeCdpTargetId !== null && target.id === activeCdpTargetId;
      
      tabs.push({
        targetId,
        url: displayUrl,
        title,
        active: isActive,
        profile: this.profile.name,
      });
    }
    
    return tabs;
  }

  async openTab(url: string): Promise<BrowserTab> {
    if (!this.context) {
      throw new Error("Browser context not available");
    }

    await assertBrowserNavigationAllowed({ url, ssrfPolicy: this.ssrfPolicy });

    const page = await this.context.newPage();
    const targetId = this.generatePageId();
    
    this.pages.set(targetId, page);
    this.pageStates.set(targetId, this.createEmptyPageState());
    this.setupPageListeners(targetId, page);
    
    this.activePageId = targetId;
    
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    return {
      targetId,
      url: page.url(),
      title: await page.title().catch(() => ""),
      active: true,
      profile: this.profile.name,
    };
  }

  async focusTab(targetId: string): Promise<void> {
    const page = this.pages.get(targetId);
    if (!page) {
      throw new Error(`Tab ${targetId} not found`);
    }
    
    this.activePageId = targetId;
    await page.bringToFront();
  }

  async closeTab(targetId: string): Promise<void> {
    const page = this.pages.get(targetId);
    if (!page) {
      throw new Error(`Tab ${targetId} not found`);
    }
    
    await page.close();
    this.pages.delete(targetId);
    this.pageStates.delete(targetId);
    
    if (this.activePageId === targetId) {
      this.activePageId = this.pages.keys().next().value ?? null;
    }
  }

  async navigate(url: string, opts?: NavigateOptions): Promise<{ url: string }> {
    const page = await this.getActivePageInternal();

    await assertBrowserNavigationAllowed({ url, ssrfPolicy: this.ssrfPolicy });
    
    const response = await page.goto(url, {
      timeout: opts?.timeoutMs ?? 30000,
      waitUntil: opts?.waitUntil ?? "domcontentloaded",
    });

    return { url: page.url() };
  }

  async snapshotAria(opts?: SnapshotOptions): Promise<SnapshotAriaResult> {
    const page = await this.getActivePageInternal();

    const elements = await this.buildAriaElements(page, opts?.limit);
    const pageTextRaw = await page.textContent("body").catch(() => "");
    // 限制 pageText 长度，避免返回过多无意义内容
    const maxPageTextLength = 5000;
    const pageText = pageTextRaw && pageTextRaw.length > maxPageTextLength
      ? pageTextRaw.slice(0, maxPageTextLength) + "... [truncated]"
      : pageTextRaw;
    
    return { elements, pageText: pageText ?? "" };
  }

  private async buildAriaElements(page: Page, limit?: number): Promise<AriaElement[]> {
    const elements: AriaElement[] = [];
    
    const interactiveRoles = [
      "button", "link", "textbox", "checkbox", "radio", "combobox",
      "menuitem", "tab", "searchbox", "spinbutton", "slider", "switch",
      "heading", "img", "listitem", "option",
    ];
    
    let refIndex = 1;
    
    for (const role of interactiveRoles) {
      try {
        const locators = await page.getByRole(role as any).all();
        
        for (let i = 0; i < locators.length; i++) {
          const locator = locators[i];
          try {
            const name = await locator.getAttribute("aria-label") 
              ?? await locator.getAttribute("title")
              ?? await locator.textContent() ?? "";
            
            const element: AriaElement = {
              ref: `e${refIndex++}`,
              role,
              name: name.trim().slice(0, 100),
            };
            
            elements.push(element);
            
            if (limit && elements.length >= limit) {
              return elements;
            }
          } catch {
            // Skip elements that can't be accessed
          }
        }
      } catch {
        // Role not found or other error
      }
    }
    
    return elements;
  }

  async snapshotAi(opts?: SnapshotOptions): Promise<SnapshotAiResult> {
    const page = await this.getActivePageInternal();
    const url = page.url();
    const state = this.pageStates.get(this.activePageId!);

    // 首先尝试获取增强快照（如果有配置的话）
    const enhancedResult = await globalSnapshotEnhancer.getEnhancedSnapshot(page, url);

    // 如果有标记配置，使用增强快照
    if (enhancedResult.config && enhancedResult.markedElements.length > 0) {
      console.log(`[PlaywrightDriver] Using enhanced snapshot with ${enhancedResult.markedElements.length} marked elements`);

      // 获取元素的当前实时内容
      const elementData = enhancedResult.pageData?.elements as Record<string, { text?: string; value?: string; exists: boolean }> | undefined;
      
      const elements: AiElement[] = enhancedResult.markedElements.map(el => {
        const currentData = elementData?.[el.ref];
        // 优先使用当前实时内容，如果没有则使用配置中的描述
        const displayText = currentData?.exists && currentData?.text 
          ? currentData.text.slice(0, 100).replace(/\n/g, ' ')
          : el.description.slice(0, 60);
        
        return {
          ref: el.ref,
          type: el.type,
          text: displayText,
        };
      });

      // 更新页面状态
      if (state) {
        state.markedElements = {};
        for (const el of enhancedResult.markedElements) {
          state.markedElements[el.ref] = {
            ref: el.ref,
            type: el.type,
            selector: el.selector,
            description: el.description,
          };
        }
      }

      return {
        elements: opts?.limit ? elements.slice(0, opts.limit) : elements,
        pageText: enhancedResult.originalSnapshot.slice(0, 5000),
      };
    }

    // 否则使用原有的role-based快照
    const roleRefs = await this.buildRoleRefs(page);
    if (state) {
      state.roleRefs = roleRefs;
      state.roleRefsMode = "role";
    }

    const elements: AiElement[] = [];
    let refIndex = 1;

    for (const [ref, roleRef] of Object.entries(roleRefs)) {
      // text 限制长度60字符，避免过长
      const text = roleRef.name ? roleRef.name.slice(0, 60) : "";
      elements.push({
        ref,
        type: roleRef.role,
        text,
      });
      refIndex++;
    }

    // 不再返回 pageText，减少冗余数据
    return { elements: opts?.limit ? elements.slice(0, opts.limit) : elements, pageText: "" };
  }

  async snapshotRole(opts?: SnapshotOptions): Promise<SnapshotRoleResult> {
    const page = await this.getActivePageInternal();
    const state = this.pageStates.get(this.activePageId!);
    
    const roleRefs = await this.buildRoleRefs(page);
    if (state) {
      state.roleRefs = roleRefs;
      state.roleRefsMode = "role";
    }
    
    const elements = Object.entries(roleRefs).map(([ref, roleRef]) => roleRef);
    const pageTextRaw = await page.textContent("body").catch(() => "");
    // 限制 pageText 长度，避免返回过多无意义内容
    const maxPageTextLength = 5000;
    const pageText = pageTextRaw && pageTextRaw.length > maxPageTextLength
      ? pageTextRaw.slice(0, maxPageTextLength) + "... [truncated]"
      : pageTextRaw;
    
    return { elements: opts?.limit ? elements.slice(0, opts.limit) : elements, pageText: pageText ?? "" };
  }



  private async buildRoleRefs(page: Page): Promise<Record<string, RoleRef>> {
    const roleRefs: Record<string, RoleRef> = {};
    
    const interactiveRoles = [
      "button", "link", "textbox", "checkbox", "radio", "combobox",
      "menuitem", "tab", "searchbox", "spinbutton", "slider", "switch",
    ];
    
    let refIndex = 1;
    
    for (const role of interactiveRoles) {
      try {
        const locators = await page.getByRole(role as any).all();
        
        for (let i = 0; i < locators.length; i++) {
          const locator = locators[i];
          try {
            const name = await locator.getAttribute("aria-label") 
              ?? await locator.getAttribute("title")
              ?? await locator.textContent() ?? "";
            
            const trimmedName = name.trim().slice(0, 100);
            const ref = `e${refIndex++}`;
            
            // 注入 cradle-ref 标记到页面元素
            await locator.evaluate((el, refValue) => {
              el.setAttribute('cradle-ref', refValue);
            }, ref);
            
            roleRefs[ref] = {
              role,
              name: trimmedName,
              ref,
            };
          } catch {
            // Skip elements that can't be accessed
          }
        }
      } catch {
        // Role not found or other error
      }
    }
    
    return roleRefs;
  }

  private async getLocator(ref: string): Promise<Locator> {
    const page = await this.getActivePageInternal();
    const state = this.pageStates.get(this.activePageId!);
    
    // 优先使用 cradle-ref 标记定位（最可靠）
    const cradleLocator = page.locator(`[cradle-ref="${ref}"]`);
    try {
      const count = await cradleLocator.count();
      if (count > 0) {
        return cradleLocator;
      }
    } catch {
      // 标记可能不存在，继续尝试其他方式
    }
    
    // 回退到 role-based 定位
    if (state?.roleRefs[ref]) {
      const roleRef = state.roleRefs[ref];
      const locator = page.getByRole(roleRef.role as any, {
        name: roleRef.name,
      });
      return locator;
    }
    
    if (state?.markedElements[ref]) {
      const markedElement = state.markedElements[ref];
      return page.locator(markedElement.selector);
    }
    
    return page.locator(`[data-ref="${ref}"], [aria-ref="${ref}"]`);
  }

  async click(ref: string, opts?: ClickOptions): Promise<void> {
    const locator = await this.getLocator(ref);
    await locator.click({
      button: opts?.button,
      clickCount: opts?.clickCount,
      delay: opts?.delayMs,
      timeout: opts?.timeoutMs ?? 30000,
    });
  }

  async type(ref: string, text: string, opts?: TypeOptions): Promise<void> {
    const locator = await this.getLocator(ref);

    if (opts?.clear) {
      await locator.clear({ timeout: opts?.timeoutMs ?? 30000 });
    }
    
    await locator.fill(text, {
      timeout: opts?.timeoutMs ?? 30000,
    });
    
    if (opts?.submit) {
      await locator.press("Enter");
    }
  }

  async hover(ref: string, opts?: HoverOptions): Promise<void> {
    const locator = await this.getLocator(ref);
    await locator.hover({
      timeout: opts?.timeoutMs ?? 30000,
    });
  }

  async drag(startRef: string, endRef: string, opts?: DragOptions): Promise<void> {
    const startLocator = await this.getLocator(startRef);
    const endLocator = await this.getLocator(endRef);
    
    await startLocator.dragTo(endLocator, {
      timeout: opts?.timeoutMs ?? 30000,
      steps: opts?.steps,
    });
  }

  async select(ref: string, values: string[], opts?: SelectOptions): Promise<void> {
    const locator = await this.getLocator(ref);
    await locator.selectOption(values, {
      timeout: opts?.timeoutMs ?? 30000,
    });
  }

  async press(key: string, opts?: PressOptions): Promise<void> {
    const page = await this.getActivePageInternal();
    await page.keyboard.press(key, {
      delay: opts?.delayMs,
    });
  }

  async fillForm(fields: FormField[], opts?: FillFormOptions): Promise<void> {
    for (const field of fields) {
      await this.type(field.ref, field.value, { timeoutMs: opts?.timeoutMs });
    }
  }

  async screenshot(opts?: ScreenshotOptions): Promise<Buffer> {
    const page = await this.getActivePageInternal();

    if (opts?.selector) {
      return await page.locator(opts.selector).screenshot({
        type: opts?.type ?? "png",
        quality: opts?.quality,
      });
    }
    
    return await page.screenshot({
      fullPage: opts?.fullPage ?? false,
      type: opts?.type ?? "png",
      quality: opts?.quality,
    });
  }

  async evaluate(fn: string, opts?: EvaluateOptions): Promise<unknown> {
    const page = await this.getActivePageInternal();

    const result = await page.evaluate(`(${fn})()`);
    return result;
  }

  async wait(opts: WaitOptions): Promise<void> {
    const page = await this.getActivePageInternal();

    if (opts.selector) {
      await page.waitForSelector(opts.selector, {
        timeout: opts?.timeoutMs ?? 30000,
        state: opts?.state,
      });
    } else if (opts.url) {
      await page.waitForURL(opts.url, {
        timeout: opts?.timeoutMs ?? 30000,
      });
    } else if (opts.urlPattern) {
      await page.waitForURL(new RegExp(opts.urlPattern), {
        timeout: opts?.timeoutMs ?? 30000,
      });
    } else {
      await page.waitForLoadState("networkidle", {
        timeout: opts?.timeoutMs ?? 30000,
      });
    }
  }

  async getConsoleMessages(): Promise<BrowserConsoleMessage[]> {
    const state = this.pageStates.get(this.activePageId!);
    return state?.console ?? [];
  }

  async getPageErrors(): Promise<BrowserPageError[]> {
    const state = this.pageStates.get(this.activePageId!);
    return state?.errors ?? [];
  }

  async getNetworkRequests(): Promise<BrowserNetworkRequest[]> {
    const state = this.pageStates.get(this.activePageId!);
    return state?.requests ?? [];
  }

  async getCookies(): Promise<Cookie[]> {
    if (!this.context) {
      throw new Error("Browser context not available");
    }
    return await this.context.cookies();
  }

  async setCookies(cookies: Cookie[]): Promise<void> {
    if (!this.context) {
      throw new Error("Browser context not available");
    }
    await this.context.addCookies(cookies);
  }

  async clearCookies(): Promise<void> {
    if (!this.context) {
      throw new Error("Browser context not available");
    }
    await this.context.clearCookies();
  }

  async getStorage(kind: "local" | "session"): Promise<Record<string, unknown>> {
    const page = await this.getActivePageInternal();
    return await page.evaluate((storageType) => {
      const storage = storageType === "local" ? localStorage : sessionStorage;
      const result: Record<string, unknown> = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          try {
            result[key] = JSON.parse(storage.getItem(key) ?? "");
          } catch {
            result[key] = storage.getItem(key);
          }
        }
      }
      return result;
    }, kind);
  }

  async setStorage(kind: "local" | "session", data: Record<string, unknown>): Promise<void> {
    const page = await this.getActivePageInternal();
    await page.evaluate(({ storageType, items }) => {
      const storage = storageType === "local" ? localStorage : sessionStorage;
      for (const [key, value] of Object.entries(items)) {
        storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      }
    }, { storageType: kind, items: data });
  }

  async clearStorage(kind: "local" | "session"): Promise<void> {
    const page = await this.getActivePageInternal();
    await page.evaluate((storageType) => {
      const storage = storageType === "local" ? localStorage : sessionStorage;
      storage.clear();
    }, kind);
  }

  async download(ref: string, filename: string): Promise<void> {
    const page = await this.getActivePageInternal();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      this.click(ref),
    ]);
    
    await download.saveAs(filename);
    this.downloads.set(download.suggestedFilename(), filename);
  }

  async waitForDownload(filename: string, opts?: WaitForDownloadOptions): Promise<string> {
    const savedPath = this.downloads.get(filename);
    if (savedPath) {
      return savedPath;
    }
    
    const page = await this.getActivePageInternal();
    const download = await page.waitForEvent("download", {
      timeout: opts?.timeoutMs ?? 30000,
    });
    
    const path = `./downloads/${download.suggestedFilename()}`;
    await download.saveAs(path);
    return path;
  }

  async pdf(): Promise<Buffer> {
    const page = await this.getActivePageInternal();
    return await page.pdf();
  }

  async resize(width: number, height: number): Promise<void> {
    const page = await this.getActivePageInternal();
    await page.setViewportSize({ width, height });
  }

  async highlight(ref: string): Promise<void> {
    const locator = await this.getLocator(ref);
    await locator.highlight();
  }

  async traceStart(): Promise<void> {
    if (!this.context) {
      throw new Error("Browser context not available");
    }
    
    await this.context.tracing.start({ screenshots: true, snapshots: true });
    this.tracing = true;
  }

  async traceStop(): Promise<Buffer> {
    if (!this.context || !this.tracing) {
      throw new Error("Tracing not started");
    }
    
    const tracePath = join(this.profile.userDataDir ?? ".", `trace-${Date.now()}.zip`);
    await this.context.tracing.stop({ path: tracePath });
    this.tracing = false;
    
    const { readFileSync } = await import("fs");
    return readFileSync(tracePath);
  }
}
