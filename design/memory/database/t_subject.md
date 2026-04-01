# t_subject - Subject 管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_subject |
| 中文名 | Subject 管理表 |
| 说明 | 管理长期记忆的 Subject 元数据，支持跨时间主题连续性 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | Subject 名称 |
| 3 | description | TEXT | - | NO | NULL | Subject 描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | YES | 1 | 状态: 0=休眠, 1=活跃, 2=归档 |
| 8 | agent_id | VARCHAR | 36 | YES | - | 所属 Agent ID |
| 9 | file_path | VARCHAR | 500 | YES | - | 记忆文件路径 |
| 10 | message_count | INT | - | YES | 0 | 消息数量 |
| 11 | last_message_time | DATETIME | - | NO | - | 最后消息时间 |
| 12 | tags | JSON | - | NO | - | 标签（JSON数组） |
| 13 | merged_from | JSON | - | NO | - | 合并来源（JSON数组） |
| 14 | parent_subject_id | VARCHAR | 36 | NO | - | 父 Subject ID（拆分场景） |

## 字段详细说明

### status 状态

| 值 | 含义 | 说明 |
|----|------|------|
| 0 | dormant | 休眠中，30天无更新自动转入 |
| 1 | active | 活跃中，默认状态 |
| 2 | archived | 已归档，项目结束或手动归档 |

### tags 标签

```json
["销售", "Q1", "重点项目", "客户A"]
```

### merged_from 合并来源

```json
["sub_002", "sub_003"]
```

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_subject | sid | 主键 |
| uk_subject_file | file_path | 唯一索引 |
| idx_subject_agent | agent_id | 普通索引 |
| idx_subject_status | status | 普通索引 |
| idx_subject_deleted | deleted | 普通索引 |
| idx_subject_time | last_message_time | 普通索引 |
| idx_subject_parent | parent_subject_id | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_subject (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT 'Subject 名称',
    description TEXT COMMENT 'Subject 描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=休眠, 1=活跃, 2=归档',
    agent_id VARCHAR(36) NOT NULL COMMENT '所属 Agent ID',
    file_path VARCHAR(500) NOT NULL COMMENT '记忆文件路径',
    message_count INT DEFAULT 0 COMMENT '消息数量',
    last_message_time DATETIME COMMENT '最后消息时间',
    tags JSON COMMENT '标签（JSON数组）',
    merged_from JSON COMMENT '合并来源（JSON数组）',
    parent_subject_id VARCHAR(36) COMMENT '父 Subject ID（拆分场景）',
    
    UNIQUE KEY uk_subject_file (file_path),
    INDEX idx_subject_agent (agent_id),
    INDEX idx_subject_status (status),
    INDEX idx_subject_deleted (deleted),
    INDEX idx_subject_time (last_message_time),
    INDEX idx_subject_parent (parent_subject_id),
    
    FOREIGN KEY (agent_id) REFERENCES t_agent(sid),
    FOREIGN KEY (parent_subject_id) REFERENCES t_subject(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Subject 管理表';
```

## 使用场景

### 场景1：创建新 Subject

```sql
INSERT INTO t_subject (sid, name, description, agent_id, file_path, status)
VALUES ('sub_001', 'Q1销售项目', '2026年第一季度销售目标与执行', 'agent_001', 'subject-sub_001.md', 1);
```

### 场景2：更新消息计数

```sql
UPDATE t_subject 
SET message_count = message_count + 1, 
    last_message_time = NOW(),
    status = 1
WHERE sid = 'sub_001';
```

### 场景3：自动转入休眠

```sql
-- 30天无更新的 Subject 自动转入休眠
UPDATE t_subject 
SET status = 0
WHERE status = 1 
  AND last_message_time < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### 场景4：合并 Subject

```sql
-- 将 sub_002 合并到 sub_001
UPDATE t_subject 
SET merged_from = JSON_ARRAY('sub_002'),
    description = CONCAT(description, '\n\n合并自: sub_002'),
    message_count = message_count + (SELECT message_count FROM t_subject WHERE sid = 'sub_002')
WHERE sid = 'sub_001';

-- 归档被合并的 Subject
UPDATE t_subject 
SET status = 2, deleted = 1
WHERE sid = 'sub_002';
```

### 场景5：拆分 Subject

```sql
-- 创建子 Subject
INSERT INTO t_subject (sid, name, description, agent_id, file_path, status, parent_subject_id)
VALUES ('sub_003', 'Q1销售项目-客户拓展', 'Q1项目中客户拓展专项', 'agent_001', 'subject-sub_003.md', 1, 'sub_001');
```

### 场景6：查询活跃 Subject

```sql
SELECT * FROM t_subject 
WHERE agent_id = 'agent_001' 
  AND status = 1 
  AND deleted = 0
ORDER BY last_message_time DESC;
```

## 关联文档

- [长期记忆层设计](../layer_long_term.md)
- [记忆索引层设计](../layer_memory_index.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
