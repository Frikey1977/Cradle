# t_codes 代码管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_codes |
| 中文名 | 代码管理表 |
| 说明 | 维护系统中所有可配置的代码，采用树形结构管理 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 代码名称（显示名称） |
| 3 | title | VARCHAR | 200 | NO | NULL | 标题翻译键 |
| 4 | description | TEXT | - | NO | NULL | 描述说明 |
| 5 | icon | VARCHAR | 100 | NO | NULL | 图标标识 |
| 6 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 7 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 8 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 9 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |
| 10 | parent_id | VARCHAR | 36 | NO | - | 父级ID（树形结构） |
| 11 | type | VARCHAR | 50 | NO | - | 代码类型 |
| 12 | value | VARCHAR | 100 | NO | - | 代码值 |
| 13 | sort | INT | - | NO | 0 | 排序序号 |
| 14 | metadata | TEXT | - | NO | NULL | 元数据（JSON格式） |

## 字段详细说明

### type 代码类型

用于区分不同类别的代码：

| 代码类型 | 说明 | 示例 |
|---------|------|------|
| SKILL_STATUS | Skill状态 | enabled, disabled, paused |
| AGENT_STATUS | Agent状态 | active, inactive, archived |
| USER_STATUS | 用户状态 | active, inactive, locked |
| MODULE_TYPE | 模块类型 | catalog, menu, button |
| MEMORY_TYPE | 记忆类型 | fact, decision, knowledge |
| CONVERSATION_STATUS | 对话状态 | pending, completed, archived |

### value 代码值

实际在代码中使用的值，用于条件判断和状态标识。

## 树形结构

```
t_codes
├── SKILL_STATUS
│   ├── enabled
│   ├── disabled
│   └── paused
├── AGENT_STATUS
│   ├── active
│   ├── inactive
│   └── archived
└── USER_STATUS
    ├── active
    ├── inactive
    └── locked
```

## SQL语句

```sql
CREATE TABLE t_codes (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '代码名称',
    title VARCHAR(200) COMMENT '标题翻译键',
    description TEXT COMMENT '描述说明',
    icon VARCHAR(100) COMMENT '图标标识',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    parent_id VARCHAR(36) COMMENT '父级ID',
    type VARCHAR(50) COMMENT '代码类型',
    value VARCHAR(100) COMMENT '代码值',
    sort INT DEFAULT 0 COMMENT '排序',
    metadata TEXT COMMENT '元数据（JSON格式）',
    
    INDEX idx_code_status (status),
    INDEX idx_code_deleted (deleted),
    INDEX idx_code_parent (parent_id),
    INDEX idx_code_type (type),
    
    FOREIGN KEY (parent_id) REFERENCES t_codes(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='代码管理表';
```

## 示例数据

| sid | name | parent_id | type | value | sort | status |
|-----|------|----------|------|-------|------|--------|
| uuid-1 | Skill状态 | NULL | ROOT | | 0 | 1 |
| uuid-2 | 启用 | uuid-1 | SKILL_STATUS | enabled | 1 | 1 |
| uuid-3 | 禁用 | uuid-1 | SKILL_STATUS | disabled | 2 | 1 |
| uuid-4 | 暂停 | uuid-1 | SKILL_STATUS | paused | 3 | 1 |

## 关联文档

- [代码管理设计](../code.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
