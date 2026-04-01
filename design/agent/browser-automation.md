# 浏览器自动化设计

## 概述

浏览器自动化模块为 Cradle Agent 提供网页交互能力，支持：
- 网页导航与内容提取
- 表单填写与提交
- 元素点击与交互
- 截图与快照
- 多种浏览器模式（本地/远程/现有会话）

本设计基于 OpenClaw 浏览器自动化系统的实现分析，针对 Cradle 架构进行了适配优化。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent 层                                  │
│  意图识别 → 选择 Browser Skill → 调用 Browser Tool              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator 层                              │
│  任务拆解：导航 → 快照 → 交互 → 提取结果                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Executor 层                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Browser Tool                          │   │
│  │  - browser.navigate(url)                                 │   │
│  │  - browser.snapshot()                                    │   │
│  │  - browser.click(ref)                                    │   │
│  │  - browser.type(ref, text)                               │   │
│  │  - browser.screenshot()                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Browser Control Service                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  独立服务进程，随 Gateway Master 启动                     │   │
│  │  - 浏览器生命周期管理                                     │   │
│  │  - Profile 管理（多浏览器配置）                           │   │
│  │  - 会话状态维护                                          │   │
│  │  - HTTP API 暴露操作接口                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Playwright   │  │ Chrome MCP   │  │ Remote CDP   │          │
│  │ (本地浏览器) │  │ (现有会话)   │  │ (远程浏览器) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 模块划分

```
src/agent/browser/
├── index                        # 模块导出
├── types                        # 类型定义
├── config                       # 配置解析
├── service                      # BrowserControlService 主服务
├── profiles/
│   ├── index                    # Profile 管理
│   ├── manager                  # Profile 生命周期
│   └── types                    # Profile 类型
├── drivers/
│   ├── index                    # 驱动工厂
│   ├── base-driver              # 基础驱动接口
│   ├── playwright-driver        # Playwright CDP 驱动
│   ├── chrome-mcp-driver        # Chrome MCP 驱动
│   └── remote-cdp-driver        # 远程 CDP 驱动
├── actions/
│   ├── index                    # 操作导出
│   ├── navigate                 # 导航操作
│   ├── snapshot                 # 快照操作
│   ├── interact                 # 交互操作（点击/输入等）
│   └── screenshot               # 截图操作
├── routes/
│   ├── index                    # HTTP 路由注册
│   ├── basic                    # 基础路由（status/start/stop）
│   ├── tabs                     # 标签页路由
│   └── agent                    # Agent 操作路由
└── utils/
    ├── cdp                      # CDP 工具函数
    ├── ssrf                     # SSRF 防护
    ├── snapshot-parser          # 快照解析
    └── errors                   # 错误定义
```

## 核心组件设计

### 1. BrowserControlService

主服务类，负责浏览器控制服务的生命周期管理。

```typescript
interface BrowserServerState {
  server: Server;                              // HTTP 服务器实例
  port: number;                                // 监听端口
  resolved: ResolvedBrowserConfig;             // 解析后的配置
  profiles: Map<string, ProfileRuntimeState>;  // Profile 运行时状态
}

interface ProfileRuntimeState {
  profile: ResolvedBrowserProfile;
  running: RunningBrowser | null;              // 运行中的浏览器实例
  lastTargetId: string | null;                 // 最后活动的标签页 ID
}
```

**启动流程**：
1. 加载配置并解析
2. 自动配置认证（如未配置则生成 token）
3. 创建 Express 应用
4. 安装中间件（认证、错误处理）
5. 注册路由
6. 绑定到 127.0.0.1:port

### 2. ProfileContext

Profile 级别的操作上下文，封装了所有浏览器操作。

```typescript
interface ProfileContext {
  profile: ResolvedBrowserProfile;
  
  // 浏览器生命周期
  ensureBrowserAvailable(): Promise<void>;
  stopRunningBrowser(): Promise<void>;
  isReachable(timeoutMs: number): Promise<boolean>;
  
  // 标签页操作
  listTabs(): Promise<BrowserTab[]>;
  openTab(url: string): Promise<BrowserTab>;
  focusTab(targetId: string): Promise<void>;
  closeTab(targetId: string): Promise<void>;
  
  // Profile 管理
  resetProfile(): Promise<BrowserResetProfileResult>;
}
```

### 3. 页面状态追踪

追踪每个页面的运行时状态，用于调试和监控。

```typescript
interface PageState {
  console: BrowserConsoleMessage[];      // 控制台消息
  errors: BrowserPageError[];            // 页面错误
  requests: BrowserNetworkRequest[];     // 网络请求
  roleRefs: Record<string, RoleRef>;     // 元素引用映射
  roleRefsMode: "role" | "aria";         // 引用模式
}

interface BrowserConsoleMessage {
  type: string;                          // log/warn/error 等
  text: string;
  timestamp: string;
  location?: { url?: string; lineNumber?: number };
}

interface BrowserPageError {
  message: string;
  name?: string;
  stack?: string;
  timestamp: string;
}

interface BrowserNetworkRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  resourceType?: string;
  status?: number;
  ok?: boolean;
  failureText?: string;
}
```

## 浏览器驱动模式

### 1. 本地浏览器模式 (local-managed)

启动独立的浏览器实例，完全隔离的用户数据目录。

```typescript
interface LocalBrowserProfile {
  driver: "local-managed";
  cdpPort: number;           // CDP 端口
  userDataDir?: string;      // 用户数据目录
  executablePath?: string;   // 浏览器可执行文件路径
  headless: boolean;         // 无头模式
  color?: string;            // UI 主题色
}
```

**适用场景**：
- 自动化测试
- 数据抓取
- 无需登录状态的任务

**实现要点**：
- 使用 Playwright 连接本地 CDP 端口
- 自动检测系统浏览器（Chrome/Brave/Edge/Chromium）
- 支持自定义启动参数

### 2. 现有会话模式 (existing-session)

连接到用户正在使用的浏览器，复用登录状态。

```typescript
interface ExistingSessionProfile {
  driver: "existing-session";
  userDataDir?: string;      // 目标浏览器用户数据目录
  color?: string;
  attachOnly: true;          // 仅附加，不启动
}
```

**适用场景**：
- 需要用户已登录的网站操作
- 用户在场协作场景
- 需要复用浏览器状态

**实现要点**：
- 通过 MCP SDK 启动 chrome-devtools-mcp 进程
- 使用 `--autoConnect` 自动连接
- 支持 `--experimentalStructuredContent` 结构化输出

**降级机制**：
- 首先尝试连接到 `http://127.0.0.1:9222`（默认 CDP 端口）
- 如果连接成功，使用现有浏览器会话
- 如果连接失败（浏览器未启动或端口不可达），自动降级到 `local-managed` 模式
- 降级后会启动新的本地浏览器实例，确保功能可用
- 降级过程对用户透明，控制台会输出相应日志

### 3. 远程 CDP 模式 (remote-cdp)

连接到远程浏览器服务（如 Browserless、Browserbase）。

```typescript
interface RemoteCdpProfile {
  driver: "remote-cdp";
  cdpUrl: string;            // CDP HTTP 或 WebSocket URL
  color?: string;
}
```

**适用场景**：
- 云端浏览器服务
- 分布式部署
- 高并发场景

**实现要点**：
- 支持 HTTP(S) 端点（通过 /json/version 发现 WebSocket）
- 支持直接 WebSocket URL（wss://）
- 自动处理认证（URL 中的 token、Basic Auth）

