# Gateway 通道架构设计

## 架构概述

Gateway 作为中央控制平面，统一接入所有通信通道，实现**身份归一化**和**消息路由**。

### 简化架构视图

```
     webui          员工可以自己维护自己在各个IM上的身份信息                         管理员维护
   dingtalk                       │                                                  |
    ......        channel -  channel identities                              r_channel_agent -  channel identities
       │             │                                偏好                           │
       ▼             ▼                                 |                             ▼
    channel  -    contact    ----------        r_contact_agent    ---------        agent
                     │                                                               |
          识别不出来的是陌生人，陌生人自动创建contact                                    │
                                                                              结合agent的position，针对不同的contact做出不同的处理策略
                                                                                     │
                                                                                     │
                                                                              识别出来是客户/合作伙伴 - 后台人工审核后建档



                                                                              
```

### 详细架构视图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Channel 层（通信通道）                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │  WebUI  │  │DingTalk │  │ WeChat  │  │  ...    │                    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘                    │
│       │            │            │                                       │
│       └────────────┴────────────┘                                       │
│                    │                                                    │
│                    ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Gateway Master (统一入口)                     │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              HTTP Server (Port 3000)                    │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │   │   │
│  │  │  │  REST API   │  │   Webhook   │  │  WebSocket /ws  │ │   │   │
│  │  │  │  /health    │  │  /webhook/* │  │  (WebUI Channel)│ │   │   │
│  │  │  │  /stats     │  │             │  │                 │ │   │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────┘ │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                              │                                  │   │
│  │                              ▼                                  │   │
│  │                   ┌─────────────────────┐                       │   │
│  │                   │   Gateway Router    │                       │   │
│  │                   │  - 提取 channel_type│                       │   │
│  │                   │  - 提取 from_id     │                       │   │
│  │                   │  - 提取 to_id       │                       │   │
│  │                   └─────────────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
┌─────────────────────────────┐      ┌─────────────────────────────┐
│        Contact 层            │      │         Agent 层            │
│      （交流对象/用户）        │      │      （服务提供者）          │
│                             │      │                             │
│  ┌─────────────────────┐   │      │  ┌─────────────────────┐    │
│  │  已知身份            │   │      │  │  Channel Identities │    │
│  │  - 内部员工          │   │      │  │  (管理员配置)        │    │
│  │  - 客户/合作伙伴     │   │      │  │                     │    │
│  │  {"dingtalk": "xxx"}│   │      │  │ {"dingtalk":        │    │
│  └─────────────────────┘   │      │  │  "robot-001"}       │    │
│                             │      │  │ {"wechat": "gh_xx"} │    │
│  身份来源：                  │      │  └─────────────────────┘    │
│  ├─ WebUI：员工自己维护      │      │                             │
│  ├─ IM通道：扫码绑定         │      │  策略来源：                  │
│  └─ 后台审核：客户/合作伙伴  │◄────►│  ├─ position 岗位画像        │
│                             │      │  └─ 个性化配置               │
└─────────────────────────────┘      └─────────────────────────────┘
              │                                    │
              └──────────────┬─────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │      身份识别机制            │
              │                             │
              │  1. 查表：r_channel_contact  │
              │     ↓ 找到 contact           │
              │     ↓ 已知身份，正常服务      │
              │                             │
              │  2. 未找到 → 陌生人处理       │
              │     ↓ 按position策略提供服务  │
              │     ↓ 记录待审核队列          │
              │                             │
              │  3. 后台人工审核              │
              │     ↓ 确认身份后建档          │
              │     ↓ 转为正式客户            │
              └─────────────────────────────┘
```

### 统一入口设计

**核心原则**：所有通道流量通过单一 HTTP 服务器入口

```
Gateway Master (Port 3000)
├── HTTP REST API
│   ├── GET  /health      → 健康检查
│   ├── GET  /stats       → 统计信息
│   └── POST /webhook/:channel → Webhook 回调
│
└── WebSocket (Path: /ws)
    ├── 连接建立          → WebUI 实时通信
    ├── JWT 认证          → 连接后发送 token
    ├── 消息收发          → 双向实时消息
    └── 心跳检测          → 连接保活
```

**设计优势**：
- **单一端口**：简化部署，只需开放 3000 端口
- **统一认证**：所有请求走相同的认证中间件
- **共享资源**：HTTP 和 WebSocket 共享服务器实例
- **标准协议**：WebSocket 通过 HTTP Upgrade 机制升级（RFC 6455）
- **易于扩展**：新增通道类型不需要新增端口

### WebSocket 认证设计

**认证方式**：连接后 JWT Token 认证（方式 B）

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket 认证流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户登录 WebUI                                          │
│     └── 获取 JWT accessToken                                │
│                                                             │
│  2. 建立 WebSocket 连接                                     │
│     Client ──► ws://localhost:3000/ws                       │
│                                                             │
│  3. 连接成功后发送认证消息                                  │
│     {                                                       │
│       "type": "auth",                                       │
│       "payload": {                                          │
│         "token": "eyJhbGciOiJIUzI1NiIs..."                  │
│       }                                                     │
│     }                                                       │
│                                                             │
│  4. Gateway 验证 JWT Token                                  │
│     └── 验证 token 有效性                                   │
│     └── 提取 userId, userName                               │
│     └── 标记客户端已认证                                    │
│                                                             │
│  5. 认证成功响应                                            │
│     {                                                       │
│       "type": "auth_success",                               │
│       "payload": {                                          │
│         "userId": "user-001",                               │
│         "userName": "张三"                                  │
│       }                                                     │
│     }                                                       │
│                                                             │
│  6. 后续消息                                                │
│     └── 无需再次认证，直接发送业务消息                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**消息协议**：

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `auth` | C→S | 发送 JWT token 进行认证 |
| `auth_success` | S→C | 认证成功，返回用户信息 |
| `auth_error` | S→C | 认证失败，返回错误信息 |
| `message` | C→S | 发送业务消息 |
| `ack` | S→C | 消息确认 |
| `ping` | C→S | 心跳请求 |
| `pong` | S→C | 心跳响应 |

**前端集成**：

```typescript
// composables/useWebSocket.ts
export function useWebSocket() {
  const accessStore = useAccessStore();
  const ws = ref<WebSocket | null>(null);
  
  const connect = () => {
    ws.value = new WebSocket('ws://localhost:3000/ws');
    
    ws.value.onopen = () => {
      // 发送 JWT token 认证
      ws.value?.send(JSON.stringify({
        type: 'auth',
        payload: { token: accessStore.accessToken }
      }));
    };
    
    ws.value.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'auth_success':
          console.log('认证成功:', message.payload);
          break;
        case 'auth_error':
          console.error('认证失败:', message.payload.error);
          break;
        case 'message':
          // 处理业务消息
          break;
      }
    };
    
    return ws.value;
  };
  
  return { ws, connect };
}
```

## 核心设计原则

### 1. 统一接入

所有通道（包括 WebUI）走相同的接入流程：
- 统一的身份识别（Contact）
- 统一的消息格式
- 统一的处理逻辑

### 2. 身份归一化

**核心原则**：
- **内部员工**：通过 WebUI 自己维护各 IM 通道身份
- **客户/合作伙伴**：首次接触为陌生人，后台人工审核后建档
- 陌生人处理策略由 **position 岗位画像** 决定

**Contact（交流对象）的 Channel Identities**：
```
Contact（赵大伟 - 内部员工）
├── Channel Identity: cradle:user-001      (WebUI - 员工自己维护)
├── Channel Identity: wechat:wxid_abc123   (微信 - 员工扫码绑定)
└── Channel Identity: dingtalk:ding_456    (钉钉 - 员工扫码绑定)

Contact（张先生 - 客户）
├── Channel Identity: dingtalk:ding_789    (钉钉 - 首次联系，后台审核后建档)
└── source: "后台人工审核" | "导入" | "API对接"
```

**Agent（服务者）的 Channel Identities**：
```
Agent（张总助理）
├── Channel Identity: cradle:agent-a       (WebUI - 管理员配置)
├── Channel Identity: dingtalk:robot-001   (钉钉 - 管理员配置)
└── Channel Identity: wechat:gh_xxx        (微信 - 管理员配置)
```

### 3. 通道即配置

每个通道通过数据库配置管理，支持动态启用/禁用：
- WebUI：内部系统通道
- WeChat/DingTalk：外部社交通道
- Slack/Discord：协作平台通道
- Email：邮件通道

## 数据模型

### 核心表关系

```
t_channels (通道配置)
    ↓
r_channel_contact (Contact通道绑定)
    ↓
t_contacts (联系人 - 身份归一)
    ↓
t_relationship (Agent-Contact 双向关系)
    ↓
t_agents (Agent)
    ↑
r_channel_agent (Agent通道绑定)
    ↑
t_channels (通道配置)
```

### 表说明

| 表名 | 作用 |
|-----|------|
| [t_channels](../system/database/t_channels.md) | 通道配置（类型、插件、启用状态、配置参数） |
| [r_channel_contact](../system/database/r_channel_contact.md) | Contact 通道身份映射（channel + sender → contact） |
| [r_channel_agent](../system/database/r_channel_agent.md) | Agent 通道身份映射（channel + identity → agent） |
| [t_contacts](../organization/database/t_contacts.md) | 联系人主表（归一化身份） |
| [t_relationship](../memory/database/t_relationship.md) | Agent-Contact 双向关系表（五重画像-关系特异性偏好） |

## 消息流转流程

### 入站消息（用户 → Agent）

```
1. 通道接收消息
   └─→ 微信/钉钉/Slack/WebUI 等
   └─→ 消息格式：{channel_type, from_id, to_id, content}

2. Gateway 路由
   └─→ 识别 channel_type
   └─→ 查 t_channels 得 channel_id

3. 识别发送者（Contact）
   └─→ 查 r_channel_contact (channel_id, from_id)
   └─→ 找到 contact_id → 已知身份
   └─→ 未找到 → 创建临时 Contact，标记为陌生人

4. 识别接收者（Agent）
   └─→ 查 r_channel_agent (channel_id, to_id)
   └─→ 找到 agent_id

5. 权限校验
   └─→ 检查 Contact 是否有权限访问该 Agent
   └─→ 陌生人按 position 策略处理

6. 消息处理
   └─→ Agent 以 Contact 身份处理
   └─→ 更新 t_relationship 关系数据

7. 回复路由
   └─→ 通过原通道返回
```

### 出站消息（Agent → 用户）

```
1. Agent 生成回复

2. Gateway 路由
   └─→ 根据 contact_id 查询 r_channel_contact
   └─→ 选择最佳通道（优先级：WebUI > 钉钉 > 微信）

3. 消息投递
   └─→ 通过选中通道发送

4. 状态追踪
   └─→ 记录投递状态
```

## 通道类型

| 通道类型 | 标识 | 适用场景 | 认证方式 |
|---------|------|---------|---------|
| WebUI | `cradle` | 系统内部用户 | JWT Token |
| 微信 | `wechat` | 外部客户、合作伙伴 | AppID + Secret |
| 钉钉 | `dingtalk` | 内部员工、外部联系 | AppKey + AppSecret |
| 飞书 | `lark` | 内部员工、外部联系 | AppID + Secret |
| Slack | `slack` | 海外团队协作 | Bot Token |
| Discord | `discord` | 社区运营 | Bot Token |
| 邮件 | `email` | 正式通知、工单 | SMTP/IMAP |
| Webhook | `webhook` | 系统集成 | 自定义密钥 |

## WebUI Channel 特殊性

WebUI 作为内部通道，具有以下特点：

### 1. 认证集成

```
用户登录 WebUI
    ↓
JWT 认证
    ↓
查询 t_users → 关联 t_employees
    ↓
查询/创建 t_contacts (type='employee')
    ↓
建立 r_channel_contact (cradle, user_id)
```

### 2. 员工自助绑定 IM 身份

```
员工登录 WebUI → 个人设置 → 账号绑定
    ↓
┌─────────────────────────────────────────┐
│ 扫码绑定微信                             │
│ 扫码绑定钉钉                             │
│                                         │
│ 绑定后：                                 │
│ - 微信消息自动识别为员工身份              │
│ - 钉钉消息自动识别为员工身份              │
│ - 跨通道历史记录统一                      │
└─────────────────────────────────────────┘
```

### 3. 连接方式

| 特性 | WebUI | 外部通道 |
|-----|-------|---------|
| 协议 | WebSocket | HTTP Webhook |
| 实时性 | 全双工 | 半双工 |
| 富媒体 | 完整支持 | 受限 |
| 文件传输 | 支持 | 受限 |

### 4. 身份关联

WebUI 用户可同时拥有多个通道身份：

```json
{
  "contact_id": "contact-001",
  "name": "赵大伟",
  "employee_id": "emp-001",
  "identities": [
    {"channel": "cradle", "id": "user-001"},
    {"channel": "wechat", "id": "wxid_abc123"},
    {"channel": "dingtalk", "id": "ding_456"}
  ]
}
```

## 身份识别与验证策略

### 1. 消息路由查询

Gateway 通过以下步骤识别消息：

```sql
-- 1. 识别通道
SELECT sid FROM t_channels 
WHERE type = 'dingtalk' AND status = 'active';
-- → channel_id = 'ch_ding_001'

-- 2. 识别发送者（Contact）
SELECT contact_id FROM r_channel_contact 
WHERE channel_id = 'ch_ding_001' AND sender = 'ding_123';
-- → contact_id = 'contact_001' (或 NULL = 陌生人)

-- 3. 识别接收者（Agent）
SELECT agent_id FROM r_channel_agent 
WHERE channel_id = 'ch_ding_001' AND identity = 'robot_001';
-- → agent_id = 'agent_001'
```

### 2. 陌生人处理流程

```
陌生人从 DingTalk 发消息
    ↓
提取身份：from=ding_789（未知）
    ↓
创建访客 Contact（type='visitor'）
    ↓
┌─────────────────────────────────────────┐
│ 服务策略（由 Agent position 决定）：       │
│                                         │
│ 客服 Agent（auto_reply）：                │
│   "您好，请问怎么称呼？来自哪家公司？"     │
│   → 记录基本信息                         │
│   → 正常提供咨询服务                      │
│                                         │
│ 专属 Agent（verify_first）：              │
│   "您好，请问您是？我需要确认身份"        │
│   → 仅提供公开信息                        │
│   → 敏感问题引导至官方渠道                │
└─────────────────────────────────────────┘
    ↓
进入【待审核客户队列】
    ↓
后台人工审核（销售/运营）
    ↓
┌─────────────────────────────────────────┐
│ 审核结果：                               │
│ ✓ 确认是客户 → 转为正式客户档案          │
│ ✓ 确认是合作伙伴 → 标记合作伙伴类型       │
│ ✗ 无效/骚扰 → 标记为黑名单               │
│ ? 存疑 → 保持临时状态，定期清理           │
└─────────────────────────────────────────┘
```

### 3. 身份维护职责

| 身份类型 | 维护者 | 方式 | 适用对象 |
|---------|--------|------|---------|
| WebUI | 员工自己 | 个人设置页面 | 内部员工 |
| 微信 | 员工自己 | WebUI扫码绑定 | 内部员工 |
| 钉钉 | 员工自己 | WebUI扫码绑定 | 内部员工 |
| **客户/合作伙伴** | **后台人工审核** | **销售/运营确认后建档** | **外部人员** |
| **Agent通道身份** | **管理员** | **后台配置** | **Agent** |

### 4. 陌生人处理策略（基于 Position 岗位画像）

```typescript
// Position 岗位画像定义
interface PositionProfile {
  // 岗位职责
  responsibilities: string[];
  
  // 行为边界
  boundaries: string[];
  
  // 陌生人处理策略
  strangerPolicy: {
    type: 'auto_reply' | 'verify_first' | 'transfer' | 'reject';
    greetingMessage?: string;     // 客服："欢迎咨询，请问有什么可以帮您？"
    verifyRequired?: boolean;     // 助理：true（需要确认身份）
    allowedTopics?: string[];     // 允许讨论的话题（verify_first时）
    transferTo?: string;          // 转人工：客服部门
  };
}

// 示例
const customerServicePosition = {
  strangerPolicy: {
    type: 'auto_reply',
    greetingMessage: '您好，我是客服小助手，请问有什么可以帮您？'
  }
};

const executiveAssistantPosition = {
  strangerPolicy: {
    type: 'verify_first',
    verifyRequired: true,
    allowedTopics: ['公开日程', '一般咨询'],  // 仅限公开信息
    greetingMessage: '您好，请问您是？我需要确认身份后才能帮您联系张总。'
  }
};
```

## OpenClaw 代码复用说明

### 复用策略

基于对 OpenClaw 项目的分析，采用**参考实现、重新设计**的策略：

```
┌─────────────────────────────────────────────────────────┐
│              复用 OpenClaw 的部分                        │
├─────────────────────────────────────────────────────────┤
│ 1. 消息格式标准化逻辑                                    │
│    • ID 格式转换 (normalize/)                            │
│    • 目标地址解析                                        │
│                                                         │
│ 2. 平台特定发送代码                                      │
│    • Telegram API 调用 (outbound/telegram.ts)            │
│    • Discord API 调用 (outbound/discord.ts)              │
│    • 钉钉/微信 API 调用（需要补充）                       │
│                                                         │
│ 3. 字段参考                                              │
│    • MsgContext 字段设计参考                             │
│    • ChatType 定义                                       │
└─────────────────────────────────────────────────────────┘
                           ↓ 适配
┌─────────────────────────────────────────────────────────┐
│              重新设计的部分                              │
├─────────────────────────────────────────────────────────┤
│ 1. 插件架构                                              │
│    • 简化 BaseChannel 抽象类                             │
│    • 移除 84 个适配器接口                                │
│                                                         │
│ 2. 配置管理                                              │
│    • 数据库配置替代文件配置                               │
│    • WebUI 管理替代 CLI 向导                             │
│                                                         │
│ 3. 消息处理                                              │
│    • Master-Worker-Agent 多进程架构                      │
│    • IPC 通信替代直接调用                                 │
│                                                         │
│ 4. 身份识别                                              │
│    • 数据库绑定表替代配置匹配                             │
│    • Contact/Agent 归一化                                │
└─────────────────────────────────────────────────────────┘
```

### 复用代码位置

| OpenClaw 路径 | 复用内容 | Cradle 目标路径 |
|--------------|---------|----------------|
| `src/channels/plugins/normalize/*.ts` | ID 格式标准化 | `src/gateway/channels/_shared/normalize/` |
| `src/channels/plugins/outbound/*.ts` | 发送逻辑 | `src/gateway/channels/_shared/outbound/` |
| `src/channels/plugins/types.core.ts` | 字段参考 | `src/gateway/channels/types.ts` |

### 架构差异对比

| 维度 | OpenClaw | Cradle |
|------|----------|--------|
| **架构** | 单体应用，单进程 | Gateway + 多进程 |
| **插件系统** | 运行时动态加载（84 个适配器） | 编译时集成（简化基类） |
| **配置管理** | 文件配置 + CLI 向导 | 数据库配置 + WebUI |
| **消息处理** | 单进程异步 | 多进程并行 + IPC |
| **Agent** | 单实例处理 | 常驻内存多进程 |

---

## 身份归一化策略

### 自动识别

Gateway 通过以下信息识别 Contact：

| 通道 | 查询表 | 字段 |
|-----|--------|------|
| WebUI | r_channel_contact | (channel_id, 'user-001') |
| 微信 | r_channel_contact | (channel_id, 'wxid_abc123') |
| 钉钉 | r_channel_contact | (channel_id, 'ding_456') |
| 邮件 | r_channel_contact | (channel_id, 'zhao@company.com') |

### 员工自助绑定

员工通过 WebUI 自助维护各 IM 通道身份：

```
Contact: 赵大伟（内部员工）
├── 已绑定: cradle:user-001  ← WebUI登录自动创建
├── 已绑定: wechat:wxid_abc123  ← 员工扫码绑定
└── 已绑定: dingtalk:ding_456  ← 员工扫码绑定
```

### 客户人工建档

外部人员首次联系时创建临时 Contact，后台审核后转正：

```
Contact: temp_ding_789（陌生人 - 访客）
├── Channel Identity: dingtalk:ding_789
├── type: 'visitor'
├── facts: '{"firstVisitChannel": "dingtalk"}'
└── created_at: 2024-01-15

审核后 → 转为正式客户：

Contact: 张先生（客户 - 正式）
├── Channel Identity: dingtalk:ding_789
├── type: 'customer'
├── source_id: 'cust-001'
├── facts: '{"company": "ABC科技"}'
├── status: 'enabled'
└── reviewed_by: '销售小李'
```

### Agent 通道身份配置

管理员在后台配置 Agent 的各通道身份：

```
Agent: 张总助理
├── Channel Identity: cradle:agent-a       ← WebUI（自动）
├── Channel Identity: dingtalk:robot-001   ← 管理员配置
└── Channel Identity: wechat:gh_xxx        ← 管理员配置
```

## 后台审核流程

### 待审核队列

```
┌─────────────────────────────────────────┐
│ 待审核客户队列                           │
├─────────────────────────────────────────┤
│ 来源筛选：全部 | 钉钉 | 微信 | 邮件       │
│ 时间筛选：今日 | 本周 | 本月             │
├─────────────────────────────────────────┤
│ □ 张先生  ABC科技  钉钉  今日10:23      │
│   对话摘要：咨询产品价格                 │
│   [查看对话] [标记为客户] [标记为无效]    │
│                                         │
│ □ 李女士  未知      微信  今日09:15      │
│   对话摘要：投诉产品质量                 │
│   [查看对话] [标记为客户] [转客服处理]    │
└─────────────────────────────────────────┘
```

### 审核操作

| 操作 | 结果 | 后续处理 |
|-----|------|---------|
| 标记为客户 | 转为正式客户档案 | 分配销售跟进 |
| 标记为合作伙伴 | 转为合作伙伴档案 | 记录合作类型 |
| 标记为供应商 | 转为供应商档案 | 记录供应品类 |
| 标记为无效 | 保持临时状态 | 7天后自动清理 |
| 加入黑名单 | 禁止访问 | 记录原因 |

## 安全设计

### 通道隔离

- 每个通道独立认证
- 通道间数据隔离
- 敏感操作需二次验证

### 权限控制

```
Contact 访问 Agent
    ↓
检查 t_relationship 是否存在记录
    ↓
检查 binding_mode 是否允许访问
    ↓
检查通道白名单（某些 Agent 仅允许特定通道）
    ↓
陌生人检查 position.strangerPolicy
```

### 数据加密

- 通道凭证（token/secret）加密存储
- 敏感配置字段加密
- 传输层 HTTPS/WSS

### 防滥用机制

```typescript
// 陌生人限制
interface StrangerLimits {
  maxMessagesPerHour: number;    // 每小时最大消息数
  maxConversationsPerDay: number; // 每日最大对话数
  requireCaptchaAfter: number;    // N条消息后需验证码
  autoBlockThreshold: number;     // 自动拉黑阈值
}
```

## 组件架构与数据流

### 完整架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              外部请求层                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │  WebUI  │  │DingTalk │  │ WeChat  │  │  Slack  │  │  其他   │      │
│  │WebSocket│  │ Webhook │  │ Webhook │  │ Webhook │  │         │      │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘      │
└───────┼────────────┼────────────┼────────────┼──────────────────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Gateway Master 进程                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    HTTP Server (Port 3000)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │  REST API   │  │   Webhook   │  │    WebSocket /ws        │ │   │
│  │  │  /health    │  │  /webhook/* │  │   (WebUI Channel)       │ │   │
│  │  │  /stats     │  │             │  │                         │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Channel 插件层 (协议适配)                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │ WebUIChannel│  │DingTalkChan-│  │    WeChatChannel        │ │   │
│  │  │             │  │    nel      │  │    (预留)               │ │   │
│  │  │ 职责:       │  │  职责:      │  │    职责:                │ │   │
│  │  │ 1.解析消息  │  │  1.解析消息 │  │    1.解析消息           │ │   │
│  │  │ 2.标准化    │  │  2.标准化   │  │    2.标准化             │ │   │
│  │  │ 3.发送回复  │  │  3.发送回复 │  │    3.发送回复           │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Gateway Router (消息路由)                     │   │
│  │  ├── 提取 channel_type                                          │   │
│  │  ├── 提取 from_id (发送者通道身份)                               │   │
│  │  ├── 提取 to_id (接收者通道身份)                                 │   │
│  │  └── 生成 InboundMessageContext                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Message Queue (消息队列)                      │   │
│  │  └── 标准化消息入队，等待 Worker 处理                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
       │   Worker 1  │      │   Worker 2  │      │   Worker N  │
       │  (进程)     │      │  (进程)     │      │  (进程)     │
       ├─────────────┤      ├─────────────┤      ├─────────────┤
       │1. 身份识别  │      │1. 身份识别  │      │1. 身份识别  │
       │   服务      │      │   服务      │      │   服务      │
       ├─────────────┤      ├─────────────┤      ├─────────────┤
       │2. 路由决策  │      │2. 路由决策  │      │2. 路由决策  │
       │   服务      │      │   服务      │      │   服务      │
       ├─────────────┤      ├─────────────┤      ├─────────────┤
       │3. Agent调用 │      │3. Agent调用 │      │3. Agent调用 │
       │   服务      │      │   服务      │      │   服务      │
       ├─────────────┤      ├─────────────┤      ├─────────────┤
       │4. 发送回复  │      │4. 发送回复  │      │4. 发送回复  │
       │   (通过     │      │   (通过     │      │   (通过     │
       │   Channel)  │      │   Channel)  │      │   Channel)  │
       └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
              │                    │                    │
              └────────────────────┴────────────────────┘
                                   │
                                   ▼
              ┌─────────────────────────────────────────┐
              │         Channel 插件层 (出站)            │
              │  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
              │  │ 格式化  │  │ 格式化  │  │ 格式化  │ │
              │  │ 并发送  │  │ 并发送  │  │ 并发送  │ │
              │  │ 到WebUI │  │ 到钉钉  │  │ 到微信  │ │
              │  └─────────┘  └─────────┘  └─────────┘ │
              └─────────────────────────────────────────┘
```

### 组件职责详解

#### 1. Channel 插件层

**位置**: Master 进程 + Worker 进程

**入站流程 (Master)**:
```typescript
// 1. 接收原始消息
rawMessage = receiveFromChannel();

// 2. Channel.parse() - 解析平台特定格式
parsedMessage = channel.parse(rawMessage);
// 例如钉钉: { conversationId, senderStaffId, text: { content } }

// 3. Channel.normalize() - 标准化为统一格式
unifiedMessage = {
  messageId: generateId(),
  channelType: 'dingtalk',
  senderId: parsedMessage.senderStaffId,
  recipientId: parsedMessage.chatbotUserId,
  body: parsedMessage.text.content,
  chatType: 'group',
  timestamp: Date.now(),
  // ... 其他标准字段
};

// 4. 入队等待处理
messageQueue.push(unifiedMessage);
```

**出站流程 (Worker)**:
```typescript
// 1. Agent 生成回复 (统一格式)
reply = {
  text: '您好，有什么可以帮您？',
  to: 'contact-001',
  // ...
};

// 2. Channel.format() - 格式化为平台特定格式
platformMessage = channel.format(reply);
// 例如钉钉: { msgtype: 'text', text: { content: '...' } }

// 3. Channel.send() - 调用平台 API 发送
channel.send(platformMessage, targetId);
```

#### 2. Gateway Router

**位置**: Master 进程

**职责**:
- 识别消息来源通道类型
- 提取发送者和接收者身份
- 将原始消息转为标准化上下文
- 路由到对应 Channel 插件

#### 3. Worker 进程

**位置**: 独立进程池

**职责**:
- 从队列消费标准化消息
- 身份识别服务 (查 r_channel_contact)
- 路由决策服务 (查 r_channel_agent)
- Agent 调用 (通过 IPC 或本地调用)
- 发送回复 (调用 Channel.send)

### 数据流详解

#### 入站消息流 (用户 → Agent)

```
Step 1: 通道接收
┌─────────────────────────────────────────┐
│ 用户从 DingTalk 发送消息                 │
│ "你好，请问产品价格是多少？"              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 2: Master 接收
┌─────────────────────────────────────────┐
│ HTTP Server 接收 Webhook 请求            │
│ POST /webhook/dingtalk                  │
│ Body: 钉钉特定格式的加密消息              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 3: Channel 解析 (DingTalkChannel)
┌─────────────────────────────────────────┐
│ 1. 解密消息 (DingTalk 加密算法)          │
│ 2. 解析 JSON                              │
│ 3. 提取字段:                              │
│    - conversationId                       │
│    - senderStaffId                        │
│    - text.content                         │
│    - createAt                             │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 4: Channel 标准化
┌─────────────────────────────────────────┐
│ 生成 InboundMessageContext:               │
│ {                                         │
│   messageId: 'msg_xxx',                   │
│   channelType: 'dingtalk',                │
│   senderId: 'ding_123',                   │
│   recipientId: 'robot_001',               │
│   body: '你好，请问产品价格是多少？',      │
│   chatType: 'group',                      │
│   chatId: 'conv_xxx',                     │
│   timestamp: 1704067200000,               │
│   raw: {原始钉钉消息}                      │
│ }                                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 5: 入队
┌─────────────────────────────────────────┐
│ MessageQueue.push(unifiedMessage)       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 6: Worker 消费
┌─────────────────────────────────────────┐
│ Worker 从队列取出消息                    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 7: 身份识别
┌─────────────────────────────────────────┐
│ 查 r_channel_contact:                    │
│ SELECT contact_id                        │
│ FROM r_channel_contact                   │
│ WHERE channel_id = 'ch_ding'             │
│   AND sender = 'ding_123'                │
│ → contact_id = 'contact_001' (张先生)    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 8: 路由决策
┌─────────────────────────────────────────┐
│ 查 r_channel_agent:                      │
│ SELECT agent_id                          │
│ FROM r_channel_agent                     │
│ WHERE channel_id = 'ch_ding'             │
│   AND identity = 'robot_001'             │
│ → agent_id = 'agent_sales_001' (销售助手)│
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 9: Agent 处理
┌─────────────────────────────────────────┐
│ 调用 Agent.process():                    │
│ - 查询产品知识库                          │
│ - 生成回复: "您好，我们的产品价格..."      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 10: 发送回复 (通过 Channel)
┌─────────────────────────────────────────┐
│ 1. 调用 DingTalkChannel.format()         │
│    → { msgtype: 'text', text: {...} }   │
│ 2. 调用 DingTalkChannel.send()           │
│    → 调用钉钉 API 发送消息                │
└─────────────────────────────────────────┘
```

#### 出站消息流 (Agent → 用户)

```
Step 1: Agent 生成回复
┌─────────────────────────────────────────┐
│ Agent 生成统一格式回复:                   │
│ {                                         │
│   text: '您好，产品A价格是¥999',           │
│   to: 'contact_001',                      │
│   channelType: 'dingtalk'                 │
│ }                                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 2: Channel 格式化
┌─────────────────────────────────────────┐
│ DingTalkChannel.format(reply):           │
│ {                                         │
│   msgtype: 'text',                        │
│   text: {                                 │
│     content: '您好，产品A价格是¥999'       │
│   }                                       │
│ }                                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
Step 3: Channel 发送
┌─────────────────────────────────────────┐
│ DingTalkChannel.send(message, target):   │
│ - 获取 access_token                      │
│ - 调用钉钉 API:                          │
│   POST https://oapi.dingtalk.com/...     │
└─────────────────────────────────────────┘
```

### Channel 接口定义

```typescript
// Channel 插件必须实现的接口
interface IChannel {
  // 通道类型标识
  getChannelType(): string;
  
  // 通道能力声明
  getCapabilities(): ChannelCapabilities;
  
  // 初始化
  initialize(): Promise<void>;
  
  // 启动 (开始接收消息)
  start(): Promise<void>;
  
  // 停止
  stop(): Promise<void>;
  
  // ===== 入站处理 (Master 调用) =====
  
  // 解析原始消息
  parse(rawMessage: unknown): ParsedMessage;
  
  // 标准化为统一格式
  normalize(parsed: ParsedMessage): InboundMessageContext;
  
  // ===== 出站处理 (Worker 调用) =====
  
  // 格式化统一消息为平台格式
  format(outbound: OutboundMessageContext): PlatformMessage;
  
  // 发送消息到平台
  send(message: PlatformMessage, target: string): Promise<void>;
}
```

### 关键设计原则

1. **Channel 是协议适配层，不是业务逻辑层**
   - Channel 只负责格式转换和收发
   - 业务逻辑（身份识别、Agent 调用）在 Worker 中

2. **标准化消息是核心抽象**
   - 所有 Channel 都将消息转为 `InboundMessageContext`
   - Worker 只处理标准化消息，无需关心来源通道

3. **Channel 可以在 Master 和 Worker 中同时使用**
   - Master: 用于入站解析
   - Worker: 用于出站发送

4. **通道配置动态化**
   - 通过 `t_channels` 表管理配置
   - 支持运行时启用/禁用通道

## 关联文档

- [协议设计](./protocol.md) - HTTP/WebSocket 协议规范
- [路由设计](./routing.md) - Gateway 路由策略
- [t_channels 表](../system/database/t_channels.md) - 通道配置表
- [r_channel_contact 表](../system/database/r_channel_contact.md) - Contact 通道绑定表
- [r_channel_agent 表](../system/database/r_channel_agent.md) - Agent 通道绑定表
- [t_contacts 表](../organization/database/t_contacts.md) - 联系人表
- [t_relationship 表](../memory/database/t_relationship.md) - Agent-Contact 双向关系表
