# t_departments 部门架构表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_departments |
| 中文名 | 部门架构表 |
| 说明 | 存储企业部门架构树，以公司为根节点，支持分支机构、部门、班组等多级组织。整条记录即部门画像的完整信息。 |

## 核心设计原则

**树形结构**：
- 以公司为根节点（parent_id = NULL）
- 支持多级组织：公司 → 分支机构 → 部门 → 班组
- 通过 path 字段实现快速层级查询

**画像即记录**：
- 整条记录就是部门/公司的画像信息
- 不需要额外的 profile 字段
- 字段如 name、description、code、type 等共同构成画像

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | 是 | - | 部门名称（中文） |
| 3 | e_name | VARCHAR | 200 | 否 | NULL | 英文名称，用于英文翻译 |
| 4 | title | VARCHAR | 200 | 否 | NULL | 翻译键，用于国际化显示 |
| 5 | description | TEXT | - | 否 | NULL | 部门描述 |
| 6 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 7 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 8 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 9 | status | TINYINT | - | 是 | 1 | 状态: 0=停用, 1=启用 |
| 10 | code | VARCHAR | 100 | 是 | - | 部门编码，唯一 |
| 11 | type | VARCHAR | 50 | 是 | - | 部门类型：company/branch/departments/group |
| 12 | parent_id | VARCHAR | 36 | 否 | NULL | 父部门ID，根节点为NULL |
| 13 | path | VARCHAR | 500 | 否 | NULL | 部门路径，如：/company-id/departments-id/ |
| 14 | sort | INT | - | 是 | 0 | 同级排序 |
| 15 | leader_id | VARCHAR | 36 | 否 | NULL | 负责人ID（关联t_employees） |
| 16 | ext_config | JSON | - | 否 | NULL | 扩展配置 |

## 字段详细说明

### name 部门名称

- 部门的显示名称，如"技术部"、"北京分公司"
- 同一父部门下不允许重复

### title 翻译键

- 用于国际化显示的翻译键
- 格式示例：`org.departments.tech.name`、`org.branch.beijing.name`
- 前端根据此键从语言包获取对应语言的显示文本
- 为空时直接显示 name 字段

### code 部门编码

- 部门的唯一编码，全局唯一
- 用于系统内部标识和外部系统集成
- 建议使用有意义的编码，如"DEPT-TECH"、"BRANCH-BJ"

### type 部门类型

| 类型值 | 说明 | 示例 |
|--------|------|------|
| company | 公司（根节点） | 总部、子公司 |
| branch | 分支机构 | 分公司、办事处 |
| departments | 部门 | 技术部、人事部 |
| group | 班组/小组 | 开发一组、销售二组 |

### path 部门路径

存储从根节点到当前节点的完整路径，格式：`/根节点ID/父节点ID/`

示例：
- 总部（根节点）：`/`
- 北京分公司：`/org-001/`
- 技术部：`/org-001/org-002/`
- 后端开发组：`/org-001/org-002/org-003/`

用途：
- 快速查询某部门下的所有子部门（LIKE '/company-id/%'）
- 避免递归查询，提升性能

### description 部门描述

部门的详细描述，可作为画像的一部分：

```
技术部：
- 负责公司核心产品研发
- 团队规模：50人
- 主要技术栈：Java、Python、React
- 企业文化：技术驱动，鼓励创新
```

### status 状态

| 值 | 含义 |
|----|------|
| 0 | 停用 |
| 1 | 启用 |

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_org | 主键索引 | sid | 主键索引 |
| uk_org_code | 唯一索引 | code | 部门编码唯一 |
| idx_org_parent | 普通索引 | parent_id | 父部门查询 |
| idx_org_path | 普通索引 | path | 路径查询 |
| idx_org_type | 普通索引 | type | 类型筛选 |
| idx_org_status | 普通索引 | status | 状态筛选 |
| idx_org_deleted | 普通索引 | deleted | 删除标记筛选 |
| idx_org_sort | 普通索引 | sort | 排序索引 |
| idx_org_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_departments (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '部门名称（中文）',
    e_name VARCHAR(200) COMMENT '英文名称，用于英文翻译',
    title VARCHAR(200) COMMENT '翻译键，用于国际化显示',
    description TEXT COMMENT '部门描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    code VARCHAR(100) NOT NULL COMMENT '部门编码，唯一',
    type VARCHAR(50) NOT NULL COMMENT '部门类型：company/branch/departments/group',
    parent_id VARCHAR(36) COMMENT '父部门ID，根节点为NULL',
    path VARCHAR(500) COMMENT '部门路径，如：/company-id/departments-id/',
    sort INT DEFAULT 0 COMMENT '同级排序',
    leader_id VARCHAR(36) COMMENT '负责人ID（关联t_employees）',
    ext_config JSON COMMENT '扩展配置',
    
    UNIQUE KEY uk_org_code (code),
    INDEX idx_org_parent (parent_id),
    INDEX idx_org_path (path),
    INDEX idx_org_type (type),
    INDEX idx_org_status (status),
    INDEX idx_org_deleted (deleted),
    INDEX idx_org_sort (sort),
    INDEX idx_org_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门架构表';
```

## 关联关系

```
t_departments (部门架构树)
    │
    ├── type='company' (公司根节点)
    │
    ├── type='branch' (分支机构)
    │
    ├── type='departments' (部门)
    │
    └── type='group' (班组)
```

## 关联文档

- [t_employees](t_employee.md) - 员工表
- [t_positions](t_position.md) - 岗位表
- [t_contacts](t_contacts.md) - 联系人表
