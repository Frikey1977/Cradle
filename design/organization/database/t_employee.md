# t_employees 员工表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_employees |
| 中文名 | 员工表 |
| 说明 | 存储企业人类员工基础信息。员工画像信息存储在 t_contacts 表中，通过 type='employee' + source_id 关联。 |

> **设计原则**：
> 1. 人类员工和数字员工是平行关系，分别存储在 t_employees 和 t_agents 表
> 2. **员工画像不存储在本表**，统一存储在 t_contacts.profile 中
> 3. 本表只保留员工基础信息（姓名、工号、部门、岗位等）

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 员工姓名 |
| 3 | description | TEXT | - | NO | NULL | 员工描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | VARCHAR | 20 | YES | 'active' | 员工状态（代码表: organization.employee.status） |
| 8 | type | VARCHAR | 20 | YES | 'full-time' | 员工类型（代码表: organization.employee.type） |
| 9 | employee_no | VARCHAR | 50 | NO | - | 员工工号 |
| 10 | oid | VARCHAR | 36 | NO | - | 所属组织ID |
| 11 | position_id | VARCHAR | 36 | NO | - | 职位ID |
| 12 | location | VARCHAR | 20 | NO | - | 工作地点 |
| 13 | email | VARCHAR | 100 | NO | - | 邮箱 |
| 14 | phone | VARCHAR | 20 | NO | - | 电话 |
| 15 | hire_date | DATE | - | NO | - | 入职日期 |
| 16 | user_id | VARCHAR | 36 | NO | - | 关联系统用户ID |

## 字段详细说明

### 员工画像存储位置

**重要**：员工的画像信息（facts、preferences）不存储在本表，而是存储在 **t_contacts.profile** 中：

```
t_employees (基础信息)
    │
    ├── sid ───────────────────┐
    │                          ▼
    ├── name                   t_contacts (画像信息)
    ├── employee_no                ├── type='employee'
    ├── oid (部门ID)               ├── source_id = t_employees.sid
    ├── position_id (岗位ID)       └── profile: { facts, preferences }
    └── ...
```

获取员工完整信息（基础 + 画像）的查询方式：

```sql
-- 查询员工基础信息 + 画像信息
SELECT 
    e.sid, e.name, e.employee_no, e.oid, e.position_id,
    c.profile
FROM t_employees e
LEFT JOIN t_contacts c ON c.type = 'employee' AND c.source_id = e.sid
WHERE e.sid = ?;
```

### status 员工状态

| 值 | 含义 |
|----|------|
| active | 在职 |
| resigned | 离职 |
| suspended | 停职 |
| probation | 试用期 |

### type 员工类型

| 值 | 含义 |
|----|------|
| full-time | 全职 |
| part-time | 兼职 |
| intern | 实习生 |
| outsourced | 外包 |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_employee | sid | 主键 |
| uk_employee_no | employee_no | 唯一索引 |
| idx_employee_status | status | 普通索引 |
| idx_employee_deleted | deleted | 普通索引 |
| idx_employee_oid | oid | 普通索引 |
| idx_employee_position | position_id | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_employees (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '员工姓名',
    description TEXT COMMENT '员工描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(50) DEFAULT 'active' COMMENT '员工状态',
    type VARCHAR(50) DEFAULT 'full-time' COMMENT '员工类型',
    employee_no VARCHAR(50) COMMENT '员工工号',
    oid VARCHAR(36) COMMENT '所属组织ID',
    position_id VARCHAR(36) COMMENT '职位ID',
    location VARCHAR(200) COMMENT '工作地点',
    email VARCHAR(100) COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '电话',
    hire_date DATE COMMENT '入职日期',
    user_id VARCHAR(36) COMMENT '关联系统用户ID',
    
    UNIQUE KEY uk_employee_no (employee_no),
    INDEX idx_employee_status (status),
    INDEX idx_employee_deleted (deleted),
    INDEX idx_employee_oid (oid),
    INDEX idx_employee_position (position_id),
    
    FOREIGN KEY (oid) REFERENCES t_departments(sid),
    FOREIGN KEY (position_id) REFERENCES t_positions(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工表（仅人类员工，画像存储在 t_contacts）';
```

## 与数字员工的关系

```
t_employees（人类员工）          t_agents（数字员工）
    │                              │
    │  平行关系                      │
    │  （共同构成企业员工体系）        │
    │                              │
    ▼                              ▼
  张三（HR专员）    ←→    HR助手（Agent）
    │                              │
    │  专属绑定（通过 t_relationship）│
    └──────────────────────────────┘
```

### 关联规则

| 场景 | 关联方式 | 说明 |
|-----|---------|------|
| **员工画像** | t_contacts.source_id → t_employees.sid | 画像存储在 t_contacts |
| **专属Agent** | t_relationship (agent_id + contact_id) | Agent 绑定到特定员工 |
| **共享Agent** | 无直接关联 | 多个员工共享使用 |

## 关联文档

- [t_contacts](t_contacts.md) - 联系人表（存储员工画像）
- [t_agents](../../agent/database/t_agents.md) - 数字员工表
- [t_departments](t_org.md) - 部门架构表
- [t_positions](t_position.md) - 岗位表
- [t_relationship](../../memory/database/t_relationship.md) - Agent-Contact 关系表
