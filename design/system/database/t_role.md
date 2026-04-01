# t_roles 角色管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_roles |
| 中文名 | 角色管理表 |
| 说明 | 存储系统角色定义，用于权限分组管理 |

## 设计原则

- **RBAC模型**：支持基于角色的访问控制
- **关联表存储权限**：使用 r_role_permission 关联表存储角色权限关系
- **灵活扩展**：支持动态配置角色和权限

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | 是 | - | 角色名称 |
| 3 | description | TEXT | - | 否 | NULL | 角色描述/备注 |
| 4 | status | VARCHAR | 20 | 否 | '1' | 状态: '0'=停用, '1'=启用 |
| 5 | sort | INT | - | 否 | 0 | 排序序号 |
| 6 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 7 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 8 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### name 角色名称

- 角色显示名称，如"管理员"、"普通用户"
- 同一组织内不允许重复

### description 角色描述

- 角色的详细说明，帮助理解角色用途
- 例如："拥有系统所有管理权限"

### status 状态

| 值 | 含义 |
|----|------|
| '0' | 停用，该角色用户将失去相关权限 |
| '1' | 启用，正常生效 |

**注意**：status 字段实际为 VARCHAR(20) 类型，不是 TINYINT。

### sort 排序序号

- 用于控制角色在列表中的显示顺序
- 数值越小，排序越靠前
- 默认值为 0

## 权限存储设计

角色权限通过 **r_role_permission 关联表** 存储，而不是 JSON 字段。

### r_role_permission 关联表

| 字段 | 类型 | 说明 |
|------|------|------|
| role_id | VARCHAR(36) | 角色ID，外键关联 t_roles.sid |
| permission_id | VARCHAR(36) | 权限ID，外键关联 t_permission.sid |

### 权限查询示例

```sql
-- 查询角色的权限列表
SELECT p.* FROM r_role_permission rp
JOIN t_permission p ON rp.permission_id = p.sid
WHERE rp.role_id = 'role-id-xxx';

-- 查询用户的所有权限（通过角色）
SELECT DISTINCT p.* FROM t_permission p
JOIN r_role_permission rp ON p.sid = rp.permission_id
JOIN r_user_role ur ON rp.role_id = ur.role_id
WHERE ur.user_id = 'user-id-xxx'
  AND p.status = '1';
```

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键索引 | sid | 主键索引 |
| idx_role_status | 普通索引 | status | 状态筛选索引 |
| idx_role_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_role_sort | 普通索引 | sort | 排序索引 |

## SQL建表语句

```sql
CREATE TABLE `t_roles` (
  `sid` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键UUID',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '角色描述',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '1' COMMENT '状态: 0=停用, 1=启用',
  `sort` int NULL DEFAULT 0 COMMENT '排序',
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted` tinyint NULL DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
  PRIMARY KEY (`sid`) USING BTREE,
  INDEX `idx_role_status`(`status` ASC) USING BTREE,
  INDEX `idx_role_deleted`(`deleted` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色管理表' ROW_FORMAT = Dynamic;
```

## 关联表 r_role_permission

```sql
CREATE TABLE `r_role_permission` (
  `role_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色ID',
  `permission_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限ID',
  PRIMARY KEY (`role_id`, `permission_id`) USING BTREE,
  INDEX `idx_permission_id`(`permission_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色权限关联表' ROW_FORMAT = Dynamic;
```

## 关联文档

- [角色管理设计文档](../roles.md)
- [系统管理模块索引](../README.md)
- [用户管理表](./t_users.md)
- [用户角色关联表](./r_user_roles.md)
- [权限管理表](./t_permission.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
