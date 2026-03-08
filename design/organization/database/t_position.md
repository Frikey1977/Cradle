# t_positions 岗位表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_positions |
| 中文名 | 岗位表 |
| 说明 | 存储企业岗位定义，用于描述人类员工的工作职责和数据访问范围。整条记录即岗位画像的完整信息。 |

## 核心设计原则

**岗位与部门关系**：
- 岗位必须关联到组织架构的某个节点（oid）
- 表示该岗位定义在哪个组织层级
- 支持公司级、分支机构级、部门级、班组级岗位

**画像即记录**：
- 整条记录就是岗位的画像信息
- 不需要额外的 profile 字段
- 字段如 name、description、responsibilities 等共同构成画像

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | 是 | - | 岗位名称 |
| 3 | e_name | VARCHAR | 200 | 否 | - | 岗位英文名称（用于自动创建多语言翻译） |
| 4 | title | VARCHAR | 200 | 否 | - | 岗位标题（多语言key） |
| 5 | description | TEXT | - | 否 | NULL | 岗位描述 |
| 6 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 7 | deleted | TINYINT | - | 是 | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 8 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 9 | status | VARCHAR | 20 | 是 | 'enabled' | 状态（代码表: organization.position.status） |
| 10 | code | VARCHAR | 100 | 是 | - | 岗位编码，唯一 |
| 11 | oid | VARCHAR | 36 | 是 | - | 所属组织ID（关联组织树任意节点） |
| 12 | level | VARCHAR | 50 | 否 | NULL | 岗位级别（代码表: organization.position.level） |
| 13 | responsibilities | JSON | - | 否 | NULL | 岗位职责列表 |
| 14 | requirements | JSON | - | 否 | NULL | 任职要求列表 |
| 15 | authority | JSON | - | 否 | NULL | 岗位权限列表 |
| 16 | data_scope | VARCHAR | 50 | 否 | 'self' | 数据权限范围 |

## 字段详细说明

### name 岗位名称

- 岗位的显示名称，如"技术总监"、"前端工程师"
- 同一组织内不允许重复

### e_name 岗位英文名称

- 岗位的英文名称，用于自动创建多语言翻译
- 如 "Chief Executive Officer"、"Frontend Engineer"
- 可选字段，用于支持国际化

### title 岗位标题（多语言key）

- 岗位的多语言标题 key，用于国际化显示
- 格式：`organization.position.{code}`，如 `organization.position.POS-TECH-DIR`
- 优先使用 title 的多语言翻译，如果不存在则回退到 name 或 e_name

### code 岗位编码

- 岗位的唯一编码，全局唯一
- 用于系统内部标识和外部系统集成
- 建议使用有意义的编码，如"POS-TECH-DIR"、"POS-FE-DEV"

### oid 所属组织

岗位必须关联到组织架构的某个节点，表示该岗位定义在哪个组织层级：

| 关联层级 | 说明 | 示例 |
|---------|------|------|
| 公司（company） | 公司级岗位 | CEO、CTO |
| 分支机构（branch） | 分支机构级岗位 | 分公司经理 |
| 部门（departments） | 部门级岗位 | 技术总监、前端工程师 |
| 班组（group） | 班组级岗位 | 组长、组员 |

**管理逻辑**：
- 展开组织树，选择节点后查看/管理该节点下的岗位
- 同组织下岗位编码唯一
- 岗位只能在其定义的组织节点下查看和管理

### responsibilities 岗位职责

存储岗位职责列表，JSON 数组格式：

```json
[
  "制定技术战略和架构规划",
  "审核重大技术决策",
  "指导团队技术成长",
  "技术团队管理和建设"
]
```

### requirements 任职要求

存储任职要求列表，JSON 数组格式：

```json
[
  "5年以上技术管理经验",
  "精通系统架构设计",
  "优秀的团队领导能力"
]
```

### authority 岗位权限

存储岗位权限列表，JSON 数组格式：

```json
[
  "技术方案最终决策权",
  "团队人员招聘建议权",
  "技术预算审批权"
]
```

### data_scope 数据权限范围

定义该岗位能够查阅和访问的数据范围：

| 值 | 说明 | 数据范围 |
|-----|------|---------|
| all | 全部数据 | 全系统所有数据 |
| org | 本组织数据 | 所在组织及其子组织的数据 |
| dept | 本部门数据 | 所在部门的数据 |
| team | 本团队数据 | 所在团队的数据 |
| self | 仅自己数据 | 仅自己的数据 |

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_position | 主键索引 | sid | 主键索引 |
| uk_position_code | 唯一索引 | code | 岗位编码唯一 |
| idx_position_oid | 普通索引 | oid | 组织查询 |
| idx_position_status | 普通索引 | status | 状态筛选 |
| idx_position_deleted | 普通索引 | deleted | 删除标记筛选 |
| idx_position_level | 普通索引 | level | 级别筛选 |

## SQL建表语句

```sql
CREATE TABLE t_positions (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '岗位名称',
    e_name VARCHAR(200) COMMENT '岗位英文名称（用于自动创建多语言翻译）',
    title VARCHAR(200) COMMENT '岗位标题（多语言key）',
    description TEXT COMMENT '岗位描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    code VARCHAR(100) NOT NULL COMMENT '岗位编码，唯一',
    oid VARCHAR(36) NOT NULL COMMENT '所属组织ID（关联组织树任意节点）',
    level VARCHAR(50) COMMENT '岗位级别（代码表: organization.position.level）',
    responsibilities JSON COMMENT '岗位职责列表',
    requirements JSON COMMENT '任职要求列表',
    authority JSON COMMENT '岗位权限列表',
    data_scope VARCHAR(50) DEFAULT 'self' COMMENT '数据权限范围',
    
    UNIQUE KEY uk_position_code (code),
    INDEX idx_position_oid (oid),
    INDEX idx_position_status (status),
    INDEX idx_position_deleted (deleted),
    INDEX idx_position_level (level),
    
    FOREIGN KEY (oid) REFERENCES t_departments(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位表';
```

## 关联关系

```
t_positions (岗位定义)
    │
    ├── oid → t_departments (所属组织)
    │
    └── 被引用：t_employees.position_id (员工所属岗位)
```

## 关联文档

- [t_departments](t_org.md) - 部门架构表
- [t_employees](t_employee.md) - 员工表
- [t_contacts](t_contacts.md) - 联系人表
