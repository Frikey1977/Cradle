# 模块管理设计

## 更新记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v2.0 | 2026-02-18 | 以实际数据库和代码实现为准更新文档，修正字段名和类型差异 |
| v1.0 | - | 初始版本 |

## 1. 模块概述

### 1.1 功能定位
模块管理是系统权限控制的基础模块，用于定义和管理系统的功能模块/菜单结构，支持多级嵌套，为角色权限分配提供基础数据。

### 1.2 核心价值
- **菜单结构管理**: 定义系统的导航菜单结构，支持多级嵌套
- **权限控制基础**: 通过模块定义权限点，实现细粒度权限控制
- **动态配置**: 支持动态添加、修改、删除模块，无需修改代码
- **前端路由映射**: 模块与前端路由、组件映射，支持灵活配置

### 1.3 使用场景
- **场景1**: 新增功能模块时，在模块管理中注册，自动显示在菜单中
- **场景2**: 调整菜单结构时，通过拖拽或修改父模块实现层级调整
- **场景3**: 控制功能权限时，通过模块的权限标识控制访问
- **场景4**: 配置外部链接时，创建链接类型的模块，嵌入第三方系统

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 模块列表 | 树形展示模块结构，支持展开/折叠 |
| 创建模块 | 创建新模块，设置基本信息和路由配置 |
| 编辑模块 | 修改模块信息和配置 |
| 删除模块 | 删除模块（逻辑删除），有子模块时禁止删除 |
| 启用/停用 | 控制模块的可用状态 |
| 排序调整 | 调整模块在同级中的显示顺序 |
| 权限配置 | 设置模块的权限标识 |

### 2.2 模块类型

| 类型 | 说明 | 典型用途 |
|------|------|----------|
| module | 模块 | 顶层容器，包含子模块，如"系统管理" |
| function | 功能 | 独立功能页面，如"用户管理" |
| action | 动作 | 操作权限点，如"新增"、"删除"按钮权限 |
| embedded | 内嵌 | iframe 内嵌页面，如嵌入报表系统 |
| link | 外链 | 外部链接，如跳转到文档站点 |

### 2.3 业务流程

#### 2.3.1 创建模块

**流程说明**：
1. 选择模块类型（模块/功能/动作/内嵌/外链）
2. 选择父模块（可选，不选则为顶级模块，pid='0'）
3. 输入模块名称（路由名）
4. 输入显示标题（支持 i18n key）
5. 配置路由路径（功能类型必填）
6. 配置组件路径（功能类型必填）
7. 设置权限标识
8. 配置其他属性（图标、排序、缓存等，通过 meta JSON 字段）
9. 提交创建

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 模块名称，路由名，如"user-management" |
| title | string | 否 | 显示标题，如"用户管理"或 i18n key |
| type | string | 否 | 模块类型: module/function/action/embedded/link，默认'function' |
| pid | string | 否 | 父模块ID，为空或'0'则为顶级模块 |
| path | string | 否 | 路由路径，功能/内嵌/外链类型必填 |
| component | string | 否 | 组件路径，功能类型必填 |
| icon | string | 否 | 图标，Iconify格式，如"lucide:user" |
| sort | number | 否 | 排序序号，默认0 |
| authCode | string | 否 | 权限标识，如"system:user:view" |
| status | string | 否 | 状态：'0'=停用，'1'=启用，默认'1' |
| meta | object | 否 | 扩展元数据，包含 keepAlive、affixTab、badge 等 |

**⚠️ 注意**：status 字段为 VARCHAR 类型，值为 '0' 或 '1'，而非数字。

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| sid | string | 模块ID（UUID） |
| name | string | 模块名称 |
| title | string | 显示标题 |
| type | string | 模块类型 |
| pid | string | 父模块ID |
| path | string | 路由路径 |
| status | string | 状态 |
| create_time | string | 创建时间 |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 模块名称重复 | 返回错误：模块名称已存在 |
| 父模块不存在 | 返回错误：父模块不存在 |
| 父模块类型不匹配 | 返回错误：动作类型不能作为父模块 |
| 必填字段缺失 | 返回错误：XX字段不能为空 |

#### 2.3.2 查询模块列表

**流程说明**：
1. 以树形结构返回所有模块
2. 支持按状态筛选
3. 支持按类型筛选
4. 返回完整的层级结构

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | string | 否 | 状态筛选，'0'=停用，'1'=启用 |
| type | string | 否 | 类型筛选 |
| keyword | string | 否 | 关键词搜索（匹配 name、title、auth_code） |

