---
name: browser
description: 浏览器自动化操作，支持网页导航、交互、截图、表单填写、平台快照等
emoji: "🌐"
---

# Browser Skill

浏览器自动化能力，通过 HTTP API 控制浏览器服务。

## When to Use

- 打开网页、导航到 URL
- 网页内容抓取、截图
- 表单自动填写
- 网页元素交互（点击、输入、悬停）
- 浏览器标签管理
- 获取页面快照和元素引用
- 获取平台特定数据（如抖音视频评论、用户视频列表等）

## API 基础

**基础 URL**: `http://127.0.0.1:18791`
**认证**: Bearer Token（通过 Authorization header）
**Profile**: 支持多浏览器实例隔离，通过 `?profile=<name>` 参数指定，可不指定默认值为 `default`。

## 调用方法

### 方式 1: 使用 HTTP 工具（推荐）

使用任意 HTTP 客户端（如 Postman、Insomnia、VS Code REST Client）发送请求：

```http
GET http://127.0.0.1:18791/tabs
Authorization: Bearer cradle-browser-test-token
```

### 方式 2: 使用 PowerShell (Windows)

```powershell
# 设置变量
$token = "cradle-browser-test-token"
$baseUrl = "http://127.0.0.1:18791"

# GET 请求
Invoke-RestMethod -Uri "$baseUrl/tabs" -Headers @{Authorization = "Bearer $token"}

# POST 请求
Invoke-RestMethod -Uri "$baseUrl/navigate" -Method POST `
  -Headers @{Authorization = "Bearer $token"; "Content-Type" = "application/json"} `
  -Body '{"url": "https://example.com"}'
```

### 方式 3: 使用 curl (Linux/Mac)

```bash
# GET 请求
curl -H "Authorization: Bearer cradle-browser-test-token" \
  "http://127.0.0.1:18791/tabs"

# POST 请求
curl -X POST -H "Authorization: Bearer cradle-browser-test-token" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  "http://127.0.0.1:18791/navigate"
```


## 标签页控制

### 列出标签

**Endpoint**: `GET /tabs`

**返回**:
```json
{
  "tabs": [
    {"targetId": "abc123", "url": "https://example.com", "title": "Example", "active": true}
  ]
}
```

### 打开新标签

**Endpoint**: `POST /tabs/open`

**参数**:
- `url`: 要打开的 URL（必填）

**示例**:
```json
{"url": "https://example.com"}
```

### 切换标签

**Endpoint**: `POST /tabs/focus`

**参数**:
- `targetId`: 标签 ID（必填）

**示例**:
```json
{"targetId": "abc123"}
```

### 关闭标签

**Endpoint**: `DELETE /tabs/{targetId}`

**参数**:
- `targetId`: 标签 ID（URL 路径参数）

### 导航到 URL

**Endpoint**: `POST /navigate`

**参数**:
- `url`: 目标 URL（必填）
- `timeoutMs`: 超时时间（毫秒，可选，默认 30000）
- `waitUntil`: 等待条件（可选）- `load` | `domcontentloaded` | `networkidle`

**示例**:
```json
{
  "url": "https://example.com",
  "timeoutMs": 30000,
  "waitUntil": "networkidle"
}
```

## 页面操作

所有页面操作使用统一的 endpoint：`POST /act`

通过 `kind` 参数指定操作类型：

### 点击元素

**参数**:
- `kind`: `"click"`
- `ref`: 元素引用（从 snapshot 获取，必填）
- `button`: 鼠标按钮（可选）- `left` | `right` | `middle`，默认 `left`
- `clickCount`: 点击次数（可选，2 = 双击）

**示例**:
```json
{
  "kind": "click",
  "ref": "e1",
  "button": "left",
  "clickCount": 1
}
```

### 输入文本

**参数**:
- `kind`: `"type"`
- `ref`: 元素引用（必填）
- `text`: 输入文本（必填）
- `submit`: 输入后按 Enter 提交（可选，默认 false）
- `clear`: 输入前清空内容（可选，默认 false）

