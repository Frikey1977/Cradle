# t_exec_approval 执行审批记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_exec_approval |
| 中文名 | 执行审批记录表 |
| 说明 | 记录命令执行的审批请求和审批结果 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 64 | 是 | UUID | 主键，审批ID |
| 2 | name | VARCHAR | 200 | 是 | - | 审批名称（命令摘要） |
| 3 | description | TEXT | - | 否 | NULL | 审批描述/备注 |
| 4 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | 是 | 1 | 状态: 0=停用, 1=启用 |
| 8 | session_id | VARCHAR | 64 | 否 | - | 关联的会话ID |
| 9 | agent_id | VARCHAR | 64 | 否 | - | 关联的Agent ID |
| 10 | user_id | VARCHAR | 64 | 否 | - | 申请用户ID |
| 11 | command | TEXT | - | 是 | - | 待执行的命令 |
| 12 | workdir | VARCHAR | 512 | 否 | - | 工作目录 |
| 13 | host | VARCHAR | 20 | 是 | - | 请求的执行环境 |
| 14 | approval_status | VARCHAR | 20 | 是 | 'pending' | 审批状态：pending/approved/rejected/expired |
| 15 | approver_id | VARCHAR | 64 | 否 | - | 审批人ID |
| 16 | approved_at | TIMESTAMP | - | 否 | - | 审批时间 |
| 17 | reject_reason | TEXT | - | 否 | - | 拒绝原因 |
| 18 | expires_at | TIMESTAMP | 是 | - | 过期时间 |
| 19 | oid | VARCHAR | 64 | 否 | - | 组织ID |

## 字段详细说明

### name 审批名称

- 待审批命令的摘要显示名称，如 "git push"、"docker run"
- 便于在审批列表中识别

### approval_status 审批状态

| 取值 | 说明 |
|------|------|
| pending | 待审批 |
| approved | 已批准 |
| rejected | 已拒绝 |
| expired | 已过期 |

### status 记录状态

| 值 | 含义 |
|----|------|
| 0 | 停用（逻辑删除或禁用） |
| 1 | 启用（正常记录） |

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_exec_approval | 主键索引 | sid | 主键索引 |
| idx_exec_approval_session | 普通索引 | session_id | 会话筛选索引 |
| idx_exec_approval_status | 普通索引 | approval_status | 审批状态筛选索引 |
| idx_exec_approval_agent | 普通索引 | agent_id | Agent筛选索引 |
| idx_exec_approval_user | 普通索引 | user_id | 用户筛选索引 |
| idx_exec_approval_expires | 普通索引 | expires_at | 过期时间索引 |
| idx_exec_approval_record_status | 普通索引 | status | 记录状态索引 |
| idx_exec_approval_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_exec_approval_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_exec_approval (
    sid VARCHAR(64) PRIMARY KEY COMMENT '主键，审批ID',
    name VARCHAR(200) NOT NULL COMMENT '审批名称（命令摘要）',
    description TEXT COMMENT '审批描述/备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    session_id VARCHAR(64) COMMENT '关联的会话ID',
    agent_id VARCHAR(64) COMMENT '关联的Agent ID',
    user_id VARCHAR(64) COMMENT '申请用户ID',
    command TEXT NOT NULL COMMENT '待执行的命令',
    workdir VARCHAR(512) COMMENT '工作目录',
    host VARCHAR(20) NOT NULL COMMENT '请求的执行环境',
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审批状态：pending/approved/rejected/expired',
    approver_id VARCHAR(64) COMMENT '审批人ID',
    approved_at TIMESTAMP COMMENT '审批时间',
    reject_reason TEXT COMMENT '拒绝原因',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    oid VARCHAR(64) COMMENT '组织ID',
    
    INDEX idx_exec_approval_session (session_id),
    INDEX idx_exec_approval_status (approval_status),
    INDEX idx_exec_approval_agent (agent_id),
    INDEX idx_exec_approval_user (user_id),
    INDEX idx_exec_approval_expires (expires_at),
    INDEX idx_exec_approval_record_status (status),
    INDEX idx_exec_approval_deleted (deleted),
    INDEX idx_exec_approval_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行审批记录表';
```

## 关联文档

- [CLI 基础设施设计](../cli.md)
- [命令执行会话表](./t_exec_session.md)
- [系统管理模块](../../README.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
