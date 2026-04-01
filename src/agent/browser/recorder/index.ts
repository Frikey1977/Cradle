/**
 * 浏览器操作录制器 - 核心录制逻辑
 */

import type { Page, BrowserContext, Locator } from "playwright-core";
import {
  type RecordedAction,
  type RecordingSession,
  type RecorderConfig,
  type ActionType,
  type ElementInfo,
  type PageSnapshot,
  generateSessionId,
  createRecordedAction,
} from "./types.js";

export class BrowserRecorder {
  private session: RecordingSession | null = null;
  private lastSession: RecordingSession | null = null;
  private config: RecorderConfig;
  private context: BrowserContext | null = null;
  private pages: Set<Page> = new Set();
  private listeners: Array<() => void> = [];
  private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  
  // 回放控制状态
  private replayState: {
    isPlaying: boolean;
    isPaused: boolean;
    shouldStop: boolean;
    currentIndex: number;
  } = {
    isPlaying: false,
    isPaused: false,
    shouldStop: false,
    currentIndex: 0,
  };

  constructor(config: RecorderConfig = {}) {
    this.config = {
      captureScreenshot: config.captureScreenshot ?? false,
      captureSnapshot: config.captureSnapshot ?? true,
      ignoreSelectors: config.ignoreSelectors ?? [],
      maxActions: config.maxActions ?? 1000,
    };
  }

  async startRecording(
    page: Page,
    options: {
      name?: string;
      description?: string;
      tags?: string[];
    } = {}
  ): Promise<RecordingSession> {
    if (this.session) {
      throw new Error("Recording already in progress. Stop it first.");
    }

    this.context = page.context();
    this.session = {
      id: generateSessionId(),
      name: options.name,
      description: options.description,
      startTime: Date.now(),
      actions: [],
      metadata: {
        profile: "default",
        startUrl: page.url(),
        tags: options.tags,
      },
    };

    await this.setupContextListeners();

    return this.session;
  }

  private async setupContextListeners(): Promise<void> {
    if (!this.context) return;

    this.context.on("page", async (page: Page) => {
      await this.setupPageListeners(page);
    });

    for (const page of this.context.pages()) {
      await this.setupPageListeners(page);
    }
  }

