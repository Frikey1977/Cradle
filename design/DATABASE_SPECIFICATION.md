# 数据库设计规范文档

## 一、命名规范

### 1.1 表名前缀

| 前缀 | 含义 | 示例 |
|------|------|------|
| t_ | 数据表 | t_users, t_order |
| r_ | 关系表 | r_role_module, r_user_role |
| v_ | 视图 | v_user_detail |
| p_ | 存储过程 | p_get_users_list |

### 1.2 关系表命名规则

关系表（多对多关联）使用 `r_` 前缀，命名格式：

```
r_{主表名}_{关联表名}
```

**规则说明**:
- 主表名：关系的主要拥有方（如 role）
- 关联表名：被关联的表（如 module）
- 使用单数形式
- 按字母顺序排列（可选）

**示例**:
| 关系 | 表名 | 说明 |
|------|------|------|
| 角色-模块 | `r_role_module` | 角色拥有的模块 |
| 用户-角色 | `r_user_role` | 用户所属的角色 |
| 用户-部门 | `r_user_departments` | 用户所属的部门 |

### 1.3 命名规则

- 表名使用小写字母和下划线
- 表名格式: `前缀_业务名`
- 字段名使用小写字母和下划线（snake_case）
- 表名即约定了数据所属的业务模块，字段名不允许添加业务名前缀
- 避免使用数据库保留字

### 1.4 字段命名缩写规范

| 缩写 | 全称 | 含义 | 使用场景 |
|------|------|------|----------|
| sid | Sequence ID | 数据序列ID | 表的主键，UUID格式 |
| pid | Parent ID | 父级ID | 树形结构的父节点ID |
| uid | User ID | 用户ID | 关联用户表的ID |
| oid | Organization ID | 组织ID | 关联组织/部门表的ID |

**使用示例**:
```sql
-- 使用 sid 作为主键
CREATE TABLE t_department (
    sid VARCHAR(36) PRIMARY KEY COMMENT '部门ID',
    name VARCHAR(200) NOT NULL COMMENT '部门名称',
    pid VARCHAR(36) COMMENT '父部门ID',
    ...
);

-- 使用 uid 关联用户
CREATE TABLE t_task (
    sid VARCHAR(36) PRIMARY KEY COMMENT '任务ID',
    name VARCHAR(200) NOT NULL COMMENT '任务名称',
    uid VARCHAR(36) COMMENT '负责人用户ID',
    oid VARCHAR(36) COMMENT '所属组织ID',
    ...
);
```

## 二、必须字段

### 2.1 数据表（t_前缀）必须字段

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| sid | VARCHAR(36) | 是 | UUID | 主键，使用UUID |
| name | VARCHAR(200) | 是 | - | 显示名称 |
| title | VARCHAR(200) | 否 | NULL | 多语言翻译标签，用于i18n |
| description | TEXT | 否 | NULL | 描述说明 |
| create_time | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |
| deleted | TINYINT | 是 | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |
| timestamp | TIMESTAMP | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| status | VARCHAR(20) | 是 | 'enabled' | 状态: enabled=启用, disabled=停用 |

### 2.2 关系表（r_前缀）必须字段

关系表用于维护多对多关联，设计应**精简**，仅保留必要字段：

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| {表A}_id | VARCHAR(36) | 是 | - | 关联表A的主键，联合主键第一部分 |
| {表B}_id | VARCHAR(36) | 是 | - | 关联表B的主键，联合主键第二部分 |
| create_time | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |

**关系表设计原则**：
1. **不包含** sid、name、description、status、deleted、timestamp 字段
2. **使用联合主键**：({表A}_id, {表B}_id) 作为联合主键
3. **不需要**逻辑删除，直接物理删除关联记录
4. **不需要**状态控制，关联即生效
5. **不需要**更新时间戳，关联关系创建后不变
6. 如需扩展属性（如关联的权重、类型等），可添加少量字段

### 2.3 替代方案：JSON字段存储

对于简单的多对多关系（仅需存储关联ID，无其他属性），可考虑在**主表中用JSON字段**存储关联ID列表，替代独立的关系表。

**适用场景**：
- 仅需存储关联ID，无其他属性
- 关联数量较少（如角色-模块）
- 查询场景简单（主要是"获取某实体的所有关联"）

**示例**：角色-模块权限存储
```sql
-- t_roles 表使用 JSON 字段存储模块权限
CREATE TABLE t_roles (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '角色名称',
    description TEXT COMMENT '角色描述',
    permissions JSON COMMENT '权限列表，存储模块ID数组：["mod-1", "mod-2"]',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色管理表';

-- 查询包含指定模块的角色
SELECT * FROM t_roles 
WHERE JSON_CONTAINS(permissions, '"module-id-1"');
```

