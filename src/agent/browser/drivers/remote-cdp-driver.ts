/**
 * 浏览器自动化模块 - Remote CDP 驱动
 * 
 * 用于连接远程浏览器服务（如 Browserless、Browserbase）
 * 通过 WebSocket CDP 协议进行通信
 */

import type { BrowserDriver, ResolvedBrowserProfile, RemoteCdpProfile, SSRFPolicy } from "../types.js";
import { BaseDriver } from "./base-driver.js";
import { assertBrowserNavigationAllowed } from "../utils/ssrf.js";
import { WebSocket } from "ws";
import { getDouyinUserScript } from "../scripts/douyin.js";

interface CDPResponse {
  id: number;
  result?: unknown;
  error?: { message: string; code: number };
}

interface CDPEvent {
  method: string;
  params?: Record<string, unknown>;
}

interface PageInfo {
  targetId: string;
  url: string;
  title: string;
}

export class RemoteCdpDriver extends BaseDriver implements BrowserDriver {
  readonly name = "remote-cdp";
  readonly profile: ResolvedBrowserProfile & { driver: "remote-cdp" };

  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private pages = new Map<string, PageInfo>();
  private activePageId: string | null = null;
  private consoleMessages: import("../types.js").BrowserConsoleMessage[] = [];
  private pageErrors: import("../types.js").BrowserPageError[] = [];
  private networkRequests: import("../types.js").BrowserNetworkRequest[] = [];
  private eventHandlers = new Map<string, ((params: unknown) => void)[]>();
  private ssrfPolicy: SSRFPolicy;

  constructor(profile: ResolvedBrowserProfile, ssrfPolicy: SSRFPolicy) {
    super();
    if (profile.driver !== "remote-cdp") {
      throw new Error(`RemoteCdpDriver requires remote-cdp profile, got ${profile.driver}`);
    }
    this.profile = profile as ResolvedBrowserProfile & { driver: "remote-cdp" };
    this.ssrfPolicy = ssrfPolicy;
  }

  async start(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const cdpUrl = await this.resolveCdpUrl();
    await this.connectWebSocket(cdpUrl);
    await this.initializeSession();
  }

