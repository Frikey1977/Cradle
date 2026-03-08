# 关系偏好设计

## 1. 功能定位

关系偏好定义 Agent 与 Contact 之间的交互关系，包括绑定模式、亲密度和互动历史。它管理 Agent-Contact 绑定关系，决定记忆是否共享。

## 2. 数据模型

### 2.1 关系偏好 Schema

```typescript
interface RelationshipPreference {
  agentId: string;
  contactId: string;
  bindingMode: 'shared' | 'exclusive';
  intimacy: number;
  trust: number;
  history: InteractionHistory;
}

interface InteractionHistory {
  totalConversations: number;
  lastInteraction: Date;
  keyMemories: string[];
}
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| agentId | string | Agent ID |
| contactId | string | Contact ID |
| bindingMode | enum | 绑定模式：共享/专属 |
| intimacy | number | 亲密度 (0-100) |
| trust | number | 信任度 (0-100) |
| history.totalConversations | number | 总对话次数 |
| history.lastInteraction | Date | 最后互动时间 |
| history.keyMemories | string[] | 关键记忆 |

### 2.3 绑定模式说明

| 模式 | 说明 | 记忆隔离 |
|------|------|---------|
| shared | 共享 Agent，一个 Agent 服务多个 Contact | Contact 间共享记忆 |
| exclusive | 专属 Agent，Agent 仅服务单一 Contact | 记忆独立，不共享 |

## 3. 管理方式

| 方式 | 说明 |
|------|------|
| Agent 管理 | 从 Agent 管理中绑定 Contact |
| Contact 管理 | 从 Contact 管理中绑定 Agent |
| 组织管理 | 在组织管理模块统一配置 |

## 4. 关联文档

- [t_relationship 表](./database/t_relationship.md) - Agent-Contact 双向关系表
- [上下文管理器](../agents/runtime.md)
- [五重画像记忆引擎](./five_profiles.md)
- [Agent 事实](./profile_agent_fact.md)
- [Contact 事实](./profile_contact_fact.md)

## 5. 与其他画像的关系

关系偏好建立在 Agent 事实和 Contact 事实之上：

```
[Agent 事实] + [Contact 事实] → [关系偏好]
                                  ↓
                            上下文注入
```

| 画像 | 作用 |
|------|------|
| [Agent 事实](./profile_agent_fact.md) | 定义 Agent 的行事风格 |
| [Contact 事实](./profile_contact_fact.md) | 定义 Contact 的偏好 |
| 关系偏好 | 管理两者之间的交互关系 |
