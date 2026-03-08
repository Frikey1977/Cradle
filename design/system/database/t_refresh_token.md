# t_refresh_token 刷新令牌表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_refresh_token |
| 中文名 | 刷新令牌表 |
| 说明 | 用于 JWT refreshToken 的存储和失效管理 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 令牌标识（如用户ID+设备） |
| 3 | description | TEXT | - | NO | NULL | 描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | YES | 1 | 状态: 0=停用, 1=启用 |
| 8 | user_id | VARCHAR | 36 | YES | - | 用户ID |
| 9 | token | VARCHAR | 500 | YES | - | refreshToken值 |
| 10 | expires_at | DATETIME | - | YES | - | 过期时间 |
| 11 | ip_address | VARCHAR | 50 | NO | - | 创建IP |
| 12 | user_agent | TEXT | - | NO | - | 用户代理 |
| 13 | revoked_at | DATETIME | - | NO | - | 撤销时间 |

## 字段详细说明

### token 令牌值

- JWT 格式的 refresh token
- 用于在 access token 过期后获取新的 token

### expires_at 过期时间

- 令牌的过期时间
- 超过此时间后令牌自动失效

### revoked_at 撤销时间

- 手动撤销令牌的时间
- 用于用户登出或安全事件后的令牌失效

### status 状态

| 值 | 含义 |
|----|------|
| 0 | 停用（已撤销） |
| 1 | 启用（有效） |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_refresh_token | sid | 主键 |
| idx_refresh_token_token | token | 普通索引 |
| idx_refresh_token_user | user_id | 普通索引 |
| idx_refresh_token_expires | expires_at | 普通索引 |
| idx_refresh_token_status | status | 普通索引 |
| idx_refresh_token_deleted | deleted | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_refresh_token (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '令牌标识',
    description TEXT COMMENT '描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    token VARCHAR(500) NOT NULL COMMENT 'refreshToken值',
    expires_at DATETIME NOT NULL COMMENT '过期时间',
    ip_address VARCHAR(50) COMMENT '创建IP',
    user_agent TEXT COMMENT '用户代理',
    revoked_at DATETIME COMMENT '撤销时间',
    
    INDEX idx_refresh_token_token (token),
    INDEX idx_refresh_token_user (user_id),
    INDEX idx_refresh_token_expires (expires_at),
    INDEX idx_refresh_token_status (status),
    INDEX idx_refresh_token_deleted (deleted),
    
    FOREIGN KEY (user_id) REFERENCES t_users(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新令牌表';
```

## 示例操作

```sql
-- 创建刷新令牌
INSERT INTO t_refresh_token (sid, name, user_id, token, expires_at, ip_address) VALUES
('uuid-token-1', 'admin-pc', 'uuid-user-1', 'refresh_token_value_here', DATE_ADD(NOW(), INTERVAL 7 DAY), '192.168.1.1');

-- 撤销刷新令牌
UPDATE t_refresh_token SET status = 0, revoked_at = NOW() WHERE sid = 'uuid-token-1';

-- 清理过期令牌
UPDATE t_refresh_token SET deleted = 1 WHERE expires_at < NOW() AND deleted = 0;
```

## 关联文档

- [组织管理模块](../README.md)
- [用户管理表](./t_users.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
