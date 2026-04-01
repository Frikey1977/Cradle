# 部门管理设计

## 1. 模块概述

### 1.1 功能定位

部门管理是企业组织架构的基础模块，负责维护企业的部门组织树。以公司为根节点，支持多级组织层级（分支机构、部门、班组），为员工管理提供组织架构基础。

### 1.2 核心价值

- **组织架构可视化**：清晰展示企业层级结构
- **灵活扩展**：支持多层级、多类型的组织架构
- **员工管理基础**：为员工分配所属部门
- **权限控制依据**：基于部门的权限分配

## 2. 部门架构设计

### 2.1 部门类型

| 类型 | 说明 | 层级 | 示例 |
|------|------|------|------|
| **company** | 公司/总部 | 0（根节点） | 示例科技有限公司 |
| **branch** | 分支机构 | 1 | 北京分公司、上海办事处 |
| **departments** | 部门 | 2 | 技术部、人事部、财务部 |
| **group** | 班组/小组 | 3+ | 后端开发组、销售一组 |

### 2.2 部门架构示例

```
示例科技有限公司（company）
├── 北京分公司（branch）
│   ├── 技术部（departments）
│   │   ├── 后端开发组（group）
│   │   ├── 前端开发组（group）
│   │   └── 测试组（group）
│   ├── 人事部（departments）
│   └── 财务部（departments）
├── 上海分公司（branch）
│   ├── 技术部（departments）
│   └── 销售部（departments）
└── 广州办事处（branch）
    └── 销售部（departments）
```

### 2.3 树形存储方案

采用**路径枚举（Path Enumeration）**方案存储树形结构：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **路径枚举** | 查询子树快（LIKE查询）、实现简单 | 路径长度有限制、移动节点需更新路径 |
| 嵌套集 | 查询快、无层级限制 | 插入删除慢、实现复杂 |
| 闭包表 | 查询快、灵活 | 需要额外表、存储空间大 |

**选择路径枚举方案**，理由：
1. 组织架构相对稳定，不频繁变动
2. 查询子树场景多（如查询某部门下所有员工）
3. 实现简单，易于维护

### 2.4 路径设计

```
根节点：path = '/'
一级节点：path = '/根节点ID/'
二级节点：path = '/根节点ID/一级节点ID/'
三级节点：path = '/根节点ID/一级节点ID/二级节点ID/'
```

**示例**：
| 组织 | path | 说明 |
|------|------|------|
| 总公司 | `/` | 根节点 |
| 北京分公司 | `/org-001/` | 一级节点 |
| 技术部 | `/org-001/org-002/` | 二级节点 |
| 后端组 | `/org-001/org-002/org-003/` | 三级节点 |

## 3. 功能列表

| 功能 | 说明 |
|------|------|
| 部门创建 | 创建公司、分支机构、部门、班组 |
| 部门编辑 | 修改部门信息、调整层级 |
| 部门删除 | 软删除部门（需检查是否有子部门或员工） |
| 部门查询 | 树形结构查询、扁平列表查询 |
| 部门移动 | 调整部门的父节点（变更隶属关系） |
| 负责人设置 | 设置部门负责人 |

## 4. 业务规则

### 4.1 创建规则

- 公司（company）只能是根节点，parent_id 为 NULL
- 分支机构（branch）的父节点必须是公司
- 部门（departments）的父节点可以是公司或分支机构
- 班组（group）的父节点必须是部门
- 部门编码（code）全局唯一

### 4.2 删除规则

- 有子部门的部门不能删除
- 有员工的部门不能删除
- 删除为软删除（deleted = 1）

### 4.3 移动规则

- 不能移动到自己的子树下（避免循环引用）
- 移动后需更新 path 和 level
- 移动后所有子节点的 path 和 level 需同步更新

## 5. 接口设计

### 5.1 路由列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments` | 部门列表（扁平） |
| GET | `/api/departments/tree` | 部门树形结构 |
| GET | `/api/departments/:id` | 部门详情 |
| POST | `/api/departments` | 创建部门 |
| PUT | `/api/departments/:id` | 更新部门 |
| DELETE | `/api/departments/:id` | 删除部门 |
| PUT | `/api/departments/:id/move` | 移动部门 |

> **变更记录**：2025-02-19 将 API 路径从 `/api/org` 改为 `/api/departments`（复数形式），以符合 RESTful 规范。

### 5.2 接口定义

#### 创建部门

```typescript
// Request
POST /api/departments
Content-Type: application/json

{
  "name": "技术部",           // 部门名称
  "title": "org.departments.tech.name", // 翻译键（可选）
  "code": "DEPT-TECH",        // 部门编码（唯一）
  "type": "departments",             // 部门类型
  "parentId": "org-002",      // 父部门ID
  "sort": 1,                  // 排序
  "leaderId": "emp-001",      // 负责人ID（可选）
  "description": "负责产品研发" // 描述（可选）
}

// Response
{
  "code": 200,
  "data": {
    "id": "org-003",
    "name": "技术部",
    "title": "org.departments.tech.name",
    "code": "DEPT-TECH",
    "type": "departments",
    "parentId": "org-002",
    "path": "/org-001/org-002/",
    "level": 2,
    "sort": 1,
    "leaderId": "emp-001",
    "description": "负责产品研发"
  }
}
```

#### 获取部门树

```typescript
// Request
GET /api/departments/tree

// Response
{
  "code": 200,
  "data": [
    {
      "id": "org-001",
      "name": "示例科技有限公司",
      "type": "company",
      "children": [
        {
          "id": "org-002",
          "name": "北京分公司",
          "type": "branch",
          "children": [
            {
              "id": "org-003",
              "name": "技术部",
              "type": "departments",
              "children": [
                {
                  "id": "org-004",
                  "name": "后端开发组",
                  "type": "group"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### 移动部门

```typescript
// Request
PUT /api/departments/org-003/move
Content-Type: application/json

{
  "parentId": "org-005"  // 新的父部门ID
}

// Response
{
  "code": 200,
  "message": "移动成功"
}
```

## 6. 与员工管理的关系

### 6.1 关联方式

员工通过 `departments_id` 字段关联到部门：

```
t_employees
    └── departments_id → t_departments.sid
```

### 6.2 业务场景

| 场景 | 说明 |
|------|------|
| 员工入职 | 分配所属部门 |
| 员工调岗 | 变更 departments_id，可能涉及部门变更 |
| 部门查询 | 查询某部门下的所有员工 |
| 部门合并 | 需要处理员工的部门归属 |

### 6.3 查询示例

```sql
-- 查询技术部及其子部门的所有员工
SELECT e.* 
FROM t_employees e
INNER JOIN t_departments o ON e.departments_id = o.sid
WHERE o.path LIKE '/org-001/org-002/org-003/%'
  AND e.deleted = 0
  AND e.status = 1;
```

## 7. 数据表设计

- [部门架构表](./database/t_departments.md)

## 8. 关联文档

- [员工管理设计](./employee.md)
- [员工表](./database/t_employees.md)
- [Gateway 路由设计](../gateway/routing.md)