  private async setupPageListeners(page: Page): Promise<void> {
    if (this.pages.has(page)) return;
    this.pages.add(page);

    console.log("[Recorder] Setting up listeners for page:", page.url());

    await page.waitForLoadState("domcontentloaded").catch(() => {});

    try {
      await page.exposeFunction("__cradle_record_action", async (data: {
        type: ActionType;
        selector?: string;
        element?: ElementInfo;
        value?: string;
      }) => {
        await this.recordAction(data.type, data, page);
      });
    } catch {
      // Function may already exist, ignore
    }

    const scriptContent = `
      (function() {
        function getElementInfo(el) {
          var rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName.toLowerCase(),
            id: el.id || undefined,
            className: el.className && typeof el.className === 'string' ? el.className : undefined,
            name: el.name || undefined,
            type: el.type || undefined,
            placeholder: el.placeholder || undefined,
            value: el.value || undefined,
            text: el.textContent ? el.textContent.trim().substring(0, 100) : undefined,
            ariaLabel: el.getAttribute('aria-label') || undefined,
            href: el.href || undefined,
            src: el.src || undefined,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          };
        }

        function getSelector(el) {
          if (el.id) return '#' + el.id;
          
          var path = [];
          var current = el;
          
          while (current && current !== document.body) {
            var selector = current.tagName.toLowerCase();
            
            if (current.id) {
              selector = '#' + current.id;
              path.unshift(selector);
              break;
            }
            
            var parent = current.parentElement;
            if (parent) {
              var siblings = Array.from(parent.children).filter(function(c) {
                return c.tagName === current.tagName;
              });
              if (siblings.length > 1) {
                var index = siblings.indexOf(current) + 1;
                selector += ':nth-of-type(' + index + ')';
              }
            }
            
            path.unshift(selector);
            current = parent;
          }
          
          return path.join(' > ');
        }

        var keyboardState = {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          altRight: false
        };

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Control') keyboardState.ctrl = true;
          if (e.key === 'Alt') keyboardState.alt = true;
          if (e.key === 'Shift') keyboardState.shift = true;
          if (e.key === 'Meta') keyboardState.meta = true;
          if (e.code === 'AltRight') keyboardState.altRight = true;
          
          var isModifierKey = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta';
          var hasModifier = keyboardState.ctrl || keyboardState.alt || keyboardState.shift || keyboardState.meta;
          
          if (isModifierKey) return;
          
          // 过滤输入法处理过程中的特殊键
          if (e.key === 'Process' || e.key === 'Unidentified' || e.key === 'Dead') return;
          
          var target = e.target;
          if (!target || !target.tagName) return;
          
          var isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          var isPrintableChar = e.key.length === 1 && !hasModifier;
          
          if (hasModifier || !isEditable || !isPrintableChar) {
            var keyValue = e.key;
            if (hasModifier) {
              var combo = [];
              if (keyboardState.ctrl) combo.push('Control');
              if (keyboardState.alt) combo.push('Alt');
              if (keyboardState.shift) combo.push('Shift');
              if (keyboardState.meta) combo.push('Meta');
              combo.push(e.key);
              keyValue = combo.join('+');
            }
            
            window.__cradle_record_action({
              type: 'keydown',
              selector: getSelector(target),
              element: getElementInfo(target),
              value: keyValue
            });
          }
        }, true);

        document.addEventListener('keyup', function(e) {
          if (e.key === 'Control') keyboardState.ctrl = false;
          if (e.key === 'Alt') keyboardState.alt = false;
          if (e.key === 'Shift') keyboardState.shift = false;
          if (e.key === 'Meta') keyboardState.meta = false;
          if (e.code === 'AltRight') keyboardState.altRight = false;
        }, true);

        var isMouseRecording = false;
        var mouseRecordInterval = null;
        var lastMouseX = 0;
        var lastMouseY = 0;

        function startMouseRecording() {
          if (isMouseRecording) return;
          isMouseRecording = true;
          var points = [];
          
          mouseRecordInterval = setInterval(function() {
            points.push({
              x: lastMouseX,
              y: lastMouseY,
              t: Date.now()
            });
          }, 100);
          
          window.__cradle_mouse_points = points;
        }

        function stopMouseRecording() {
          if (!isMouseRecording) return;
          isMouseRecording = false;
          
          if (mouseRecordInterval) {
            clearInterval(mouseRecordInterval);
            mouseRecordInterval = null;
          }
          
          var points = window.__cradle_mouse_points || [];
          if (points.length > 0) {
            window.__cradle_record_action({
              type: 'mousemove',
              value: JSON.stringify({
                points: points,
                pointCount: points.length
              })
            });
          }
          
          window.__cradle_mouse_points = [];
        }

        document.addEventListener('mousemove', function(e) {
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          
          if (keyboardState.altRight) {
            startMouseRecording();
          } else {
            stopMouseRecording();
          }
        }, true);

        document.addEventListener('click', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          window.__cradle_record_action({
            type: 'click',
            selector: getSelector(target),
            element: getElementInfo(target)
          });
        }, true);

        document.addEventListener('dblclick', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          window.__cradle_record_action({
            type: 'dblclick',
            selector: getSelector(target),
            element: getElementInfo(target)
          });
        }, true);

        var inputTimeout = null;
        document.addEventListener('input', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          if (inputTimeout) clearTimeout(inputTimeout);
          
          inputTimeout = setTimeout(function() {
            window.__cradle_record_action({
              type: 'input',
              selector: getSelector(target),
              element: getElementInfo(target),
              value: target.value || ''
            });
          }, 300);
        }, true);

        document.addEventListener('change', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          var tagName = target.tagName.toLowerCase();
          if (tagName === 'select') {
            window.__cradle_record_action({
              type: 'select',
              selector: getSelector(target),
              element: getElementInfo(target),
              value: target.value
            });
          }
        }, true);

        var hoverTimeout = null;
        var lastHoverSelector = null;
        document.addEventListener('mouseover', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          var selector = getSelector(target);
          
          // 相邻同一元素不重复记录
          if (lastHoverSelector === selector) return;
          
          if (hoverTimeout) clearTimeout(hoverTimeout);
          
          hoverTimeout = setTimeout(function() {
            // 再次检查是否是同一元素
            if (lastHoverSelector === selector) return;
            lastHoverSelector = selector;
            
            var elementInfo = getElementInfo(target);
            // 使用鼠标实际位置
            elementInfo.rect.x = e.clientX - 5;
            elementInfo.rect.y = e.clientY - 5;
            elementInfo.rect.width = 10;
            elementInfo.rect.height = 10;
            
            window.__cradle_record_action({
              type: 'hover',
              selector: selector,
              element: elementInfo
            });
          }, 1500);
        }, true);

        var scrollTimeout = null;
        document.addEventListener('scroll', function(e) {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          
          scrollTimeout = setTimeout(function() {
            var target = e.target;
            var scrollInfo = {
              scrollX: window.scrollX,
              scrollY: window.scrollY,
              elementScroll: null
            };
            
            if (target && target !== document && target !== document.body && target !== document.documentElement) {
              scrollInfo.elementScroll = {
                selector: getSelector(target),
                tagName: target.tagName,
                className: target.className,
                scrollTop: target.scrollTop,
                scrollLeft: target.scrollLeft
              };
            }
            
            window.__cradle_record_action({
              type: 'scroll',
              value: JSON.stringify(scrollInfo)
            });
          }, 500);
        }, true);

        document.addEventListener('paste', function(e) {
          var target = e.target;
          if (!target || !target.tagName) return;
          
          var pastedText = '';
          if (e.clipboardData && e.clipboardData.getData) {
            pastedText = e.clipboardData.getData('text/plain');
          }
          
          window.__cradle_record_action({
            type: 'paste',
            selector: getSelector(target),
            element: getElementInfo(target),
            value: pastedText
          });
        }, true);
      })();
    `;

    try {
      await page.evaluate(scriptContent);
      console.log("[Recorder] Script injected successfully");
    } catch (e) {
      console.log("[Recorder] Script injection error:", e);
      // Page may have navigated, try again after load
      try {
        await page.waitForLoadState("domcontentloaded");
        await page.evaluate(scriptContent);
        console.log("[Recorder] Script injected after retry");
      } catch (e2) {
        console.log("[Recorder] Script injection retry failed:", e2);
        // Ignore if still failing
      }
    }

    page.on("framenavigated", async (frame: import("playwright-core").Frame) => {
      if (frame === page.mainFrame()) {
        let pageTitle: string | undefined;
        try {
          pageTitle = await page.title();
        } catch {
          // Ignore - page context may be destroyed during navigation
        }
        
        await this.recordAction("navigate", {
          url: page.url(),
          pageTitle,
        }, page);
        
        // Re-inject script after navigation
        try {
          await page.evaluate(scriptContent);
        } catch (e) {
          // Ignore navigation errors
        }
      }
    });

    const removeListener = () => {
      page.removeListener("framenavigated", () => {});
    };
    this.listeners.push(removeListener);
  }

