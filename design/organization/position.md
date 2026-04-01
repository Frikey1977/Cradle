# 岗位管理设计

## 1. 功能定位

岗位管理定义企业中的岗位体系，用于描述人类员工的工作职责和数据访问范围。岗位可以定义在组织架构的任意层级，是人力资源管理的基础。

### 1.1 核心价值

- **职责定义**：明确岗位的工作内容和职责范围
- **数据隔离**：控制员工能够访问的数据范围
- **权限基础**：为数据权限控制提供依据
- **管理规范**：规范企业的人力资源管理

## 2. 岗位与组织的关系

### 2.1 岗位层级

岗位可以定义在组织架构的任意层级：

```
示例科技有限公司（company）
├── CEO（公司级岗位）
├── CTO（公司级岗位）
│
├── 北京分公司（branch）
│   ├── 分公司经理（分支机构级岗位）
│   │
│   └── 技术部（departments）
│       ├── 技术总监（部门级岗位）
│       ├── 后端开发组（group）
│       │   ├── 后端组长（班组级岗位）
│       │   └── Java工程师（班组级岗位）
│       └── 前端开发组（group）
│           └── 前端工程师（班组级岗位）
```

### 2.2 岗位定义规则

| 规则 | 说明 |
|------|------|
| **必填性** | 岗位必须关联到组织树的某个节点 |
| **唯一性** | 同一组织内岗位编码唯一 |

**管理方式**：
- 展开组织树，选择节点后查看/管理该节点下的岗位
- 岗位只能在其定义的组织节点下查看和管理

### 2.3 岗位作用域

| 岗位级别 | 作用范围 | 示例 |
|---------|---------|------|
| 公司级 | 全公司通用 | CEO、CFO、CTO |
| 分支机构级 | 特定分支机构 | 分公司经理、区域总监 |
| 部门级 | 特定部门 | 技术总监、人事经理 |
| 班组级 | 特定班组 | 组长、组员 |

## 3. 岗位结构

### 3.1 岗位属性

岗位以 JSON 格式存储在 `profile_json` 字段中，定义员工的工作职责：

```json
{
  "name": "技术总监",
  "level": "management",
  "responsibilities": [
    "制定技术战略和架构规划",
    "审核重大技术决策",
    "指导团队技术成长",
    "技术团队管理和建设"
  ],
  "requirements": [
    "5年以上技术管理经验",
    "精通系统架构设计",
    "优秀的团队领导能力"
  ]
}
```

### 3.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 岗位名称（冗余存储） |
| level | enum | 岗位级别，来自代码表 `organization.position.level` |
| responsibilities | string[] | 岗位职责列表 |
| requirements | string[] | 岗位要求列表（可选） |

### 3.3 岗位级别说明

岗位级别通过代码表 `organization.position.level` 管理，支持灵活配置：

| 级别值 | 说明 | 典型岗位 |
|--------|------|---------|
| **vision** | 愿景层 | 董事长、创始人 |
| **strategy** | 战略层 | CEO、CTO、VP |
| **campaign** | 战役层 | 事业部总经理 |
| **tactics** | 战术层 | 总监、经理 |
| **execution** | 执行层 | 工程师、专员 |

## 4. 数据权限范围

### 4.1 权限类型

数据权限通过代码表 `organization.position.scope` 管理：

| 值 | 说明 | 数据范围 | 适用场景 |
|-----|------|---------|---------|
| all | 全部 | 全系统所有数据 | CEO、管理员 |
| org | 组织 | 所在组织及其子组织 | 分公司经理 |
| departments | 部门 | 所在部门的数据 | 部门总监 |
| group | 班组 | 所在班组的数据 | 组长 |
| self | 自己 | 仅与自己相关的数据 | 普通员工 |

### 4.2 代码表管理

岗位管理中的以下字段通过域代码管理接口进行配置，支持灵活的扩展和定制：

