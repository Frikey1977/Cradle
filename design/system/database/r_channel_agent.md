# r_channel_agent - Agent 通道绑定表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | r_channel_agent |
| 中文名 | Agent 通道绑定表 |
| 说明 | 存储 Agent 在各通信通道的身份映射。一个 Agent 可在多个通道有身份，由管理员配置。 |

## 核心设计原则

**身份映射**：
- 通过 `(channel_id, identity)` 唯一确定一个 Agent
- Gateway 根据消息中的接收者标识查询对应的 Agent
- 每个 Agent 的通道身份由管理员在后台配置

**配置管理**：
- 管理员在后台为 Agent 配置各通道的身份
- 支持通道特定的配置（如钉钉的 corpId、机器人名称等）
- 一个 Agent 在同一通道一般只有一个身份

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | channel_id | VARCHAR | 36 | YES | - | 通道ID，外键关联 t_channels |
| 2 | agent_id | VARCHAR | 36 | YES | - | Agent ID，外键关联 t_agents |
| 3 | identity | VARCHAR | 200 | YES | - | Agent 在通道内的标识 |
| 4 | config | JSON | - | NO | NULL | 通道特定配置 |
| 5 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### channel_id 通道ID

外键关联 `t_channels.sid`，标识属于哪个通道。

### agent_id Agent ID

外键关联 `t_agents.sid`，标识这个通道身份对应哪个 Agent。

### identity 通道内标识

Agent 在该通道内的唯一标识：

| 通道 | identity 示例 | 说明 |
|-----|--------------|------|
| cradle | `agent-a` | WebUI 内部标识 |
| dingtalk | `robot-001` | 钉钉机器人ID |
| wechat | `gh_xxx` | 微信公众号ID |
| lark | `bot_xxx` | 飞书机器人ID |

### config 通道特定配置

存储该通道特有的配置信息：

```json
// 钉钉机器人配置
{
  "robotName": "小助手",
  "corpId": "ding_corp_xxx",
  "robotCode": "robot_001"
}

// 微信公众号配置
{
  "appId": "wx123456",
  "originalId": "gh_xxx",
  "encodingAESKey": "xxx"
}

// WebUI 配置
{
  "displayName": "张总助理",
  "emoji": "👔"
}
```

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| pk_channel_agent | channel_id, agent_id | 联合主键 | 通道-Agent 唯一 |
| uk_channel_agent_identity | channel_id, identity | 唯一索引 | 通道内身份唯一 |
| idx_agent_id | agent_id | 普通索引 | 查询 Agent 的所有通道身份 |

## SQL语句

```sql
CREATE TABLE r_channel_agent (
    channel_id VARCHAR(36) NOT NULL COMMENT '通道ID，外键关联 t_channels',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID，外键关联 t_agents',
    identity VARCHAR(200) NOT NULL COMMENT 'Agent 在通道内的标识',
    config JSON COMMENT '通道特定配置',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (channel_id, agent_id),
    UNIQUE KEY uk_channel_agent_identity (channel_id, identity),
    INDEX idx_agent_id (agent_id),
    
    FOREIGN KEY (channel_id) REFERENCES t_channels(sid) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES t_agents(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent 通道绑定表';
```

## 使用场景

### 场景1：Gateway 路由消息

```sql
-- 钉钉消息：to=robot_001
-- 1. 识别通道
SELECT sid FROM t_channels WHERE channel_name = '钉钉' AND status = 'active';
-- → channel_id = 'ch_ding_001'

-- 2. 查询接收 Agent
SELECT agent_id FROM r_channel_agent 
WHERE channel_id = 'ch_ding_001' AND identity = 'robot_001';
-- → agent_id = 'agent_001'

-- 3. 路由到 agent_001 处理
```

### 场景2：管理员配置 Agent 通道身份

```sql
-- 为"张总助理"配置钉钉机器人身份
INSERT INTO r_channel_agent (channel_id, agent_id, identity, config) VALUES
('ch_ding_001', 'agent_001', 'robot_001', 
 '{"robotName": "张总助理", "corpId": "ding_corp_xxx"}');

-- 为"张总助理"配置微信公众号身份
INSERT INTO r_channel_agent (channel_id, agent_id, identity, config) VALUES
('ch_wechat_001', 'agent_001', 'gh_xxx', 
 '{"appId": "wx123456", "originalId": "gh_xxx"}');

-- 现在 agent_001 有两个通道身份：
-- - dingtalk:robot_001
-- - wechat:gh_xxx
```

### 场景3：查询 Agent 的所有通道身份

```sql
-- 查询"张总助理"的所有通道身份
SELECT 
    rca.channel_id,
    rca.identity,
    tc.channel_name,
    rca.config
FROM r_channel_agent rca
JOIN t_channels tc ON rca.channel_id = tc.sid
WHERE rca.agent_id = 'agent_001';

-- 结果：
-- channel_id    | identity    | channel_name | config
-- ch_cradle_001 | agent-a     | WebUI        | {"displayName": "张总助理"}
-- ch_ding_001   | robot_001   | 钉钉         | {"robotName": "张总助理"}
-- ch_wechat_001 | gh_xxx      | 微信         | {"appId": "wx123456"}
```

### 场景4：查询通道的所有 Agent

```sql
-- 查询钉钉通道的所有 Agent
SELECT 
    rca.identity,
    rca.agent_id,
    ta.name as agent_name,
    rca.config
FROM r_channel_agent rca
JOIN t_agents ta ON rca.agent_id = ta.sid
WHERE rca.channel_id = 'ch_ding_001';

-- 结果：
-- identity   | agent_id   | agent_name    | config
-- robot_001  | agent_001  | 张总的助理    | {"robotName": "张总助理"}
-- robot_002  | agent_002  | 客服小助手    | {"robotName": "客服助手"}
```

## 关联文档

- [Gateway 通道架构](../../gateway/channels.md)
- [t_channels 表](./t_channels.md) - 通道配置表
- [r_channel_contact 表](./r_channel_contact.md) - Contact 通道绑定表
- [t_agents 表](../../agent/database/t_agents.md) - Agent 定义表
