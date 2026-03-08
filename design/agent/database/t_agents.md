# t_agents Agents 定义表（数字员工）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_agents |
| 中文名 | Agents 定义表 |
| 说明 | 数字员工定义表，与 t_employeess（人类员工）并列，共同构成企业员工体系。运行时实例化为内存对象，频繁调用。 |

## 核心设计原则

**运行时架构**：
- **数据库**：存储基础配置信息（读多写少）
- **内存对象**：运行时状态、心跳状态（实时更新）
- **持久化策略**：内存状态定期/关键节点写入数据库

**心跳状态设计**：
- 运行时心跳状态保存在内存中
- 数据库仅保存配置信息（`heartbeat` JSON 字段）
- 服务重启后状态重置，等待下次调度

**关系设计**：
- Agent 与 Contact 的关系移到 `t_relationship` 表（包含双向关系特异性数据）
- Agent 与 Skill 的关系移到 `r_agents_skills` 表
- 保持 t_agents 表精简，只存储 Agent 本身属性

> **废弃说明**: `r_agents_users` 和 `r_agents_contacts` 表已废弃，统一使用 `t_relationship` 表管理 Agent-Contact 关系

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | Agent 名称（中文） |
| 3 | e_name | VARCHAR | 200 | NO | NULL | Agent 英文名称 |
| 4 | title | VARCHAR | 200 | NO | NULL | 多语言翻译标签，用于 i18n |
| 5 | description | TEXT | - | NO | NULL | Agent 描述 |
| 6 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 7 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 8 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 9 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |
| 10 | agent_no | VARCHAR | 100 | YES | - | Agent 编号（如 AGT_001），唯一 |
| 11 | oid | VARCHAR | 36 | YES | - | 所属组织ID（关联组织树任意节点） |
| 12 | mode | VARCHAR | 20 | YES | 'exclusive' | 服务模式（代码字典配置） |
| 13 | config | JSON | - | NO | NULL | 模型配置 + 运行时配置 |
| 14 | profile | JSON | - | NO | NULL | 个人事实与偏好数据 |
| 15 | avatar | VARCHAR | 500 | NO | - | Agent 头像 |
| 16 | heartbeat | JSON | - | NO | NULL | 心跳配置（仅配置，运行时状态在内存） |

## 字段详细说明

### name / e_name Agent 名称

- `name`：中文名称，必填，用于界面展示
- `e_name`：英文名称，可选，用于国际化场景和代码引用
- 示例：`name`="张总的助理"，`e_name`="Assistant Zhang"

### agent_no Agent 编号

- 唯一标识符，格式建议：AGT_001
- 用于业务场景中的快速识别

### oid 所属组织

- Agent 必须关联到组织架构的某个节点
- 表示该 Agent 归属于哪个组织/部门
- **关键设计**：Agent 归属组织，不随人员变动而变动

### mode 服务模式 

通过代码字典配置，可选值：

| 值 | 含义 | 说明 |
|----|------|------|
| exclusive | 专属 | 绑定特定用户，一对一服务 |
| shared | 共享 | 多个用户共享使用 |
| public | 公共 | 全组织可用，无需绑定 |
| department | 部门 | 绑定到部门，部门内共享 |

**注意**：mode 仅表示设计意图，实际绑定关系通过 `t_relationship` 表管理（agent_contact.binding_mode 字段）。

### config 配置

合并模型配置和运行时配置：

```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "You are a helpful assistant."
  },
  "runtime": {
    "identity": {
      "emoji": "🤖",
      "displayName": "小助手"
    },
    "behavior": {
      "humanDelay": {
        "enabled": true,
        "minMs": 500,
        "maxMs": 2000
      }
    },
    "workspace": {
      "path": "/data/agents/agent-001",
      "sandboxEnabled": false
    }
  }
}
```

### profile 个人事实与偏好

存储 Agent 的个人化数据：

```json
{
  "facts": [
    "负责技术部日常运维",
    "熟悉 Linux 系统",
    "工作时间：9:00-18:00"
  ],
  "preferences": {
    "language": "zh-CN",
    "tone": "professional",
    "responseStyle": "concise"
  },
  "welcomeMessage": "你好，我是技术助手，有什么可以帮你的？"
}
```

### heartbeat 心跳配置

**注意**：仅存储配置信息，运行时状态在内存中维护。

```json
{
  "enabled": true,
  "interval": "30m",
  "activeHours": {
    "start": "09:00",
    "end": "18:00",
    "timezone": "Asia/Shanghai"
  },
  "prompt": "检查收件箱、日历和待办事项",
  "target": "last"
}
```

| 配置项 | 类型 | 说明 |
|-------|------|------|
| enabled | boolean | 是否启用心跳 |
| interval | string | 心跳间隔（如30m, 1h） |
| activeHours | object | 活跃时段配置 |
| prompt | string | 心跳触发时使用的提示词 |
| target | string | 投递目标（last/dingtalk/wechat/email） |

## 运行时状态（内存中）

Agent 运行时实例化为内存对象，包含以下运行时状态：