  async stopRecording(): Promise<RecordingSession | null> {
    if (!this.session) {
      return null;
    }

    this.removeAllListeners();

    this.session.endTime = Date.now();
    const session = this.session;
    this.lastSession = session;
    this.session = null;
    this.context = null;
    this.pages.clear();

    return session;
  }

  isRecording(): boolean {
    return this.session !== null;
  }

  getSession(): RecordingSession | null {
    return this.session ?? this.lastSession;
  }

  getLastSession(): RecordingSession | null {
    return this.lastSession;
  }

  loadSession(session: RecordingSession): void {
    this.lastSession = session;
  }

  getActions(): RecordedAction[] {
    return this.session?.actions ?? this.lastSession?.actions ?? [];
  }

  getAction(index: number): RecordedAction | null {
    const actions = this.getActions();
    if (index >= 0 && index < actions.length) {
      return actions[index];
    }
    return null;
  }

  async replaySingleAction(
    page: Page,
    actionOrIndex: RecordedAction | number
  ): Promise<{ success: boolean; action: RecordedAction | null; error?: string }> {
    const action = typeof actionOrIndex === "number" 
      ? this.getAction(actionOrIndex) 
      : actionOrIndex;
    
    if (!action) {
      return { success: false, action: null, error: "Action not found" };
    }

    try {
      await this.replayAction(page, action);
      return { success: true, action };
    } catch (error) {
      return { success: false, action, error: String(error) };
    }
  }

  async executeActionJson(
    page: Page,
    actionJson: Record<string, unknown>,
    showCursor: boolean = true
  ): Promise<{ success: boolean; action: RecordedAction | null; error?: string }> {
    if (!actionJson || typeof actionJson !== "object") {
      return { success: false, action: null, error: "Invalid action JSON" };
    }

    if (!actionJson.type) {
      return { success: false, action: null, error: "Action must have a 'type' field" };
    }

    const action: RecordedAction = {
      id: String(actionJson.id || `action-${Date.now()}`),
      timestamp: Number(actionJson.timestamp) || Date.now(),
      type: actionJson.type as ActionType,
      url: String(actionJson.url || page.url()),
      pageTitle: actionJson.pageTitle ? String(actionJson.pageTitle) : undefined,
      selector: actionJson.selector ? String(actionJson.selector) : undefined,
      element: actionJson.element as ElementInfo | undefined,
      value: actionJson.value ? String(actionJson.value) : undefined,
      strictMatch: actionJson.strictMatch !== undefined ? Boolean(actionJson.strictMatch) : undefined,
    };

    if (showCursor) {
      await this.injectCursor(page);
    }

    try {
      await this.replayAction(page, action, showCursor);
      return { success: true, action };
    } catch (error) {
      return { success: false, action, error: String(error) };
    }
  }

