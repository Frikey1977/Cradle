# Cradle 详细设计规范文档

## 目录

1. [概述](#1-概述)
2. [模块设计原则](#2-模块设计原则)
3. [后端详细设计规范](#3-后端详细设计规范)
4. [前端详细设计规范](#4-前端详细设计规范)
5. [代码管理规范](#5-代码管理规范)
6. [路由配置规范](#6-路由配置规范)
7. [测试规范](#7-测试规范)
8. [示例：组织架构模块](#8-示例组织架构模块)

---

## 1. 概述

### 1.1 文档目的

本文档定义 Cradle 平台的详细设计规范，用于指导新模块的设计和开发，确保系统的一致性、可维护性和可扩展性。

### 1.2 设计原则

1. **配置优先**：所有选项、状态、枚举值通过代码管理模块配置，禁止硬编码
2. **数据驱动路由**：所有路由配置存储于数据库，非本地硬编码路由
3. **统一界面风格**：保持一致的UI风格和操作逻辑
4. **完整测试覆盖**：每个模块必须包含测试数据脚本和测试用例

---

## 2. 模块设计原则

### 2.1 配置优先原则

#### 2.1.1 代码管理配置

系统中所有的选项、状态、类型等必须通过 `system/codes` 模块进行配置管理：

```typescript
// ❌ 错误：硬编码选项
const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' }
];

// ✅ 正确：从代码管理获取
const options = await getCodeOptionsByParentValue("system.status");
```

#### 2.1.2 配置层级规范

代码配置使用层级路径管理，格式：`{module}.{function}.{type}`

| 层级 | 说明 | 示例 |
|------|------|------|
| 模块级 | 系统模块命名空间 | `system`, `organization`, `llm` |
| 功能级 | 模块内功能点 | `codes`, `departments`, `instances` |
| 类型级 | 具体配置类型 | `type`, `status`, `billing` |

**示例配置路径**：
- `system.codes.type` - 代码类型配置
- `organization.departments.type` - 组织架构类型配置
- `llm.instances.billing` - LLM实例计费类型配置

### 2.2 数据驱动路由原则

#### 2.2.1 路由配置存储

所有菜单路由通过 `system/modules` 模块配置，存储于 `t_modules` 表：

```sql
-- 路由配置表示例
INSERT INTO t_modules (sid, name, title, type, path, component, pid, status, sort, auth_code, icon) 
VALUES (
  'mod-org-001',
  '组织架构管理',
  'organization.departments.moduleName',
  'menu',
  '/organization/departments',
  '/organization/departments/list.vue',
  'parent-module-id',
  1,
  10,
  'org:departments:view',
  'carbon:organization'
);
```

#### 2.2.2 路由字段规范

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 菜单显示名称（中文） | `组织架构管理` |
| `title` | 翻译键 | `organization.departments.moduleName` |
| `path` | 路由路径 | `/organization/departments` |
| `component` | 组件路径 | `/organization/departments/list.vue` |
| `auth_code` | 权限码 | `org:departments:view` |
| `icon` | 图标标识 | `carbon:organization` |

---

## 3. 后端详细设计规范

### 3.1 模块目录结构

```
src/{module}/{submodule}/
├── index.ts              # 模块入口，统一导出
├── service.ts            # 业务逻辑层
├── schema.ts             # Zod 验证Schema
├── types.ts              # TypeScript类型定义
└── constants.ts          # 模块常量（可选）
```

### 3.2 类型定义规范

#### 3.2.1 实体接口定义

```typescript
// types.ts
export interface Organization {
  sid: string;                    // 主键，UUID格式
  name: string;                   // 显示名称
  eName?: string;                 // 英文名称（国际化）
  title?: string;                 // 翻译键
  code: string;                   // 业务编码
  type: string;                   // 类型（代码配置）
  status: string;                 // 状态（代码配置）
  parentId: string | null;        // 父级ID（树形结构）
  path: string;                   // 路径（树形结构）
  sort: number;                   // 排序
  createTime?: string;            // 创建时间
  children?: Organization[];      // 子节点（树形）
}
```

#### 3.2.2 DTO定义规范

```typescript
// 创建DTO - 必填字段不带?
export interface CreateOrgDto {
  name: string;
  code: string;
  type: string;
  eName?: string;
  title?: string;
  parentId?: string;
  sort?: number;
  status?: string;
}

// 更新DTO - 所有字段可选
export interface UpdateOrgDto {
  name?: string;
  code?: string;
  type?: string;
  // ... 所有字段可选
}

// 查询参数
export interface OrgQuery {
  type?: string;
  status?: number;
  keyword?: string;
}
```

### 3.3 验证Schema规范

```typescript
// schema.ts
import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(1, "组织名称不能为空"),
  code: z.string().min(1, "组织编码不能为空"),
  type: z.string().min(1, "组织类型不能为空"),
  parentId: z.string().optional(),
  sort: z.number().default(0),
  status: z.string().default("enabled"),
});

export const updateOrgSchema = createOrgSchema.partial();
```

### 3.4 服务层规范

#### 3.4.1 基础CRUD方法命名

| 操作 | 方法名 | 返回类型 |
|------|--------|----------|
| 列表查询 | `get{Entity}List` | `Promise<Entity[]>` |
| 树形查询 | `get{Entity}Tree` | `Promise<Entity[]>` |
| 单条查询 | `get{Entity}ById` | `Promise<Entity \| null>` |
| 创建 | `create{Entity}` | `Promise<string>` // 返回sid |
| 更新 | `update{Entity}` | `Promise<void>` |
| 删除 | `delete{Entity}` | `Promise<void>` |
| 检查存在 | `is{Field}Exists` | `Promise<boolean>` |

#### 3.4.2 服务层代码模板

```typescript
// service.ts
import { query, run } from "../../store/database.js";
import { generateUUID, buildTree } from "../../shared/utils.js";
import type { Organization, CreateOrgDto, UpdateOrgDto } from "./types.js";

/**
 * 获取组织架构树
 */
export async function getOrgTree(queryParams: OrgQuery): Promise<Organization[]> {
  const { type, status } = queryParams;
  
  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];
  
  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }
  
  const rows = await query<Organization[]>(
    `SELECT sid, name, code, type, parent_id as parentId, ...
     FROM t_departments
     ${whereClause}
     ORDER BY sort ASC, create_time ASC`,
    params
  );
  
  return buildTree(rows, {
    idField: "sid",
    pidField: "parentId",
    childrenField: "children",
  });
}

/**
 * 创建组织架构
 */
export async function createOrg(data: CreateOrgDto): Promise<string> {
  const sid = generateUUID();
  
  // 计算树形路径
  let path = "/";
  if (data.parentId) {
    const parent = await query<[{ path: string }]>(
      "SELECT path FROM t_departments WHERE sid = ?",
      [data.parentId]
    );
    if (parent.length > 0) {
      path = `${parent[0].path}${data.parentId}/`;
    }
  }
  
  await run(
    `INSERT INTO t_departments (sid, name, code, type, parent_id, path, ...)
     VALUES (?, ?, ?, ?, ?, ?, ...)`,
    [sid, data.name, data.code, data.type, data.parentId || null, path, ...]
  );
  
  return sid;
}
```

### 3.5 路由层规范

#### 3.5.1 路由文件位置

```
src/gateway/routes/{module}.ts
```

#### 3.5.2 路由注册规范

```typescript
// src/gateway/routes/departments.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, validationErrorResponse } from "../shared/response.js";

export default async function departmentsRoutes(fastify: FastifyInstance) {
  // 获取树形列表
  fastify.get("/tree", async (request, reply) => {
    const tree = await getOrgTree(request.query);
    return successResponse(reply, tree, "获取成功");
  });
  
  // 获取详情
  fastify.get("/:sid", async (request, reply) => {
    const org = await getOrgById(request.params.sid);
    if (!org) {
      return notFoundResponse(reply, "组织不存在");
    }
    return successResponse(reply, org, "获取成功");
  });
  
  // 创建
  fastify.post("/", async (request, reply) => {
    // 验证数据
    const result = createOrgSchema.safeParse(request.body);
    if (!result.success) {
      return validationErrorResponse(reply, result.error.errors[0]?.message);
    }
    
    // 业务校验...
    
    const sid = await createOrg(request.body);
    return successResponse(reply, { sid }, "创建成功");
  });
}
```

#### 3.5.3 标准路由列表

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 获取列表（分页） |
| `/tree` | GET | 获取树形列表 |
| `/all` | GET | 获取全部（不分页） |
| `/:id` | GET | 获取详情 |
| `/` | POST | 创建 |
| `/:id` | PUT | 更新 |
| `/:id` | DELETE | 删除 |
| `/{field}-exists` | GET | 检查字段是否存在 |

---

## 4. 前端详细设计规范

### 4.1 页面目录结构

```
web/playground/src/views/{module}/{submodule}/
├── list.vue              # 列表页面
├── modules/
│   └── form.vue          # 表单弹窗
└── data.ts               # 页面配置数据
```

### 4.2 API层规范

```typescript
// web/playground/src/api/{module}/{submodule}.ts
import { request } from "#/api/request";

export interface OrganizationApi {
  interface Organization {
    sid: string;
    name: string;
    // ...
  }
}

// 获取树形列表
export function getOrgTree(params?: OrgQuery) {
  return request<OrganizationApi.Organization[]>({
    url: "/departments/tree",
    method: "GET",
    params,
  });
}

// 创建
export function createOrg(data: CreateOrgDto) {
  return request<{ sid: string }>({
    url: "/departments",
    method: "POST",
    data,
  });
}
```

### 4.3 页面配置数据规范

#### 4.3.1 data.ts 文件结构

```typescript
// data.ts
import type { VbenFormSchema } from "#/adapter/form";
import type { VxeTableGridOptions } from "#/adapter/vxe-table";
import { z } from "#/adapter/form";
import { $t } from "#/locales";
import { getCodeOptionsByParentValue } from "#/api/system/codes";

/**
 * 获取类型选项 - 从代码管理获取
 */
export async function getOrgTypeOptions() {
  return getCodeOptionsByParentValue("organization.departments.type");
}

/**
 * 生成翻译键
 * 格式：organization.department.{type}.{code}
 */
export function generateTitle(type: string, code: string): string {
  if (!type || !code) return "";
  const normalizedType = type.toLowerCase().replace(/\s+/g, "");
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  return `organization.department.${normalizedType}.${normalizedCode}`;
}

/**
 * 获取表单Schema
 */
export function useBasicInfoSchema(
  onTitleChange?: (type: string, code: string) => void,
  titleSuffix?: Ref<string | undefined>
): VbenFormSchema[] {
  return [
    {
      component: "ApiTreeSelect",
      componentProps: {
        api: getOrgTreeWithTranslation,
        labelField: "title",
        valueField: "sid",
        childrenField: "children",
      },
      fieldName: "parentId",
      label: $t("organization.departments.parent"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options: getOrgTypeOptions(), // 从代码管理获取
      },
      fieldName: "type",
      label: $t("organization.departments.type"),
      rules: "required",
    },
    // ... 更多字段
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationApi.Organization>
): VxeTableGridOptions["columns"] {
  return [
    {
      field: "name",
      title: $t("organization.departments.name"),
      treeNode: true,  // 树形表格
      width: 250,
    },
    {
      field: "type",
      title: $t("organization.departments.type"),
      cellRender: { 
        name: "CellTag", 
        options: getOrgTypeOptions()  // 从代码管理获取
      },
    },
    // ... 更多列
    {
      field: "operation",
      title: $t("organization.departments.operation"),
      cellRender: {
        name: "CellOperation",
        options: ["edit", "delete"],
      },
    },
  ];
}
```

### 4.4 列表页面规范

#### 4.4.1 树形列表页面模板

```vue
<!-- list.vue -->
<script lang="ts" setup>
import type { OnActionClickParams } from "#/adapter/vxe-table";
import { Page, useVbenModal } from "@vben/common-ui";
import { useVbenVxeGrid } from "#/adapter/vxe-table";
import { getOrgTree, deleteOrg } from "#/api/organization/departments";
import { useColumns } from "./data";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    proxyConfig: {
      ajax: {
        query: async () => {
          return await getOrgTree();
        },
      },
    },
    treeConfig: {
      parentField: "parentId",
      rowField: "sid",
      transform: false,
      expandAll: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  },
});

function onActionClick({ code, row }: OnActionClickParams) {
  switch (code) {
    case "edit":
      formModalApi.setData(row).open();
      break;
    case "delete":
      onDelete(row);
      break;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="gridApi.query()" />
    <Grid>
      <template #toolbar-tools>
        <Button type="primary" @click="formModalApi.open()">
          {{ $t("common.create") }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
```

### 4.5 表单页面规范

#### 4.5.1 表单弹窗模板

```vue
<!-- modules/form.vue -->
<script lang="ts" setup>
import { useVbenForm } from "#/adapter/form";
import { createOrg, updateOrg } from "#/api/organization/departments";
import { useBasicInfoSchema, generateTitle } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<OrganizationApi.Organization>();
const isNew = computed(() => !formData.value?.sid);

// 当前表单值缓存
const currentType = ref<string>("");
const currentCode = ref<string>("");
const titleSuffix = ref<string>();

/**
 * 处理 title 生成
 */
async function handleTitleChange(type: string, code: string) {
  if (type) currentType.value = type;
  if (code) currentCode.value = code;
  
  const title = generateTitle(currentType.value, currentCode.value);
  if (title) {
    await formApi.setFieldValue("title", title);
  }
}

const [Form, formApi] = useVbenForm({
  schema: useBasicInfoSchema(handleTitleChange, titleSuffix),
  showDefaultActions: false,
  handleSubmit: onSubmit,
});

async function onSubmit(values: Record<string, any>) {
  if (isNew.value) {
    await createOrg(values as CreateOrgDto);
  } else {
    await updateOrg(formData.value!.sid, values);
  }
  emit("success");
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<OrganizationApi.Organization>();
      if (data) {
        formData.value = data;
        formApi.setValues(data);
      }
    }
  },
});
</script>

<template>
  <Modal :title="isNew ? $t('common.create') : $t('common.edit')">
    <Form />
  </Modal>
</template>
```

---

## 5. 代码管理规范

### 5.1 代码配置结构

代码管理采用四级层级结构：**Module → Function → Project → Item**

```
system.codes                    # 根节点
├── system                      # Module: 系统模块
│   └── codes                   # Function: 代码管理功能
│       └── type                # Code: 代码类型项目
│           ├── module          # Item value: 模块类型
│           ├── function        # Item value: 功能类型
│           ├── code            # Item value: 代码类型
│           └── value           # Item value: 码值类型
│
├── organization                # Module: 组织模块
│   └── departments             # Function: 组织架构功能
│       └── type                # Code: 组织类型项目
│           ├── company         # Item value: 公司
│           ├── branch          # Item value: 分支机构
│           ├── departments     # Item value: 部门
│           └── group           # Item value: 小组
│
└── llm                         # Module: LLM模块
    └── instances               # Function: 实例管理功能
        └── billing             # Code: 计费类型项目
            ├── free            # Item value: 免费
            ├── usage           # Item value: 按量计费
            └── subscription    # Item value: 订阅制
```

### 5.2 代码类型（type字段）

| 类型 | 说明 | 层级 | 示例 |
|------|------|------|------|
| `module` | 模块 | 第1级 | `system`, `organization`, `llm` |
| `function` | 功能 | 第2级 | `codes`, `departments`, `instances` |
| `code` | 项目 | 第3级 | `type`, `status`, `billing` |
| `value` | 码值 | 第4级 | `company`, `enabled`, `free` |

### 5.3 代码配置字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 显示名称 | `公司` |
| `value` | 码值 | `company` |
| `title` | 翻译键 | `organization.departments.typeCompany` |
| `type` | 代码类型 | `module`/`function`/`code`/`value` |
| `parent_id` | 父级ID | 上级节点的sid |
| `icon` | 图标 | `carbon:enterprise` |
| `color` | 颜色 | `#1890ff` |
| `sort` | 排序 | `10` |
| `status` | 状态 | `enabled`/`disabled` |
| `metadata` | 扩展数据 | JSON格式 |

### 5.4 前端获取代码选项

通过 `getCodeOptionsByParentValue` 方法，使用 **Module.Function.Project** 路径获取 Item 级别的选项列表：

```typescript
// 获取组织架构类型选项（返回 company, branch, departments, group）
const options = await getCodeOptionsByParentValue("organization.departments.type");

// 获取技能来源选项
const options = await getCodeOptionsByParentValue("system.skills.source");

// 返回格式
[
  { 
    value: "company", 
    label: "公司", 
    title: "organization.departments.typeCompany",
    icon: "carbon:enterprise",
    color: "#ff4d4f",
    metadata: { ... }
  },
  // ...
]
```

### 5.5 代码配置示例

#### 组织架构类型配置

```sql
-- Module: organization
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort, status) VALUES
('code-org', '组织模块', 'organization', 'organization.moduleName', 'module', NULL, 'carbon:organization', NULL, 10, 'enabled');

-- Function: departments (parent_id = 'code-org')
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-org-dept', '组织架构', 'departments', 'organization.departments.moduleName', 'function', 'code-org', 'carbon:tree-view', 10, 'enabled');

-- Project: type (parent_id = 'code-org-dept')
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-org-dept-type', '组织类型', 'type', 'organization.departments.type', 'code', 'code-org-dept', 10, 'enabled');

-- Items: company, branch, departments, group (parent_id = 'code-org-dept-type')
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort, status) VALUES
('code-org-type-company', '公司', 'company', 'organization.departments.typeCompany', 'value', 'code-org-dept-type', 'carbon:enterprise', '#ff4d4f', 10, 'enabled'),
('code-org-type-branch', '分支机构', 'branch', 'organization.departments.typeBranch', 'value', 'code-org-dept-type', 'carbon:building', '#faad14', 20, 'enabled'),
('code-org-type-dept', '部门', 'departments', 'organization.departments.typeDept', 'value', 'code-org-dept-type', 'carbon:folder', '#1890ff', 30, 'enabled'),
('code-org-type-group', '小组', 'group', 'organization.departments.typeGroup', 'value', 'code-org-dept-type', 'carbon:group', '#52c41a', 40, 'enabled');
```

---

## 6. 路由配置规范

### 6.1 模块路由配置

```sql
-- 插入模块路由配置
INSERT INTO t_modules (sid, name, title, type, path, component, pid, status, sort, auth_code, icon) VALUES
-- 父菜单
('mod-org', '组织管理', 'organization.moduleName', 'catalog', '/organization', NULL, '', 1, 20, 'org:view', 'carbon:organization'),

-- 子菜单 - 组织架构
('mod-org-dept', '组织架构', 'organization.departments.moduleName', 'menu', '/organization/departments', '/organization/departments/list.vue', 'mod-org', 1, 10, 'org:departments:view', 'carbon:tree-view'),

-- 子菜单 - 岗位管理
('mod-org-position', '岗位管理', 'organization.positions.moduleName', 'menu', '/organization/positions', '/organization/positions/list.vue', 'mod-org', 1, 20, 'org:positions:view', 'carbon:user-activity');
```

### 6.2 权限码规范

格式：`{module}:{function}:{action}`

| 部分 | 说明 | 示例 |
|------|------|------|
| `module` | 模块标识 | `org`, `system`, `llm` |
| `function` | 功能标识 | `departments`, `users`, `instances` |
| `action` | 操作标识 | `view`, `create`, `update`, `delete` |

**示例权限码**：
- `org:departments:view` - 查看组织架构
- `org:departments:create` - 创建组织架构
- `system:users:update` - 更新用户

---

## 7. 测试规范

### 7.1 测试数据脚本

每个模块必须提供测试数据脚本，位于 `scripts/test-data/{module}.sql`：

```sql
-- scripts/test-data/organization.sql
-- 组织架构测试数据

-- 清除旧数据
DELETE FROM t_departments WHERE code LIKE 'TEST_%';

-- 插入测试数据
INSERT INTO t_departments (sid, name, code, type, parent_id, path, sort, status, create_time) VALUES
('test-dept-001', '测试总公司', 'TEST_COMPANY', 'company', NULL, '/', 1, 'enabled', datetime('now')),
('test-dept-002', '测试研发中心', 'TEST_RD', 'branch', 'test-dept-001', '/test-dept-001/', 1, 'enabled', datetime('now')),
('test-dept-003', '测试前端组', 'TEST_FE', 'departments', 'test-dept-002', '/test-dept-001/test-dept-002/', 1, 'enabled', datetime('now'));
```

### 7.2 测试用例规范

#### 7.2.1 后端测试

```typescript
// tests/organization/departments.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createOrg, getOrgById, deleteOrg } from "../../src/organization/departments/service";

describe("组织架构模块", () => {
  const testOrgId = "test-org-001";
  
  afterAll(async () => {
    // 清理测试数据
    await deleteOrg(testOrgId);
  });
  
  describe("创建组织架构", () => {
    it("应该成功创建组织架构", async () => {
      const sid = await createOrg({
        name: "测试部门",
        code: "TEST_DEPT",
        type: "departments",
        parentId: null,
      });
      
      expect(sid).toBeDefined();
      
      const org = await getOrgById(sid);
      expect(org).not.toBeNull();
      expect(org?.name).toBe("测试部门");
    });
    
    it("应该拒绝重复编码", async () => {
      await expect(createOrg({
        name: "测试部门2",
        code: "TEST_DEPT", // 重复编码
        type: "departments",
      })).rejects.toThrow("组织编码已存在");
    });
  });
  
  describe("树形结构", () => {
    it("应该正确构建树形结构", async () => {
      const tree = await getOrgTree({});
      expect(Array.isArray(tree)).toBe(true);
      
      // 检查是否有子节点
      const hasChildren = tree.some(node => node.children && node.children.length > 0);
      expect(hasChildren).toBe(true);
    });
  });
});
```

#### 7.2.2 前端测试

```typescript
// tests/organization/departments.data.test.ts
import { describe, it, expect } from "vitest";
import { generateTitle, getOrgTypeOptions } from "../../web/playground/src/views/organization/departments/data";

describe("组织架构数据配置", () => {
  describe("generateTitle", () => {
    it("应该正确生成翻译键", () => {
      const title = generateTitle("company", "headquarters");
      expect(title).toBe("organization.department.company.headquarters");
    });
    
    it("应该处理空值", () => {
      expect(generateTitle("", "code")).toBe("");
      expect(generateTitle("type", "")).toBe("");
    });
  });
  
  describe("getOrgTypeOptions", () => {
    it("应该返回类型选项", async () => {
      const options = await getOrgTypeOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
      
      // 检查选项格式
      const firstOption = options[0];
      expect(firstOption).toHaveProperty("value");
      expect(firstOption).toHaveProperty("label");
      expect(firstOption).toHaveProperty("title");
    });
  });
});
```

### 7.3 测试检查清单

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖主要业务流程
- [ ] 测试数据脚本可重复执行
- [ ] 测试后清理数据

---

## 8. 示例：组织架构模块

### 8.1 模块概述

组织架构模块实现企业组织架构的树形管理，支持多层级部门、岗位管理。

### 8.2 代码配置

```sql
-- 组织架构类型配置
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort) VALUES
('code-org-type-root', '组织架构类型', 'organization.departments.type', 'organization.codes.types.departments', 'module', NULL, 'carbon:tree-view', NULL, 10),
('code-org-type-company', '公司', 'company', 'organization.departments.typeCompany', 'code', 'code-org-type-root', 'carbon:enterprise', '#ff4d4f', 10),
('code-org-type-branch', '分支机构', 'branch', 'organization.departments.typeBranch', 'code', 'code-org-type-root', 'carbon:building', '#faad14', 20),
('code-org-type-dept', '部门', 'departments', 'organization.departments.typeDept', 'code', 'code-org-type-root', 'carbon:folder', '#1890ff', 30),
('code-org-type-group', '小组', 'group', 'organization.departments.typeGroup', 'code', 'code-org-type-root', 'carbon:group', '#52c41a', 40);
```

### 8.3 路由配置

```sql
-- 菜单路由配置
INSERT INTO t_modules (sid, name, title, type, path, component, pid, status, sort, auth_code, icon) VALUES
('mod-org', '组织管理', 'organization.moduleName', 'catalog', '/organization', NULL, '', 1, 20, 'org:view', 'carbon:organization'),
('mod-org-dept', '组织架构', 'organization.departments.moduleName', 'menu', '/organization/departments', '/organization/departments/list.vue', 'mod-org', 1, 10, 'org:departments:view', 'carbon:tree-view');
```

### 8.4 数据库表

```sql
-- 组织架构表
CREATE TABLE t_departments (
    sid VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL COMMENT '组织名称',
    e_name VARCHAR(200) COMMENT '英文名称',
    title VARCHAR(200) COMMENT '翻译键',
    code VARCHAR(100) NOT NULL UNIQUE COMMENT '组织编码',
    type VARCHAR(50) NOT NULL COMMENT '组织类型（代码配置）',
    parent_id VARCHAR(36) COMMENT '父级ID',
    path VARCHAR(500) COMMENT '路径',
    sort INT DEFAULT 0 COMMENT '排序',
    leader_id VARCHAR(36) COMMENT '负责人ID',
    description TEXT COMMENT '描述',
    culture TEXT COMMENT '企业文化',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 8.5 接口清单

| 接口 | 方法 | 说明 |
|------|------|------|
| `/departments/tree` | GET | 获取组织架构树 |
| `/departments` | GET | 获取组织架构列表 |
| `/departments/:sid` | GET | 获取组织架构详情 |
| `/departments` | POST | 创建组织架构 |
| `/departments/:sid` | PUT | 更新组织架构 |
| `/departments/:sid` | DELETE | 删除组织架构 |
| `/departments/:sid/move` | PUT | 移动组织架构 |
| `/departments/code-exists` | GET | 检查编码是否存在 |

### 8.6 测试数据脚本

```sql
-- scripts/test-data/organization.sql
-- 组织架构测试数据

-- 清除旧数据
DELETE FROM t_departments WHERE code LIKE 'TEST_%';

-- 插入测试数据
INSERT INTO t_departments (sid, name, e_name, title, code, type, parent_id, path, sort, status, create_time) VALUES
('test-dept-001', '测试总公司', 'Test Company', 'organization.department.test.company', 'TEST_COMPANY', 'company', NULL, '/', 1, 'enabled', datetime('now')),
('test-dept-002', '测试研发中心', 'Test R&D Center', 'organization.department.test.rd', 'TEST_RD', 'branch', 'test-dept-001', '/test-dept-001/', 1, 'enabled', datetime('now')),
('test-dept-003', '测试前端组', 'Test Frontend Team', 'organization.department.test.fe', 'TEST_FE', 'departments', 'test-dept-002', '/test-dept-001/test-dept-002/', 1, 'enabled', datetime('now')),
('test-dept-004', '测试后端组', 'Test Backend Team', 'organization.department.test.be', 'TEST_BE', 'departments', 'test-dept-002', '/test-dept-001/test-dept-002/', 2, 'enabled', datetime('now'));
```

### 8.7 翻译键配置

```json
// locales/zh-CN/organization.json
{
  "organization": {
    "moduleName": "组织管理",
    "departments": {
      "moduleName": "组织架构",
      "moduleDescription": "管理企业组织架构，支持多层级部门管理",
      "typeCompany": "公司",
      "typeBranch": "分支机构",
      "typeDept": "部门",
      "typeGroup": "小组",
      "name": "组织名称",
      "code": "组织编码",
      "type": "组织类型",
      "parent": "上级组织",
      "sort": "排序",
      "status": "状态",
      "description": "描述",
      "culture": "企业文化",
      "leader": "负责人",
      "operation": "操作"
    }
  }
}
```

---

## 9. 关联文档

- [系统设计规范](./DESIGN_SPECIFICATION.md)
- [数据库设计规范](./DATABASE_SPECIFICATION.md)
- [代码开发规范](./CODING_STANDARDS.md)
