# t_modules 模块管理表

## 更新记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v2.0 | 2026-02-18 | 以实际数据库为准更新文档，修正字段名和类型差异 |
| v1.0 | - | 初始版本 |

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_modules |
| 中文名 | 模块管理表 |
| 说明 | 存储系统模块/菜单的层级结构，支持多级嵌套 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 模块名称（路由名） |
| 3 | title | VARCHAR | 100 | NO | NULL | 显示标题（i18n key） |
| 4 | type | VARCHAR | 20 | NO | 'function' | 模块类型: module/function/action/embedded/link |
| 5 | path | VARCHAR | 200 | NO | NULL | 路由路径 |
| 6 | component | VARCHAR | 200 | NO | NULL | 组件路径 |
| 7 | pid | VARCHAR | 36 | NO | NULL | 父模块ID |
| 8 | sort | INT | - | NO | 0 | 排序序号 |
| 9 | deleted | TINYINT | - | NO | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 10 | status | VARCHAR | 20 | NO | '1' | 状态: 0=停用, 1=启用 |
| 11 | create_time | DATETIME | - | NO | CURRENT_TIMESTAMP | 创建时间 |
| 12 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 13 | meta | TEXT | - | NO | NULL | 扩展元数据（JSON） |
| 14 | auth_code | VARCHAR | 100 | NO | NULL | 权限标识 |
| 15 | icon | VARCHAR | 100 | NO | NULL | 图标（Iconify格式） |
| 16 | description | TEXT | - | NO | NULL | 模块描述 |

## ⚠️ 字段变更说明

### 与设计文档 v1.0 的差异

| 字段 | 原设计 | 实际数据库 | 变更类型 |
|------|--------|-----------|---------|
| pid | parent_id | pid | 字段名变更 |
| status | TINYINT DEFAULT 1 | VARCHAR(20) DEFAULT '1' | 类型变更 |
| redirect | VARCHAR(200) | 不存在 | 已移除 |
| iframe_src | VARCHAR(500) | 不存在 | 已移除 |
| keep_alive | TINYINT DEFAULT 0 | 不存在 | 已移除 |
| affix_tab | TINYINT DEFAULT 0 | 不存在 | 已移除 |
| badge | VARCHAR(50) | 不存在 | 已移除 |
| badge_type | VARCHAR(20) | 不存在 | 已移除 |
| badge_variants | VARCHAR(20) | 不存在 | 已移除 |
| visible_forbidden | TINYINT DEFAULT 0 | 不存在 | 已移除 |
| authority | TEXT | 不存在 | 已移除 |

**说明**：以上移除的字段功能已迁移至 `meta` JSON 字段中存储。

## 字段详细说明

### type 模块类型

| 值 | 含义 | 说明 | 示例 |
|----|------|------|------|
| module | 模块 | 顶层容器，包含子模块 | 系统管理、组织管理 |
| function | 功能 | 独立功能页面 | 角色管理、用户管理 |
| action | 动作 | 操作权限点（按钮级权限） | 新增、编辑、删除、查看 |
| embedded | 内嵌 | iframe 内嵌页面 | 报表页面 |
| link | 外链 | 外部链接 | 帮助文档 |

**三级权限结构**：
```
系统管理 (module)
├── 角色管理 (function)
│   ├── 查看 (action, auth_code=sys.roles.view)
│   ├── 新增 (action, auth_code=sys.roles.create)
│   ├── 编辑 (action, auth_code=sys.roles.update)
│   └── 删除 (action, auth_code=sys.roles.delete)
└── 用户管理 (function)
    ├── 查看 (action, auth_code=sys.users.view)
    └── ...
```

**权限码生成规则**：`{parent.auth_code}.{action_code}`
- 例如：sys.roles.create、sys.users.view

### status 状态

| 值 | 含义 |
|----|------|
| '0' | 停用 |
| '1' | 启用 |