**示例**:
```json
{
  "kind": "type",
  "ref": "e2",
  "text": "hello",
  "submit": true,
  "clear": true
}
```

### 悬停元素

**参数**:
- `kind`: `"hover"`
- `ref`: 元素引用（必填）

**示例**:
```json
{
  "kind": "hover",
  "ref": "e1"
}
```

### 按键操作

**参数**:
- `kind`: `"press"`
- `key`: 按键名称（必填）

**常用按键**: `Enter`, `Escape`, `Tab`, `ArrowDown`, `ArrowUp`, `Backspace`, `Delete`

**示例**:
```json
{
  "kind": "press",
  "key": "Enter"
}
```

### 滚动页面

**参数**:
- `kind`: `"scroll"`
- `direction`: 滚动方向（必填）- `up` | `down` | `left` | `right`

**示例**:
```json
{
  "kind": "scroll",
  "direction": "down"
}
```

### 拖拽元素

**参数**:
- `kind`: `"drag"`
- `startRef`: 源元素引用（必填）
- `endRef`: 目标元素引用（必填）

**示例**:
```json
{
  "kind": "drag",
  "startRef": "e1",
  "endRef": "e2"
}
```

### 选择下拉框

**参数**:
- `kind`: `"select"`
- `ref`: 元素引用（必填）
- `values`: 选项值数组（必填）

**示例**:
```json
{
  "kind": "select",
  "ref": "e3",
  "values": ["option1", "option2"]
}
```

## 页面信息

### 获取页面快照

**Endpoint**: `GET /snapshot`

**查询参数**:
- `format`: 快照格式（可选）- `ai` | `aria` | `role`，默认 `ai`
- `selector`: CSS 选择器，限制快照范围（可选）
- `limit`: 返回元素数量限制（可选）

**格式说明**:
- `ai`: AI 优化格式（推荐，通用页面），自动匹配页面配置并注入标注脚本
- `aria`: ARIA 无障碍树
- `role`: Role-based 语义化

**返回示例** (format=ai):
```json
{
  "elements": [
    {"ref": "e1", "type": "textbox", "description": "Search"},
    {"ref": "e2", "type": "button", "description": "Submit"}
  ],
  "pageText": "..."
}
```

### 读取元素内容

**Endpoint**: `GET /read/{ref}`

**说明**: 读取指定元素的文本内容。可读取任何已标记的元素，返回其 `innerText` 文本。如果页面有标记配置，会自动注入标记并返回元素描述。

**路径参数**:
- `ref`: 元素引用 ID（必填）

**返回示例**:
```json
{
  "success": true,
  "ref": "r2",
  "type": "text",
  "description": "聊天消息区",
  "content": "用户A: 你好\n用户B: 在吗",
  "url": "https://live.douyin.com/410878295093",
  "domain": "live.douyin.com"
}
```

**注意**: 
- 返回的 `type` 字段来自标记配置，表示元素的用途类型（如 text、chat、input 等）
- `content` 始终返回文本内容，不包含 HTML 标签

**PowerShell 示例**:
```powershell
# 读取聊天消息区内容
Invoke-RestMethod -Uri "$baseUrl/read/r2" -Headers @{Authorization = "Bearer $token"}
```

### 截图

**Endpoint**: `POST /screenshot`

**参数**:
- `fullPage`: 截取整个页面（可选，默认 false）
- `selector`: CSS 选择器，截取特定元素（可选）
- `type`: 图片格式（可选）- `png` | `jpeg`，默认 `png`
- `quality`: JPEG 质量 1-100（可选）

**返回**:
```json
{
  "data": "<base64>",
  "mimeType": "image/png",
  "size": 12345
}
```

### 执行 JavaScript

**Endpoint**: `POST /evaluate`

**参数**:
- `fn`: JavaScript 函数代码（必填）

**示例**:
```json
{
  "fn": "() => document.title"
}
```

### 等待条件

**Endpoint**: `POST /wait`

