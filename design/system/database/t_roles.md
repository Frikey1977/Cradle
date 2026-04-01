# t_roles 角色管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_roles |
| 中文名 | 角色管理表 |
| 说明 | 存储系统角色定义，用于权限分组管理 |

## 设计原则

- **RBAC模型**：支持基于角色的访问控制
- **JSON存储权限**：使用 permission 字段存储权限配置
- **多语言支持**：通过 title 字段存储多语言key
- **灵活扩展**：支持英文名和自定义排序

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | 是 | - | 角色名称（中文） |
| 3 | e_name | VARCHAR | 200 | 否 | NULL | 角色英文名 |
| 4 | title | VARCHAR | 200 | 否 | NULL | 多语言key |
| 5 | description | TEXT | - | 否 | NULL | 角色描述/备注 |
| 6 | permission | VARCHAR | 255 | 否 | NULL | 权限JSON配置 |
| 7 | status | VARCHAR | 20 | 否 | '1' | 状态: '0'=停用, '1'=启用 |
| 8 | sort | INT | - | 否 | 0 | 排序序号 |
| 9 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 10 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 11 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### name 角色名称

- 角色的中文显示名称，如"管理员"、"普通用户"
- 同一组织内不允许重复

### e_name 英文名

- 角色的英文名称，用于国际化或系统内部标识
- 例如："administrator"、"user"

### title 多语言key

- 用于前端多语言显示的翻译key
- 例如："system.roles.admin"、"system.roles.user"
- 前端通过 `$t(title)` 获取本地化显示

### description 角色描述

- 角色的详细说明，帮助理解角色用途
- 例如："拥有系统所有管理权限"

### permission 权限JSON

存储角色拥有的权限配置，JSON格式：

```json
{
  "modules": ["module-id-1", "module-id-2"],
  "actions": ["sys.roles.view", "sys.roles.create", "sys.users.view"],
  "permissions": ["perm-id-1", "perm-id-2"]
}
```

**字段说明**：
| 属性 | 类型 | 说明 |
|------|------|------|
| modules | string[] | 功能模块ID列表 |
| actions | string[] | 操作权限码列表 |
| permissions | string[] | 权限ID列表 |

**权限码格式**：`{module_code}.{action_code}`
- 例如：`sys.roles.create` 表示角色管理模块的新增权限
- 例如：`sys.users.view` 表示用户管理模块的查看权限

### status 状态

| 值 | 含义 |
|----|------|
| '0' | 停用，该角色用户将失去相关权限 |
| '1' | 启用，正常生效 |

**注意**：status 字段实际为 VARCHAR(20) 类型。

### sort 排序序号

- 用于控制角色在列表中的显示顺序
- 数值越小，排序越靠前
- 默认值为 0

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键索引 | sid | 主键索引 |
| idx_role_status | 普通索引 | status | 状态筛选索引 |
| idx_role_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE `t_roles` (
  `sid` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键UUID',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '角色描述',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '1' COMMENT '状态: 0=停用, 1=启用',
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted` tinyint NULL DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
  `sort` int NULL DEFAULT 0 COMMENT '排序',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '多语言key',
  `e_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '英文名',
  `permission` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '权限JSON',
  PRIMARY KEY (`sid`) USING BTREE,
  INDEX `idx_role_status`(`status` ASC) USING BTREE,
  INDEX `idx_role_deleted`(`deleted` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色管理表' ROW_FORMAT = Dynamic;
```

## 权限查询示例

```sql
-- 查询包含指定权限码的角色
SELECT * FROM t_roles 
WHERE JSON_CONTAINS(permission->'$.actions', '"sys.roles.view"')
  AND status = '1'
  AND deleted = 0;

-- 查询角色的权限配置
SELECT permission FROM t_roles 
WHERE sid = 'role-id-xxx';
```

## 关联文档

- [角色管理设计文档](../roles.md)
- [系统管理模块索引](../README.md)
- [用户管理表](./t_users.md)
- [用户角色关联表](./r_user_roles.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