**注意**：status 字段实际为 VARCHAR 类型，而非 TINYINT。

### meta 扩展元数据

JSON 格式存储的扩展配置，包含原设计文档中移除的字段功能：

```json
{
  "title": "菜单标题",
  "icon": "menu-icon",
  "hideInMenu": false,
  "keepAlive": true,
  "affixTab": false,
  "badge": "New",
  "badgeType": "normal",
  "badgeVariants": "primary",
  "iframeSrc": "https://example.com",
  "redirect": "/redirect/path",
  "visibleForbidden": false,
  "authority": ["permission1", "permission2"]
}
```

**meta 字段包含的原独立字段**：

| 原字段 | meta 中的属性 | 类型 | 说明 |
|--------|--------------|------|------|
| redirect | redirect | string | 重定向路径 |
| iframe_src | iframeSrc | string | iframe 内嵌地址 |
| keep_alive | keepAlive | boolean | 是否缓存页面 |
| affix_tab | affixTab | boolean | 是否固定标签页 |
| badge | badge | string | 徽标内容 |
| badge_type | badgeType | string | 徽标类型：dot/normal |
| badge_variants | badgeVariants | string | 徽标变体 |
| visible_forbidden | visibleForbidden | boolean | 无权限时是否可见 |
| authority | authority | array | 额外权限控制（JSON数组） |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| PRIMARY | sid | 主键 |
| idx_module_status | status | 普通索引 |
| idx_module_deleted | deleted | 普通索引 |
| idx_module_parent | pid | 普通索引 |
| idx_module_type | type | 普通索引 |

## SQL语句（以实际数据库为准）

```sql
CREATE TABLE `t_modules` (
  `sid` varchar(36) NOT NULL COMMENT '主键UUID',
  `name` varchar(200) NOT NULL COMMENT '模块名称（路由名）',
  `title` varchar(100) DEFAULT NULL COMMENT '显示标题（i18n key）',
  `type` varchar(20) DEFAULT 'function' COMMENT '模块类型: module/function/action/embedded/link',
  `path` varchar(200) DEFAULT NULL COMMENT '路由路径',
  `component` varchar(200) DEFAULT NULL COMMENT '组件路径',
  `pid` varchar(36) DEFAULT NULL COMMENT '父模块ID',
  `sort` int DEFAULT '0' COMMENT '排序序号',
  `deleted` tinyint DEFAULT '0' COMMENT '逻辑删除: 0=未删除, 1=已删除',
  `status` varchar(20) DEFAULT '1' COMMENT '状态: 0=停用, 1=启用',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
  `meta` text COMMENT '扩展元数据（JSON）',
  `auth_code` varchar(100) DEFAULT NULL COMMENT '权限标识',
  `icon` varchar(100) DEFAULT NULL COMMENT '图标（Iconify格式）',
  `description` text COMMENT '模块描述',
  PRIMARY KEY (`sid`),
  KEY `idx_module_status` (`status`),
  KEY `idx_module_deleted` (`deleted`),
  KEY `idx_module_parent` (`pid`),
  KEY `idx_module_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模块管理表';
```

## 前端类型对应

```typescript
interface SystemModule {
  sid: string;
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid: string;
  status: string;
  sort: number;
  meta?: {
    title?: string;
    icon?: string;
    hideInMenu?: boolean;
    keepAlive?: boolean;
    affixTab?: boolean;
    badge?: string;
    badgeType?: 'dot' | 'normal';
    badgeVariants?: string;
    iframeSrc?: string;
    link?: string;
    redirect?: string;
    visibleForbidden?: boolean;
    authority?: string[];
  };
  authCode?: string;
  icon?: string;
  createTime?: Date;
  deleted: number;
  children?: SystemModule[];
}
```

## 关联文档

- [系统管理模块](../README.md)
- [模块管理设计文档](../module.md)
- [代码管理表](./t_codes.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