**优缺点对比**：
| 方案 | 优点 | 缺点 |
|------|------|------|
| **关系表** | 符合范式、支持复杂查询、易于扩展属性 | 多一张表、查询需JOIN |
| **JSON字段** | 简洁、单表查询、易于维护 | 复杂查询性能稍差、不易扩展属性 |

### 2.4 建表示例

**数据表示例**：
```sql
CREATE TABLE t_example (
    sid VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'enabled'
);
```

**关系表示例**：
```sql
CREATE TABLE r_user_role (
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (user_id, role_id),
    INDEX idx_user_role_role (role_id),
    
    FOREIGN KEY (user_id) REFERENCES t_users(sid) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES t_roles(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色关联表';
```

## 三、通用业务字段

根据业务需要，可选择添加以下通用字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| catalog | VARCHAR(100) | 分类编码 |
| icon | VARCHAR(255) | 显示图标路径或标识 |
| parent_id | VARCHAR(36) | 父级ID，用于树形结构 |
| path | VARCHAR(500) | 路径信息 |
| sort | INT | 显示顺序，默认0 |

### 3.1 树形结构表示例

```sql
CREATE TABLE t_category (
    sid VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id VARCHAR(36),
    path VARCHAR(500),
    sort INT DEFAULT 0,
    icon VARCHAR(255),
    catalog VARCHAR(100),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'enabled',
    
    FOREIGN KEY (parent_id) REFERENCES t_category(sid)
);
```

## 四、字段类型规范

| 数据类型 | 使用场景 | 示例 |
|----------|----------|------|
| VARCHAR(36) | UUID主键 | sid |
| VARCHAR(100) | 编码、类型 | code, type |
| VARCHAR(200) | 名称、标题 | name, title |
| VARCHAR(500) | 路径、URL | path, url |
| TEXT | 长文本描述 | description, content |
| INT | 整数、排序 | sort, count |
| BIGINT | 大整数、ID | user_id, order_id |
| DECIMAL(19,4) | 金额 | amount, price |
| DATETIME | 日期时间 | create_time, update_time |
| TIMESTAMP | 时间戳 | timestamp |
| TINYINT | 状态标记 | status, deleted |
| JSON | 扩展配置 | ext_config |

## 五、索引规范

### 5.1 必须索引

| 索引类型 | 字段 | 说明 |
|----------|------|------|
| 主键索引 | sid | 唯一标识 |
| 普通索引 | status | 状态筛选 |
| 普通索引 | deleted | 删除标记筛选 |

### 5.2 推荐索引

| 场景 | 索引字段 |
|------|----------|
| 树形结构 | parent_id |
| 分类查询 | catalog |
| 时间范围 | create_time |
| 名称搜索 | name |
| 外键关联 | xxx_id |

### 5.3 索引命名

- 主键索引: `pk_表名`
- 唯一索引: `uk_表名_字段名`
- 普通索引: `idx_表名_字段名`

## 六、SQL示例

### 6.1 完整建表示例

```sql
-- 用户表
CREATE TABLE t_users (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '用户姓名',
    description TEXT COMMENT '用户描述',
    username VARCHAR(100) UNIQUE NOT NULL COMMENT '用户名',
    email VARCHAR(255) COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '电话',
    avatar VARCHAR(500) COMMENT '头像URL',
    departments_id VARCHAR(36) COMMENT '部门ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    
    INDEX idx_user_status (status),
    INDEX idx_user_deleted (deleted),
    INDEX idx_user_departments (departments_id),
    INDEX idx_user_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 6.2 树形结构表示例

```sql
-- 组织架构表
CREATE TABLE t_department (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '部门名称',
    description TEXT COMMENT '部门描述',
    code VARCHAR(100) UNIQUE COMMENT '部门编码',
    parent_id VARCHAR(36) COMMENT '父部门ID',
    path VARCHAR(500) COMMENT '部门路径',
    sort INT DEFAULT 0 COMMENT '排序',
    icon VARCHAR(255) COMMENT '图标',
    catalog VARCHAR(100) COMMENT '分类',
    leader_id VARCHAR(36) COMMENT '负责人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    
    INDEX idx_departments_status (status),
    INDEX idx_departments_deleted (deleted),
    INDEX idx_departments_parent (parent_id),
    INDEX idx_departments_path (path),
    INDEX idx_departments_sort (sort),
    
    FOREIGN KEY (parent_id) REFERENCES t_department(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';
```

## 七、规范检查清单

创建新表时，请检查以下项目：

- [ ] 表名使用 `t_` 前缀
- [ ] 包含必须字段: sid, name, description, create_time, deleted, timestamp, status
- [ ] sid 使用 VARCHAR(36) 类型
- [ ] 创建主键索引
- [ ] 为 status 和 deleted 字段创建索引
- [ ] 使用合适的字段类型
- [ ] 添加表和字段注释
- [ ] 设置合适的字符集(utf8mb4)

## 八、关联文档

- [数据库设计索引](./README.md)
- [系统管理模块表结构](./system/)
