# t_relationship - Agent-Contact 双向关系表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_relationship |
| 中文名 | Agent-Contact 双向关系表 |
| 说明 | 存储 Agent 与 Contact 之间的双向关系数据（五重画像中的关系特异性偏好），包含双方视角的偏好和认知。 |

## 核心设计原则

**五重画像定位**：
- 本表对应五重画像中的 **关系特异性偏好 (Relationship Preference)**
- 存储 Agent ↔ Contact 双向的关系数据
- 一个关系由两个视角组成：Contact 怎么看 Agent，Agent 怎么看 Contact

**双向视角设计**：
- `contact_agent`：Contact 视角，Contact 对 Agent 的偏好和认知
- `agent_contact`：Agent 视角，Agent 对 Contact 的学习和认知
- 两个视角独立维护，通过 LLM 指令分别更新

**运行时更新机制**：
- LLM 在互动过程中输出更新指令
- Agent 运行时执行指令，更新 Context
- Context 持久化到本表

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | agent_id | VARCHAR | 36 | YES | - | Agent ID，外键关联 t_agents |
| 3 | contact_id | VARCHAR | 36 | YES | - | Contact ID，外键关联 t_contacts |
| 4 | contact_agent | JSON | - | NO | NULL | Contact 视角：Contact 对 Agent 的偏好 |
| 5 | agent_contact | JSON | - | NO | NULL | Agent 视角：Agent 对 Contact 的学习 |
| 6 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 7 | update_time | DATETIME | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| 8 | deleted | TINYINT | - | YES | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |

## 字段详细说明

### agent_id / contact_id 关联字段

- `agent_id`：外键关联 `t_agents.sid`，标识关系中的 Agent
- `contact_id`：外键关联 `t_contacts.sid`，标识关系中的 Contact
- 联合唯一索引 `(agent_id, contact_id)` 确保一个 Agent-Contact 对只有一条关系记录

### contact_agent Contact 视角

JSON 格式存储 Contact 对 Agent 的偏好和认知：

```json
{
  "intimacy": 75,
  "trust": 80,
  "interaction_mode": {
    "formality": "casual",
    "frequency": "high",
    "topics": ["技术方案", "项目管理", "团队建设"]
  },
  "special_preferences": [
    "喜欢用'您'称呼",
    "希望回复简洁",
    "工作时间外不要打扰"
  ],
  "key_memories": [
    {
      "type": "preference",
      "content": "对新技术很敏感，喜欢尝试",
      "created_at": "2024-01-15T14:30:00Z"
    }
  ]
}
```

**维护方**：主要由用户主动配置，或 LLM 从对话中学习并经用户确认

### agent_contact Agent 视角

JSON 格式存储 Agent 对 Contact 的学习和认知：

```json
{
  "intimacy": 80,
  "trust": 90,
  "binding_mode": "exclusive",
  "learned_preferences": {
    "likes": ["简洁的技术回答", "使用代码示例"],
    "dislikes": ["别叫我老赵，显老", "不要过多表情符号"],
    "topics": ["微服务架构", "团队管理"]
  },
  "communication_style": {
    "formality": "casual",
    "verbosity": "concise",
    "response_time": "immediate"
  },
  "key_memories": [
    {
      "type": "goal",
      "content": "正在准备晋升答辩",
      "created_at": "2024-01-10T09:00:00Z",
      "expires_at": "2024-02-01T00:00:00Z"
    },
    {
      "type": "fact",
      "content": "负责支付系统架构",
      "created_at": "2024-01-20T10:00:00Z"
    }
  ],
  "interaction_stats": {
    "total_conversations": 50,
    "last_interaction_time": "2024-01-20T18:30:00Z"
  }
}
```

**维护方**：主要由 LLM 在互动过程中自动学习更新

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| pk_relationship | sid | 主键 | 关系记录唯一标识 |
| uk_agent_contact | agent_id, contact_id | 唯一索引 | Agent-Contact 对唯一 |
| idx_contact | contact_id | 普通索引 | 查询 Contact 的所有关系 |

## SQL语句

```sql
CREATE TABLE t_relationship (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID，外键关联 t_agents',
    contact_id VARCHAR(36) NOT NULL COMMENT 'Contact ID，外键关联 t_contacts',
    contact_agent JSON COMMENT 'Contact视角: 亲密度、信任度、沟通偏好等',
    agent_contact JSON COMMENT 'Agent视角: 学习到的偏好、互动历史、关键记忆等',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    
    UNIQUE KEY uk_agent_contact (agent_id, contact_id),
    INDEX idx_contact (contact_id),
    
    FOREIGN KEY (agent_id) REFERENCES t_agents(sid) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES t_contacts(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent-Contact 双向关系表（五重画像-关系特异性偏好）';
```

## 使用场景

### 场景1：初始化关系

```sql
-- 创建新的 Agent-Contact 关系
INSERT INTO t_relationship (sid, agent_id, contact_id, contact_agent, agent_contact) VALUES (
    UUID(),
    'agent-001',
    'contact-001',
    '{
        "intimacy": 50,
        "trust": 50,
        "interaction_mode": {
            "formality": "casual",
            "frequency": "medium",
            "topics": []
        },
        "special_preferences": [],
        "key_memories": []
    }',
    '{
        "intimacy": 50,
        "trust": 50,
        "binding_mode": "exclusive",
        "learned_preferences": {"likes": [], "dislikes": [], "topics": []},
        "key_memories": [],
        "interaction_stats": {"total_conversations": 0, "last_interaction_time": null}
    }'
);
```