  async replayFrom(
    page: Page,
    startIndex: number,
    options: {
      count?: number;
      delay?: number;
      useOriginalTiming?: boolean;
      speedMultiplier?: number;
      onAction?: (action: RecordedAction, index: number) => void;
    } = {}
  ): Promise<{ success: boolean; replayedCount: number; errors: string[]; startIndex: number; endIndex: number }> {
    const actions = this.getActions();
    const count = options.count ?? actions.length - startIndex;
    const endIndex = Math.min(startIndex + count, actions.length);
    
    if (startIndex < 0 || startIndex >= actions.length) {
      return { success: false, replayedCount: 0, errors: ["Invalid start index"], startIndex, endIndex: startIndex };
    }

    const actionsToReplay = actions.slice(startIndex, endIndex);
    const result = await this.replay(page, {
      ...options,
      actions: actionsToReplay,
    });

    return {
      ...result,
      startIndex,
      endIndex: startIndex + result.replayedCount,
    };
  }

  async replay(
    page: Page,
    options: {
      sessionId?: string;
      actions?: RecordedAction[];
      delay?: number;
      useOriginalTiming?: boolean;
      speedMultiplier?: number;
      onAction?: (action: RecordedAction, index: number) => void;
      showCursor?: boolean;
      startIndex?: number;
    } = {}
  ): Promise<{ success: boolean; replayedCount: number; errors: string[]; stopped?: boolean; paused?: boolean; currentIndex: number }> {
    const actions = options.actions || this.lastSession?.actions || [];
    const useOriginalTiming = options.useOriginalTiming ?? true;
    const speedMultiplier = options.speedMultiplier ?? 1;
    const defaultDelay = options.delay ?? 500;
    const showCursor = options.showCursor ?? true;
    const startIndex = options.startIndex ?? 0;
    const errors: string[] = [];
    let replayedCount = 0;

    if (actions.length === 0) {
      return { success: false, replayedCount: 0, errors: ["No actions to replay"], currentIndex: 0 };
    }

    // 重置回放状态
    this.replayState = {
      isPlaying: true,
      isPaused: false,
      shouldStop: false,
      currentIndex: startIndex,
    };

    if (showCursor) {
      await this.injectCursor(page);
    }

    for (let i = startIndex; i < actions.length; i++) {
      // 检查是否需要停止
      if (this.replayState.shouldStop) {
        this.replayState.isPlaying = false;
        return {
          success: errors.length === 0,
          replayedCount,
          errors,
          stopped: true,
          currentIndex: i,
        };
      }

      // 检查是否暂停
      while (this.replayState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
        // 暂停期间也检查停止信号
        if (this.replayState.shouldStop) {
          this.replayState.isPlaying = false;
          return {
            success: errors.length === 0,
            replayedCount,
            errors,
            stopped: true,
            paused: true,
            currentIndex: i,
          };
        }
      }

      const action = actions[i];
      this.replayState.currentIndex = i;
      
      try {
        await this.replayAction(page, action, showCursor);
        replayedCount++;
        
        if (options.onAction) {
          options.onAction(action, i);
        }
        
        if (i < actions.length - 1) {
          let delay: number;
          
          if (useOriginalTiming && action.timestamp) {
            const nextAction = actions[i + 1];
            const actualInterval = nextAction.timestamp - action.timestamp;
            delay = Math.max(0, actualInterval / speedMultiplier);
          } else {
            delay = defaultDelay;
          }
          
          if (delay > 0) {
            // 在延迟期间也检查暂停和停止
            const delayStart = Date.now();
            while (Date.now() - delayStart < delay) {
              if (this.replayState.shouldStop) {
                this.replayState.isPlaying = false;
                return {
                  success: errors.length === 0,
                  replayedCount,
                  errors,
                  stopped: true,
                  currentIndex: i + 1,
                };
              }
              if (this.replayState.isPaused) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
              }
              await new Promise(resolve => setTimeout(resolve, Math.min(50, delay - (Date.now() - delayStart))));
            }
          }
        }
      } catch (error) {
        errors.push(`Action ${i + 1} (${action.type}): ${error}`);
      }
    }