```typescript
interface AgentRuntime {
  // 基础信息（来自 t_agents）
  sid: string;
  name: string;
  config: AgentConfig;
  
  // 运行时状态（内存中，不持久化到数据库）
  runtime: {
    status: 'idle' | 'running' | 'error' | 'paused';
    lastHeartbeat: Date;
    nextHeartbeat: Date;
    consecutiveErrors: number;
    currentConversation: string | null;
  };
  
  // 内存缓存
  cache: {
    skills: Skill[];
    memory: MemoryContext;
    profile: ProfileData;
  };
}
```

**持久化策略**：
1. 服务优雅关闭时保存状态
2. 心跳状态发生重要变更时（如 error → running）
3. 定期（每 5 分钟）批量保存
4. 管理员查看状态时实时查询内存

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_agents | sid | 主键 |
| uk_agents_agent_no | agent_no | 唯一索引 |
| idx_agents_oid | oid | 普通索引 |
| idx_agents_mode | mode | 普通索引 |
| idx_agents_status | status | 普通索引 |
| idx_agents_deleted | deleted | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_agents (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT 'Agent 名称（中文）',
    e_name VARCHAR(200) COMMENT 'Agent 英文名称',
    title VARCHAR(200) COMMENT '多语言翻译标签，用于 i18n',
    description TEXT COMMENT 'Agent 描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    agent_no VARCHAR(100) NOT NULL COMMENT 'Agent 编号',
    oid VARCHAR(36) NOT NULL COMMENT '所属组织ID',
    mode VARCHAR(20) DEFAULT 'exclusive' COMMENT '服务模式（代码字典配置）',
    config JSON COMMENT '模型配置 + 运行时配置',
    profile JSON COMMENT '个人事实与偏好数据',
    avatar VARCHAR(500) COMMENT 'Agent 头像',
    heartbeat JSON COMMENT '心跳配置（仅配置，运行时状态在内存）',
    
    UNIQUE KEY uk_agents_agent_no (agent_no),
    INDEX idx_agents_oid (oid),
    INDEX idx_agents_mode (mode),
    INDEX idx_agents_status (status),
    INDEX idx_agents_deleted (deleted),
    
    FOREIGN KEY (oid) REFERENCES t_departments(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agents 定义表（数字员工）';
```

## 示例数据

### 专属模式 Agent

```sql
INSERT INTO t_agents (
    sid, name, e_name, agent_no, oid, mode, config, profile, status
) VALUES (
    'uuid-1',
    '张总的助理',
    'Assistant Zhang',
    'AGT_001',
    'org-company',
    'exclusive',
    '{
        "model": {"provider": "openai", "model": "gpt-4", "temperature": 0.7},
        "runtime": {"identity": {"emoji": "👔", "displayName": "张总助理"}}
    }',
    '{
        "facts": ["张总的专属助理", "负责日程管理"],
        "preferences": {"language": "zh-CN", "tone": "formal"},
        "welcomeMessage": "您好，我是张总的助理，有什么可以帮您？"
    }',
    'enabled'
);

-- 绑定到 Contact（通过 t_relationship 建立双向关系）
-- 假设 contact-zhangsan 是张三的 contact_id
INSERT INTO t_relationship (sid, agent_id, contact_id, agent_contact, contact_agent) VALUES 
('rel-001', 'uuid-1', 'contact-zhangsan', 
 '{"binding_mode": "exclusive", "intimacy": 90, "trust": 95}',
 '{"intimacy": 85, "trust": 90}');
```

### 共享模式 Agent

```sql
INSERT INTO t_agents (
    sid, name, e_name, agent_no, oid, mode, config, heartbeat, status
) VALUES (
    'uuid-2',
    '代码助手',
    'Code Assistant',
    'AGT_002',
    'org-tech-departments',
    'shared',
    '{
        "model": {"provider": "openai", "model": "gpt-4", "temperature": 0.5},
        "runtime": {"identity": {"emoji": "💻", "displayName": "代码助手"}}
    }',
    '{"enabled": true, "interval": "1h", "prompt": "检查代码审查请求"}',
    'enabled'
);

-- 绑定到多个 Contact（通过 t_relationship 建立双向关系）
INSERT INTO t_relationship (sid, agent_id, contact_id, agent_contact, contact_agent) VALUES 
('rel-002', 'uuid-2', 'contact-dev1', '{"binding_mode": "shared"}', '{}'),
('rel-003', 'uuid-2', 'contact-dev2', '{"binding_mode": "shared"}', '{}'),
('rel-004', 'uuid-2', 'contact-dev3', '{"binding_mode": "shared"}', '{}');
```

## 关联文档

- [Agents 管理设计](../agents.md)
- [Agents-Skills 关联表](./r_agents_skills.md)
- [t_relationship 表](../../memory/database/t_relationship.md) - Agent-Contact 双向关系表（五重画像-关系特异性偏好）
- [岗位技能关系表](../../organization/database/r_position_skills.md)
- [员工管理表](../../organization/database/t_employees.md)
- [联系人表](../../organization/database/t_contacts.md)
- [Gateway 通道架构](../../gateway/channels.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
