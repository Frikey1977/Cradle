# 角色管理设计

## 1. 模块概述

### 1.1 功能定位
角色管理是系统权限控制的核心模块，用于定义和管理用户角色，通过角色分配权限，实现基于角色的访问控制（RBAC）。

### 1.2 核心价值
- **权限分组**：将权限按角色分组，简化权限管理
- **灵活配置**：支持动态配置角色和权限，无需修改代码
- **用户授权**：通过给用户分配角色，快速完成权限授权
- **多语言支持**：角色名称支持多语言显示

### 1.3 使用场景
- **场景1**：新员工入职时，分配对应角色（如"普通用户"）即可获得相应权限
- **场景2**：调整某类用户的权限时，只需修改角色权限，所有该角色用户自动生效
- **场景3**：创建临时角色（如"项目经理"）用于特定项目期间的权限控制

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 角色列表 | 查询角色列表，支持按名称搜索 |
| 创建角色 | 创建新角色，设置名称、描述和权限 |
| 编辑角色 | 修改角色信息和权限 |
| 删除角色 | 删除角色（逻辑删除） |
| 启用/停用 | 控制角色的可用状态 |
| **查看用户** | 查看拥有该角色的用户列表 |

### 2.2 业务流程

#### 2.2.1 创建角色

**流程说明**：
1. 输入角色名称（必填）
2. 输入角色英文名（可选）
3. 输入多语言key（可选）
4. 输入角色描述（可选）
5. 选择角色拥有的权限（从权限树中选择）
6. 提交创建

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 角色名称，如"管理员" |
| e_name | string | 否 | 角色英文名，如"admin" |
| title | string | 否 | 多语言key，如"system.roles.admin" |
| description | string | 否 | 角色描述说明 |
| permission | object | 否 | 权限JSON配置 |
| status | string | 否 | 状态：'0'=停用，'1'=启用，默认'1' |
| sort | number | 否 | 排序序号，默认0 |

**permission 对象结构**：
| 属性 | 类型 | 说明 |
|------|------|------|
| modules | string[] | 模块ID列表 |
| actions | string[] | 操作权限码列表 |
| permissions | string[] | 权限ID列表 |

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 角色ID（UUID） |
| name | string | 角色名称 |
| e_name | string | 角色英文名 |
| title | string | 多语言key |
| description | string | 角色描述 |
| permission | object | 权限JSON配置 |
| status | string | 状态：'0'=停用，'1'=启用 |
| sort | number | 排序序号 |
| createTime | string | 创建时间 |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 角色名称重复 | 返回错误：角色名称已存在 |
| 名称为空 | 返回错误：角色名称不能为空 |

#### 2.2.2 查询角色列表

**流程说明**：
1. 支持查询所有角色
2. 支持按角色名称模糊搜索
3. 返回角色基本信息（不包含权限详情）

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 否 | 角色名称（模糊搜索） |

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 角色列表 |
| total | number | 总记录数 |

#### 2.2.3 编辑角色

**流程说明**：
1. 根据ID查询角色详情
2. 修改角色信息（名称、英文名、多语言key、描述、权限）
3. 提交更新

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 角色ID |
| name | string | 是 | 角色名称 |
| e_name | string | 否 | 角色英文名 |
| title | string | 否 | 多语言key |
| description | string | 否 | 角色描述 |
| permission | object | 否 | 权限JSON配置 |
| status | string | 否 | 状态：'0'=停用，'1'=启用 |
| sort | number | 否 | 排序序号 |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 角色不存在 | 返回错误：角色不存在 |
| 角色名称与其他角色重复 | 返回错误：角色名称已存在 |

#### 2.2.4 删除角色

**流程说明**：
1. 检查角色是否已分配给用户（可选，根据业务需求）
2. 执行逻辑删除

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 角色ID |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 角色已分配给用户 | 返回错误：角色已被使用，无法删除 |
| 角色不存在 | 返回错误：角色不存在 |

#### 2.2.5 启用/停用角色

**流程说明**：
1. 切换角色的状态字段
2. 停用后，该角色用户将失去相关权限

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 角色ID |
| status | string | 是 | 状态：'0'=停用，'1'=启用 |

#### 2.2.6 查看角色下的用户

**流程说明**：
1. 查询拥有该角色的所有用户
2. 关联显示用户的基本信息（用户名、姓名、部门等）
3. 支持分页和搜索

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| roleId | string | 是 | 角色ID |
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页条数，默认10 |
| keyword | string | 否 | 用户名/姓名搜索 |

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 用户列表 |
| list[].id | string | 用户ID |
| list[].username | string | 用户名 |
| list[].name | string | 姓名 |
| list[].employeeNo | string | 工号 |
| list[].departmentsName | string | 部门名称 |
| list[].status | string | 用户状态：'0'=停用，'1'=启用 |
| total | number | 总用户数 |