| 字段 | 代码表 | 说明 |
|------|--------|------|
| **dataScope** | `organization.position.scope` | 数据权限范围 |
| **status** | `organization.position.status` | 岗位状态 |
| **level** | `organization.position.level` | 岗位级别 |

**代码表配置示例**：

```json
// organization.position.scope
{
  "value": "all",
  "label": "全部",
  "title": "organization.position.scope.all"
}

// organization.position.status
{
  "value": "enabled",
  "label": "已启用",
  "title": "organization.position.status.enabled"
}

// organization.position.level
{
  "value": "strategy",
  "label": "战略",
  "title": "organization.position.level.strategy"
}
```

**前端集成**：
- 使用 `getCodeOptionsByParentValue(codeKey)` 获取选项列表
- 选项显示使用 `title` 字段的多语言翻译
- 提交时使用 `value` 字段作为实际值

### 4.3 权限计算逻辑

```
用户数据权限 = MAX(岗位数据权限, 角色数据权限)

说明：
- 取岗位权限和角色权限的较大者
- 岗位权限定义业务数据访问范围
- 角色权限定义功能操作权限
```

### 4.3 数据查询示例

```sql
-- 查询用户能够访问的组织列表
SELECT o.* 
FROM t_departments o
WHERE o.path LIKE CONCAT(
  (SELECT path FROM t_departments WHERE sid = #{userOrgId}), 
  '%'
)
AND o.deleted = 0
AND o.status = 1;

-- 查询用户能够访问的员工列表
SELECT e.* 
FROM t_employees e
INNER JOIN t_departments o ON e.org_id = o.sid
WHERE o.path LIKE CONCAT(
  (SELECT path FROM t_departments WHERE sid = #{userOrgId}), 
  '%'
)
AND e.deleted = 0
AND e.status = 1;
```

## 5. 功能列表

| 功能 | 说明 |
|------|------|
| 岗位创建 | 在指定组织下创建岗位 |
| 岗位编辑 | 修改岗位信息和职责 |
| 岗位删除 | 软删除岗位（需检查是否有员工关联） |
| 岗位查询 | 按组织查询岗位列表 |
| 数据权限配置 | 配置岗位的数据访问范围 |
| 岗位复制 | 复制岗位到另一个组织 |

## 6. 业务规则

### 6.1 创建规则

- 岗位编码全局唯一
- 同一组织内岗位名称不能重复
- 岗位必须关联到组织树的某个节点（`org_id` 必填）

**创建流程**：
1. 展开组织树，选择目标组织节点
2. 在该节点下创建岗位
3. 岗位自动关联到选中的组织节点

### 6.2 删除规则

- 有员工关联的岗位不能删除
- 删除为软删除（deleted = 1）
- 删除后已分配的员工保留岗位信息（历史记录）

### 6.3 岗位分配

员工通过 `t_employees.position_id` 关联岗位：

```
t_employees
    └── position_id → t_positions.sid
```

一个员工只能分配一个主岗位，但可以有兼职岗位（通过扩展表实现）。

## 7. 接口设计

### 7.1 路由列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments/position` | 岗位列表 |
| GET | `/api/departments/positions/:id` | 岗位详情 |
| POST | `/api/departments/position` | 创建岗位 |
| PUT | `/api/departments/positions/:id` | 更新岗位 |
| DELETE | `/api/departments/positions/:id` | 删除岗位 |
| GET | `/api/departments/:oid/position` | 指定组织的岗位列表 |

### 7.2 接口定义

#### 创建岗位

