# t_departments 部门管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_departments |
| 中文名 | 部门管理表 |
| 说明 | 存储部门树形结构，支持多级组织架构 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 部门名称 |
| 3 | description | TEXT | - | NO | NULL | 部门描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | YES | 1 | 状态: 0=停用, 1=启用 |
| 8 | parent_id | VARCHAR | 36 | NO | - | 父部门ID |
| 9 | code | VARCHAR | 100 | NO | - | 部门编码，唯一 |
| 10 | path | VARCHAR | 500 | NO | - | 部门路径 |
| 11 | sort | INT | - | NO | 0 | 排序序号 |
| 12 | leader | VARCHAR | 100 | NO | - | 负责人姓名 |
| 13 | phone | VARCHAR | 20 | NO | - | 联系电话 |
| 14 | email | VARCHAR | 100 | NO | - | 邮箱 |

## 字段详细说明

### parent_id 父部门ID

- 用于构建树形结构
- 顶级部门为 NULL
- 外键关联到本表 sid

### code 部门编码

- 部门的唯一标识编码
- 建议按规则生成，如：DEPT_001

### path 部门路径

- 记录部门的完整层级路径
- 格式：/顶级ID/父级ID/当前ID/
- 便于快速查询子树

### status 状态

| 值 | 含义 |
|----|------|
| 0 | 停用 |
| 1 | 启用 |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_departments | sid | 主键 |
| uk_departments_codes | code | 唯一索引 |
| idx_departments_status | status | 普通索引 |
| idx_departments_deleted | deleted | 普通索引 |
| idx_departments_parent | parent_id | 普通索引 |
| idx_departments_path | path | 普通索引 |
| idx_departments_sort | sort | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_departments (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '部门名称',
    description TEXT COMMENT '部门描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    parent_id VARCHAR(36) COMMENT '父部门ID',
    code VARCHAR(100) COMMENT '部门编码',
    path VARCHAR(500) COMMENT '部门路径',
    sort INT DEFAULT 0 COMMENT '排序序号',
    leader VARCHAR(100) COMMENT '负责人姓名',
    phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(100) COMMENT '邮箱',
    
    UNIQUE KEY uk_departments_codes (code),
    INDEX idx_departments_status (status),
    INDEX idx_departments_deleted (deleted),
    INDEX idx_departments_parent (parent_id),
    INDEX idx_departments_path (path),
    INDEX idx_departments_sort (sort),
    
    FOREIGN KEY (parent_id) REFERENCES t_departments(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门管理表';
```

## 树形结构示例

```
t_departments
├── 总公司 (sid: uuid-1, parent_id: NULL)
│   ├── 技术部 (sid: uuid-2, parent_id: uuid-1)
│   │   ├── 前端组 (sid: uuid-3, parent_id: uuid-2)
│   │   └── 后端组 (sid: uuid-4, parent_id: uuid-2)
│   └── 产品部 (sid: uuid-5, parent_id: uuid-1)
└── 分公司 (sid: uuid-6, parent_id: NULL)
```

## 示例查询

```sql
-- 查询部门树 (MySQL 8.0+ with RECURSIVE)
WITH RECURSIVE departments_tree AS (
    SELECT sid, parent_id, name, 0 as level, CAST(name AS CHAR(1000)) as path_name
    FROM t_departments
    WHERE parent_id IS NULL AND deleted = 0
    UNION ALL
    SELECT d.sid, d.parent_id, d.name, dt.level + 1, CONCAT(dt.path_name, ' > ', d.name)
    FROM t_departments d
    INNER JOIN departments_tree dt ON d.parent_id = dt.sid
    WHERE d.deleted = 0
)
SELECT * FROM departments_tree ORDER BY path_name;
```

## 关联文档

- [组织管理模块](../README.md)
- [用户管理表](./t_users.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