### 场景2：LLM 更新 Agent 视角

```sql
-- LLM 学习后更新 agent_contact 字段
UPDATE t_relationship 
SET agent_contact = JSON_SET(agent_contact,
    '$.intimacy', LEAST(JSON_EXTRACT(agent_contact, '$.intimacy') + 5, 100),
    '$.trust', LEAST(JSON_EXTRACT(agent_contact, '$.trust') + 3, 100),
    '$.interaction_stats.total_conversations', JSON_EXTRACT(agent_contact, '$.interaction_stats.total_conversations') + 1,
    '$.interaction_stats.last_interaction_time', NOW()
)
WHERE agent_id = 'agent-001' AND contact_id = 'contact-001';
```

### 场景3：添加关键记忆（Agent 视角）

```sql
-- 在 agent_contact.key_memories 中添加新记忆
UPDATE t_relationship 
SET agent_contact = JSON_ARRAY_APPEND(agent_contact, '$.key_memories',
    JSON_OBJECT(
        'type', 'preference',
        'content', '不喜欢被称呼为老赵',
        'created_at', DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%sZ')
    )
)
WHERE agent_id = 'agent-001' AND contact_id = 'contact-001';
```

### 场景4：更新 Contact 视角偏好

```sql
-- 用户配置或确认后更新 contact_agent 字段
UPDATE t_relationship 
SET contact_agent = JSON_MERGE_PATCH(contact_agent, '{
    "special_preferences": ["希望回复简洁", "工作时间外不要打扰"],
    "interaction_mode": {
        "formality": "casual",
        "frequency": "low"
    }
}')
WHERE agent_id = 'agent-001' AND contact_id = 'contact-001';
```

### 场景5：查询关系的完整数据（Context 构建）

```sql
-- 构建 Agent Context 时查询关系数据
SELECT 
    r.agent_id,
    r.contact_id,
    r.contact_agent,
    r.agent_contact,
    a.name as agent_name,
    c.type as contact_type,
    c.facts as contact_facts
FROM t_relationship r
JOIN t_agents a ON r.agent_id = a.sid
JOIN t_contacts c ON r.contact_id = c.sid
WHERE r.agent_id = 'agent-001' 
  AND r.contact_id = 'contact-001'
  AND r.deleted = 0;
```

### 场景6：查询 Contact 的所有 Agent 关系

```sql
-- 获取 Contact 对所有 Agent 的关系
SELECT 
    r.agent_id,
    a.name as agent_name,
    r.contact_agent,
    r.agent_contact
FROM t_relationship r
JOIN t_agents a ON r.agent_id = a.sid
WHERE r.contact_id = 'contact-001' AND r.deleted = 0;
```

## 运行时 Context 构建示例

```typescript
async function buildRelationshipContext(agentId: string, contactId: string) {
  // 查询关系数据
  const relationship = await db.query(
    `SELECT contact_agent, agent_contact 
     FROM t_relationship 
     WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
    [agentId, contactId]
  );
  
  if (!relationship) {
    // 关系不存在，创建默认关系
    return createDefaultRelationship(agentId, contactId);
  }
  
  return {
    // Contact 视角：Contact 对 Agent 的偏好
    contactView: JSON.parse(relationship.contact_agent || '{}'),
    
    // Agent 视角：Agent 对 Contact 的学习
    agentView: JSON.parse(relationship.agent_contact || '{}')
  };
}

// 构建 System Prompt 时使用
function buildSystemPrompt(context: RelationshipContext): string {
  return `
## 关系背景

### 用户对你的看法
- 亲密度: ${context.contactView.intimacy || 50}/100
- 信任度: ${context.contactView.trust || 50}/100
- 沟通偏好: ${context.contactView.interaction_mode?.formality || 'casual'}
- 特殊要求: ${(context.contactView.special_preferences || []).join(', ')}

### 你对用户的了解
- 亲密度: ${context.agentView.intimacy || 50}/100
- 信任度: ${context.agentView.trust || 50}/100
- 用户喜好: ${(context.agentView.learned_preferences?.likes || []).join(', ')}
- 用户忌讳: ${(context.agentView.learned_preferences?.dislikes || []).join(', ')}
- 关键记忆: ${(context.agentView.key_memories || []).map(m => m.content).join('; ')}
`.trim();
}
```

## 与五重画像的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     五重画像记忆引擎                              │
│                    (Quintuple Profile Engine)                    │
├─────────────────────────────────────────────────────────────────┤
│  企业画像 (Enterprise Profile)                                   │
│  岗位画像 (Position Profile)                                     │
│  Agent 事实 (Agent Facts)                                        │
│  Contact 事实 (Contact Facts)                                    │
│  关系特异性偏好 (Relationship Preference)                         │
│    └─→ t_relationship                                            │
│          ├── contact_agent: Contact 对 Agent 的偏好              │
│          └── agent_contact: Agent 对 Contact 的学习              │
└─────────────────────────────────────────────────────────────────┘
```

## 关联文档

- [t_agents 表](../../agent/database/t_agents.md) - Agent 定义表
- [t_contacts 表](../../organization/database/t_contacts.md) - 联系人表
- [r_channel_agent 表](../../system/database/r_channel_agent.md) - Agent 通道绑定表
- [r_channel_contact 表](../../system/database/r_channel_contact.md) - Contact 通道绑定表
- [五重画像记忆引擎](../five_profiles.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
