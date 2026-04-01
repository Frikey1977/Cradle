# t_data_permission 数据权限规则表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_data_permission |
| 中文名 | 数据权限规则表 |
| 说明 | 存储数据权限规则定义，控制不同角色/用户/岗位对数据的访问范围 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，规则ID |
| 2 | name | VARCHAR | 200 | 是 | - | 规则名称 |
| 3 | description | TEXT | - | 否 | NULL | 规则描述 |
| 4 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | 1 | 是 | 1 | 状态: 0=停用, 1=启用 |
| 8 | target_type | VARCHAR | 20 | 是 | - | 作用对象类型: role/users/position |
| 9 | target_id | VARCHAR | 36 | 是 | - | 作用对象ID |
| 10 | data_type | VARCHAR | 100 | 是 | - | 数据类型（表名） |
| 11 | scope | VARCHAR | 20 | 是 | - | 数据范围: all/departments/departments/group/self |
| 12 | operations | JSON | - | 否 | NULL | 允许的操作: ["read","create","update","delete"] |
| 13 | conditions | JSON | - | 否 | NULL | 自定义条件（SQL模板数组） |
| 14 | priority | INT | - | 是 | 0 | 优先级（数字越小优先级越高） |
| 15 | oid | VARCHAR | 36 | 否 | NULL | 所属组织ID |

## 字段详细说明

### target_type 作用对象类型

| 取值 | 说明 |
|-----|------|
| role | 角色级别权限（影响该角色下所有用户） |
| user | 用户级别权限（特定用户的特殊权限） |
| position | 岗位级别权限（影响该岗位下所有员工） |

### scope 数据范围

| 取值 | 说明 | 适用场景 |
|-----|------|---------|
| all | 全部数据 | 系统管理员 |
| org | 本组织及子组织 | 组织管理员 |
| departments | 本部门及子部门 | 部门经理 |
| group | 本小组/团队 | 团队负责人 |
| self | 仅自己的数据 | 普通员工 |

### operations 允许的操作

JSON 数组格式，如 `["read", "update"]` 表示允许读取和更新。

| 操作 | 说明 |
|-----|------|
| create | 创建数据 |
| read | 读取数据 |
| update | 更新数据 |
| delete | 删除数据 |

### conditions 自定义条件

JSON 数组格式，存储 SQL WHERE 条件模板：

```json
[
  "org_id = {user.org_id}",
  "created_by = {user.id} OR departments_id = {user.departments_id}"
]
```

模板变量会在执行时替换为实际值。

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_data_permission | 主键索引 | sid | 主键索引 |
| idx_data_permission_target | 普通索引 | target_type, target_id | 作用对象查询索引 |
| idx_data_permission_data_type | 普通索引 | data_type | 数据类型索引 |
| idx_data_permission_scope | 普通索引 | scope | 数据范围索引 |
| idx_data_permission_org | 普通索引 | oid | 组织筛选索引 |
| idx_data_permission_status | 普通索引 | status | 状态筛选索引 |
| idx_data_permission_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_data_permission (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，规则ID',
    name VARCHAR(200) NOT NULL COMMENT '规则名称',
    description TEXT COMMENT '规则描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    target_type VARCHAR(20) NOT NULL COMMENT '作用对象类型: role/users/position',
    target_id VARCHAR(36) NOT NULL COMMENT '作用对象ID',
    data_type VARCHAR(100) NOT NULL COMMENT '数据类型（表名）',
    scope VARCHAR(20) NOT NULL COMMENT '数据范围: all/departments/departments/group/self',
    operations JSON COMMENT '允许的操作: ["read","create","update","delete"]',
    conditions JSON COMMENT '自定义条件（SQL模板数组）',
    priority INT DEFAULT 0 COMMENT '优先级（数字越小优先级越高）',
    oid VARCHAR(36) COMMENT '所属组织ID',
    
    INDEX idx_data_permission_target (target_type, target_id),
    INDEX idx_data_permission_data_type (data_type),
    INDEX idx_data_permission_scope (scope),
    INDEX idx_data_permission_org (org_id),
    INDEX idx_data_permission_status (status),
    INDEX idx_data_permission_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据权限规则表';
```

## 示例数据

### 角色权限配置

```sql
-- 组织管理员可管理本组织的Agent
INSERT INTO t_data_permission (
    sid, name, target_type, target_id, data_type, scope, operations, description
) VALUES (
    'uuid-dp-001',
    '组织管理员-Agent管理',
    'role',
    'role-org-admin',
    't_agent',
    'org',
    '["read", "create", "update", "delete"]',
    '组织管理员可管理本组织的Agent'
);

-- 部门经理可查看本部门的定时任务
INSERT INTO t_data_permission (
    sid, name, target_type, target_id, data_type, scope, operations, description
) VALUES (
    'uuid-dp-002',
    '部门经理-定时任务查看',
    'role',
    'role-departments-manager',
    't_cron_job',
    'departments',
    '["read"]',
    '部门经理可查看本部门的定时任务'
);
```

### 用户特殊权限

```sql
-- 特定用户可查看所有Agent（只读）
INSERT INTO t_data_permission (
    sid, name, target_type, target_id, data_type, scope, operations, priority, description
) VALUES (
    'uuid-dp-003',
    '审计员-全量Agent查看',
    'user',
    'user-auditor-001',
    't_agent',
    'all',
    '["read"]',
    1,
    '审计员可查看所有Agent（只读权限）'
);
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_roles | target_id (当 target_type='role') | 多对一 |
| t_users | target_id (当 target_type='user') | 多对一 |
| t_positions | target_id (当 target_type='position') | 多对一 |
| t_departments | oid | 多对一 |

## 参考文档

- [数据权限控制设计](../../data-permission.md)
- [角色管理设计](../roles.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