## 驱动接口设计

### BaseDriver

所有驱动必须实现的基础接口。

```typescript
interface BrowserDriver {
  readonly name: string;
  readonly profile: ResolvedBrowserProfile;
  
  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  
  // 标签页
  listTabs(): Promise<BrowserTab[]>;
  openTab(url: string): Promise<BrowserTab>;
  focusTab(targetId: string): Promise<void>;
  closeTab(targetId: string): Promise<void>;
  
  // 导航
  navigate(url: string, opts?: NavigateOptions): Promise<{ url: string }>;
  
  // 快照
  snapshotAria(opts?: SnapshotAriaOptions): Promise<SnapshotAriaResult>;
  snapshotAi(opts?: SnapshotAiOptions): Promise<SnapshotAiResult>;
  snapshotRole(opts?: SnapshotRoleOptions): Promise<SnapshotRoleResult>;
  
  // 交互
  click(ref: string, opts?: ClickOptions): Promise<void>;
  type(ref: string, text: string, opts?: TypeOptions): Promise<void>;
  hover(ref: string, opts?: HoverOptions): Promise<void>;
  drag(startRef: string, endRef: string, opts?: DragOptions): Promise<void>;
  select(ref: string, values: string[], opts?: SelectOptions): Promise<void>;
  press(key: string, opts?: PressOptions): Promise<void>;
  
  // 表单
  fillForm(fields: FormField[], opts?: FillFormOptions): Promise<void>;
  
  // 截图
  screenshot(opts?: ScreenshotOptions): Promise<Buffer>;
  
  // 执行
  evaluate(fn: string, opts?: EvaluateOptions): Promise<unknown>;
  
  // 等待
  wait(opts: WaitOptions): Promise<void>;
  
  // 状态
  getConsoleMessages(opts?: ConsoleOptions): Promise<BrowserConsoleMessage[]>;
  getPageErrors(): Promise<BrowserPageError[]>;
  getNetworkRequests(opts?: NetworkOptions): Promise<BrowserNetworkRequest[]>;
  
  // 存储
  getCookies(): Promise<Cookie[]>;
  setCookies(cookies: Cookie[]): Promise<void>;
  clearCookies(): Promise<void>;
  getStorage(kind: "local" | "session"): Promise<Record<string, unknown>>;
  setStorage(kind: "local" | "session", data: Record<string, unknown>): Promise<void>;
  clearStorage(kind: "local" | "session"): Promise<void>;
  
  // 下载
  download(ref: string, filename: string): Promise<void>;
  waitForDownload(filename: string, opts?: WaitForDownloadOptions): Promise<string>;
  
  // PDF
  pdf(): Promise<Buffer>;
  
  // 视口
  resize(width: number, height: number): Promise<void>;
  
  // 调试
  highlight(ref: string): Promise<void>;
  traceStart(): Promise<void>;
  traceStop(): Promise<Buffer>;
}
```

### PlaywrightDriver

基于 Playwright CDP 的本地浏览器驱动。

```typescript
class PlaywrightDriver implements BrowserDriver {
  readonly name = "playwright";
  
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  
  async start(): Promise<void> {
    // 连接到本地 CDP 端口
    this.browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${this.profile.cdpPort}`
    );
  }
  
  async navigate(url: string, opts?: NavigateOptions): Promise<{ url: string }> {
    const page = await this.getActivePage();
    
    // SSRF 检查
    await assertBrowserNavigationAllowed({ url, ssrfPolicy: this.ssrfPolicy });
    
    // 导航并检查重定向链
    const response = await page.goto(url, { timeout: opts?.timeoutMs });
    await assertBrowserNavigationRedirectChainAllowed({ request: response?.request() });
    
    return { url: page.url() };
  }
  
  // 元素定位器
  private refLocator(page: Page, ref: string): Locator {
    const roleRef = this.pageState.roleRefs?.[ref];
    if (roleRef) {
      return page.getByRole(roleRef.role, { 
        name: roleRef.name, 
        nth: roleRef.nth 
      });
    }
    return page.locator(`[aria-ref="${ref}"]`);
  }
}
```

### ChromeMcpDriver

基于 Chrome DevTools MCP 的现有会话驱动。

```typescript
class ChromeMcpDriver implements BrowserDriver {
  readonly name = "chrome-mcp";
  
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  
  async start(): Promise<void> {
    // 启动 chrome-devtools-mcp 进程
    this.transport = new StdioClientTransport({
      command: "npx",
      args: [
        "-y", "chrome-devtools-mcp@latest",
        "--autoConnect",
        "--experimentalStructuredContent",
        "--experimental-page-id-routing",
      ],
    });
    
    this.client = new Client({ name: "cradle-browser", version: "1.0.0" }, {
      capabilities: { tools: {} },
    });
    
    await this.client.connect(this.transport);
  }
  
  async listTabs(): Promise<BrowserTab[]> {
    const result = await this.client.callTool({ name: "list_pages" });
    return this.parsePagesResult(result);
  }
  
  async click(ref: string, opts?: ClickOptions): Promise<void> {
    await this.client.callTool({
      name: "click_element",
      arguments: { element: ref },
    });
  }
}
```

### RemoteCdpDriver

基于 WebSocket CDP 的远程浏览器驱动。

```typescript
class RemoteCdpDriver implements BrowserDriver {
  readonly name = "remote-cdp";
  
  private ws: WebSocket | null = null;
  private messageId = 0;
  
  async start(): Promise<void> {
    let wsUrl: string;
    
    if (isWebSocketUrl(this.profile.cdpUrl)) {
      wsUrl = this.profile.cdpUrl;
    } else {
      // 通过 /json/version 发现 WebSocket URL
      const version = await fetchJson<{ webSocketDebuggerUrl?: string }>(
        `${this.profile.cdpUrl}/json/version`
      );
      wsUrl = normalizeCdpWsUrl(version.webSocketDebuggerUrl, this.profile.cdpUrl);
    }
    
    this.ws = await this.connectWebSocket(wsUrl);
  }
  
  async sendCommand(method: string, params?: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      
      const handler = (data: Buffer) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          this.ws?.off("message", handler);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };
      