**使用场景**：
- 角色详情页查看"哪些用户拥有此角色"
- 调整角色权限前，评估影响范围
- 角色停用前，确认受影响用户

**业务规则**：
| 规则 | 说明 |
|------|------|
| 包含停用用户 | 列表包含所有关联用户，包括已停用的 |
| 关联时间排序 | 默认按关联时间倒序排列 |
| 权限影响提示 | 角色详情页显示"此角色已分配给XX位用户" |

## 3. 接口设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/system/roles/list | GET | 获取角色列表 |
| /api/system/roles/:id | GET | 获取角色详情 |
| /api/system/role | POST | 创建角色 |
| /api/system/roles/:id | PUT | 更新角色 |
| /api/system/roles/:id | DELETE | 删除角色 |
| /api/system/roles/:id/status | PUT | 修改角色状态 |
| /api/system/roles/:id/users | GET | 获取角色下的用户列表 |

## 4. 权限授权设计

### 4.1 授权方式

角色与权限的关联采用 **JSON字段存储** 方案，在 `t_roles` 表的 `permission` 字段中存储权限配置。

**选择JSON方案的理由**：
1. **数据简单** - 仅需存储权限列表，无需额外属性
2. **查询高效** - 单表查询，无需JOIN关联表
3. **维护方便** - 编辑角色时直接修改JSON，一次事务完成
4. **易于扩展** - 如需存储权限类型，可扩展为对象数组

### 4.2 数据结构

```json
{
  "modules": ["module-id-1", "module-id-2"],
  "actions": ["sys.roles.view", "sys.roles.create", "sys.users.view"],
  "permissions": ["perm-id-1", "perm-id-2"]
}
```

**字段说明**：
| 属性 | 类型 | 说明 | 来源 |
|------|------|------|------|
| modules | string[] | 功能模块ID列表 | t_modules 表中 type=function 的节点 |
| actions | string[] | 操作权限码列表 | t_modules 表中 type=action 的 auth_code |
| permissions | string[] | 权限ID列表 | t_permission 表中的 sid |

**权限码格式**：`{module_code}.{action_code}`
- 例如：`sys.roles.create` 表示角色管理模块的新增权限
- 例如：`sys.users.view` 表示用户管理模块的查看权限

### 4.3 授权流程

```
管理员创建/编辑角色
    ↓
从权限树中选择要授权的模块（支持多选）
    ↓
系统将选中的权限信息存入 permission JSON字段
    ↓
用户登录时，系统查询用户角色
    ↓
解析 permission 字段获取权限列表
    ↓
返回用户可见的菜单和可操作的功能
```

### 4.4 权限查询

**查询角色的权限列表**：
```sql
SELECT permission FROM t_roles WHERE sid = 'role-id-xxx';
```

**查询用户的所有权限**（通过角色）：
```sql
-- 获取用户的角色列表
SELECT role_id FROM r_user_role WHERE user_id = 'user-id-xxx';

-- 获取这些角色的所有权限（JSON合并）
SELECT permission FROM t_roles 
WHERE sid IN (SELECT role_id FROM r_user_role WHERE user_id = 'user-id-xxx')
  AND status = '1';
```

**查询拥有某权限的所有角色**：
```sql
SELECT * FROM t_roles 
WHERE JSON_CONTAINS(permission->'$.actions', '"sys.roles.view"')
  AND status = '1'
  AND deleted = 0;
```

### 4.5 权限校验逻辑

```typescript
// 伪代码：校验用户是否有某权限
function hasPermission(userId: string, actionCode: string): boolean {
  // 1. 获取用户的所有角色
  const roles = getUserRoles(userId);
  
  // 2. 遍历角色，检查permission字段
  for (const role of roles) {
    if (role.status === '0') continue; // 跳过停用角色
    
    const permission = JSON.parse(role.permission || '{}');
    if (permission.actions?.includes(actionCode)) {
      return true;
    }
  }
  
  return false;
}
```

## 5. 数据库设计

- [角色管理表](./database/t_roles.md)

## 6. 数据类型说明

### 6.1 status 字段

| 值 | 含义 |
|----|------|
| '0' | 停用 |
| '1' | 启用 |

**注意**：status 字段实际为 VARCHAR(20) 类型。

### 6.2 permission JSON字段

角色对象中的 `permission` 字段存储权限配置：
```json
{
  "modules": ["module-id-1", "module-id-2"],
  "actions": ["sys.roles.view", "sys.roles.create"],
  "permissions": ["perm-id-1"]
}
```

### 6.3 title 多语言key

用于前端多语言显示：
- 存储值如：`system.roles.admin`、`system.roles.user`
- 前端通过 `$t(title)` 获取本地化显示文本

## 7. 关联文档

- [系统管理模块索引](./README.md)
- [用户管理表](./database/t_users.md)
- [用户角色关联表](./database/r_user_roles.md)
- [模块管理表](./database/t_modules.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
