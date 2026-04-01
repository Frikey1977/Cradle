# 元素标记系统设计文档

## 概述

元素标记系统是一个用于人工标记页面互动元素的工具，通过配置文件的方式让 Agent 能够精准识别和操作页面元素。该系统将平台快照机制融合进 AI 快照逻辑中，提高元素识别的准确性和效率。

## 核心功能

### 1. 页面元素标记器

在浏览器页面中直接标记互动元素：

- **启动标记模式**：在当前活动 Tab 上启动标记器
- **高亮显示**：已标记元素以绿色高亮显示，带有 ref 标签
- **元素选择**：按住右 Alt 键，点击页面元素进行选择
- **面包屑导航**：显示元素层级路径，支持精确调整选择
- **交互类型选择**：click、input、hover、select、submit、scroll、focus、other
- **描述输入**：允许输入简短说明，告诉 Agent 这是什么元素
- **自动生成选择器**：基于 ID、class、属性等生成精准 CSS 选择器

### 2. 配置文件系统

基于域名的 JSON 配置文件：

```
config/element-markers/
├── live.douyin.com.json
├── www.douyin.com.json
├── www.bilibili.com.json
└── ...
```

#### 配置文件结构

```typescript
interface SiteConfig {
  domain: string;           // 站点域名
  displayName: string;      // 显示名称
  description?: string;     // 站点描述
  pages: PageConfig[];      // 页面配置列表
  globalScript?: string;    // 全局注入脚本
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface PageConfig {
  urlPattern: string;       // URL 匹配模式（支持通配符）
  pageType: string;         // 页面类型标识
  description: string;      // 页面描述
  elements: MarkedElement[]; // 标记的元素列表
  actionGroups?: ActionGroup[]; // 操作组定义
  pageScript?: string;      // 页面特定脚本
  snapshotScript?: string;  // 快照处理脚本
  updatedAt: string;
  version: number;
}

interface MarkedElement {
  ref: string;              // 元素引用 ID (r1, r2, r3...)
  type: ElementInteractionType; // 交互类型
  description: string;      // 元素描述
  selector: string;         // CSS 选择器
  selectorType: "css" | "xpath" | "id" | "data-attribute";
  tagName: string;          // 元素标签名
  breadcrumb: string[];     // 层级路径
  rect: { x, y, width, height }; // 元素位置
  attributes: Record<string, string>; // 元素属性
  text?: string;            // 文本内容
  placeholder?: string;     // 占位符
  isGroup?: boolean;        // 是否属于操作组
  groupId?: string;         // 所属操作组 ID
  groupOrder?: number;      // 在操作组中的顺序
  metadata?: Record<string, unknown>; // 额外元数据
}

interface ActionGroup {
  id: string;               // 组 ID
  name: string;             // 组名称
  description: string;      // 组描述
  elementRefs: string[];    // 元素引用列表（按执行顺序）
  delayBetweenActions?: number; // 组内操作间隔
  preCondition?: {          // 执行前等待条件
    selector?: string;
    visible?: boolean;
    timeout?: number;
  };
  postValidation?: {        // 执行后验证
    selector?: string;
    textContains?: string;
    timeout?: number;
  };
}
```

### 3. 快照增强

将标记配置融合进 AI 快照流程：

#### 快照获取流程

```
获取快照请求
    │
    ▼
识别当前 URL
    │
    ▼
查找匹配的配置文件
    │
    ├── 有配置 ──→ 注入标记脚本 ──→ 标注元素 (data-cradle-ref)
    │                      │
    │                      ▼
    │              返回增强快照（含标记元素列表）
    │
    └── 无配置 ──→ 返回原始 AI 快照
```

#### 增强快照内容

```typescript
interface EnhancedSnapshotResult {
  originalSnapshot: string;     // 增强后的快照文本
  markedElements: MarkedElement[]; // 标记的元素列表
  actionGroups: ActionGroup[];  // 可用的操作组
  pageData?: Record<string, unknown>; // 页面特定数据
  config: SiteConfig | null;    // 使用的配置
}
```

### 4. 操作组批处理

支持将多个操作组合成一个操作组，一次性执行：

#### 操作组示例

```json
{
  "id": "send-comment",
  "name": "发送评论",
  "description": "输入评论内容并发送",
  "elementRefs": ["r1", "r2"],
  "delayBetweenActions": 100,
  "preCondition": {
    "selector": "[data-e2e='comment-input']",
    "visible": true,
    "timeout": 5000
  },
  "postValidation": {
    "selector": "[data-e2e='comment-list']",
    "timeout": 3000
  }
}
```

#### 批处理执行

```typescript
// 执行操作组
await executeActionGroup(page, group, elements);

// 执行自定义批处理
await executeBatchActions(page, [
  { ref: "r1", type: "input", value: "Hello!" },
  { ref: "r2", type: "submit" }
], 100);
```

## API 接口

### HTTP API

#### 配置管理