    this.replayState.isPlaying = false;
    return {
      success: errors.length === 0,
      replayedCount,
      errors,
      currentIndex: actions.length,
    };
  }

  /**
   * 暂停回放
   */
  pauseReplay(): { success: boolean; message: string } {
    if (!this.replayState.isPlaying) {
      return { success: false, message: "No replay is currently running" };
    }
    if (this.replayState.isPaused) {
      return { success: false, message: "Replay is already paused" };
    }
    this.replayState.isPaused = true;
    return { success: true, message: `Replay paused at action ${this.replayState.currentIndex}` };
  }

  /**
   * 继续回放
   */
  resumeReplay(): { success: boolean; message: string } {
    if (!this.replayState.isPlaying) {
      return { success: false, message: "No replay is currently running" };
    }
    if (!this.replayState.isPaused) {
      return { success: false, message: "Replay is not paused" };
    }
    this.replayState.isPaused = false;
    return { success: true, message: "Replay resumed" };
  }

  /**
   * 停止回放
   */
  stopReplay(): { success: boolean; message: string; currentIndex: number } {
    if (!this.replayState.isPlaying) {
      return { success: false, message: "No replay is currently running", currentIndex: this.replayState.currentIndex };
    }
    this.replayState.shouldStop = true;
    this.replayState.isPaused = false;
    const stoppedIndex = this.replayState.currentIndex;
    return { success: true, message: `Replay stopped at action ${stoppedIndex}`, currentIndex: stoppedIndex };
  }

  /**
   * 获取回放状态
   */
  getReplayStatus(): {
    isPlaying: boolean;
    isPaused: boolean;
    currentIndex: number;
    totalActions: number;
  } {
    return {
      isPlaying: this.replayState.isPlaying,
      isPaused: this.replayState.isPaused,
      currentIndex: this.replayState.currentIndex,
      totalActions: this.lastSession?.actions?.length || 0,
    };
  }

  private async injectCursor(page: Page): Promise<void> {
    const cursorScript = `
      if (!window.__cradle_replay_cursor) {
        var cursor = document.createElement('div');
        cursor.id = '__cradle_replay_cursor';
        cursor.style.cssText = 'position:fixed;width:20px;height:20px;pointer-events:none;z-index:2147483647;border-radius:50%;background:rgba(255,0,0,0.5);border:2px solid red;transform:translate(-50%,-50%);transition:all 0.1s ease;display:none;';
        document.body.appendChild(cursor);
        
        var label = document.createElement('div');
        label.id = '__cradle_replay_label';
        label.style.cssText = 'position:fixed;padding:4px 8px;background:rgba(0,0,0,0.8);color:white;font-size:12px;border-radius:4px;pointer-events:none;z-index:2147483647;transform:translate(10px,-50%);display:none;white-space:nowrap;';
        document.body.appendChild(label);
        
        window.__cradle_replay_cursor = cursor;
        window.__cradle_replay_label = label;
      }
    `;
    
    try {
      await page.evaluate(cursorScript);
    } catch (e) {
      // Ignore injection errors
    }
  }

  private quadraticBezier(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    return { x, y };
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  private addJitter(value: number, range: number = 4): number {
    return value + (Math.random() - 0.5) * range * 2;
  }

  private randomDelay(min: number = 50, max: number = 200): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

  private async interpolateMouseMovement(
    page: Page,
    targetX: number,
    targetY: number,
    showCursor: boolean = true
  ): Promise<void> {
    const startX = this.lastMousePosition.x;
    const startY = this.lastMousePosition.y;
    
    const distance = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
    
    if (distance < 10) {
      this.lastMousePosition = { x: targetX, y: targetY };
      return;
    }
    
    const numPoints = Math.min(5, Math.max(3, Math.floor(distance / 100)));
    const totalDuration = Math.min(500, Math.max(300, distance / 2));
    
    const midX = (startX + targetX) / 2 + (Math.random() - 0.5) * 80;
    const midY = (startY + targetY) / 2 + (Math.random() - 0.5) * 80;
    const controlPoint = { x: midX, y: midY };
    const startPoint = { x: startX, y: startY };
    const endPoint = { x: targetX, y: targetY };
    
    for (let i = 1; i <= numPoints; i++) {
      const progress = i / numPoints;
      const easedProgress = this.easeOutQuad(progress);
      
      const t = easedProgress;
      let point = this.quadraticBezier(startPoint, controlPoint, endPoint, t);
      
      point.x = this.addJitter(point.x, 4);
      point.y = this.addJitter(point.y, 4);
      
      await page.mouse.move(point.x, point.y);
      if (showCursor) {
        await this.showCursor(page, point.x, point.y);
      }
      
      if (i < numPoints) {
        const stepDelay = totalDuration / numPoints + this.randomDelay(10, 50);
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
    }
    
    this.lastMousePosition = { x: targetX, y: targetY };
  }

  private async showCursor(page: Page, x: number, y: number, label?: string): Promise<void> {
    const showScript = `
      if (window.__cradle_replay_cursor) {
        var cursor = window.__cradle_replay_cursor;
        cursor.style.left = '${x}px';
        cursor.style.top = '${y}px';
        cursor.style.display = 'block';
        
        var labelEl = window.__cradle_replay_label;
        if (labelEl) {
          labelEl.style.left = '${x}px';
          labelEl.style.top = '${y}px';
          labelEl.textContent = '${label || ''}';
          labelEl.style.display = label ? 'block' : 'none';
        }
      }
    `;
    
    try {
      await page.evaluate(showScript);
    } catch (e) {
      // Ignore errors
    }
  }

  private async hideCursor(page: Page): Promise<void> {
    const hideScript = `
      if (window.__cradle_replay_cursor) {
        window.__cradle_replay_cursor.style.display = 'none';
      }
      if (window.__cradle_replay_label) {
        window.__cradle_replay_label.style.display = 'none';
      }
    `;
    
    try {
      await page.evaluate(hideScript);
    } catch (e) {
      // Ignore errors
    }
  }

  private async highlightElement(page: Page, locator: Locator, label?: string): Promise<void> {
    try {
      const box = await locator.boundingBox();
      if (box) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        await this.showCursor(page, centerX, centerY, label);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  private async findElementWithFallback(
    page: Page,
    action: RecordedAction
  ): Promise<{ locator: Locator; method: string } | null> {
    const strictMatch = action.strictMatch ?? true;
    
    if (action.selector) {
      try {
        const locator = page.locator(action.selector);
        const count = await locator.count();
        if (count > 0) {
          return { locator, method: "selector" };
        }
      } catch {
        // Selector failed, continue to fallback
      }
    }
    
    if (strictMatch) {
      return null;
    }
    
    if (action.element) {
      const elem = action.element;
      
      if (elem.tagName) {
        const tagName = elem.tagName.toLowerCase();
        
        if (elem.className) {
          try {
            const classes = elem.className.split(/\s+/).filter(c => c.length > 3);
            for (const cls of classes.slice(0, 2)) {
              const locator = page.locator(`${tagName}.${cls}`);
              const count = await locator.count();
              if (count > 0) {
                return { locator: locator.first(), method: "class-fallback" };
              }
            }
          } catch {
            // Continue to next fallback
          }
        }
        
        if (elem.placeholder) {
          try {
            const locator = page.locator(`${tagName}[placeholder="${elem.placeholder}"]`);
            const count = await locator.count();
            if (count > 0) {
              return { locator: locator.first(), method: "placeholder-fallback" };
            }
          } catch {
            // Continue to next fallback
          }
        }
        
        if (elem.text) {
          try {
            const text = elem.text.substring(0, 30);
            const locator = page.locator(tagName).filter({ hasText: text });
            const count = await locator.count();
            if (count > 0) {
              return { locator: locator.first(), method: "text-fallback" };
            }
          } catch {
            // Continue to next fallback
          }
        }
        
        if (elem.ariaLabel) {
          try {
            const locator = page.locator(`${tagName}[aria-label="${elem.ariaLabel}"]`);
            const count = await locator.count();
            if (count > 0) {
              return { locator: locator.first(), method: "aria-fallback" };
            }
          } catch {
            // Continue to next fallback
          }
        }
        
        try {
          const locator = page.locator(tagName);
          const count = await locator.count();
          if (count === 1) {
            return { locator, method: "tag-fallback" };
          }
        } catch {
          // Ignore
        }
      }
    }
    
    if (action.element?.rect && action.element.rect.x !== undefined && action.element.rect.y !== undefined) {
      return { locator: page.locator(`body`), method: "coordinate-fallback" };
    }
    
    return null;
  }

  private async replayAction(page: Page, action: RecordedAction, showCursor: boolean = true): Promise<void> {
    const strictMatch = action.strictMatch ?? true;
    
    if (["click", "dblclick", "hover", "input", "paste", "select"].includes(action.type)) {
      const delay = this.randomDelay(50, 200);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    switch (action.type) {
      case "click": {
        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          if (!strictMatch && action.element?.rect) {
            const rect = action.element.rect;
            const x = rect.x + rect.width / 2;
            const y = rect.y + rect.height / 2;
            console.log(`[Recorder] Click using coordinates (${x}, ${y}) - non-strict mode`);
            await this.interpolateMouseMovement(page, x, y, showCursor);
            if (showCursor) await this.showCursor(page, x, y, "click");
            await page.mouse.click(x, y);
            break;
          }
          throw new Error(`Element not found for click (strict: ${strictMatch})`);
        }
        
        if (found.method === "coordinate-fallback" && action.element?.rect) {
          const rect = action.element.rect;
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
          if (showCursor) await this.showCursor(page, x, y, "click");
          await page.mouse.click(x, y);
        } else {
          const box = await found.locator.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await this.interpolateMouseMovement(page, x, y, showCursor);
          }
          if (showCursor) await this.highlightElement(page, found.locator, "click");
          await found.locator.click({ timeout: 5000 });
        }
        break;
      }

      case "dblclick": {
        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          if (!strictMatch && action.element?.rect) {
            const rect = action.element.rect;
            const x = rect.x + rect.width / 2;
            const y = rect.y + rect.height / 2;
            console.log(`[Recorder] Dblclick using coordinates (${x}, ${y}) - non-strict mode`);
            await this.interpolateMouseMovement(page, x, y, showCursor);
            if (showCursor) await this.showCursor(page, x, y, "dblclick");
            await page.mouse.dblclick(x, y);
            break;
          }
          throw new Error(`Element not found for dblclick (strict: ${strictMatch})`);
        }
        
        if (found.method === "coordinate-fallback" && action.element?.rect) {
          const rect = action.element.rect;
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
          if (showCursor) await this.showCursor(page, x, y, "dblclick");
          await page.mouse.dblclick(x, y);
        } else {
          const box = await found.locator.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await this.interpolateMouseMovement(page, x, y, showCursor);
          }
          if (showCursor) await this.highlightElement(page, found.locator, "dblclick");
          await found.locator.dblclick({ timeout: 5000 });
        }
        break;
      }

      case "hover": {
        // 对于 non-strict 模式，优先使用记录的坐标
        if (!strictMatch && action.element?.rect) {
          const rect = action.element.rect;
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          console.log(`[Recorder] Hover using coordinates (${x}, ${y}) - non-strict mode`);
          await this.interpolateMouseMovement(page, x, y, showCursor);
          if (showCursor) await this.showCursor(page, x, y, "hover");
          break;
        }

        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          throw new Error(`Element not found for hover (strict: ${strictMatch})`);
        }
        
        if (found.method === "coordinate-fallback" && action.element?.rect) {
          const rect = action.element.rect;
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
          if (showCursor) await this.showCursor(page, x, y, "hover");
        } else {
          const box = await found.locator.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await this.interpolateMouseMovement(page, x, y, showCursor);
          }
          if (showCursor) await this.highlightElement(page, found.locator, "hover");
          await found.locator.hover({ timeout: 5000 });
        }
        break;
      }

      case "input": {
        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          throw new Error(`Element not found for input (strict: ${strictMatch})`);
        }
        
        const box = await found.locator.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
        }
        if (showCursor) await this.highlightElement(page, found.locator, "input");
        if (action.value !== undefined) {
          await found.locator.fill(action.value, { timeout: 5000 });
        }
        break;
      }

      case "keydown":
        if (action.value) {
          // 跳过输入法处理过程中的特殊键
          if (action.value === 'Process' || action.value === 'Unidentified' || action.value === 'Dead') {
            console.log(`[Recorder] Skipping invalid key: ${action.value}`);
            break;
          }
          if (showCursor) await this.showCursor(page, 100, 50, action.value);
          await page.keyboard.press(action.value);
        }
        break;

      case "scroll":
        if (action.value) {
          try {
            const scrollInfo = JSON.parse(action.value);
            const { scrollX, scrollY, elementScroll } = scrollInfo;
            
            if (elementScroll && elementScroll.selector) {
              try {
                const locator = page.locator(elementScroll.selector).first();
                const box = await locator.boundingBox();
                if (box && showCursor) {
                  await this.showCursor(page, box.x + box.width / 2, box.y + box.height / 2, "scroll");
                }
                await locator.evaluate((el: Element, info: { scrollTop: number; scrollLeft: number }) => {
                  el.scrollTop = info.scrollTop;
                  el.scrollLeft = info.scrollLeft;
                }, { scrollTop: elementScroll.scrollTop, scrollLeft: elementScroll.scrollLeft });
              } catch {
                await page.evaluate(({ x, y }: { x: number; y: number }) => window.scrollTo(x, y), { x: scrollX || 0, y: scrollY || 0 });
              }
            } else {
              if (showCursor) await this.showCursor(page, scrollX || 0, scrollY || 0, "scroll");
              await page.evaluate(({ x, y }: { x: number; y: number }) => window.scrollTo(x, y), { x: scrollX || 0, y: scrollY || 0 });
            }
          } catch {
            // Ignore parse errors
          }
        }
        break;

      case "navigate":
        if (action.url) {
          await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          if (showCursor) {
            await this.injectCursor(page);
          }
        }
        break;

      case "select": {
        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          throw new Error(`Element not found for select (strict: ${strictMatch})`);
        }
        
        const box = await found.locator.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
        }
        if (showCursor) await this.highlightElement(page, found.locator, "select");
        if (action.value !== undefined) {
          await found.locator.selectOption(action.value, { timeout: 5000 });
        }
        break;
      }

      case "paste": {
        const found = await this.findElementWithFallback(page, action);
        if (!found) {
          throw new Error(`Element not found for paste (strict: ${strictMatch})`);
        }
        
        const box = await found.locator.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await this.interpolateMouseMovement(page, x, y, showCursor);
        }
        if (showCursor) await this.highlightElement(page, found.locator, "paste");
        if (action.value !== undefined) {
          await found.locator.fill(action.value, { timeout: 5000 });
        }
        break;
      }

      case "mousemove":
        if (action.value) {
          try {
            const data = JSON.parse(action.value);
            if (data.points && Array.isArray(data.points) && data.points.length > 0) {
              const firstPoint = data.points[0];
              await page.mouse.move(firstPoint.x, firstPoint.y);
              
              for (let i = 1; i < data.points.length; i++) {
                const point = data.points[i];
                const prevPoint = data.points[i - 1];
                const delay = Math.min(100, point.t - prevPoint.t);
                if (delay > 0) {
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                await page.mouse.move(point.x, point.y);
                if (showCursor) await this.showCursor(page, point.x, point.y, "mousemove");
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        break;

      case "drag":
        // Drag operations need more context, skip for now
        break;

      default:
        console.log(`Unknown action type: ${action.type}`);
    }
  }

  private async recordAction(
    type: ActionType,
    data: Partial<RecordedAction>,
    page?: Page
  ): Promise<void> {
    if (!this.session) return;

    console.log("[Recorder] Action recorded:", type);

    if (this.session.actions.length >= this.config.maxActions!) {
      return;
    }

    let pageTitle = data.pageTitle;
    if (!pageTitle && page) {
      try {
        pageTitle = await page.title();
      } catch {
        // 页面导航中，忽略错误
      }
    }

    const action = createRecordedAction(type, {
      ...data,
      url: data.url || page?.url() || "",
      pageTitle,
    });

    if (this.config.captureSnapshot && page) {
      try {
        action.pageSnapshot = await this.capturePageSnapshot(page);
      } catch (e) {
        // Ignore snapshot errors
      }
    }

    if (this.config.captureScreenshot && page) {
      try {
        action.screenshot = await page.screenshot({
          fullPage: false,
          type: "jpeg",
          quality: 50,
        }).then((buffer: Buffer) => buffer.toString("base64"));
      } catch (e) {
      }
    }

    this.session.actions.push(action);
  }

  private async capturePageSnapshot(page: Page): Promise<PageSnapshot> {

    const elements = await page.evaluate(() => {
      var results: Array<{
        selector: string;
        tagName: string;
        text?: string;
        role?: string;
        ariaLabel?: string;
      }> = [];

      var interactiveElements = document.querySelectorAll(
        'a, button, input, select, textarea, [role="button"], [role="link"], [onclick], [tabindex]'
      );

      interactiveElements.forEach(function(el: Element) {
        function getSelector(element: Element) {
          if (element.id) return '#' + element.id;
          
          var path: string[] = [];
          var current: Element | null = element;
          
          while (current && current !== document.body) {
            var selector = current.tagName.toLowerCase();
            
            if (current.id) {
              selector = '#' + current.id;
              path.unshift(selector);
              break;
            }
            
            var parentElement: HTMLElement | null = current.parentElement;
            if (parentElement) {
              var siblings = Array.from(parentElement.children).filter(function(c: Element) {
                return c.tagName === current!.tagName;
              });
              if (siblings.length > 1) {
                var index = siblings.indexOf(current) + 1;
                selector += ':nth-of-type(' + index + ')';
              }
            }
            
            path.unshift(selector);
            current = parentElement;
          }
          
          return path.join(' > ');
        }

        results.push({
          selector: getSelector(el),
          tagName: el.tagName.toLowerCase(),
          text: el.textContent ? el.textContent.trim().substring(0, 50) : undefined,
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined
        });
      });

      return results;
    });

    return {
      url: page.url(),
      title: await page.title(),
      elements,
    };
  }

  private removeAllListeners(): void {
    this.listeners.forEach((remove) => remove());
    this.listeners = [];
  }
}

export const globalRecorder = new BrowserRecorder();
