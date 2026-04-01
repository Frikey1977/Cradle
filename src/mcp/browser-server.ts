#!/usr/bin/env node
/**
 * Cradle 浏览器控制 MCP 服务器
 * 
 * 将 Cradle 浏览器自动化功能暴露为 MCP 工具
 * 聚合版本：将相关功能合并为 5 个主要工具
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BROWSER_API_URL = process.env.BROWSER_API_URL || "http://127.0.0.1:18791";
const BROWSER_AUTH_TOKEN = process.env.BROWSER_AUTH_TOKEN || "cradle-browser-test-token";

console.error(`[MCP Browser] API URL: ${BROWSER_API_URL}`);
console.error(`[MCP Browser] Auth Token: ${BROWSER_AUTH_TOKEN ? '***' + BROWSER_AUTH_TOKEN.slice(-4) : '(empty)'}`);

interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
  [key: string]: unknown;
}

async function browserApi<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, unknown>;
    params?: Record<string, string | undefined>;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params } = options;
  
  let url = `${BROWSER_API_URL}${path}`;
  if (params) {
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;
    if (Object.keys(filteredParams).length > 0) {
      const searchParams = new URLSearchParams(filteredParams);
      url += `?${searchParams.toString()}`;
    }
  }
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (BROWSER_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${BROWSER_AUTH_TOKEN}`;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  
  const text = await response.text();
  
  if (!text) {
    throw new Error(`Empty response from ${url}`);
  }
  
  let data: ApiResponse<T>;
  try {
    data = JSON.parse(text) as ApiResponse<T>;
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${text.substring(0, 200)}`);
  }
  
  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

const server = new McpServer({
  name: "cradle-browser",
  version: "2.0.0",
});

// ==================== 1. browser_tab_control ====================
server.tool(
  "browser_tab_control",
  "浏览器标签页控制：列出、打开、聚焦、关闭标签页",
  {
    action: z.enum(["list", "open", "focus", "close", "navigate"]).describe("操作类型：list(列出)、open(打开)、focus(聚焦)、close(关闭)、navigate(导航)"),
    profile: z.string().optional().describe("Profile 名称，不指定则使用默认"),
    targetId: z.string().optional().describe("标签页 ID（focus/close 时需要）"),
    url: z.string().optional().describe("URL（open/navigate 时需要）"),
    timeoutMs: z.number().optional().describe("导航超时时间（毫秒，navigate 时使用）"),
  },
  async ({ action, profile, targetId, url, timeoutMs }) => {
    const params: Record<string, string | undefined> = { profile };
    
    switch (action) {
      case "list": {
        const result = await browserApi<{ tabs: Array<{ targetId: string; url: string; title: string; active: boolean }> }>("/tabs", { params });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "open": {
        if (!url) throw new Error("open 操作需要提供 url 参数");
        const result = await browserApi<{ targetId: string; url: string }>("/tabs/open", {
          method: "POST",
          params,
          body: { url },
        });
        return {
          content: [{ type: "text" as const, text: `已打开新标签页: ${JSON.stringify(result, null, 2)}` }],
        };
      }
      case "focus": {
        if (!targetId) throw new Error("focus 操作需要提供 targetId 参数");
        const result = await browserApi(`/tabs/focus`, {
          method: "POST",
          params,
          body: { targetId },
        });
        return {
          content: [{ type: "text" as const, text: `已聚焦到标签页: ${targetId}` }],
        };
      }
      case "close": {
        if (!targetId) throw new Error("close 操作需要提供 targetId 参数");
        const result = await browserApi(`/tabs/${targetId}`, {
          method: "DELETE",
          params,
        });
        return {
          content: [{ type: "text" as const, text: `已关闭标签页: ${targetId}` }],
        };
      }
      case "navigate": {
        if (!url) throw new Error("navigate 操作需要提供 url 参数");
        const result = await browserApi("/navigate", {
          method: "POST",
          params,
          body: { url, timeoutMs },
        });
        return {
          content: [{ type: "text" as const, text: `已导航到: ${url}\n${JSON.stringify(result, null, 2)}` }],
        };
      }
    }
  }
);

// ==================== 2. browser_page_action ====================
server.tool(
  "browser_page_action",
  "页面元素操作：点击、输入、悬停、按键、滚动、读取",
  {
    action: z.enum(["click", "type", "hover", "press", "scroll", "evaluate", "wait", "highlight", "read"]).describe("操作类型"),
    profile: z.string().optional().describe("Profile 名称"),
    ref: z.string().optional().describe("元素引用（从 snapshot 获取，click/type/hover/highlight/read 时需要）"),
    selector: z.string().optional().describe("CSS 选择器（scroll/wait 时需要）"),
    text: z.string().optional().describe("输入文本（type 时需要）"),
    key: z.string().optional().describe("按键名称（press 时需要），如 Enter、Escape、Tab、ArrowDown"),
    button: z.enum(["left", "right", "middle"]).optional().describe("鼠标按钮（click 时使用）"),
    clickCount: z.number().optional().describe("点击次数（click 时使用，2=双击）"),
    submit: z.boolean().optional().describe("输入后按 Enter 提交（type 时使用）"),
    clear: z.boolean().optional().describe("输入前清空内容（type 时使用）"),
    direction: z.enum(["up", "down", "left", "right"]).optional().describe("滚动方向（scroll 时使用）"),
    fn: z.string().optional().describe("JavaScript 函数代码（evaluate 时使用）"),
    url: z.string().optional().describe("等待 URL 匹配（wait 时使用）"),
    timeoutMs: z.number().optional().describe("超时时间（wait 时使用）"),
  },
  async ({ action, profile, ref, selector, text, key, button, clickCount, submit, clear, direction, fn, url, timeoutMs }) => {
    const params: Record<string, string | undefined> = { profile };
    
    switch (action) {
      case "click": {
        if (!ref) throw new Error("click 操作需要提供 ref 参数");
        const result = await browserApi("/act", {
          method: "POST",
          params,
          body: { kind: "click", ref, button, clickCount },
        });
        return {
          content: [{ type: "text" as const, text: `已点击元素: ${ref}` }],
        };
      }
      case "type": {
        if (!ref) throw new Error("type 操作需要提供 ref 参数");
        if (text === undefined) throw new Error("type 操作需要提供 text 参数");
        const result = await browserApi("/act", {
          method: "POST",
          params,
          body: { kind: "type", ref, text, submit, clear },
        });
        return {
          content: [{ type: "text" as const, text: `已输入文本: "${text}"` }],
        };
      }
      case "hover": {
        if (!ref) throw new Error("hover 操作需要提供 ref 参数");
        const result = await browserApi("/act", {
          method: "POST",
          params,
          body: { kind: "hover", ref },
        });
        return {
          content: [{ type: "text" as const, text: `已悬停在元素: ${ref}` }],
        };
      }
      case "press": {
        if (!key) throw new Error("press 操作需要提供 key 参数");
        const result = await browserApi("/act", {
          method: "POST",
          params,
          body: { kind: "press", key },
        });
        return {
          content: [{ type: "text" as const, text: `已按下按键: ${key}` }],
        };
      }
      case "scroll": {
        const result = await browserApi("/act", {
          method: "POST",
          params,
          body: { kind: "scroll", direction, selector },
        });
        return {
          content: [{ type: "text" as const, text: `已滚动页面` }],
        };
      }
      case "evaluate": {
        if (!fn) throw new Error("evaluate 操作需要提供 fn 参数");
        const result = await browserApi<{ result: unknown }>("/evaluate", {
          method: "POST",
          params,
          body: { fn },
        });
        return {
          content: [{ type: "text" as const, text: `执行结果:\n${JSON.stringify(result.result, null, 2)}` }],
        };
      }
      case "wait": {
        const result = await browserApi("/wait", {
          method: "POST",
          params,
          body: { selector, url, timeoutMs },
        });
        return {
          content: [{ type: "text" as const, text: "等待完成" }],
        };
      }
      case "highlight": {
        if (!ref) throw new Error("highlight 操作需要提供 ref 参数");
        const result = await browserApi("/highlight", {
          method: "POST",
          params,
          body: { ref },
        });
        return {
          content: [{ type: "text" as const, text: `已高亮元素: ${ref}` }],
        };
      }
      case "read": {
        if (!ref) throw new Error("read 操作需要提供 ref 参数");
        const result = await browserApi<{ success: boolean; ref: string; type: string; description: string; content: string; url: string; domain: string | null }>(`/read/${ref}`, { params });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    }
  }
);

// ==================== 3. browser_recording ====================
server.tool(
  "browser_recording",
  "录制控制：开始、停止、状态、加载、导出",
  {
    action: z.enum(["start", "stop", "status", "load", "export"]).describe("操作类型"),
    profile: z.string().optional().describe("Profile 名称（start 时使用）"),
    name: z.string().optional().describe("录制会话名称（start 时使用）"),
    description: z.string().optional().describe("录制会话描述（start 时使用）"),
    filePath: z.string().optional().describe("录制文件路径（load 时使用，相对于项目根目录）"),
    format: z.enum(["json", "llm", "markdown"]).optional().describe("导出格式（export 时使用，默认 llm）"),
  },
  async ({ action, profile, name, description, filePath, format }) => {
    switch (action) {
      case "start": {
        const params: Record<string, string | undefined> = { profile };
        const body: Record<string, unknown> = {};
        if (name) body.name = name;
        if (description) body.description = description;
        
        const result = await browserApi("/recording/start", {
          method: "POST",
          params,
          body,
        });
        return {
          content: [{ type: "text" as const, text: `开始录制: ${JSON.stringify(result, null, 2)}` }],
        };
      }
      case "stop": {
        const result = await browserApi("/recording/stop", { method: "POST" });
        return {
          content: [{ type: "text" as const, text: `停止录制: ${JSON.stringify(result, null, 2)}` }],
        };
      }
      case "status": {
        const result = await browserApi("/recording/status");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "load": {
        if (!filePath) throw new Error("load 操作需要提供 filePath 参数");
        const result = await browserApi("/recording/load", {
          method: "POST",
          body: { filePath },
        });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "export": {
        const exportFormat = format || "llm";
        const result = await browserApi(`/recording/export?format=${exportFormat}`);
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
    }
  }
);

// ==================== 4. browser_replay ====================
server.tool(
  "browser_replay",
  "录制回放控制：播放、暂停、停止、单步、从指定位置播放",
  {
    action: z.enum(["play", "pause", "resume", "stop", "step", "playFrom", "getAction", "execute", "status"]).describe("操作类型"),
    index: z.number().optional().describe("操作索引（step/getAction 时使用，从 0 开始）"),
    startIndex: z.number().optional().describe("开始索引（playFrom 时使用，从 0 开始）"),
    count: z.number().optional().describe("回放操作数量（playFrom 时使用，不指定则回放到末尾）"),
    delay: z.number().optional().describe("固定延迟时间（毫秒），默认 500"),
    useOriginalTiming: z.boolean().optional().describe("是否使用录制时的实际时间间隔，默认 true"),
    speedMultiplier: z.number().optional().describe("回放速度倍数，默认 1"),
    showCursor: z.boolean().optional().describe("是否显示可视化光标，默认 true"),
    actionJson: z.string().optional().describe("action JSON 对象（execute 时使用，用于手动验证修改后的动作）"),
  },
  async ({ action, index, startIndex, count, delay, useOriginalTiming, speedMultiplier, showCursor, actionJson }) => {
    switch (action) {
      case "play": {
        const params = new URLSearchParams();
        params.set("delay", String(delay ?? 500));
        params.set("useOriginalTiming", String(useOriginalTiming ?? true));
        params.set("speedMultiplier", String(speedMultiplier ?? 1));
        params.set("showCursor", String(showCursor ?? true));
        
        const result = await browserApi(`/recording/replay?${params.toString()}`, { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "pause": {
        const result = await browserApi("/recording/replay/pause", { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "stop": {
        const result = await browserApi("/recording/replay/stop", { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "resume": {
        const result = await browserApi("/recording/replay/resume", { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "status": {
        const result = await browserApi("/recording/replay/status");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "step": {
        if (index === undefined) throw new Error("step 操作需要提供 index 参数");
        const result = await browserApi(`/recording/replay/${index}`, { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "playFrom": {
        if (startIndex === undefined) throw new Error("playFrom 操作需要提供 startIndex 参数");
        const params = new URLSearchParams();
        if (count !== undefined) params.set("count", String(count));
        params.set("delay", String(delay ?? 500));
        params.set("useOriginalTiming", String(useOriginalTiming ?? true));
        params.set("speedMultiplier", String(speedMultiplier ?? 1));
        
        const result = await browserApi(`/recording/replay-from/${startIndex}?${params.toString()}`, { method: "POST" });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "getAction": {
        if (index === undefined) throw new Error("getAction 操作需要提供 index 参数");
        const result = await browserApi(`/recording/action/${index}`);
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
      case "execute": {
        if (!actionJson) throw new Error("execute 操作需要提供 actionJson 参数");
        const action = JSON.parse(actionJson);
        const params = new URLSearchParams();
        if (showCursor !== undefined) {
          params.set("showCursor", String(showCursor));
        }
        const result = await browserApi(`/recording/execute?${params.toString()}`, {
          method: "POST",
          body: action,
        });
        return {
          content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      }
    }
  }
);

// ==================== 5. browser_info ====================
server.tool(
  "browser_info",
  "浏览器信息获取：状态、快照、截图、Cookies",
  {
    action: z.enum(["status", "snapshot", "screenshot", "cookies"]).describe("操作类型"),
    profile: z.string().optional().describe("Profile 名称"),
    format: z.enum(["ai", "aria", "role"]).optional().describe("快照格式（snapshot 时使用，默认 ai）"),
    selector: z.string().optional().describe("CSS 选择器（snapshot/screenshot 时使用，限制范围或截取特定元素）"),
    limit: z.number().optional().describe("返回元素数量限制（snapshot 时使用）"),
    fullPage: z.boolean().optional().describe("是否截取整个页面（screenshot 时使用）"),
  },
  async ({ action, profile, format, selector, limit, fullPage }) => {
    const params: Record<string, string> = {};
    if (profile) params.profile = profile;

    switch (action) {
      case "status": {
        const result = await browserApi("/");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "snapshot": {
        params.format = format || "ai";
        if (selector) params.selector = selector;
        if (limit) params.limit = String(limit);

        const result = await browserApi("/snapshot", { params });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "screenshot": {
        const result = await browserApi<{ data: string; mimeType: string; size: number }>("/screenshot", {
          method: "POST",
          params: { profile },
          body: { fullPage, selector },
        });

        const imageData = result.data as string | undefined;
        const mimeType = (result.mimeType as string) || "image/png";

        if (!imageData) {
          return {
            content: [{ type: "text" as const, text: "截图失败: 未获取到图片数据" }],
          };
        }

        return {
          content: [{ type: "image" as const, data: imageData, mimeType: mimeType }],
        };
      }
      case "cookies": {
        const result = await browserApi("/cookies", { params });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    }
  }
);

// ==================== 6. browser_element_marker ====================
server.tool(
  "browser_element_marker",
  "元素标记系统：标记页面互动元素、管理配置、获取增强快照",
  {
    action: z.enum([
      "startMarking",
      "stopMarking",
      "getConfigs",
      "getConfig",
      "createConfig",
      "savePageConfig",
      "addElement",
      "removeElement",
      "getEnhancedSnapshot",
      "executeBatch",
      "executeActionGroup",
    ]).describe("操作类型"),
    profile: z.string().optional().describe("Profile 名称"),
    domain: z.string().optional().describe("站点域名（startMarking/createConfig/addElement 时使用）"),
    pageType: z.string().optional().describe("页面类型（startMarking/savePageConfig/addElement 时使用）"),
    url: z.string().optional().describe("页面URL（startMarking/getEnhancedSnapshot 时使用）"),
    displayName: z.string().optional().describe("站点显示名称（createConfig 时使用）"),
    description: z.string().optional().describe("描述（createConfig/savePageConfig 时使用）"),
    element: z.string().optional().describe("元素配置JSON（addElement 时使用）"),
    ref: z.string().optional().describe("元素引用ID（removeElement 时使用）"),
    actions: z.string().optional().describe("操作列表JSON（executeBatch 时使用）"),
    groupId: z.string().optional().describe("操作组ID（executeActionGroup 时使用）"),
    pageConfig: z.string().optional().describe("页面配置JSON（savePageConfig 时使用）"),
  },
  async ({ action, profile, domain, pageType, url, displayName, description, element, ref, actions, groupId, pageConfig }) => {
    const params: Record<string, string | undefined> = { profile };

    switch (action) {
      case "startMarking": {
        const body: Record<string, unknown> = {};
        if (domain) body.domain = domain;
        if (pageType) body.pageType = pageType;
        if (url) body.url = url;

        const result = await browserApi("/marker/start", {
          method: "POST",
          params,
          body,
        });
        return {
          content: [{ type: "text" as const, text: `元素标记器已启动\n${JSON.stringify(result, null, 2)}\n\n提示：按住右Alt键，点击页面元素进行标记` }],
        };
      }
      case "stopMarking": {
        const result = await browserApi("/marker/stop", {
          method: "POST",
          params,
        });
        return {
          content: [{ type: "text" as const, text: `元素标记器已停止\n${JSON.stringify(result, null, 2)}` }],
        };
      }
      case "getConfigs": {
        const result = await browserApi("/marker/configs");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "getConfig": {
        if (!domain) throw new Error("getConfig 操作需要提供 domain 参数");
        const result = await browserApi(`/marker/config/${domain}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "createConfig": {
        if (!domain) throw new Error("createConfig 操作需要提供 domain 参数");
        const body: Record<string, unknown> = { domain };
        if (displayName) body.displayName = displayName;
        if (description) body.description = description;

        const result = await browserApi("/marker/config", {
          method: "POST",
          body,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "savePageConfig": {
        if (!domain) throw new Error("savePageConfig 操作需要提供 domain 参数");
        if (!pageConfig) throw new Error("savePageConfig 操作需要提供 pageConfig 参数");

        const config = JSON.parse(pageConfig);
        const result = await browserApi(`/marker/config/${domain}/page`, {
          method: "POST",
          body: config,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "addElement": {
        if (!domain) throw new Error("addElement 操作需要提供 domain 参数");
        if (!pageType) throw new Error("addElement 操作需要提供 pageType 参数");
        if (!element) throw new Error("addElement 操作需要提供 element 参数");

        const el = JSON.parse(element);
        const result = await browserApi("/marker/element", {
          method: "POST",
          body: { domain, pageType, element: el, url },
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "removeElement": {
        if (!domain) throw new Error("removeElement 操作需要提供 domain 参数");
        if (!pageType) throw new Error("removeElement 操作需要提供 pageType 参数");
        if (!ref) throw new Error("removeElement 操作需要提供 ref 参数");

        const result = await browserApi(`/marker/element/${domain}/${pageType}/${ref}`, {
          method: "DELETE",
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "getEnhancedSnapshot": {
        const snapshotParams: Record<string, string | undefined> = { profile, url };
        const result = await browserApi("/marker/snapshot", { params: snapshotParams });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "executeBatch": {
        if (!actions) throw new Error("executeBatch 操作需要提供 actions 参数");

        const actionList = JSON.parse(actions);
        const result = await browserApi("/marker/batch-action", {
          method: "POST",
          params,
          body: { actions: actionList },
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
      case "executeActionGroup": {
        if (!groupId) throw new Error("executeActionGroup 操作需要提供 groupId 参数");

        const result = await browserApi(`/marker/action-group/${groupId}`, {
          method: "POST",
          params: { profile, url },
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cradle Browser MCP Server v2.1.0 started with 6 aggregated tools");
  console.error("Tools: browser_tab_control, browser_page_action, browser_recording, browser_replay, browser_info, browser_element_marker");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