  private async resolveCdpUrl(): Promise<string> {
    const profile = this.profile;
    const cdpUrl = profile.cdpUrl;

    // 如果已经是 WebSocket URL，直接使用
    if (cdpUrl.startsWith("ws://") || cdpUrl.startsWith("wss://")) {
      return cdpUrl;
    }

    // 否则通过 HTTP 端点发现 WebSocket URL
    try {
      const listResponse = await fetch(`${cdpUrl}/json/list`);
      if (listResponse.ok) {
        const targets = await listResponse.json() as Array<{ type: string; webSocketDebuggerUrl?: string; url: string; title?: string }>;
        
        // 优先查找抖音页面
        const douyinTarget = targets.find(t => 
          t.type === "page" && 
          t.webSocketDebuggerUrl &&
          (t.url?.includes("douyin.com") || t.title?.includes("抖音"))
        );
        if (douyinTarget?.webSocketDebuggerUrl) {
          console.log(`[RemoteCdpDriver] Found Douyin page WebSocket: ${douyinTarget.url}`);
          return douyinTarget.webSocketDebuggerUrl;
        }
        
        // 排除 Chrome 内部页面，找到第一个普通页面
        const pageTarget = targets.find(t => 
          t.type === "page" && 
          t.webSocketDebuggerUrl &&
          !t.url?.startsWith("chrome://") &&
          !t.url?.startsWith("chrome-extension://") &&
          !t.url?.startsWith("devtools://")
        );
        if (pageTarget?.webSocketDebuggerUrl) {
          console.log(`[RemoteCdpDriver] Found page WebSocket: ${pageTarget.url}`);
          return pageTarget.webSocketDebuggerUrl;
        }
      }
    } catch (error) {
      console.warn(`[RemoteCdpDriver] Failed to get page list, falling back to browser WebSocket: ${error}`);
    }

    // 回退到 browser 级别的 WebSocket
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (!response.ok) {
        throw new Error(`Failed to fetch CDP version: ${response.status}`);
      }

      const version = await response.json() as { webSocketDebuggerUrl?: string };
      if (!version.webSocketDebuggerUrl) {
        throw new Error("No webSocketDebuggerUrl in CDP version response");
      }

      return version.webSocketDebuggerUrl;
    } catch (error) {
      throw new Error(`Failed to resolve CDP WebSocket URL: ${error}`);
    }
  }

  private async connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on("open", () => {
          console.log(`[RemoteCdpDriver] Connected to ${url}`);
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as CDPResponse | CDPEvent;
            this.handleMessage(message);
          } catch (error) {
            console.error("[RemoteCdpDriver] Failed to parse message:", error);
          }
        });

        this.ws.on("error", (error) => {
          console.error("[RemoteCdpDriver] WebSocket error:", error);
          reject(error);
        });

        this.ws.on("close", () => {
          console.log("[RemoteCdpDriver] WebSocket closed");
          this.pendingMessages.forEach(({ reject }, id) => {
            reject(new Error(`WebSocket closed while waiting for message ${id}`));
          });
          this.pendingMessages.clear();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: CDPResponse | CDPEvent): void {
    // 处理响应
    if ("id" in message && typeof message.id === "number") {
      const pending = this.pendingMessages.get(message.id);
      if (pending) {
        this.pendingMessages.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }

    // 处理事件
    if ("method" in message && message.method) {
      this.handleEvent(message.method, message.params);
    }
  }

  private handleEvent(method: string, params?: Record<string, unknown>): void {
    // 处理控制台消息
    if (method === "Runtime.consoleAPICalled") {
      const consoleParams = params as {
        type: string;
        args: { value?: string; description?: string }[];
        timestamp: number;
      };
      this.consoleMessages.push({
        type: consoleParams.type,
        text: consoleParams.args.map(arg => arg.value || arg.description || "").join(" "),
        timestamp: new Date(consoleParams.timestamp).toISOString(),
      });
    }

    // 处理页面错误
    if (method === "Runtime.exceptionThrown") {
      const exceptionParams = params as {
        timestamp: number;
        exceptionDetails: {
          text: string;
          exception?: { description?: string };
        };
      };
      this.pageErrors.push({
        message: exceptionParams.exceptionDetails.exception?.description || exceptionParams.exceptionDetails.text,
        timestamp: new Date(exceptionParams.timestamp).toISOString(),
      });
    }

    // 处理网络请求
    if (method === "Network.requestWillBeSent") {
      const requestParams = params as {
        requestId: string;
        timestamp: number;
        request: { method: string; url: string; headers: Record<string, string> };
      };
      this.networkRequests.push({
        id: requestParams.requestId,
        timestamp: new Date(requestParams.timestamp).toISOString(),
        method: requestParams.request.method,
        url: requestParams.request.url,
        requestHeaders: requestParams.request.headers,
      });
    }

    // 调用注册的事件处理器
    const handlers = this.eventHandlers.get(method);
    if (handlers) {
      handlers.forEach(handler => handler(params));
    }
  }

  private async sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const id = ++this.messageId;
    const message = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });

      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Command timeout: ${method}`));
      }, 30000);

      // 清理超时
      const originalResolve = resolve;
      const originalReject = reject;
      
      this.pendingMessages.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          originalReject(error);
        },
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  private async initializeSession(): Promise<void> {
    // 启用必要的 CDP 域
    await this.sendCommand("Runtime.enable");
    await this.sendCommand("Page.enable");
    await this.sendCommand("Network.enable");
    await this.sendCommand("DOM.enable");

    // 获取当前页面信息
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: `({ url: window.location.href, title: document.title })`,
      returnByValue: true,
    }) as { result: { value: { url: string; title: string } } };

    const pageInfo = result.result.value;
    const targetId = "page-1"; // 使用简单标识

    this.pages.set(targetId, {
      targetId,
      url: pageInfo.url,
      title: pageInfo.title,
    });
    this.activePageId = targetId;

    console.log(`[RemoteCdpDriver] Connected to page: ${pageInfo.title} (${pageInfo.url})`);
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pages.clear();
    this.activePageId = null;
    this.consoleMessages = [];
    this.pageErrors = [];
    this.networkRequests = [];
  }

  async isRunning(): Promise<boolean> {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 标签页管理
  async listTabs(): Promise<import("../types.js").BrowserTab[]> {
    const tabs: import("../types.js").BrowserTab[] = [];
    
    for (const [targetId, page] of this.pages) {
      tabs.push({
        targetId,
        url: page.url,
        title: page.title,
        active: targetId === this.activePageId,
        profile: this.profile.name,
      });
    }
    
    return tabs;
  }

  async openTab(url: string): Promise<import("../types.js").BrowserTab> {
    await assertBrowserNavigationAllowed({ url, ssrfPolicy: this.ssrfPolicy });

    const result = await this.sendCommand("Target.createTarget", { url }) as { targetId: string };
    
    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 获取页面信息
    const targetInfo = await this.sendCommand("Target.getTargetInfo", { targetId: result.targetId }) as { targetInfo: { url: string; title: string } };
    
    const pageInfo: PageInfo = {
      targetId: result.targetId,
      url: targetInfo.targetInfo.url,
      title: targetInfo.targetInfo.title,
    };
    
    this.pages.set(result.targetId, pageInfo);
    this.activePageId = result.targetId;

    return {
      targetId: result.targetId,
      url: pageInfo.url,
      title: pageInfo.title,
      active: true,
      profile: this.profile.name,
    };
  }

  async focusTab(targetId: string): Promise<void> {
    if (!this.pages.has(targetId)) {
      throw new Error(`Tab ${targetId} not found`);
    }
    
    this.activePageId = targetId;
    await this.sendCommand("Target.activateTarget", { targetId });
  }

  async closeTab(targetId: string): Promise<void> {
    if (!this.pages.has(targetId)) {
      throw new Error(`Tab ${targetId} not found`);
    }
    
    await this.sendCommand("Target.closeTarget", { targetId });
    this.pages.delete(targetId);
    
    if (this.activePageId === targetId) {
      this.activePageId = this.pages.keys().next().value ?? null;
    }
  }

  // 导航
  async navigate(url: string, opts?: import("../types.js").NavigateOptions): Promise<{ url: string }> {
    await assertBrowserNavigationAllowed({ url, ssrfPolicy: this.ssrfPolicy });

    const pageId = await this.getActivePageId();

    // 导航到URL
    await this.sendCommand("Page.navigate", { url });
    
    // 等待页面加载
    const waitUntil = opts?.waitUntil ?? "domcontentloaded";
    await this.waitForLoad(waitUntil, opts?.timeoutMs ?? 30000);
    
    // 更新页面信息
    const result = await this.sendCommand("Runtime.evaluate", { expression: "window.location.href" }) as { result: { value: string } };
    const finalUrl = result.result.value;
    
    if (this.activePageId) {
      const page = this.pages.get(this.activePageId);
      if (page) {
        page.url = finalUrl;
      }
    }
    
    return { url: finalUrl };
  }

  private async getActivePageId(): Promise<string> {
    if (!this.activePageId) {
      throw new Error("No active page available");
    }
    // 确保目标页面是活动的
    await this.sendCommand("Target.activateTarget", { targetId: this.activePageId });
    return this.activePageId;
  }

  private async waitForLoad(waitUntil: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Navigation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkLoad = () => {
        // 简化的加载检测，实际应该监听 Page.loadEventFired
        clearTimeout(timeout);
        resolve();
      };

      // 监听加载完成事件
      const handler = () => {
        checkLoad();
      };

      // 设置一次性事件监听
      const handlers = this.eventHandlers.get("Page.loadEventFired") || [];
      const oneTimeHandler = () => {
        handler();
        // 移除自己
        const index = handlers.indexOf(oneTimeHandler);
        if (index > -1) handlers.splice(index, 1);
      };
      handlers.push(oneTimeHandler);
      this.eventHandlers.set("Page.loadEventFired", handlers);

      // 备用：简单延迟
      setTimeout(checkLoad, 2000);
    });
  }

  // 快照方法
  async snapshotAria(opts?: import("../types.js").SnapshotOptions): Promise<import("../types.js").SnapshotAriaResult> {
    // 获取文档的完整可访问性树
    const result = await this.sendCommand("Accessibility.getFullAXTree") as { nodes: Array<{
      nodeId: string;
      role?: { value: string };
      name?: { value: string };
      value?: { value: string };
      description?: { value: string };
      checked?: { value: string };
      disabled?: { value: boolean };
      expanded?: { value: boolean };
      level?: { value: number };
    }> };

    const elements: import("../types.js").AriaElement[] = [];
    let refIndex = 1;

    for (const node of result.nodes.slice(0, opts?.limit ?? 100)) {
      if (node.role?.value) {
        elements.push({
          ref: `e${refIndex++}`,
          role: node.role.value,
          name: node.name?.value || "",
          value: node.value?.value,
          description: node.description?.value,
          checked: node.checked?.value === "true",
          disabled: node.disabled?.value,
          expanded: node.expanded?.value,
          level: node.level?.value,
        });
      }
    }

    // 获取页面文本
    const textResult = await this.sendCommand("Runtime.evaluate", {
      expression: "document.body?.innerText || ''",
    }) as { result: { value: string } };

    return { elements, pageText: textResult.result.value };
  }

  async snapshotAi(opts?: import("../types.js").SnapshotOptions): Promise<import("../types.js").SnapshotAiResult> {
    // 简化的AI快照，基于Aria快照转换
    const ariaResult = await this.snapshotAria(opts);
    
    const elements: import("../types.js").AiElement[] = ariaResult.elements.map(el => ({
      ref: el.ref,
      type: el.role,
      description: el.name,
      text: el.name,
    }));

    return { elements, pageText: ariaResult.pageText };
  }

  async snapshotRole(opts?: import("../types.js").SnapshotOptions): Promise<import("../types.js").SnapshotRoleResult> {
    const ariaResult = await this.snapshotAria(opts);
    
    const elements: import("../types.js").RoleRef[] = ariaResult.elements.map((el, index) => ({
      ref: el.ref,
      role: el.role,
      name: el.name,
      nth: index,
    }));

    return { elements, pageText: ariaResult.pageText };
  }

  async snapshotPlatform(opts?: import("../types.js").SnapshotOptions): Promise<import("../types.js").SnapshotPlatformResult> {
    const script = this.getPlatformSnapshotScript(opts?.platform || "generic");
    
    const result = await this.sendCommand("Runtime.evaluate", { 
      expression: script,
      returnByValue: true,
    }) as { result: { value?: import("../types.js").SnapshotPlatformResult } };
    
    const snapshot = result.result?.value || {
      platform: "generic",
      pageType: "unknown",
      videos: [],
      elements: [],
      comments: [],
      pageText: "",
    };
    
    // 如果是抖音用户页面，尝试获取真实主页链接
    if (opts?.platform === "douyin" && snapshot.pageType === "user") {
      try {
        const realHomepageUrl = await this.getDouyinRealHomepageUrl();
        if (realHomepageUrl && snapshot.user) {
          snapshot.user.homepageUrl = realHomepageUrl;
        }
      } catch (error) {
        console.warn(`[RemoteCdpDriver] Failed to get real homepage URL: ${error}`);
      }
    }
    
    return snapshot;
  }
  
  // 获取抖音真实主页链接（通过点击分享主页按钮）
  private async getDouyinRealHomepageUrl(): Promise<string | undefined> {
    console.log('[RemoteCdpDriver] Getting Douyin real homepage URL...');
    
    // 1. 首先尝试从页面中直接提取短链接（可能已经存在）
    const checkExistingScript = `function() {
      var pageText = document.body.innerText;
      var linkMatch = pageText.match(/(https:\/\/v\.douyin\.com\/[a-zA-Z0-9_-]+)/);
      if (linkMatch) {
        return { found: true, url: linkMatch[1] };
      }
      return { found: false };
    }`;
    
    const existingResult = await this.sendCommand("Runtime.evaluate", {
      expression: `(${checkExistingScript})()`,
      returnByValue: true,
    }) as { result: { value?: { found: boolean; url?: string } } };
    
    if (existingResult.result?.value?.found && existingResult.result.value.url) {
      console.log('[RemoteCdpDriver] Found existing short URL:', existingResult.result.value.url);
      return existingResult.result.value.url;
    }
    
    // 2. 使用录制中获取到的选择器点击【分享主页】按钮
    // 选择器: #frame-user-info-share-button > span > span
    const clickShareScript = `function() {
      // 方法1: 使用录制中获取到的选择器
      var shareBtn = document.querySelector('#frame-user-info-share-button > span > span');
      if (shareBtn && shareBtn.textContent.includes('分享')) {
        shareBtn.click();
        return 'clicked-selector';
      }
      
      // 方法2: 通过data-e2e属性查找
      shareBtn = document.querySelector('[data-e2e="user-share-container"]');
      if (shareBtn) {
        shareBtn.click();
        return 'clicked-e2e';
      }
      
      // 方法3: 通过文本内容查找
      var buttons = Array.from(document.querySelectorAll('button, div, span'));
      shareBtn = buttons.find(function(el) {
        return el.textContent && el.textContent.includes('分享主页');
      });
      if (shareBtn) {
        shareBtn.click();
        return 'clicked-text';
      }
      
      return 'not-found';
    }`;
    
    const clickResult = await this.sendCommand("Runtime.evaluate", {
      expression: `(${clickShareScript})()`,
      returnByValue: true,
    }) as { result: { value?: string } };
    
    console.log('[RemoteCdpDriver] Share button click result:', clickResult.result?.value);
    
    if (clickResult.result?.value === 'not-found') {
      console.warn('[RemoteCdpDriver] Share button not found');
      return undefined;
    }
    
    // 等待弹窗出现
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 3. 确保分享列表显示（如果 hover 没有触发显示，直接修改样式）
    const showListScript = `function() {
      var shareContainer = document.querySelector('[data-e2e="user-share-container"] > div');
      if (shareContainer && shareContainer.style.display === 'none') {
        shareContainer.style.display = 'block';
        return 'shown';
      }
      return 'already-visible-or-not-found';
    }`;
    
    await this.sendCommand("Runtime.evaluate", {
      expression: `(${showListScript})()`,
      returnByValue: true,
    });
    
    // 等待列表显示
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 4. 点击【复制链接】按钮
    // 选择器: #frame-user-info-share-button > span > div > div > div:nth-of-type(2) > div > button:nth-of-type(1)
    // 类名: FmP4URQv y1puhiha
    const clickCopyScript = `function() {
      // 方法1: 使用录制中获取到的选择器
      var copyBtn = document.querySelector('#frame-user-info-share-button > span > div > div > div:nth-of-type(2) > div > button:nth-of-type(1)');
      if (copyBtn && copyBtn.textContent.includes('复制链接')) {
        copyBtn.click();
        return 'clicked-selector';
      }
      
      // 方法2: 通过类名查找
      copyBtn = document.querySelector('button.FmP4URQv.y1puhiha');
      if (copyBtn && copyBtn.textContent.includes('复制链接')) {
        copyBtn.click();
        return 'clicked-class';
      }
      
      // 方法3: 通过文本内容查找
      var buttons = Array.from(document.querySelectorAll('button'));
      copyBtn = buttons.find(function(el) {
        return el.textContent && el.textContent.includes('复制链接');
      });
      if (copyBtn) {
        copyBtn.click();
        return 'clicked-text';
      }
      
      return 'not-found';
    }`;
    
    const copyResult = await this.sendCommand("Runtime.evaluate", {
      expression: `(${clickCopyScript})()`,
      returnByValue: true,
    }) as { result: { value?: string } };
    
    console.log('[RemoteCdpDriver] Copy button click result:', copyResult.result?.value);
    
    if (copyResult.result?.value === 'not-found') {
      console.warn('[RemoteCdpDriver] Copy link button not found');
    }
    
    // 等待剪贴板内容更新
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 4. 从剪贴板中读取短链接
    const readClipboardScript = `async function() {
      try {
        const text = await navigator.clipboard.readText();
        // 从剪贴板文本中提取短链接
        // 格式: 长按复制此条消息，打开抖音搜索，查看TA的更多作品。 \`https://v.douyin.com/xxxxx/\`
        const linkMatch = text.match(/(https:\/\/v\.douyin\.com\/[a-zA-Z0-9_-]+)/);
        if (linkMatch) {
          return linkMatch[1];
        }
      } catch (e) {
        // 剪贴板读取失败，返回 null
      }
      return null;
    }`;
    
    const clipboardResult = await this.sendCommand("Runtime.evaluate", {
      expression: `(${readClipboardScript})()`,
      returnByValue: true,
      awaitPromise: true,
    }) as { result: { value?: string } };
    
    const shortUrl = clipboardResult.result?.value;
    
    // 5. 关闭弹窗
    const closeScript = `function() {
      // 按 ESC 键关闭弹窗
      var evt = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
      document.dispatchEvent(evt);
      // 点击空白处
      var blankArea = document.querySelector('body');
      if (blankArea) {
        var clickEvt = new MouseEvent('click', { bubbles: true });
        blankArea.dispatchEvent(clickEvt);
      }
      return 'closed';
    }`;
    
    await this.sendCommand("Runtime.evaluate", {
      expression: `(${closeScript})()`,
      returnByValue: true,
    });
    
    if (shortUrl) {
      console.log('[RemoteCdpDriver] Found short URL:', shortUrl);
    }
    
    return shortUrl;
  }

  private getPlatformSnapshotScript(platform: import("../types.js").PlatformName): string {
    if (platform === "douyin") {
      // 使用外部脚本文件获取抖音平台快照脚本
      return getDouyinUserScript();
    }

    return `
      (function() {
        return {
          platform: 'generic',
          pageType: 'unknown',
          elements: [],
          pageText: document.body.innerText.slice(0, 50000)
        };
      })()
    `;
  }

  // 元素交互
  async click(ref: string, opts?: import("../types.js").ClickOptions): Promise<void> {
    // 通过 ref 查找元素并点击
    // 简化实现：使用 JavaScript 执行点击
    const script = `
      (function() {
        const element = document.querySelector('[data-ref="${ref}"]') || 
                       document.querySelector('[aria-ref="${ref}"]') ||
                       document.querySelectorAll('*')[${parseInt(ref.replace('e', '')) - 1}];
        if (element) {
          element.click();
          return true;
        }
        return false;
      })()
    `;
    
    const result = await this.sendCommand("Runtime.evaluate", { expression: script }) as { result: { value: boolean } };
    
    if (!result.result.value) {
      throw new Error(`Element with ref ${ref} not found`);
    }
  }

  async type(ref: string, text: string, opts?: import("../types.js").TypeOptions): Promise<void> {
    // 先聚焦元素
    await this.click(ref);
    
    // 如果需要清空，先选择全部
    if (opts?.clear) {
      await this.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "a",
        modifiers: 2, // Ctrl
      });
      await this.sendCommand("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "a",
        modifiers: 2,
      });
    }

    // 输入文本
    for (const char of text) {
      await this.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: char,
      });
      await this.sendCommand("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: char,
      });
      
      if (opts?.delayMs) {
        await new Promise(resolve => setTimeout(resolve, opts.delayMs));
      }
    }

    // 如果需要提交
    if (opts?.submit) {
      await this.press("Enter");
    }
  }

  async hover(ref: string, opts?: import("../types.js").HoverOptions): Promise<void> {
    // 简化实现：通过 JavaScript 触发 mouseover 事件
    const script = `
      (function() {
        const element = document.querySelector('[data-ref="${ref}"]') || 
                       document.querySelectorAll('*')[${parseInt(ref.replace('e', '')) - 1}];
        if (element) {
          const event = new MouseEvent('mouseover', { bubbles: true });
          element.dispatchEvent(event);
          return true;
        }
        return false;
      })()
    `;
    
    const result = await this.sendCommand("Runtime.evaluate", { expression: script }) as { result: { value: boolean } };
    
    if (!result.result.value) {
      throw new Error(`Element with ref ${ref} not found`);
    }
  }

  async drag(startRef: string, endRef: string, opts?: import("../types.js").DragOptions): Promise<void> {
    // 简化实现：通过 JavaScript 模拟拖拽
    const script = `
      (function() {
        const startEl = document.querySelector('[data-ref="${startRef}"]') || 
                       document.querySelectorAll('*')[${parseInt(startRef.replace('e', '')) - 1}];
        const endEl = document.querySelector('[data-ref="${endRef}"]') || 
                     document.querySelectorAll('*')[${parseInt(endRef.replace('e', '')) - 1}];
        
        if (!startEl || !endEl) return false;
        
        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();
        
        const startX = startRect.left + startRect.width / 2;
        const startY = startRect.top + startRect.height / 2;
        const endX = endRect.left + endRect.width / 2;
        const endY = endRect.top + endRect.height / 2;
        
        // 触发拖拽事件
        startEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
        endEl.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
        endEl.dispatchEvent(new DragEvent('drop', { bubbles: true }));
        startEl.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
        
        return true;
      })()
    `;
    
    const result = await this.sendCommand("Runtime.evaluate", { expression: script }) as { result: { value: boolean } };
    
    if (!result.result.value) {
      throw new Error(`Elements not found for drag operation`);
    }
  }

  async select(ref: string, values: string[], opts?: import("../types.js").SelectOptions): Promise<void> {
    const script = `
      (function() {
        const select = document.querySelector('[data-ref="${ref}"]') || 
                      document.querySelectorAll('select')[${parseInt(ref.replace('e', '')) - 1}];
        if (!select || select.tagName !== 'SELECT') return false;
        
        const values = ${JSON.stringify(values)};
        for (const option of select.options) {
          option.selected = values.includes(option.value);
        }
        
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;
    
    const result = await this.sendCommand("Runtime.evaluate", { expression: script }) as { result: { value: boolean } };
    
    if (!result.result.value) {
      throw new Error(`Select element with ref ${ref} not found`);
    }
  }

  async press(key: string, opts?: import("../types.js").PressOptions): Promise<void> {
    await this.sendCommand("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
    });
    await this.sendCommand("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
    });
  }

  async fillForm(fields: import("../types.js").FormField[], opts?: import("../types.js").FillFormOptions): Promise<void> {
    for (const field of fields) {
      await this.type(field.ref, field.value, { timeoutMs: opts?.timeoutMs });
    }
  }

  // 截图
  async screenshot(opts?: import("../types.js").ScreenshotOptions): Promise<Buffer> {
    const result = await this.sendCommand("Page.captureScreenshot", {
      format: opts?.type ?? "png",
      quality: opts?.type === "jpeg" ? (opts?.quality ?? 80) : undefined,
      fromSurface: true,
    }) as { data: string };

    return Buffer.from(result.data, "base64");
  }

  // JavaScript 执行
  async evaluate(fn: string, opts?: import("../types.js").EvaluateOptions): Promise<unknown> {
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: `(${fn})()`,
      returnByValue: true,
    }) as { result: { value?: unknown; type?: string } };

    return result.result.value;
  }

  // 等待
  async wait(opts: import("../types.js").WaitOptions): Promise<void> {
    if (opts.selector) {
      // 等待元素出现
      const startTime = Date.now();
      while (Date.now() - startTime < (opts.timeoutMs ?? 30000)) {
        const result = await this.sendCommand("Runtime.evaluate", {
          expression: `document.querySelector("${opts.selector}") !== null`,
        }) as { result: { value: boolean } };
        
        if (result.result.value) {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for selector: ${opts.selector}`);
    } else if (opts.url) {
      // 等待URL匹配
      const startTime = Date.now();
      while (Date.now() - startTime < (opts.timeoutMs ?? 30000)) {
        const result = await this.sendCommand("Runtime.evaluate", {
          expression: `window.location.href`,
        }) as { result: { value: string } };
        
        if (result.result.value.includes(opts.url)) {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for URL: ${opts.url}`);
    } else {
      // 简单延迟
      await new Promise(resolve => setTimeout(resolve, opts.timeoutMs ?? 1000));
    }
  }

  // 调试信息
  async getConsoleMessages(): Promise<import("../types.js").BrowserConsoleMessage[]> {
    return [...this.consoleMessages];
  }

  async getPageErrors(): Promise<import("../types.js").BrowserPageError[]> {
    return [...this.pageErrors];
  }

  async getNetworkRequests(): Promise<import("../types.js").BrowserNetworkRequest[]> {
    return [...this.networkRequests];
  }

  // 存储管理
  async getCookies(): Promise<import("../types.js").Cookie[]> {
    const result = await this.sendCommand("Network.getAllCookies") as { cookies: import("../types.js").Cookie[] };
    return result.cookies;
  }

  async setCookies(cookies: import("../types.js").Cookie[]): Promise<void> {
    for (const cookie of cookies) {
      await this.sendCommand("Network.setCookie", {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      });
    }
  }

  async clearCookies(): Promise<void> {
    await this.sendCommand("Network.clearBrowserCookies");
  }

  async getStorage(kind: "local" | "session"): Promise<Record<string, unknown>> {
    const storageType = kind === "local" ? "localStorage" : "sessionStorage";
    const result = await this.sendCommand("Runtime.evaluate", {
      expression: `
        (() => {
          const data = {};
          for (let i = 0; i < ${storageType}.length; i++) {
            const key = ${storageType}.key(i);
            try {
              data[key] = JSON.parse(${storageType}.getItem(key));
            } catch {
              data[key] = ${storageType}.getItem(key);
            }
          }
          return data;
        })()
      `,
      returnByValue: true,
    }) as { result: { value: Record<string, unknown> } };

    return result.result.value;
  }

  async setStorage(kind: "local" | "session", data: Record<string, unknown>): Promise<void> {
    const storageType = kind === "local" ? "localStorage" : "sessionStorage";
    
    for (const [key, value] of Object.entries(data)) {
      await this.sendCommand("Runtime.evaluate", {
        expression: `${storageType}.setItem("${key}", ${JSON.stringify(typeof value === "string" ? value : JSON.stringify(value))})`,
      });
    }
  }

  async clearStorage(kind: "local" | "session"): Promise<void> {
    const storageType = kind === "local" ? "localStorage" : "sessionStorage";
    await this.sendCommand("Runtime.evaluate", {
      expression: `${storageType}.clear()`,
    });
  }

  // 下载
  async download(ref: string, filename: string): Promise<void> {
    // 触发点击，让浏览器处理下载
    await this.click(ref);
    // 远程CDP模式下，下载处理取决于远程服务的配置
    console.log(`[RemoteCdpDriver] Download triggered for ${filename}`);
  }

  async waitForDownload(filename: string, opts?: import("../types.js").WaitForDownloadOptions): Promise<string> {
    // 远程CDP模式下，下载处理取决于远程服务的配置
    throw new Error("waitForDownload not fully supported in RemoteCdpDriver");
  }

  // PDF
  async pdf(): Promise<Buffer> {
    const result = await this.sendCommand("Page.printToPDF", {
      printBackground: true,
    }) as { data: string };

    return Buffer.from(result.data, "base64");
  }

  // 视口调整
  async resize(width: number, height: number): Promise<void> {
    await this.sendCommand("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  // 高亮
  async highlight(ref: string): Promise<void> {
    const script = `
      (function() {
        const element = document.querySelector('[data-ref="${ref}"]') || 
                       document.querySelectorAll('*')[${parseInt(ref.replace('e', '')) - 1}];
        if (element) {
          const originalOutline = element.style.outline;
          element.style.outline = '2px solid red';
          setTimeout(() => {
            element.style.outline = originalOutline;
          }, 2000);
          return true;
        }
        return false;
      })()
    `;
    
    await this.sendCommand("Runtime.evaluate", { expression: script });
  }

  // 追踪
  async traceStart(): Promise<void> {
    await this.sendCommand("Tracing.start", {
      categories: "devtools.timeline,v8,blink",
    });
  }

  async traceStop(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Trace stop timeout"));
      }, 30000);

      const handler = (params: unknown) => {
        const data = params as { stream: string };
        clearTimeout(timeout);
        
        // 读取追踪数据流
        this.readTraceStream(data.stream).then(resolve).catch(reject);
      };

      const handlers = this.eventHandlers.get("Tracing.tracingComplete") || [];
      handlers.push(handler);
      this.eventHandlers.set("Tracing.tracingComplete", handlers);

      this.sendCommand("Tracing.end").catch(reject);
    });
  }

  private async readTraceStream(stream: string): Promise<Buffer> {
    return Buffer.from("");
  }

  getActivePage(): import("playwright-core").Page | null {
    console.warn("[RemoteCdpDriver] getActivePage not supported in remote CDP mode");
    return null;
  }
  
  async ensureActivePage(): Promise<import("playwright-core").Page | null> {
    console.warn("[RemoteCdpDriver] ensureActivePage not supported in remote CDP mode");
    return null;
  }
}
