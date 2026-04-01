# Message Router - 消息路由组件

## 概述

Message Router 是 Gateway 层的核心组件，负责：
1. **身份归一化** - 将不同通道的 sender 标识统一映射为 contact_id
2. **Agent 路由** - 确定消息应该由哪个 Agent 处理
3. **消息转换** - 构建标准化的 AgentMessage

## 架构位置

```
Channel Plugin → Message Router → Agent Worker
                     │
                     ▼
            Identity Resolver
            (身份解析器)
```

## 核心职责

### 1. 身份归一化 (Identity Resolution)

**输入：** 原始 sender 标识（通道特定）
- Cradle: `userId` (t_users.sid)
- 微信: `wxid_xxx` 
- 飞书: `ou_xxx`
- 钉钉: `ding_xxx`

**输出：** 统一的 `contact_id` (t_contacts.sid)

**处理流程：**
1. 查询 `r_channel_contact` 表
2. 如果找到映射，返回 `contact_id`
3. 如果未找到，创建新的访客 Contact

### 2. Agent 路由 (Agent Routing)

**输入：** 消息上下文

**输出：** 目标 `agent_id`

**路由策略：**
- 如果消息指定了 `agentId`，直接使用
- 如果未指定，使用默认 Agent
- 未来可扩展：基于负载均衡、技能匹配等

### 3. 消息转换 (Message Transformation)

将 `InboundMessageContext` 转换为 `AgentMessage`：

```typescript
AgentMessage {
  messageId: string;      // 消息唯一ID
  agentId: string;        // 目标Agent
  contactId: string;      // 发送者Contact
  content: string;        // 消息内容
  timestamp: number;      // 时间戳
  metadata: {             // 元数据
    channelType: string;
    channelName: string;
    senderName: string;
    // ...
  }
}
```

## 数据表依赖

### r_channel_contact (通道身份映射表)

```sql
CREATE TABLE r_channel_contact (
    channel_id VARCHAR(36) NOT NULL,  -- 通道ID
    contact_id VARCHAR(36) NOT NULL,  -- 联系人ID
    sender VARCHAR(200) NOT NULL,     -- 通道内sender标识
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (channel_id, contact_id),
    UNIQUE KEY uk_channel_sender (channel_id, sender)
);
```

### t_contacts (联系人表)

```sql
CREATE TABLE t_contacts (
    sid VARCHAR(36) PRIMARY KEY,
    type VARCHAR(20) NOT NULL,        -- employee/customer/partner/visitor
    source_id VARCHAR(36),            -- 关联实体ID
    facts JSON,                       -- 跨通道事实
    preferences JSON,                 -- 偏好设置
    status VARCHAR(20) DEFAULT 'enabled',
    deleted TINYINT DEFAULT 0
);
```

## 接口定义

```typescript
interface MessageRouter {
  /**
   * 路由消息
   * @param context 入站消息上下文
   * @returns AgentMessage 标准化的Agent消息
   */
  route(context: InboundMessageContext): Promise<AgentMessage>;
  
  /**
   * 解析Contact
   * @param channelId 通道ID
   * @param sender 原始sender标识
   * @returns contact_id
   */
  resolveContact(channelId: string, sender: string): Promise<string>;
  
  /**
   * 确定目标Agent
   * @param context 消息上下文
   * @returns agent_id
   */
  resolveAgent(context: InboundMessageContext): Promise<string>;
}
```

## 处理流程

```
1. 接收 InboundMessageContext
   ↓
2. 提取 channelId + sender
   ↓
3. 查询 r_channel_contact
   ↓
4. 如果找到 → 返回 contact_id
   如果未找到 → 创建访客 Contact → 返回 contact_id
   ↓
5. 确定目标 Agent
   ↓
6. 构建 AgentMessage
   ↓
7. 返回给 GatewayMaster
```

## Channel Plugin 职责变化

**之前（错误）：**
- Channel 层查询 contact_id
- 每个 Channel 重复实现

**之后（正确）：**
- Channel 只传递原始 sender 标识
- 统一由 Message Router 处理归一化

## 示例

### Cradle 通道

```typescript
// CradleChannel 构建的 InboundMessageContext
{
  senderId: "67df68a8-999d-4ac4-9053-d26560d94fbc", // userId (原始)
  // ...
}

// Message Router 处理后
{
  contactId: "445ae047-45c4-4e7f-815e-437664be7f73", // 查询 r_channel_contact
  // ...
}
```

### 微信通道（未来）

```typescript
// WechatChannel 构建的 InboundMessageContext
{
  senderId: "wxid_abc123", // 微信ID (原始)
  // ...
}

// Message Router 处理后
{
  contactId: "xxx-xxx-xxx", // 查询 r_channel_contact
  // ...
}
```

## 设计原则

1. **单一职责**
   - Channel: 协议处理
   - Message Router: 业务路由
   - Agent: 对话处理

2. **通道无关**
   - Message Router 不依赖特定通道
   - 所有通道统一处理

3. **可扩展**
   - 支持新增通道无需修改 Router
   - 支持多种路由策略