```
GET    /marker/configs                    # 获取所有站点配置
GET    /marker/config/:domain              # 获取站点配置
POST   /marker/config                      # 创建站点配置
PUT    /marker/config/:domain              # 更新站点配置
DELETE /marker/config/:domain              # 删除站点配置

GET    /marker/config/:domain/pages        # 获取页面配置列表
GET    /marker/config/:domain/page/:type   # 获取页面配置
POST   /marker/config/:domain/page         # 保存页面配置
DELETE /marker/config/:domain/page/:type   # 删除页面配置
```

#### 元素标记

```
POST   /marker/element                     # 添加标记元素
DELETE /marker/element/:domain/:page/:ref  # 删除标记元素
```

#### 标记器控制

```
POST   /marker/start                       # 启动标记器
POST   /marker/stop                        # 停止标记器
GET    /marker/script                      # 获取标记器脚本
```

#### 快照增强

```
GET    /marker/snapshot                    # 获取增强快照
POST   /marker/batch-action                # 执行批处理操作
POST   /marker/action-group/:groupId       # 执行操作组
```

### MCP 工具

```typescript
// 元素标记工具
browser_element_marker({
  action: "startMarking" | "stopMarking" | 
          "getConfigs" | "getConfig" | "createConfig" | "savePageConfig" |
          "addElement" | "removeElement" |
          "getEnhancedSnapshot" | "executeBatch" | "executeActionGroup",
  profile?: string,
  domain?: string,
  pageType?: string,
  url?: string,
  displayName?: string,
  description?: string,
  element?: string,      // JSON string
  ref?: string,
  actions?: string,      // JSON string
  groupId?: string,
  pageConfig?: string,   // JSON string
})
```

## 使用流程

### 1. 标记页面元素

```bash
# 1. 导航到目标页面
curl -X POST http://localhost:18791/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://live.douyin.com/123456"}'

# 2. 启动标记器
curl -X POST http://localhost:18791/marker/start \
  -H "Content-Type: application/json" \
  -d '{"domain": "live.douyin.com", "pageType": "live-room"}'

# 3. 在浏览器中操作：
#    - 按住右 Alt 键
#    - 点击要标记的元素
#    - 选择交互类型，输入描述
#    - 保存标记

# 4. 停止标记器，获取标记结果
curl -X POST http://localhost:18791/marker/stop
```

### 2. 获取增强快照

```bash
# 获取增强快照（自动使用已保存的配置）
curl http://localhost:18791/snapshot?format=ai

# 或者直接获取增强快照
curl http://localhost:18791/marker/snapshot
```

### 3. 执行操作组

```bash
# 执行发送评论操作组
curl -X POST http://localhost:18791/marker/action-group/send-comment \
  -H "Content-Type: application/json" \
  -d '{"profile": "default"}'

# 执行自定义批处理
curl -X POST http://localhost:18791/marker/batch-action \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {"ref": "r1", "type": "input", "value": "Hello!"},
      {"ref": "r2", "type": "submit"}
    ],
    "delayMs": 100
  }'
```

## 集成到 AI 快照流程

修改 `snapshotAi` 方法，优先使用增强快照：

```typescript
async snapshotAi(opts?: SnapshotOptions): Promise<SnapshotAiResult> {
  const page = await this.getActivePageInternal();
  const url = page.url();

  // 首先尝试获取增强快照
  const enhancedResult = await globalSnapshotEnhancer.getEnhancedSnapshot(page, url);

  // 如果有标记配置，使用增强快照
  if (enhancedResult.config && enhancedResult.markedElements.length > 0) {
    return {
      elements: enhancedResult.markedElements.map(el => ({
        ref: el.ref,
        type: el.type,
        text: el.description.slice(0, 60),
      })),
      pageText: enhancedResult.originalSnapshot.slice(0, 5000),
    };
  }

  // 否则使用原有的 role-based 快照
  return this.buildRoleBasedSnapshot(page, opts);
}
```

## 优势

1. **精准识别**：人工标记确保元素选择器的准确性
2. **高效快照**：直接返回配置，无需动态页面提取
3. **数据量小**：只返回关心的元素，不关心的元素不体现
4. **操作组支持**：支持将多个操作组合，一次调用完成多组动作
5. **可维护性**：配置文件易于管理和更新
6. **向后兼容**：无配置时自动回退到原有快照逻辑

## 文件结构

```
src/agent/browser/
├── element-marker/
│   ├── index.ts              # 模块导出
│   ├── types.ts              # 类型定义
│   ├── config-manager.ts     # 配置管理器
│   ├── marker-script.ts      # 页面标记脚本
│   └── snapshot-enhancer.ts  # 快照增强器
├── routes/
│   ├── element-marker.ts     # HTTP 路由
│   └── index.ts              # 路由注册
├── drivers/
│   └── playwright-driver.ts  # 集成增强快照
└── service.ts                # 初始化配置管理器
```

## 配置文件示例

见 `config/element-markers/live.douyin.com.json`