      this.ws?.on("message", handler);
      this.ws?.send(JSON.stringify({ id, method, params }));
    });
  }
}
```

## API 设计

### HTTP API

所有 API 绑定到 `127.0.0.1`，仅限本地访问。

#### 基础路由

```
GET  /                           # 服务状态
POST /start                      # 启动浏览器
POST /stop                       # 停止浏览器
POST /reset-profile              # 重置 Profile 数据
GET  /profiles                   # 列出所有 Profile
POST /profiles/create            # 创建 Profile
DELETE /profiles/:name           # 删除 Profile
```

#### 标签页路由

```
GET    /tabs                     # 列出所有标签页
POST   /tabs/open                # 打开新标签页
POST   /tabs/focus               # 聚焦标签页
DELETE /tabs/:targetId           # 关闭标签页
POST   /tabs/action              # 批量标签页操作
```

#### Agent 操作路由

```
POST /navigate                   # 导航到 URL
GET  /snapshot                   # 获取页面快照
POST /screenshot                 # 截图
POST /act                        # 执行操作（click/type/hover等）
POST /evaluate                   # 执行 JavaScript
POST /wait                       # 等待条件
POST /highlight                  # 高亮元素
POST /pdf                        # 导出 PDF
```

#### 存储路由

```
GET    /cookies                  # 获取 Cookies
POST   /cookies/set              # 设置 Cookies
POST   /cookies/clear            # 清除 Cookies
GET    /storage/:kind            # 获取存储（local/session）
POST   /storage/:kind/set        # 设置存储
POST   /storage/:kind/clear      # 清除存储
```

#### 调试路由

```
GET  /console                    # 获取控制台消息
GET  /errors                     # 获取页面错误
GET  /requests                   # 获取网络请求
POST /response/body              # 获取响应体
POST /trace/start                # 开始追踪
POST /trace/stop                 # 停止追踪
```

#### 下载路由

```
POST /download                   # 触发下载
POST /wait/download              # 等待下载完成
POST /upload                     # 上传文件
```

#### 设置路由

```
POST /set/offline                # 设置离线模式
POST /set/headers                # 设置额外 HTTP 头
POST /set/credentials            # 设置 HTTP 认证
POST /set/geolocation            # 设置地理位置
POST /set/media                  # 设置媒体设备
POST /set/timezone               # 设置时区
POST /set/locale                 # 设置语言环境
POST /set/device                 # 设置设备模拟
```

### Tool API

```typescript
const BrowserTool = defineTool("browser", {
  description: "Control a web browser for automation tasks.",
  parameters: z.discriminatedUnion("action", [
    // 导航
    z.object({
      action: z.literal("navigate"),
      url: z.string().describe("The URL to navigate to"),
      timeoutMs: z.number().optional(),
    }),
    
    // 快照
    z.object({
      action: z.literal("snapshot"),
      format: z.enum(["ai", "aria", "role"]).optional(),
      limit: z.number().optional(),
      maxChars: z.number().optional(),
      interactive: z.boolean().optional(),
      compact: z.boolean().optional(),
      depth: z.number().optional(),
      selector: z.string().optional(),
      frame: z.string().optional(),
    }),
    
    // 点击
    z.object({
      action: z.literal("click"),
      ref: z.string().describe("Element reference from snapshot"),
      double: z.boolean().optional(),
      button: z.enum(["left", "right", "middle"]).optional(),
      modifiers: z.array(z.enum(["Alt", "Control", "Meta", "Shift"])).optional(),
      delayMs: z.number().optional(),
      timeoutMs: z.number().optional(),
    }),
    
    // 输入
    z.object({
      action: z.literal("type"),
      ref: z.string().describe("Element reference from snapshot"),
      text: z.string().describe("Text to type"),
      submit: z.boolean().optional().describe("Press Enter after typing"),
      slowly: z.boolean().optional(),
      timeoutMs: z.number().optional(),
    }),
    
    // 悬停
    z.object({
      action: z.literal("hover"),
      ref: z.string().describe("Element reference from snapshot"),
      timeoutMs: z.number().optional(),
    }),
    
    // 拖拽
    z.object({
      action: z.literal("drag"),
      startRef: z.string(),
      endRef: z.string(),
      timeoutMs: z.number().optional(),
    }),
    
    // 选择
    z.object({
      action: z.literal("select"),
      ref: z.string(),
      values: z.array(z.string()),
      timeoutMs: z.number().optional(),
    }),
    
    // 按键
    z.object({
      action: z.literal("press"),
      key: z.string(),
      delayMs: z.number().optional(),
    }),
    
    // 表单填写
    z.object({
      action: z.literal("fillForm"),
      fields: z.array(z.object({
        ref: z.string(),
        type: z.enum(["text", "checkbox", "radio", "select"]).optional(),
        value: z.union([z.string(), z.boolean(), z.number()]),
      })),
      timeoutMs: z.number().optional(),
    }),
    
    // 截图
    z.object({
      action: z.literal("screenshot"),
      fullPage: z.boolean().optional(),
      ref: z.string().optional(),
      format: z.enum(["png", "jpeg"]).optional(),
      quality: z.number().optional(),
    }),
    
    // 等待
    z.object({
      action: z.literal("wait"),
      text: z.string().optional(),
      textGone: z.string().optional(),
      selector: z.string().optional(),
      url: z.string().optional(),
      load: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
      fn: z.string().optional(),
      timeMs: z.number().optional(),
      timeoutMs: z.number().optional(),
    }),
    
    // 执行脚本
    z.object({
      action: z.literal("evaluate"),
      fn: z.string(),
      ref: z.string().optional(),
      timeoutMs: z.number().optional(),
    }),
    
    // 滚动
    z.object({
      action: z.literal("scrollIntoView"),
      ref: z.string(),
    }),
    
    // 高亮
    z.object({
      action: z.literal("highlight"),
      ref: z.string(),
    }),
    
    // 批量操作
    z.object({
      action: z.literal("batch"),
      actions: z.array(z.object({
        kind: z.enum(["click", "type", "hover", "press", "wait"]),
        // ... 对应操作的参数
      })),
      timeoutMs: z.number().optional(),
    }),
  ]),
  execute: async (args, ctx) => { /* ... */ },
});
```

## 快照格式

### AI Snapshot

AI 友好的页面快照，返回带引用的元素列表：

```
- button "Submit" [ref=e12]
- textbox "Email" [ref=e23] value=""
- link "Learn more" [ref=e45]
- heading "Welcome" [ref=e67]
```

### Role Snapshot

基于角色的结构化快照：

```
[button] Submit (ref=e12)
[textbox] Email (ref=e23, value="")
[link] Learn more (ref=e45)
[heading] Welcome (ref=e67)
```

### Aria Snapshot

基于 CDP Accessibility API 的原始快照：

```typescript
interface AriaSnapshotNode {
  ref: string;              // 元素引用 ID
  role: string;             // ARIA 角色
  name: string;             // 可访问名称
  value?: string;           // 当前值
  description?: string;     // 描述
  backendDOMNodeId?: number; // DOM 节点 ID
  depth: number;            // 树深度
}
```

### 引用解析

```typescript
interface RoleRef {
  ref: string;              // 如 "e12"
  role: string;             // 如 "button"
  name?: string;            // 如 "Submit"
  nth?: number;             // 重复元素的索引
}

// 引用缓存机制
// 跨请求保持元素引用稳定，即使 Page 对象变化
const roleRefsByTarget = new Map<string, RoleRefCacheEntry>();
```

## 安全设计

### SSRF 防护

```typescript
interface SsrFPolicy {
  dangerouslyAllowPrivateNetwork?: boolean;  // 允许私有网络
  hostnameAllowlist?: string[];              // 主机名白名单
  allowedHostnames?: string[];               // 允许的主机名
}
```

**默认策略**：
- 允许访问私有网络（信任网络模式）
- 可配置为严格模式（仅允许公网）
- 支持 hostname 白名单

### 导航守卫

```typescript
async function assertBrowserNavigationAllowed(opts: {
  url: string;
  ssrfPolicy?: SsrFPolicy;
  lookupFn?: LookupFn;
}): Promise<void> {
  // 1. 验证协议（仅 http/https）
  // 2. 检查代理环境变量（严格模式下禁止）
  // 3. DNS 查询验证
  // 4. 应用 SSRF 策略
}

// 重定向链检查
async function assertBrowserNavigationRedirectChainAllowed(opts: {
  request?: BrowserNavigationRequestLike;
  ssrfPolicy?: SsrFPolicy;
}): Promise<void> {
  // 遍历重定向链，检查每个 URL
}