**输出结果**：
```typescript
interface ModuleTree {
  sid: string;
  name: string;
  title: string;
  type: string;
  status: string;
  sort: number;
  pid: string;
  children?: ModuleTree[];
  // ... 其他字段
}
```

#### 2.3.3 编辑模块

**流程说明**：
1. 根据ID查询模块详情
2. 修改模块信息
3. 检查父模块变更是否形成循环依赖
4. 提交更新

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sid | string | 是 | 模块ID |
| name | string | 否 | 模块名称 |
| title | string | 否 | 显示标题 |
| type | string | 否 | 模块类型 |
| pid | string | 否 | 父模块ID |
| path | string | 否 | 路由路径 |
| component | string | 否 | 组件路径 |
| icon | string | 否 | 图标 |
| sort | number | 否 | 排序序号 |
| authCode | string | 否 | 权限标识 |
| status | string | 否 | 状态 |
| meta | object | 否 | 扩展元数据 |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 模块不存在 | 返回错误：模块不存在 |
| 形成循环依赖 | 返回错误：不能将模块设置为其子模块的后代 |
| 有子模块时变更类型为action | 返回错误：有子模块的模块不能变更为动作类型 |

#### 2.3.4 删除模块

**流程说明**：
1. 检查模块是否存在
2. 检查是否有子模块
3. 检查是否被角色引用
4. 执行逻辑删除（deleted = 1）

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sid | string | 是 | 模块ID |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 模块不存在 | 返回错误：模块不存在 |
| 有子模块 | 返回错误：请先删除子模块 |
| 被角色引用 | 返回错误：该模块已被角色使用，无法删除 |

#### 2.3.5 启用/停用模块

**流程说明**：
1. 切换模块的状态字段（'0' 或 '1'）
2. 停用父模块时，自动停用所有子模块
3. 启用子模块时，自动启用所有父模块

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sid | string | 是 | 模块ID |
| status | string | 是 | 状态：'0'=停用，'1'=启用 |
| cascade | boolean | 否 | 是否级联操作子模块 |

### 2.4 模块元数据配置

#### 2.4.1 扩展属性（存储在 meta JSON 字段中）

| 属性名 | 类型 | 说明 |
|--------|------|------|
| keepAlive | boolean | 是否缓存页面 |
| affixTab | boolean | 是否固定标签页 |
| hideInMenu | boolean | 是否在菜单中隐藏 |
| badge | string | 徽标内容 |
| badgeType | string | 徽标类型：dot/normal |
| badgeVariants | string | 徽标变体 |
| iframeSrc | string | iframe 内嵌地址 |
| link | string | 外部链接地址 |
| redirect | string | 重定向路径 |
| visibleForbidden | boolean | 无权限时是否可见 |
| authority | string[] | 额外权限控制（JSON数组） |

**⚠️ 注意**：以上字段在数据库设计 v1.0 中为独立字段，现已统一迁移至 meta JSON 字段中。

#### 2.4.2 权限控制

**权限标识格式**：
```
系统标识:模块标识:操作标识

示例：
- system:user:view    // 查看用户
- system:user:create  // 创建用户
- system:user:update  // 更新用户
- system:user:delete  // 删除用户
```

## 3. 接口设计

### 3.1 RESTful API

> **⚠️ 注意事项**：RESTful API 设计中应避免使用 `list` 作为资源名称，列表查询应使用根路径 `GET /api/system/{resource}`，如 `GET /api/system/module`。

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/system/module | GET | 获取模块列表（树形） |
| /api/system/module | POST | 创建模块 |
| /api/system/module/:sid | GET | 获取模块详情 |
| /api/system/module/:sid | PUT | 更新模块 |
| /api/system/module/:sid | DELETE | 删除模块 |
| /api/system/module/:sid/status | PUT | 修改模块状态 |
| /api/system/module/check-name | GET | 检查模块名称是否存在 |
| /api/system/module/check-path | GET | 检查模块路径是否存在 |

### 3.2 接口详细说明

#### 获取模块树

**请求**：
```http
GET /api/system/module?status=1
```

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "sid": "mod-001",
      "name": "system",
      "title": "系统管理",
      "type": "module",
      "icon": "lucide:settings",
      "sort": 1,
      "status": "1",
      "pid": "0",
      "children": [
        {
          "sid": "mod-002",
          "name": "users",
          "title": "用户管理",
          "type": "function",
          "path": "/system/users",
          "component": "system/users/index",
          "icon": "lucide:users",
          "authCode": "system:user:view",
          "sort": 1,
          "status": "1",
          "pid": "mod-001"
        }
      ]
    }
  ]
}
```

#### 创建模块

**请求**：
```http
POST /api/system/module
Content-Type: application/json