```typescript
// Request
POST /api/departments/position
Content-Type: application/json

{
  "name": "技术总监",           // 岗位名称
  "eName": "Technical Director", // 岗位英文名称
  "title": "organization.position.POS-TECH-DIR",  // 岗位标题（多语言key）
  "code": "POS-TECH-DIR",       // 岗位编码（唯一）
  "oid": "org-003",            // 所属组织ID
  "description": "负责技术团队管理", // 描述
  "status": "enabled",          // 状态
  "dataScope": "org",           // 数据权限范围
  "profileJson": {              // 岗位定义
    "name": "技术总监",
    "level": "management",
    "responsibilities": [
      "制定技术战略和架构规划",
      "审核重大技术决策",
      "指导团队技术成长"
    ],
    "requirements": [
      "5年以上技术管理经验",
      "精通系统架构设计"
    ]
  }
}

// Response
{
  "code": 200,
  "data": {
    "id": "pos-001",
    "name": "技术总监",
    "eName": "Technical Director",
    "title": "organization.position.POS-TECH-DIR",
    "code": "POS-TECH-DIR",
    "oid": "org-003",
    "status": "enabled",
    "dataScope": "org",
    "profileJson": { ... }
  }
}
```

#### 获取组织岗位列表

```typescript
// Request
GET /api/departments/org-003/position

// Response
{
  "code": 200,
  "data": [
    {
      "id": "pos-001",
      "name": "技术总监",
      "code": "POS-TECH-DIR",
      "dataScope": "org",
      "profileJson": { ... }
    },
    {
      "id": "pos-002",
      "name": "前端工程师",
      "code": "POS-FE-DEV",
      "dataScope": "group",
      "profileJson": { ... }
    }
  ]
}
```

## 8. 与员工管理的关系

### 8.1 关联方式

员工通过 `position_id` 字段关联岗位：

```
t_employees
    └── position_id → t_positions.sid
```

### 8.2 业务场景

| 场景 | 说明 |
|------|------|
| 员工入职 | 分配岗位，确定职责和权限 |
| 员工调岗 | 变更 position_id，调整职责和权限 |
| 权限计算 | 根据岗位 data_scope 计算数据权限 |

### 8.3 查询示例

```sql
-- 查询某岗位下的所有员工
SELECT e.* 
FROM t_employees e
WHERE e.position_id = 'pos-001'
  AND e.deleted = 0
  AND e.status = 1;

-- 查询员工及其岗位信息
SELECT e.*, p.name as position_name, p.data_scope, p.profile_json
FROM t_employees e
LEFT JOIN t_positions p ON e.position_id = p.sid
WHERE e.sid = 'emp-001';
```

## 9. 与 org-skill 的区别

| 对比项 | org-position（岗位） | org-skill（技能定义） |
|--------|---------------------|---------------------|
| **作用对象** | 人类员工 | 数字员工（Agent） |
| **核心目的** | 定义工作职责 | 定义 Agent 能力 |
| **权限类型** | 数据权限（能查看什么） | 操作权限（能调用什么工具） |
| **管理方式** | HR 管理 | 技术/组织管理员 |
| **与 Agent 关系** | 员工可绑定 Agent | Agent 直接绑定技能定义 |

## 10. 数据表设计

- [岗位表](./database/t_positions.md)

## 11. 关联文档

- [组织管理设计](./org.md)
- [员工管理设计](./employee.md)
- [组织技能定义](./skill.md)
- [组织架构表](./database/t_departments.md)
- [员工表](./database/t_employees.md)
- [组织技能定义表](./database/t_departments_skill.md)
- [Gateway 路由设计](../gateway/routing.md)

## 12. 变更历史

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-02-18 | v1.3 | 1. 修改数据权限、状态、级别字段使用代码表管理<br>2. dataScope 使用 `organization.position.scope` 代码表<br>3. status 使用 `organization.position.status` 代码表<br>4. level 使用 `organization.position.level` 代码表<br>5. 更新前端表单，使用代码接口加载选项 |
| 2026-02-18 | v1.2 | 1. 新增 e_name 字段用于保存英文名称，为自动创建多语言翻译准备数据<br>2. 修改 orgId 为 oid，遵循设计规范<br>3. 修改状态值从 active/inactive 改为 enabled/disabled，遵循设计规范 |
| 2026-02-18 | v1.1 | 1. 新增 title 字段用于多语言支持<br>2. 修改 status 字段类型从 TINYINT 改为 VARCHAR(20)，使用代码表 `organization.position.status` 管理<br>3. 更新接口定义，添加 title 字段支持 |