// 最终 URL 检查
async function assertBrowserNavigationResultAllowed(opts: {
  url: string;
  ssrfPolicy?: SsrFPolicy;
}): Promise<void> {
  // 导航完成后检查最终 URL
}
```

### 执行控制

```typescript
interface BrowserConfig {
  enabled: boolean;
  evaluateEnabled: boolean;    // 是否允许执行 JS
  ssrfPolicy?: SsrFPolicy;
}
```

### 认证机制

```typescript
interface BrowserControlAuth {
  token?: string;              // Bearer token
  password?: string;           // HTTP Basic / x-openclaw-password
}

// 自动生成认证（如未配置）
async function ensureBrowserControlAuth(opts: { cfg: OpenClawConfig }): Promise<{
  auth: BrowserControlAuth;
  generatedToken?: string;
}> {
  // 如果未配置认证，自动生成 gateway.auth.token
}
```

## 配置设计

### 配置结构

```typescript
interface BrowserConfig {
  enabled: boolean;
  defaultProfile: string;
  headless: boolean;
  noSandbox: boolean;
  evaluateEnabled: boolean;
  controlPort?: number;        // HTTP 服务端口
  cdpPortRangeStart?: number;  // CDP 端口范围起始
  remoteCdpTimeoutMs?: number; // 远程 CDP 超时
  remoteCdpHandshakeTimeoutMs?: number;
  executablePath?: string;     // 浏览器可执行文件路径
  color?: string;              // 默认主题色
  ssrfPolicy?: SsrFPolicy;
  extraArgs?: string[];        // 额外启动参数
  profiles: Record<string, ProfileConfig>;
}

interface ProfileConfig {
  driver: "local-managed" | "existing-session" | "remote-cdp";
  cdpPort?: number;
  cdpUrl?: string;
  userDataDir?: string;
  executablePath?: string;
  color?: string;
  attachOnly?: boolean;
}
```

### 默认配置

```json
{
  "browser": {
    "enabled": true,
    "defaultProfile": "default",
    "headless": false,
    "evaluateEnabled": true,
    "ssrfPolicy": {
      "dangerouslyAllowPrivateNetwork": true
    },
    "profiles": {
      "default": {
        "driver": "local-managed",
        "cdpPort": 18800,
        "color": "#FF4500"
      },
      "user": {
        "driver": "existing-session",
        "attachOnly": true,
        "color": "#00AA00"
      }
    }
  }
}
```

### 端口分配策略

```
端口范围分配：
- 18789: Gateway WebSocket
- 18790: Bridge
- 18791: Browser Control Server
- 18792-18799: 预留服务（Canvas 18793）
- 18800-18899: CDP 端口（100 个 Profile）

端口派生规则：
- controlPort = gatewayPort + 2
- cdpPortRangeStart = controlPort + 9
```

### Profile 端口分配

```typescript
function allocateCdpPort(
  usedPorts: Set<number>,
  range?: { start: number; end: number },
): number | null {
  const start = range?.start ?? 18800;
  const end = range?.end ?? 18899;
  
  for (let port = start; port <= end; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  return null;
}
```

### Profile 颜色分配

```typescript
const PROFILE_COLORS = [
  "#FF4500", // Orange-red (默认)
  "#0066CC", // Blue
  "#00AA00", // Green
  "#9933FF", // Purple
  "#FF6699", // Pink
  "#00CCCC", // Cyan
  "#FF9900", // Orange
  "#6666FF", // Indigo
  "#CC3366", // Magenta
  "#339966", // Teal
];
```

## 错误处理

### 错误类型

```typescript
class BrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserError";
  }
}

class BrowserProfileNotFoundError extends BrowserError {
  constructor(message: string) {
    super(message);
    this.name = "BrowserProfileNotFoundError";
  }
}

class BrowserProfileUnavailableError extends BrowserError {
  constructor(message: string) {
    super(message);
    this.name = "BrowserProfileUnavailableError";
  }
}

class BrowserTabNotFoundError extends BrowserError {
  constructor() {
    super("Tab not found");
    this.name = "BrowserTabNotFoundError";
  }
}

