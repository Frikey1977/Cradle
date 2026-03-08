# r_user_role 用户-角色关联表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | r_user_role |
| 中文名 | 用户-角色关联表 |
| 说明 | 多对多关系，支持一个用户多个角色 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | user_id | VARCHAR | 36 | YES | - | 用户ID，联合主键第一部分 |
| 2 | role_id | VARCHAR | 36 | YES | - | 角色ID，联合主键第二部分 |
| 3 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### user_id 用户ID

- 关联到用户表(t_users)的主键
- 作为联合主键的第一部分
- 外键约束：ON DELETE CASCADE

### role_id 角色ID

- 关联到角色表(t_roles)的主键
- 作为联合主键的第二部分
- 外键约束：ON DELETE CASCADE

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| PRIMARY | user_id, role_id | 联合主键 | 唯一标识，防止重复绑定 |
| idx_user_role_role | role_id | 普通索引 | 按角色查询 |

## SQL语句

```sql
CREATE TABLE r_user_role (
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (user_id, role_id),
    INDEX idx_user_role_role (role_id),
    
    FOREIGN KEY (user_id) REFERENCES t_users(sid) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES t_roles(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色关联表';
```

## 示例数据

```sql
-- 用户分配角色
INSERT INTO r_user_role (user_id, role_id) VALUES
('uuid-user-1', 'uuid-role-1'),
('uuid-user-2', 'uuid-role-2');
```

## 关联文档

- [系统管理模块](../README.md)
- [用户管理表](./t_users.md)
- [角色管理表](./t_roles.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