**参数**:
- `selector`: CSS 选择器，等待元素出现（可选）
- `url`: URL 字符串，等待 URL 匹配（可选）
- `timeoutMs`: 超时时间（可选，默认 10000）
- `state`: 元素状态（可选）- `visible` | `hidden` | `attached` | `detached`

**示例**:
```json
{
  "selector": "#content",
  "timeoutMs": 10000,
  "state": "visible"
}
```

### 高亮元素

**Endpoint**: `POST /highlight`

**参数**:
- `ref`: 元素引用（必填）

**示例**:
```json
{
  "ref": "e1"
}
```

### 填充表单

**Endpoint**: `POST /fill-form`

**参数**:
- `fields`: 字段数组（必填）
  - `ref`: 元素引用
  - `value`: 填充值

**示例**:
```json
{
  "fields": [
    {"ref": "e1", "value": "John"},
    {"ref": "e2", "value": "john@example.com"}
  ]
}
```

### 获取 Cookies

**Endpoint**: `GET /cookies`

### 获取浏览器状态

**Endpoint**: `GET /`

## 录制与回放

### 录制控制

#### 开始录制

**Endpoint**: `POST /recording/start`

**参数**:
- `name`: 录制会话名称（必填）
- `description`: 录制描述（可选）

#### 停止录制

**Endpoint**: `POST /recording/stop`

#### 查看录制状态

**Endpoint**: `GET /recording/status`

**返回**:
```json
{
  "isRecording": true,
  "name": "login-flow",
  "actionCount": 5,
  "duration": 12345
}
```

#### 加载录制文件

**Endpoint**: `POST /recording/load`

**参数**:
- `filePath`: 录制文件路径（必填）

#### 导出录制

**Endpoint**: `POST /recording/export`

**参数**:
- `format`: 导出格式（可选）- `json` | `llm` | `markdown`，默认 `llm`

### 回放控制

#### 播放录制

**Endpoint**: `POST /replay/play`

**参数**:
- `speedMultiplier`: 回放速度倍数（可选，默认 1）
- `showCursor`: 显示可视化光标（可选，默认 true）
- `useOriginalTiming`: 使用原始时间间隔（可选，默认 true）
- `delay`: 固定延迟时间毫秒（可选）

#### 暂停/恢复/停止回放

- **暂停**: `POST /replay/pause`
- **恢复**: `POST /replay/resume`
- **停止**: `POST /replay/stop`

#### 单步执行

**Endpoint**: `POST /replay/step`

**参数**:
- `index`: 操作索引（必填，从 0 开始）

#### 从指定位置播放

**Endpoint**: `POST /replay/playFrom`

**参数**:
- `startIndex`: 开始索引（必填，从 0 开始）
- `count`: 回放操作数量（可选，不指定则回放到末尾）

#### 查看回放状态

**Endpoint**: `GET /replay/status`

**返回**:
```json
{
  "isPlaying": true,
  "currentIndex": 3,
  "totalActions": 10,
  "name": "login-flow"
}
```

## 使用流程

```
1. navigate: 导航到目标页面
2. snapshot: 获取元素引用 (ref)
3. click/type/read: 使用 ref 进行交互或读取内容
4. 重复步骤 2-3 直到完成
```

## 元素标记系统

元素标记系统允许人工标注页面上的关键元素，生成配置文件，后续访问时自动注入标记。

### 配置文件位置

配置文件存储在 `config/element-markers/` 目录：

```
config/element-markers/
├── live.douyin.com.json      # 抖音直播配置
└── creator.xiaohongshu.com.json  # 小红书配置
```

### 配置文件结构

```json
{
  "domain": "live.douyin.com",
  "displayName": "抖音直播",
  "pages": [
    {
      "pageType": "default",
      "urlPattern": "regex:^https://live\\.douyin\\.com/\\d+",
      "elements": [
        {
          "ref": "r1",
          "type": "text",
          "description": "观众列表",
          "selector": "xpath=//*[@id=\"chatroom\"]/div[2]/div[1]",
          "selectorType": "xpath"
        },
        {
          "ref": "r2",
          "type": "text",
          "description": "聊天消息区",
          "selector": "xpath=//*[@id=\"chatroom\"]/div[2]/div[2]",
          "selectorType": "xpath"
        },
        {
          "ref": "r3",
          "type": "chat",
          "description": "聊天输入区",
          "selector": "xpath=//*[@id=\"chatInput\"]//div[@contenteditable=\"true\"]",
          "selectorType": "xpath"
        }
      ]
    }
  ]
}
```