class InvalidBrowserNavigationUrlError extends BrowserError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBrowserNavigationUrlError";
  }
}
```

### 错误响应格式

```typescript
interface BrowserErrorResponse {
  status: number;
  message: string;
  code?: string;
}
```

## 依赖

```json
{
  "dependencies": {
    "playwright-core": "^1.40.0",
    "express": "^4.18.0"
  },
  "optionalDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

## 工作流程

### 整体调用链路

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户请求                                        │
│  用户: "帮我打开淘宝搜索 iPhone 15，截图发给我"                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent 层                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 接收消息（通过 Channel → Gateway）                                │   │
│  │  2. 加载用户画像、记忆、关系                                          │   │
│  │  3. 意图识别：需要浏览器操作                                          │   │
│  │  4. Tool-based Routing：选择 orchestrator tool                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC: 调用 orchestrator tool
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Orchestrator 层                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 分析任务：需要 browser skill                                      │   │
│  │  2. 创建 Worktask                                                     │   │
│  │  3. 任务拆解：                                                         │   │
│  │     ├── Step 1: 导航到淘宝                                            │   │
│  │     ├── Step 2: 搜索 iPhone 15                                        │   │
│  │     ├── Step 3: 截图                                                  │   │
│  │     └── Step 4: 返回结果                                              │   │
│  │  4. 启动 Executor 执行                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC: spawn(executorParams)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Executor 层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ReAct 循环执行：                                                      │   │
│  │                                                                       │   │
│  │  Thought 1: 需要先打开浏览器并导航到淘宝                               │   │
│  │  Action 1: browser.navigate("https://taobao.com")                    │   │
│  │  Obs 1: 导航成功，当前 URL: https://taobao.com                       │   │
│  │                                                                       │   │
│  │  Thought 2: 需要获取页面快照，找到搜索框                               │   │
│  │  Action 2: browser.snapshot(format="ai")                             │   │
│  │  Obs 2: 快照返回，找到搜索框 ref=e23                                  │   │
│  │                                                                       │   │
│  │  Thought 3: 在搜索框输入 iPhone 15                                    │   │
│  │  Action 3: browser.type(ref="e23", text="iPhone 15", submit=true)    │   │
│  │  Obs 3: 输入完成，已提交搜索                                          │   │
│  │                                                                       │   │
│  │  Thought 4: 等待搜索结果加载                                          │   │
│  │  Action 4: browser.wait(selector=".search-result", timeoutMs=5000)   │   │
│  │  Obs 4: 搜索结果已加载                                                │   │
│  │                                                                       │   │
│  │  Thought 5: 截图保存结果                                              │   │
│  │  Action 5: browser.screenshot(fullPage=true)                         │   │
│  │  Obs 5: 截图成功，返回 base64 数据                                    │   │
│  │                                                                       │   │
│  │  Thought 6: 任务完成                                                  │   │
│  │  Action 6: complete(截图数据)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Browser Control Service                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  独立服务进程（随 Gateway Master 启动）                                │   │
│  │                                                                       │   │
│  │  HTTP API (127.0.0.1:18791):                                          │   │
│  │  ├── POST /navigate    → PlaywrightDriver.navigate()                 │   │
│  │  ├── GET  /snapshot    → PlaywrightDriver.snapshotAi()               │   │
│  │  ├── POST /act         → PlaywrightDriver.type()                     │   │
│  │  ├── POST /wait        → PlaywrightDriver.wait()                     │   │
│  │  └── POST /screenshot  → PlaywrightDriver.screenshot()               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    ▼               ▼               ▼                       │
│           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│           │ Playwright   │ │ Chrome MCP   │ │ Remote CDP   │              │
│           │ Driver       │ │ Driver       │ │ Driver       │              │
│           └──────┬───────┘ └──────────────┘ └──────────────┘              │
│                  │                                                         │
└──────────────────┼─────────────────────────────────────────────────────────┘
                   │
                   │ CDP / MCP
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            浏览器实例                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Chrome/Brave/Edge (CDP Port: 18800)                                  │   │
│  │  - 独立用户数据目录                                                    │   │
│  │  - 受控标签页                                                         │   │
│  │  - 页面状态追踪                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 详细时序图

```
User          Channel       Gateway        Agent         Orchestrator    Executor      BrowserService    Browser
  │              │             │             │               │              │               │             │
  │  发送消息    │             │             │               │              │               │             │
  │─────────────>│             │             │               │              │               │             │
  │              │  转发消息   │             │               │              │               │             │
  │              │────────────>│             │               │              │               │             │
  │              │             │  路由到Agent │               │              │               │             │
  │              │             │────────────>│               │              │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │ 加载画像/记忆  │              │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │ 意图识别      │              │               │             │
  │              │             │             │ (需要浏览器)  │              │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │ 选择工具      │              │               │             │
  │              │             │             │ orchestrator  │              │               │             │
  │              │             │             │──────────────>│              │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │ 创建Worktask │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │ 任务拆解     │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │ spawn Executor              │             │
  │              │             │             │               │─────────────>│               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ loadTools()   │             │
  │              │             │             │               │              │ loadSkills()  │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ ReAct Loop    │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ Thought 1     │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ HTTP: POST /navigate        │
  │              │             │             │               │              │──────────────>│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │               │ CDP: goto() │
  │              │             │             │               │              │               │────────────>│
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │               │<────────────│
  │              │             │             │               │              │<──────────────│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ Observation 1 │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ Thought 2     │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ HTTP: GET /snapshot         │
  │              │             │             │               │              │──────────────>│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │               │ CDP: snapshot│
  │              │             │             │               │              │               │────────────>│
  │              │             │             │               │              │               │<────────────│
  │              │             │             │               │              │<──────────────│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ Observation 2 │             │
  │              │             │             │               │              │ (ref=e23)     │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ Thought 3     │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ HTTP: POST /act             │
  │              │             │             │               │              │ {type, ref, text}           │
  │              │             │             │               │              │──────────────>│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │               │ CDP: type() │
  │              │             │             │               │              │               │────────────>│
  │              │             │             │               │              │               │<────────────│
  │              │             │             │               │              │<──────────────│             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ ... 更多步骤  │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │              │ complete()    │             │
  │              │             │             │               │<─────────────│               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │               │ 汇总结果     │               │             │
  │              │             │             │<──────────────│              │               │             │
  │              │             │             │               │              │               │             │
  │              │             │             │ 返回给用户    │              │               │             │
  │              │             │<────────────│               │              │               │             │
  │              │             │             │               │              │               │             │
  │              │<────────────│             │               │              │               │             │
  │<─────────────│             │             │               │              │               │             │
```

### 核心组件交互

#### BrowserTool 定义

```typescript
const BrowserTool = defineTool("browser", {
  description: "控制浏览器进行网页自动化操作",
  parameters: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("navigate"),
      url: z.string(),
    }),
    z.object({
      action: z.literal("snapshot"),
      format: z.enum(["ai", "aria", "role"]).optional(),
    }),
    z.object({
      action: z.literal("click"),
      ref: z.string(),
    }),
    z.object({
      action: z.literal("type"),
      ref: z.string(),
      text: z.string(),
      submit: z.boolean().optional(),
    }),
    z.object({
      action: z.literal("screenshot"),
      fullPage: z.boolean().optional(),
    }),
  ]),
  execute: async (args, ctx) => {
    const baseUrl = `http://127.0.0.1:${ctx.browserControlPort}`;
    
    switch (args.action) {
      case "navigate":
        return fetch(`${baseUrl}/navigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: args.url }),
        });
        
      case "snapshot":
        const params = new URLSearchParams();
        if (args.format) params.set("format", args.format);
        return fetch(`${baseUrl}/snapshot?${params}`);
        
      case "click":
        return fetch(`${baseUrl}/act`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "click", ref: args.ref }),
        });
        
      case "type":
        return fetch(`${baseUrl}/act`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            kind: "type", 
            ref: args.ref, 
            text: args.text,
            submit: args.submit,
          }),
        });
        
      case "screenshot":
        return fetch(`${baseUrl}/screenshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullPage: args.fullPage }),
        });
    }
  },
});
```

#### Browser Skill 定义

```markdown
# browser

## 概述
控制浏览器进行网页自动化操作，支持导航、快照、点击、输入、截图等功能。

## 命令

### navigate
导航到指定 URL。

参数：
- url: 目标 URL

示例：
browser.navigate "https://example.com"

### snapshot
获取页面快照，返回可交互元素的引用列表。

参数：
- format: 快照格式 (ai/aria/role)

示例：
browser.snapshot format="ai"

### click
点击页面元素。

参数：
- ref: 元素引用（从 snapshot 获取）

示例：
browser.click ref="e12"

### type
在输入框中输入文本。

参数：
- ref: 元素引用
- text: 要输入的文本
- submit: 是否按回车提交

示例：
browser.type ref="e23" text="搜索内容" submit=true

### screenshot
截取页面截图。

参数：
- fullPage: 是否全页截图

示例：
browser.screenshot fullPage=true
```

#### Executor 中的调用

```typescript
class Executor {
  private async executeToolCall(action: ToolAction): Promise<string> {
    const tool = this.tools.get(action.toolName);
    
    if (action.toolName === "browser") {
      const result = await tool.execute(action.parameters, {
        toolCallId: this.generateToolCallId(),
        browserControlPort: this.context.browserControlPort,
        profile: this.context.browserProfile || "default",
      });
      return result.output;
    }
  }
}
```

### 服务启动流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway Master 启动                        │
│                                                                 │
│  1. 加载配置                                                    │
│  2. 初始化数据库连接                                            │
│  3. 启动 HTTP 服务                                              │
│  4. 启动 WebSocket 服务                                         │
│  5. 启动 Browser Control Service  ←─────────────────────────┐  │
│     │                                                        │  │
│     ├── 加载 browser 配置                                    │  │
│     ├── 创建 Express 应用                                    │  │
│     ├── 安装认证中间件                                        │  │
│     ├── 注册路由                                              │  │
│     └── 绑定 127.0.0.1:18791                                 │  │
│                                                              │  │
│  6. 启动 Worker 进程                                         │  │
│     │                                                        │  │
│     └── Worker 可通过 HTTP 调用 Browser Control Service ─────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 关键设计点

#### 服务隔离

```
Browser Control Service 作为独立服务：
- 随 Gateway Master 启动
- 绑定到 127.0.0.1（仅本地访问）
- 通过 HTTP API 提供服务
- 与 Worker 进程隔离
```

#### 认证机制

```typescript
// Browser Control Service 认证
interface BrowserControlAuth {
  token?: string;      // Bearer token
  password?: string;   // HTTP Basic / x-cradle-password
}

