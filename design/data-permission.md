# 数据权限控制设计

## 概述

数据权限控制是 Cradle 系统的核心安全机制，用于控制不同角色、不同范围的用户对数据的访问权限。

> **设计原则**：数据权限由**用户**决定，不是由 **Agent** 决定。Agent 只是执行用户授权范围内的操作。

## 核心概念

### 数据权限 vs 功能权限

| 维度 | 功能权限 | 数据权限 |
|-----|---------|---------|
| 控制对象 | 能否使用某个功能 | 能看到哪些数据 |
| 配置位置 | t_modules + t_roles.permission_json | t_data_permission |
| 校验时机 | API 路由层 | 数据查询层 |
| 粒度 | 模块/功能/操作 | 组织/部门/个人 |

### 数据范围（Data Scope）

数据权限的核心是定义用户可以访问的数据范围：

```
┌─────────────────────────────────────────────────────────────┐
│                      数据范围层级                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Level 1: ALL（全部数据）                                   │
│   └── 系统管理员、超级管理员                                  │
│                                                             │
│   Level 2: ORG（本组织及子组织）                             │
│   └── 组织管理员、跨部门管理者                                │
│                                                             │
│   Level 3: DEPT（本部门及子部门）                            │
│   └── 部门经理、部门管理员                                    │
│                                                             │
│   Level 4: GROUP（本小组/团队）                              │
│   └── 团队负责人、小组长                                      │
│                                                             │
│   Level 5: SELF（仅自己的数据）                              │
│   └── 普通员工、个人用户                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 权限模型

### 数据权限规则

```typescript
interface DataPermissionRule {
  // 规则标识
  id: string;
  
  // 作用对象
  target: {
    type: 'role' | 'user' | 'position';  // 作用对象类型
    id: string;                           // 对象ID
  };
  
  // 数据范围
  scope: 'all' | 'org' | 'departments' | 'group' | 'self';
  
  // 数据类型（哪些表的数据）
  dataTypes: string[];  // ['t_agent', 't_cron_job', 't_session']
  
  // 操作类型
  operations: ('create' | 'read' | 'update' | 'delete')[];
  
  // 自定义条件（SQL WHERE 条件模板）
  conditions?: string[];  // ["org_id = {user.org_id}", "created_by = {user.id}"]
  
  // 优先级（数字越小优先级越高）
  priority: number;
  
  // 状态
  status: 0 | 1;
}
```

### 权限判定流程

```
┌─────────────────────────────────────────────────────────────┐
│                     数据权限判定流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户发起数据操作请求                                     │
│            ↓                                                │
│  2. 获取用户身份和角色                                       │
│            ↓                                                │
│  3. 查询数据权限规则                                         │
│            ↓                                                │
│  4. 确定数据范围（取最大权限）                                │
│            ↓                                                │
│  5. 生成数据过滤条件                                         │
│            ↓                                                │
│  6. 执行带权限过滤的查询                                     │
│            ↓                                                │
│  7. 返回过滤后的数据                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 数据权限配置

### 按角色配置（推荐）

```json
{
  "role_id": "role-admin",
  "data_permissions": [
    {
      "data_type": "t_agent",
      "scope": "org",
      "operations": ["read", "update"],
      "description": "组织管理员可查看和修改本组织的Agent"
    },
    {
      "data_type": "t_cron_job",
      "scope": "departments",
      "operations": ["read", "create", "update", "delete"],
      "description": "可管理部门的定时任务"
    }
  ]
}
```

### 按岗位配置

```json
{
  "position_id": "pos-sales-manager",
  "data_permissions": [
    {
      "data_type": "t_customer",
      "scope": "departments",
      "operations": ["read", "update"],
      "description": "销售经理可查看本部门客户"
    }
  ]
}
```

### 特殊用户配置（覆盖角色权限）

```json
{
  "user_id": "user-xxx",
  "override": true,
  "data_permissions": [
    {
      "data_type": "t_agent",
      "scope": "all",
      "operations": ["read"],
      "description": "特殊用户可查看所有Agent（只读）"
    }
  ]
}
```

## 数据过滤实现

### 自动过滤机制

在数据查询层自动注入权限过滤条件：

```sql
-- 原始查询
SELECT * FROM t_agent WHERE status = 1;

-- 用户数据范围 = DEPT，部门ID = 'departments-001'
-- 自动添加过滤条件
SELECT * FROM t_agent 
WHERE status = 1 
  AND oid IN (
    SELECT sid FROM t_departments WHERE path LIKE '%departments-001%'
  );
```

### 权限过滤函数

```sql
-- 获取用户数据范围对应的组织ID列表
CREATE FUNCTION get_users_scope_org_ids(user_id VARCHAR(36))
RETURNS VARCHAR(36)[]
BEGIN
  DECLARE user_scope VARCHAR(20);
  DECLARE user_org_id VARCHAR(36);
  
  -- 获取用户的数据范围和所属组织
  SELECT scope, oid INTO user_scope, user_org_id
  FROM t_employees WHERE user_id = user_id;
  
  -- 根据范围返回对应的组织ID列表
  CASE user_scope
    WHEN 'all' THEN RETURN NULL;  -- 返回NULL表示无限制
    WHEN 'org' THEN 
      RETURN (SELECT GROUP_CONCAT(sid) FROM t_departments WHERE path LIKE CONCAT('%', user_org_id, '%'));
    WHEN 'departments' THEN
      RETURN (SELECT GROUP_CONCAT(sid) FROM t_departments WHERE path LIKE CONCAT('%', user_org_id, '%'));
    WHEN 'self' THEN
      RETURN user_org_id;
    ELSE RETURN user_org_id;
  END CASE;
END;
```

## 数据权限校验点

### 查询校验

```
用户查询 Agent 列表
    ↓
获取用户角色和岗位
    ↓
确定数据范围（DEPT）
    ↓
生成过滤条件：WHERE departments_id IN (用户部门及子部门)
    ↓
执行查询
```

### 操作校验

```
用户修改 Agent
    ↓
查询该 Agent 的 oid
    ↓
校验用户是否有该 oid 的写权限
    ↓
有权限 → 允许操作
无权限 → 返回 403 Forbidden
```

## 与 Agent 的关系

### 重要原则

**Agent 不决定数据权限，只执行用户授权的操作。**

```
用户通过 Agent 查询数据
        ↓
Agent 调用 Skill 执行查询
        ↓
Skill 使用用户的身份和权限执行
        ↓
数据权限层过滤数据
        ↓
返回用户有权限看到的数据
```

### Agent 执行上下文

```json
{
  "agent_id": "agent-xxx",
  "executing_user": {
    "user_id": "user-xxx",
    "roles": ["role-admin"],
    "data_scope": "departments",
    "org_id": "org-xxx",
    "departments_id": "departments-xxx"
  },
  "permission_context": {
    "can_access_all": false,
    "accessible_org_ids": ["org-xxx", "departments-001", "departments-002"]
  }
}
```

## 数据库设计

详见 [t_data_permission.md](./system/database/t_data_permission.md)

## 关联文档

- [角色管理设计](./system/roles.md)
- [岗位管理设计](./organization/position.md)
- [员工管理设计](./organization/employee.md)
- [数据库设计规范](./DATABASE_SPECIFICATION.md)