{
  "name": "roles",
  "title": "角色管理",
  "type": "function",
  "pid": "mod-001",
  "path": "/system/roles",
  "component": "system/roles/index",
  "icon": "lucide:user-cog",
  "authCode": "system:role:view",
  "sort": 2,
  "status": "1",
  "meta": {
    "keepAlive": true,
    "affixTab": false
  }
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "sid": "mod-003",
    "name": "roles",
    "title": "角色管理",
    "type": "function",
    "pid": "mod-001",
    "path": "/system/roles",
    "component": "system/roles/index",
    "icon": "lucide:user-cog",
    "authCode": "system:role:view",
    "sort": 2,
    "status": "1",
    "create_time": "2026-01-15T10:30:00Z"
  }
}
```

## 4. 数据库设计

- [模块管理表](./database/t_modules.md)

**⚠️ 重要变更说明**：

| 变更项 | 原设计 | 实际实现 | 影响 |
|--------|--------|---------|------|
| 父模块字段 | parent_id | pid | 代码中使用 pid |
| 状态字段类型 | TINYINT | VARCHAR(20) | 状态值用字符串 '0'/'1' |
| 扩展字段 | 独立字段（redirect, keep_alive 等） | 统一存储在 meta JSON 中 | 简化表结构 |

## 5. 前端集成

### 5.1 路由生成

根据模块配置动态生成前端路由：

```typescript
// 将模块树转换为路由配置
function generateRoutes(modules: SystemModule[]): RouteRecordRaw[] {
  return modules.map(module => {
    const route: RouteRecordRaw = {
      path: module.path,
      name: module.name,
      component: loadComponent(module.component),
      meta: {
        title: module.title,
        icon: module.icon,
        keepAlive: module.meta?.keepAlive,
        affixTab: module.meta?.affixTab,
        auth: module.authCode
      }
    };
    
    if (module.children?.length) {
      route.children = generateRoutes(module.children);
    }
    
    return route;
  });
}
```

### 5.2 菜单生成

根据模块配置生成导航菜单：

```typescript
// 将模块树转换为菜单配置
function generateMenus(modules: SystemModule[]): MenuOption[] {
  return modules
    .filter(m => m.status === '1' && !m.meta?.hideInMenu)
    .sort((a, b) => a.sort - b.sort)
    .map(module => {
      const menu: MenuOption = {
        label: module.title,
        key: module.name,
        icon: renderIcon(module.icon),
        path: module.path
      };
      
      if (module.children?.length) {
        menu.children = generateMenus(module.children);
      }
      
      return menu;
    });
}
```

### 5.3 权限控制

在路由守卫中进行权限检查：

```typescript
router.beforeEach((to, from, next) => {
  const authCode = to.meta?.auth;
  
  if (authCode) {
    const hasPermission = userStore.permissions.includes(authCode);
    if (!hasPermission) {
      next('/403');
      return;
    }
  }
  
  next();
});
```

## 6. 代码实现参考

### 6.1 类型定义（types.ts）

```typescript
export interface SystemModule {
  sid: string;
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid: string;
  status: string;
  sort: number;
  meta?: any;
  authCode?: string;
  icon?: string;
  createTime?: Date;
  deleted: number;
  children?: SystemModule[];
}

export interface CreateModuleDto {
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid?: string;
  status?: string;
  sort?: number;
  meta?: object;
  authCode?: string;
  icon?: string;
}
```

### 6.2 服务层实现（service.ts）

```typescript
// 解析 meta 字段
function parseMeta(row: any): any {
  if (row.meta && typeof row.meta === "string") {
    try {
      return JSON.parse(row.meta);
    } catch {
      return {};
    }
  }
  return row.meta || {};
}

// 创建模块
export async function createModule(data: CreateModuleDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_modules (sid, name, title, type, path, component, pid, status, sort, meta, auth_code, icon, deleted, create_time, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.title || data.name,
      data.type || "function",
      data.path || "",
      data.component || "",
      data.pid || "0",
      data.status ?? "1",
      data.sort ?? 0,
      data.meta ? JSON.stringify(data.meta) : null,
      data.authCode || "",
      data.icon || "",
    ],
  );

  return sid;
}
```

## 7. 关联文档

- [系统管理模块索引](./README.md)
- [模块管理表](./database/t_modules.md)
- [角色管理设计](../organization/roles.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
