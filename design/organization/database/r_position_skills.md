# r_position_skills 岗位技能关系表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | r_position_skills |
| 中文名 | 岗位技能关系表 |
| 说明 | 岗位与系统技能的关联关系表，仅当岗位类型为 agent 时有效 |

## 核心设计原则

**关系表设计**：
- 仅存储岗位与技能的关联关系
- 岗位类型为 `agent` 时才可配置技能
- 使用联合主键，不包含 sid 字段
- 不包含逻辑删除和状态字段

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | position_id | VARCHAR | 36 | YES | - | 岗位ID（关联 t_positions.sid），联合主键第一部分 |
| 2 | skill_id | VARCHAR | 36 | YES | - | 技能ID（关联 t_system_skills.sid），联合主键第二部分 |
| 3 | config | JSON | - | NO | NULL | 岗位级技能配置（覆盖默认配置） |
| 4 | invocation | VARCHAR | 20 | YES | 'auto' | 调用策略: auto=自动调用, user_only=仅用户调用, disabled=禁用 |
| 5 | priority | INT | - | YES | 0 | 优先级（数字越大优先级越高） |
| 6 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### position_id 岗位ID

- **关联目标**：`t_positions.sid`
- **约束**：仅当 `t_positions.type = 'agent'` 时，才允许在此表创建关联记录
- **级联删除**：岗位删除时，自动删除关联的技能记录

### skill_id 技能ID

- **关联目标**：`t_system_skills.sid`
- **约束**：引用的技能必须处于 `enabled` 状态

### config 岗位级配置

用于覆盖技能的默认配置，JSON 结构：

```json
{
  "timeout": 60,
  "retry_count": 3,
  "custom_endpoint": "https://api.company.com"
}
```

**配置优先级**：`r_position_skills.config` > `t_system_skills.default_config`

### invocation 调用策略

| 值 | 说明 |
|-----|------|
| auto | Agent 可自动判断并调用 |
| user_only | 仅当用户明确请求时才调用 |
| disabled | 禁用此技能 |

### priority 优先级

- 数字越大优先级越高
- 用于 Agent 决策时优先选择技能
- 默认值为 0

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| pk_position_skills | position_id, skill_id | 主键 | 联合主键 |
| idx_position_skills_sid | skill_id | 普通 | 技能查询 |

## SQL语句

```sql
CREATE TABLE r_position_skills (
    position_id VARCHAR(36) NOT NULL COMMENT '岗位ID（关联 t_positions.sid）',
    skill_id VARCHAR(36) NOT NULL COMMENT '技能ID（关联 t_system_skills.sid）',
    config JSON COMMENT '岗位级技能配置（覆盖默认配置）',
    invocation VARCHAR(20) DEFAULT 'auto' COMMENT '调用策略: auto/user_only/disabled',
    priority INT DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (position_id, skill_id),
    INDEX idx_position_skills_sid (skill_id),
    
    FOREIGN KEY (position_id) REFERENCES t_positions(sid) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES t_system_skills(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位技能关系表';
```

## 数据示例

### 示例1：HR Agent 岗位的技能配置

```sql
-- 假设 HR Agent 岗位的 sid 为 'pos-001'
-- 配置了邮件发送和数据库查询两个技能
INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority) VALUES
('pos-001', 'skill-001', '{"default_sender": "hr@company.com"}', 'auto', 10),
('pos-001', 'skill-002', null, 'user_only', 5);
```

### 示例2：开发助手岗位的技能配置

```sql
-- 假设开发助手岗位的 sid 为 'pos-002'
INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority) VALUES
('pos-002', 'skill-002', '{"timeout": 120}', 'auto', 10),
('pos-002', 'skill-003', null, 'auto', 8);
```

## 业务规则

### 1. 岗位类型限制

- 仅当 `t_positions.type = 'agent'` 时，才允许配置技能
- 非 agent 类型岗位查询技能列表时返回空

### 2. 技能状态检查

- 关联的技能必须处于 `enabled` 状态
- 技能删除时，级联删除关联记录

### 3. 配置继承规则

```
最终生效配置：
    r_position_skills.config（岗位级，最高优先级）
←   t_system_skills.default_config（系统级默认）
```

## 关联文档

- [岗位表](./t_positions.md)
- [系统技能表](../../system/database/t_system_skills.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