### URL 匹配规则

支持两种匹配模式：

| 模式 | 示例 | 说明 |
|------|------|------|
| 通配符 | `https://example.com/*` | `*` 匹配任意字符，`?` 匹配单个字符 |
| 正则表达式 | `regex:^https://live\\.douyin\\.com/\\d+` | 以 `regex:` 开头，后面是正则表达式 |

### 元素类型

| type | 说明 | 用途 |
|------|------|------|
| `text` | 文本元素 | 显示内容，如聊天消息、评论 |
| `chat` | 聊天输入 | 发送消息 |
| `input` | 输入框 | 表单输入 |
| `button` | 按钮 | 点击操作 |
| `link` | 链接 | 导航 |
| `tab` | 标签页 | 切换内容 |

### 标记 API

#### 获取增强快照

**Endpoint**: `GET /marker/snapshot`

**返回**: 包含标记元素信息的增强快照

#### 批量执行操作

**Endpoint**: `POST /marker/batch-action`

**参数**:
```json
{
  "actions": [
    {"ref": "r3", "type": "chat", "value": "你好"}
  ],
  "delayMs": 1000
}
```

### 使用标记元素的完整示例

```powershell
# 1. 导航到抖音直播间
Invoke-RestMethod -Uri "$baseUrl/navigate" -Method POST `
  -Headers $headers -Body '{"url": "https://live.douyin.com/410878295093"}'

# 2. 获取快照（自动匹配配置并注入标记）
$snapshot = Invoke-RestMethod -Uri "$baseUrl/snapshot?format=ai" -Headers $headers

# 3. 读取聊天消息
$messages = Invoke-RestMethod -Uri "$baseUrl/read/r2" -Headers $headers
Write-Host $messages.content

# 4. 发送聊天消息
Invoke-RestMethod -Uri "$baseUrl/act" -Method POST `
  -Headers $headers -Body '{"kind": "type", "ref": "r3", "text": "主播好", "submit": true}'
```

## 示例：搜索并截图

**步骤**:
1. 导航到百度
2. 获取页面快照，找到搜索框 ref
3. 在搜索框输入内容并提交
4. 等待结果加载
5. 截图

**PowerShell 实现**:
```powershell
$token = "cradle-browser-test-token"
$baseUrl = "http://127.0.0.1:18791"
$headers = @{Authorization = "Bearer $token"; "Content-Type" = "application/json"}

# 1. 导航到百度
Invoke-RestMethod -Uri "$baseUrl/navigate" -Method POST `
  -Headers $headers -Body '{"url": "https://www.baidu.com"}'

# 2. 获取页面快照
$snapshot = Invoke-RestMethod -Uri "$baseUrl/snapshot?format=ai&profile=default" -Headers $headers
# 从 $snapshot.elements 中找到搜索框的 ref（通常是 type=textbox 的元素）
$searchRef = "e1"  # 根据实际 snapshot 结果确定

# 3. 输入搜索词并提交
Invoke-RestMethod -Uri "$baseUrl/act" -Method POST `
  -Headers $headers -Body "{`"kind`": `"type`", `"ref`": `"$searchRef`", `"text`": `"Cradle`", `"submit`": true}"

# 4. 等待结果加载
Invoke-RestMethod -Uri "$baseUrl/wait" -Method POST `
  -Headers $headers -Body '{"selector": "#content", "timeoutMs": 5000}'

# 5. 截图
Invoke-RestMethod -Uri "$baseUrl/screenshot" -Method POST `
  -Headers $headers -Body '{"fullPage": true}'
```