// Executor 调用时携带认证
fetch(`${baseUrl}/navigate`, {
  headers: {
    "Authorization": `Bearer ${ctx.browserToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url }),
});
```

#### Profile 路由

```typescript
// 多 Profile 支持
// Executor 可指定使用哪个 Profile

fetch(`${baseUrl}/navigate?profile=user`, {
  // 使用 "user" Profile（现有会话模式）
  // 复用用户已登录的浏览器状态
});

fetch(`${baseUrl}/navigate?profile=default`, {
  // 使用 "default" Profile（本地浏览器模式）
  // 独立的浏览器实例
});
```

#### 错误处理

```typescript
// Executor 中的错误处理
try {
  const result = await tool.execute(action.parameters, ctx);
  return result.output;
} catch (error) {
  if (error instanceof BrowserProfileUnavailableError) {
    // Profile 不可用，尝试启动
    await this.startBrowserProfile(ctx.profile);
    // 重试
    return await tool.execute(action.parameters, ctx);
  }
  throw error;
}
```

### 典型场景示例

#### 场景：自动填写表单

```
用户: "帮我打开公司 OA 系统提交请假申请"

Agent 层：
  → 意图识别：需要浏览器操作 + 表单填写
  → 选择 orchestrator tool

Orchestrator 层：
  → 创建 Worktask
  → 任务拆解：
     1. 导航到 OA 系统
     2. 登录（如需要）
     3. 找到请假申请页面
     4. 填写表单
     5. 提交

Executor 层（ReAct 循环）：
  
  [Iteration 1]
  Thought: 需要先打开 OA 系统
  Action: browser.navigate("https://oa.company.com")
  Obs: 导航成功，页面显示登录界面
  
  [Iteration 2]
  Thought: 需要获取页面快照，找到登录表单
  Action: browser.snapshot(format="ai")
  Obs: 
    - textbox "用户名" [ref=e1]
    - textbox "密码" [ref=e2]
    - button "登录" [ref=e3]
  
  [Iteration 3]
  Thought: 填写用户名
  Action: browser.type(ref="e1", text="zhangsan")
  Obs: 输入成功
  
  [Iteration 4]
  Thought: 填写密码
  Action: browser.type(ref="e2", text="****")
  Obs: 输入成功
  
  [Iteration 5]
  Thought: 点击登录
  Action: browser.click(ref="e3")
  Obs: 登录成功，跳转到首页
  
  [Iteration 6]
  Thought: 获取首页快照，找到请假入口
  Action: browser.snapshot(format="ai")
  Obs:
    - link "请假申请" [ref=e10]
    - link "报销" [ref=e11]
  
  [Iteration 7]
  Thought: 点击请假申请
  Action: browser.click(ref="e10")
  Obs: 跳转到请假申请页面
  
  [Iteration 8]
  Thought: 获取表单快照
  Action: browser.snapshot(format="ai")
  Obs:
    - textbox "请假天数" [ref=e20]
    - textbox "请假原因" [ref=e21]
    - button "提交" [ref=e22]
  
  [Iteration 9]
  Thought: 填写请假天数
  Action: browser.type(ref="e20", text="1")
  Obs: 输入成功
  
  [Iteration 10]
  Thought: 填写请假原因
  Action: browser.type(ref="e21", text="个人事务")
  Obs: 输入成功
  
  [Iteration 11]
  Thought: 提交表单
  Action: browser.click(ref="e22")
  Obs: 提交成功
  
  [Iteration 12]
  Thought: 任务完成
  Action: complete("请假申请已提交成功")
```

#### 场景：数据抓取

```
用户: "帮我从电商网站抓取商品价格信息"

Agent 层：
  → 意图识别：需要浏览器操作 + 数据提取
  → 选择 orchestrator tool

Orchestrator 层：
  → 创建 Worktask
  → 任务拆解：
     1. 导航到电商网站
     2. 搜索商品
     3. 获取商品列表
     4. 提取价格信息
     5. 整理返回

Executor 层（ReAct 循环）：
  
  [Iteration 1]
  Thought: 打开电商网站
  Action: browser.navigate("https://shop.example.com")
  Obs: 导航成功
  
  [Iteration 2]
  Thought: 获取页面快照
  Action: browser.snapshot(format="ai")
  Obs:
    - textbox "搜索" [ref=e1]
    - button "搜索" [ref=e2]
  
  [Iteration 3]
  Thought: 输入搜索关键词
  Action: browser.type(ref="e1", text="笔记本电脑")
  Obs: 输入成功
  
  [Iteration 4]
  Thought: 点击搜索
  Action: browser.click(ref="e2")
  Obs: 搜索完成
  
  [Iteration 5]
  Thought: 等待结果加载
  Action: browser.wait(selector=".product-list", timeoutMs=5000)
  Obs: 结果已加载
  
  [Iteration 6]
  Thought: 获取商品列表快照
  Action: browser.snapshot(format="ai", selector=".product-list")
  Obs:
    - listitem "商品A - ¥5999" [ref=e10]
    - listitem "商品B - ¥4999" [ref=e11]
    - listitem "商品C - ¥6999" [ref=e12]
  
  [Iteration 7]
  Thought: 使用 JavaScript 提取所有价格
  Action: browser.evaluate(fn="() => {
    const items = document.querySelectorAll('.product-item');
    return Array.from(items).map(item => ({
      name: item.querySelector('.name')?.textContent,
      price: item.querySelector('.price')?.textContent
    }));
  }")
  Obs: [
    { name: "商品A", price: "¥5999" },
    { name: "商品B", price: "¥4999" },
    { name: "商品C", price: "¥6999" }
  ]
  
  [Iteration 8]
  Thought: 任务完成
  Action: complete("已获取商品价格信息")
```

#### 场景：使用现有会话

```
用户: "帮我在已登录的邮箱中查看最新邮件"

Agent 层：
  → 意图识别：需要浏览器操作 + 复用登录状态
  → 选择 orchestrator tool

Orchestrator 层：
  → 创建 Worktask
  → 指定使用 "user" Profile（现有会话模式）

Executor 层：
  
  [Iteration 1]
  Thought: 使用现有会话打开邮箱
  Action: browser.navigate("https://mail.example.com", profile="user")
  Obs: 已在登录状态，直接进入收件箱
  
  [Iteration 2]
  Thought: 获取邮件列表快照
  Action: browser.snapshot(format="ai")
  Obs:
    - listitem "邮件1: 项目更新" [ref=e1]
    - listitem "邮件2: 会议邀请" [ref=e2]
    - listitem "邮件3: 报告审批" [ref=e3]
  
  [Iteration 3]
  Thought: 点击最新邮件
  Action: browser.click(ref="e1")
  Obs: 邮件内容已显示
  
  [Iteration 4]
  Thought: 获取邮件内容
  Action: browser.snapshot(format="ai", selector=".email-content")
  Obs: 邮件内容快照...
  
  [Iteration 5]
  Thought: 任务完成
  Action: complete("最新邮件内容已获取")
```

## 实现计划

### 阶段 1：核心服务

1. 实现 `BrowserControlService`
2. 实现 Playwright 驱动
3. 实现基础 HTTP API
4. 实现配置系统
5. 实现 SSRF 防护

### 阶段 2：工具集成

1. 实现 `BrowserTool`
2. 创建 Browser Skill 文档
3. 集成到 Agent 工具系统
4. 实现快照系统

### 阶段 3：高级功能

1. 实现 Chrome MCP 驱动
2. 实现远程 CDP 驱动
3. 实现下载拦截
4. 实现追踪功能

### 阶段 4：优化完善

1. 性能优化
2. 错误处理完善
3. 日志和监控
4. 文档完善

## 相关文档

- [Agent 架构](./ARCHITECTURE.md)
- [Executor 设计](./executor.md)
- [Skill 系统](./skill-system.md)

## 录制与回放

### 概述

录制回放功能允许记录用户在浏览器中的操作，并在之后自动回放这些操作。主要用途：

1. **LLM 学习** - 通过录制教 LLM 某些操作方法
2. **自动化测试** - 录制测试用例并自动执行
3. **流程自动化** - 录制重复性操作并自动执行

### 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      BrowserRecorder                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  录制核心                                                 │   │
│  │  - startRecording()                                      │   │
│  │  - stopRecording()                                       │   │
│  │  - recordAction()                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  回放核心                                                 │   │
│  │  - replay()                                              │   │
│  │  - replayFrom(startIndex)                                │   │
│  │  - replaySingleAction(index)                             │   │
│  │  - executeActionJson()                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  元素匹配                                                 │   │
│  │  - findElementWithFallback()                             │   │
│  │  - strictMatch 策略                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  视觉反馈                                                 │   │
│  │  - injectCursor()                                        │   │
│  │  - showCursor()                                          │   │
│  │  - highlightElement()                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 数据结构

#### RecordedAction

```typescript
interface RecordedAction {
  id: string;                    // 唯一标识
  timestamp: number;             // 时间戳
  type: ActionType;              // 操作类型
  selector?: string;             // CSS 选择器
  element?: ElementInfo;         // 元素信息
  value?: string;                // 操作值
  url: string;                   // 页面 URL
  pageTitle?: string;            // 页面标题
  screenshot?: string;           // 截图（可选）
  pageSnapshot?: PageSnapshot;   // 页面快照（可选）
  strictMatch?: boolean;         // 是否严格匹配元素
}

type ActionType = 
  | "click"       // 单击
  | "dblclick"    // 双击
  | "hover"       // 悬停
  | "input"       // 输入
  | "keydown"     // 按键
  | "scroll"      // 滚动
  | "navigate"    // 导航
  | "select"      // 选择
  | "paste"       // 粘贴
  | "drag"        // 拖拽
  | "mousemove";  // 鼠标移动

interface ElementInfo {
  tagName?: string;              // 标签名
  className?: string;            // 类名
  id?: string;                   // ID
  text?: string;                 // 文本内容
  placeholder?: string;          // 占位符
  ariaLabel?: string;            // ARIA 标签
  rect?: {                       // 位置信息
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

#### RecordingSession

```typescript
interface RecordingSession {
  id: string;                    // 会话 ID
  name?: string;                 // 会话名称
  description?: string;          // 描述
  startTime: number;             // 开始时间
  endTime?: number;              // 结束时间
  actions: RecordedAction[];     // 操作列表
  metadata: {
    profile: string;             // 使用的 Profile
    startUrl: string;            // 起始 URL
    tags?: string[];             // 标签
  };
}
```

### 录制功能

#### 支持的操作类型

| 操作类型 | 触发条件 | 记录内容 |
|---------|---------|---------|
| click | 点击事件 | 选择器、元素信息、坐标 |
| dblclick | 双击事件 | 选择器、元素信息、坐标 |
| hover | 悬停 500ms | 选择器、元素信息、坐标 |
| input | 输入事件 | 选择器、输入值 |
| keydown | 按键事件（含修饰键） | 按键组合 |
| scroll | 滚动事件 | 滚动位置 |
| navigate | 页面跳转 | URL |
| mousemove | Ctrl+Alt+鼠标移动 | 轨迹点列表 |

#### 录制流程

```
1. 注入录制脚本到页面
   ↓
2. 监听用户操作事件
   ↓
3. 收集元素信息（选择器、坐标、属性）
   ↓
4. 生成 RecordedAction
   ↓
5. 添加到 Session.actions
```

#### 跨标签页录制

录制器监听整个 BrowserContext，支持：
- 新标签页打开时自动注入脚本
- 所有标签页的操作统一记录
- 标签页切换时保持录制状态

### 回放功能

#### 回放模式

1. **完整回放** - `replay()`
   - 回放所有录制的操作
   - 支持原始时间间隔
   - 支持速度倍率

2. **部分回放** - `replayFrom(startIndex, count)`
   - 从指定索引开始回放
   - 可限制回放数量

3. **单步回放** - `replaySingleAction(index)`
   - 仅回放指定索引的操作
   - 用于调试和验证

4. **JSON 执行** - `executeActionJson(actionJson)`
   - 直接执行 JSON 格式的操作
   - 用于手动修改后验证

#### 时间间隔保持

```typescript
interface ReplayOptions {
  useOriginalTiming?: boolean;   // 使用原始时间间隔（默认 true）
  speedMultiplier?: number;      // 速度倍率（默认 1）
  delay?: number;                // 固定延迟（默认 500ms）
  showCursor?: boolean;          // 显示视觉光标（默认 true）
}
```

### 元素匹配策略

#### strictMatch 策略

| 操作类型 | 默认 strictMatch | 说明 |
|---------|-----------------|------|
| click, dblclick, select | `true` | 必须精确匹配 |
| input, keydown, paste | `true` | 必须精确匹配 |
| hover, mousemove, scroll | `false` | 允许模糊匹配 |
| navigate, drag | `false` | 不依赖元素 |

#### 匹配流程

```
1. 尝试原始选择器
   ↓ (失败且非严格模式)
2. 按 className 查找（取前2个长类名）
   ↓ (失败)
3. 按 placeholder 查找
   ↓ (失败)
4. 按 text 内容查找
   ↓ (失败)
5. 按 aria-label 查找
   ↓ (失败)
6. 按 tagName 查找（如果唯一）
   ↓ (失败)
7. 使用坐标回退（如果有 rect）
```

#### 坐标回退

非严格模式下，当所有选择器策略都失败时：
- 使用 `element.rect` 中的坐标
- 计算元素中心点 `(x + width/2, y + height/2)`
- 执行坐标点击/悬停

### 视觉反馈

#### 回放光标

回放时显示可视化光标，帮助用户观察操作位置：

```typescript
// 光标样式
{
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "rgba(255, 0, 0, 0.5)",
  border: "2px solid red",
  transform: "translate(-50%, -50%)",
  transition: "all 0.1s ease"
}

// 标签样式
{
  padding: "4px 8px",
  background: "rgba(0, 0, 0, 0.8)",
  color: "white",
  fontSize: "12px",
  borderRadius: "4px"
}
```

#### 光标显示位置

| 操作类型 | 光标位置 |
|---------|---------|
| click/dblclick/hover | 元素中心或坐标 |
| input/paste/select | 元素中心 |
| keydown | 左上角 (100, 50)，显示按键 |
| scroll | 滚动坐标位置 |
| mousemove | 跟随鼠标轨迹 |

### 鼠标移动插值

为避免触发网站自动化检测，回放时自动在操作之间插入鼠标移动轨迹。

#### 插值策略

```typescript
interface InterpolationConfig {
  minDistance: number;      // 最小触发距离（默认 10px）
  numPoints: number;        // 插值点数量（3-5 个）
  totalDuration: number;    // 总持续时间（300-500ms）
  easingFunction: string;   // 缓动函数（ease-in-out）
}
```

#### 插值逻辑

1. **距离计算**：计算当前位置到目标位置的距离
2. **点数确定**：根据距离动态确定插值点数量
   - 距离 < 100px：3 个点
   - 距离 100-300px：4 个点
   - 距离 > 300px：5 个点
3. **缓动插值**：使用 ease-in-out 缓动函数计算中间点
4. **时间分布**：均匀分配总持续时间到各插值点

#### 应用范围

在执行以下操作前自动应用插值：
- click / dblclick
- hover
- input / paste / select

#### 实现示例

```typescript
// 在 replayAction 中统一处理
private async interpolateMouseMovement(
  page: Page,
  targetX: number,
  targetY: number,
  showCursor: boolean = true
): Promise<void> {
  const distance = Math.sqrt(
    Math.pow(targetX - this.lastMousePosition.x, 2) +
    Math.pow(targetY - this.lastMousePosition.y, 2)
  );
  
  if (distance < 10) return;
  
  const numPoints = Math.min(5, Math.max(3, Math.floor(distance / 100)));
  const totalDuration = Math.min(500, Math.max(300, distance / 2));
  
  for (let i = 1; i <= numPoints; i++) {
    const progress = i / numPoints;
    const easeProgress = easeInOut(progress);
    const x = startX + (targetX - startX) * easeProgress;
    const y = startY + (targetY - startY) * easeProgress;
    
    await page.mouse.move(x, y);
    await delay(totalDuration / numPoints);
  }
}
```

### API 设计

#### HTTP API

```
POST /recording/start           # 开始录制
POST /recording/stop            # 停止录制
GET  /recording/status          # 录制状态
GET  /recording/actions         # 获取操作列表
POST /recording/load            # 加载录制文件
POST /recording/replay          # 回放录制
POST /recording/replay/:index   # 回放单个操作
POST /recording/replay-from/:startIndex  # 从指定位置回放
POST /recording/execute         # 执行 JSON 操作
GET  /recording/export          # 导出录制
POST /recording/save            # 保存录制文件
```

#### MCP 工具

```typescript
// 开始录制
browser_recording_start()

// 停止录制
browser_recording_stop()

// 获取录制状态
browser_recording_status()

// 加载录制文件
browser_recording_load({
  filePath: "browser-data/recordings/session-xxx.json"
})

// 回放录制
browser_recording_replay({
  useOriginalTiming?: boolean,
  speedMultiplier?: number
})

// 执行单个操作
browser_recording_execute({
  action: {
    type: "click" | "hover" | "input" | ...,
    selector?: string,
    element?: { tagName, className, rect, ... },
    value?: string,
    strictMatch?: boolean
  },
  showCursor?: boolean
})

// 导出录制
browser_recording_export({
  format?: "json" | "llm" | "markdown"
})

// 保存录制文件
browser_recording_save({
  filename?: string
})
```

### 文件存储

录制文件保存在 `browser-data/recordings/` 目录：

```
browser-data/
└── recordings/
    ├── session-1774149210642-abc123.json
    ├── session-1774149267890-def456.json
    └── ...
```

文件命名格式：`session-{timestamp}-{randomId}.json`

### 使用示例

#### 录制操作

```typescript
// 开始录制
await browserApi("/recording/start", { method: "POST" });

// 用户在浏览器中操作...

// 停止录制
await browserApi("/recording/stop", { method: "POST" });

// 导出录制
const session = await browserApi("/recording/export");
```

#### 回放操作

```typescript
// 完整回放
await browserApi("/recording/replay", {
  method: "POST",
  body: {
    useOriginalTiming: true,
    speedMultiplier: 1,
    showCursor: true
  }
});

// 部分回放
await browserApi("/recording/replay-from/5?count=3", {
  method: "POST"
});

// 单步回放
await browserApi("/recording/replay/5", { method: "POST" });

// 执行 JSON 操作
await browserApi("/recording/execute", {
  method: "POST",
  body: {
    type: "hover",
    strictMatch: false,
    selector: "#video-player",
    element: {
      tagName: "video",
      rect: { x: 184, y: 704, width: 327, height: 184 }
    }
  }
});
```

### 鼠标移动插值（反自动化检测）

为绕过网站的自动化检测，实现鼠标轨迹插值，模拟真实人类操作。

#### 设计原则

1. **统一前置** - 所有操作执行前自动插入插值
2. **距离阈值** - 距离 > 10px 时插入插值
3. **自然轨迹** - 贝塞尔曲线 + 随机抖动
4. **速度变化** - 先快后慢，模拟人类行为

#### 插值参数

| 参数 | 值 | 说明 |
|-----|---|------|
| 最小距离 | 10px | 超过此距离才插值 |
| 插值数量 | 3-5 | 根据距离动态调整 |
| 总持续时间 | 300-500ms | 根据距离动态调整 |
| 抖动范围 | ±3-5px | 随机偏移 |
| 随机延迟 | 50-200ms | 操作前随机等待 |

#### 实现细节

```typescript
interface InterpolationConfig {
  minDistance: number;       // 最小触发距离（默认 10px）
  numPoints: number;         // 插值点数量（3-5 个）
  totalDuration: number;     // 总持续时间（300-500ms）
  jitterRange: number;       // 抖动范围（±3-5px）
  randomDelay: number;       // 随机延迟（50-200ms）
}

interface Point {
  x: number;
  y: number;
}
```

##### 1. 贝塞尔曲线轨迹

使用二次贝塞尔曲线生成自然轨迹：

```typescript
function quadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  return { x, y };
}

// 控制点在起点和终点连线的中点，随机偏移 30-50px
const midX = (startX + targetX) / 2 + (Math.random() - 0.5) * 80;
const midY = (startY + targetY) / 2 + (Math.random() - 0.5) * 80;
const controlPoint = { x: midX, y: midY };
```

##### 2. 随机抖动

每个插值点添加随机偏移：

```typescript
function addJitter(point: Point, range: number = 4): Point {
  return {
    x: point.x + (Math.random() - 0.5) * range * 2,
    y: point.y + (Math.random() - 0.5) * range * 2
  };
}
```

##### 3. 速度曲线

使用 ease-out 缓动函数（开始快、接近目标慢）：

```typescript
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// 应用缓动
const easedProgress = easeOutQuad(progress);
```

##### 4. 随机延迟

操作前添加随机等待时间：

```typescript
function randomDelay(min: number = 50, max: number = 200): number {
  return Math.floor(Math.random() * (max - min) + min);
}

// 操作前等待
await new Promise(resolve => setTimeout(resolve, randomDelay()));
```

#### 插值流程

```
当前位置 (x1, y1)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. 计算距离 distance = √((x2-x1)² + (y2-y1)²)      │
│  2. 确定插值数量 (3-5) 和总时间 (300-500ms)          │
│  3. 生成贝塞尔曲线控制点（随机偏移）                  │
│  4. 沿曲线生成插值点                                 │
│  5. 每个点添加随机抖动 (±3-5px)                      │
│  6. 应用 ease-out 速度曲线                          │
│  7. 每个点间添加随机延迟                             │
└─────────────────────────────────────────────────────┘
    │
    ▼
插值点1 ──→ 插值点2 ──→ 插值点3 ──→ 插值点4 ──→ 插值点5
  80ms      120ms     100ms      90ms      110ms
    │
    ▼
目标位置 (x2, y2)
```

#### 应用范围

在执行以下操作前自动应用插值：
- click / dblclick
- hover
- input / paste / select

#### 实现位置

在 `replayAction` 方法中，通过 `interpolateMouseMovement` 方法统一处理，覆盖所有回放入口：
- `replay()` 整体回放
- `replayFrom()` 部分回放
- `executeActionJson()` 单步执行
- `replaySingleAction()` 单个回放
