# t_exec_session 命令执行会话表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_exec_session |
| 中文名 | 命令执行会话表 |
| 说明 | 记录命令执行会话的状态和结果 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 64 | 是 | UUID | 主键，会话ID |
| 2 | name | VARCHAR | 200 | 是 | - | 会话名称（命令摘要） |
| 3 | description | TEXT | - | 否 | NULL | 会话描述/备注 |
| 4 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | 是 | 1 | 状态: 0=停用, 1=启用 |
| 8 | agent_id | VARCHAR | 64 | 否 | - | 关联的Agent ID |
| 9 | user_id | VARCHAR | 64 | 否 | - | 执行用户ID |
| 10 | command | TEXT | - | 是 | - | 执行的命令 |
| 11 | workdir | VARCHAR | 512 | 否 | - | 工作目录 |
| 12 | host | VARCHAR | 20 | 是 | 'gateway' | 执行环境：sandbox/gateway/node |
| 13 | security | VARCHAR | 20 | 是 | 'allowlist' | 安全级别：deny/allowlist/full |
| 14 | exec_status | VARCHAR | 20 | 是 | 'running' | 执行状态：running/completed/failed/timeout |
| 15 | pid | BIGINT | - | 否 | - | 进程ID |
| 16 | exit_codes | INT | - | 否 | - | 退出码 |
| 17 | stdout | LONGTEXT | - | 否 | - | 标准输出 |
| 18 | stderr | LONGTEXT | - | 否 | - | 标准错误 |
| 19 | backgrounded | TINYINT | 1 | 是 | 0 | 是否后台执行：0=否，1=是 |
| 20 | timeout_seconds | INT | - | 否 | - | 超时时间（秒） |
| 21 | started_at | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP | 开始时间 |
| 22 | completed_at | TIMESTAMP | - | 否 | - | 完成时间 |
| 23 | duration_ms | BIGINT | - | 否 | - | 执行时长（毫秒） |
| 24 | oid | VARCHAR | 64 | 否 | - | 组织ID |

## 字段详细说明

### name 会话名称

- 命令的摘要显示名称，如 "git status"、"npm install"
- 便于在列表中识别会话

### host 执行环境

| 取值 | 说明 |
|------|------|
| sandbox | Docker 沙箱环境，最安全 |
| gateway | 网关主机环境，受限权限 |
| node | 远程节点环境 |

### security 安全级别

| 取值 | 说明 |
|------|------|
| deny | 完全禁止执行 |
| allowlist | 白名单审批模式 |
| full | 完全允许执行 |

### exec_status 执行状态

| 取值 | 说明 |
|------|------|
| running | 运行中 |
| completed | 正常完成 |
| failed | 执行失败 |
| timeout | 执行超时 |
| approval_pending | 等待审批 |

### status 记录状态

| 值 | 含义 |
|----|------|
| 0 | 停用（逻辑删除或禁用） |
| 1 | 启用（正常记录） |

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_exec_session | 主键索引 | sid | 主键索引 |
| idx_exec_session_agent | 普通索引 | agent_id | Agent筛选索引 |
| idx_exec_session_user | 普通索引 | user_id | 用户筛选索引 |
| idx_exec_session_exec_status | 普通索引 | exec_status | 执行状态筛选索引 |
| idx_exec_session_org | 普通索引 | oid | 组织筛选索引 |
| idx_exec_session_started | 普通索引 | started_at | 开始时间索引 |
| idx_exec_session_status | 普通索引 | status | 记录状态索引 |
| idx_exec_session_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_exec_session_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_exec_session (
    sid VARCHAR(64) PRIMARY KEY COMMENT '主键，会话ID',
    name VARCHAR(200) NOT NULL COMMENT '会话名称（命令摘要）',
    description TEXT COMMENT '会话描述/备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    agent_id VARCHAR(64) COMMENT '关联的Agent ID',
    user_id VARCHAR(64) COMMENT '执行用户ID',
    command TEXT NOT NULL COMMENT '执行的命令',
    workdir VARCHAR(512) COMMENT '工作目录',
    host VARCHAR(20) NOT NULL DEFAULT 'gateway' COMMENT '执行环境：sandbox/gateway/node',
    security VARCHAR(20) NOT NULL DEFAULT 'allowlist' COMMENT '安全级别：deny/allowlist/full',
    exec_status VARCHAR(20) NOT NULL DEFAULT 'running' COMMENT '执行状态：running/completed/failed/timeout',
    pid BIGINT COMMENT '进程ID',
    exit_codes INT COMMENT '退出码',
    stdout LONGTEXT COMMENT '标准输出',
    stderr LONGTEXT COMMENT '标准错误',
    backgrounded TINYINT NOT NULL DEFAULT 0 COMMENT '是否后台执行：0=否，1=是',
    timeout_seconds INT COMMENT '超时时间（秒）',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    completed_at TIMESTAMP COMMENT '完成时间',
    duration_ms BIGINT COMMENT '执行时长（毫秒）',
    oid VARCHAR(64) COMMENT '组织ID',
    
    INDEX idx_exec_session_agent (agent_id),
    INDEX idx_exec_session_user (user_id),
    INDEX idx_exec_session_exec_status (exec_status),
    INDEX idx_exec_session_org (org_id),
    INDEX idx_exec_session_started (started_at),
    INDEX idx_exec_session_status (status),
    INDEX idx_exec_session_deleted (deleted),
    INDEX idx_exec_session_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令执行会话表';
```

## 关联文档

- [CLI 基础设施设计](../cli.md)
- [执行审批记录表](./t_exec_approval.md)
- [系统管理模块](../../README.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
