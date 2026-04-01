# t_users 用户管理表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_users |
| 中文名 | 用户管理表 |
| 说明 | 存储系统用户认证信息，仅用于人类员工的登录认证 |

## 设计原则

- **职责单一**：仅存储认证相关数据（用户名、密码、角色）
- **业务数据分离**：姓名、部门、邮箱等业务数据存储在 [t_employees](./t_employees.md) 表
- **仅人类员工使用**：数字员工不需要登录，不创建 User 记录

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 用户姓名（冗余，便于显示） |
| 3 | description | TEXT | - | NO | NULL | 用户描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | YES | 1 | 状态: 0=停用, 1=启用 |
| 8 | username | VARCHAR | 100 | YES | - | 用户名，唯一 |
| 9 | password | VARCHAR | 255 | YES | - | 加密密码（bcrypt） |
| 10 | avatar | VARCHAR | 500 | NO | - | 头像URL |
| 11 | home_path | VARCHAR | 200 | NO | - | 登录后默认首页 |
| 12 | last_login_time | DATETIME | - | NO | - | 最后登录时间 |
| 13 | last_login_ip | VARCHAR | 50 | NO | - | 最后登录IP |

## 字段详细说明

### username 用户名

- 用于登录系统的唯一标识
- 不允许重复
- 建议使用字母、数字和下划线组合

### password 密码

- 使用 bcrypt 算法加密存储
- 不包含明文密码

### name 用户姓名

- 冗余存储，便于前端显示
- 应与关联的 Employee.name 保持一致
- 修改时同步更新

### status 状态

| 值 | 含义 |
|----|------|
| 0 | 停用，无法登录 |
| 1 | 启用，可以登录 |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_user | sid | 主键 |
| uk_user_username | username | 唯一索引 |
| idx_user_status | status | 普通索引 |
| idx_user_deleted | deleted | 普通索引 |
| idx_user_create_time | create_time | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_users (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '用户姓名（冗余，便于显示）',
    description TEXT COMMENT '用户描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    username VARCHAR(100) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '加密密码',
    avatar VARCHAR(500) COMMENT '头像URL',
    home_path VARCHAR(200) COMMENT '登录后默认首页',
    last_login_time DATETIME COMMENT '最后登录时间',
    last_login_ip VARCHAR(50) COMMENT '最后登录IP',
    
    UNIQUE KEY uk_user_username (username),
    INDEX idx_user_status (status),
    INDEX idx_user_deleted (deleted),
    INDEX idx_user_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户管理表 - 仅用于人类员工认证';
```

## 与 Employee 的关系

```
人类员工（Human Employee）
    ├── t_employees（业务数据）
    │   ├── employee_no（工号）
    │   ├── name（姓名）
    │   ├── departments_id（部门）
    │   ├── position_id（职位）
    │   ├── email（邮箱）
    │   ├── phone（电话）
    │   ├── profile_json（画像）
    │   └── user_id → 关联 t_users.sid
    │
    └── t_users（认证数据）
        ├── username（登录名）
        ├── password（密码）
        ├── status（账号状态）
        └── last_login_time（登录记录）

数字员工（Digital Employee）
    └── t_employees（业务数据）
        ├── employee_no（工号）
        ├── name（名称）
        ├── agent_id → 关联 Agent
        └── user_id = null（不需要登录）
```

## 数据流向

### 创建人类员工

```
HR 创建员工
    ↓
插入 t_employees（业务数据）
    ↓
创建 t_users（认证数据）
    ↓
更新 t_employees.user_id = t_users.sid
    ↓
分配 Role（权限）
```

### 员工登录

```
用户输入用户名密码
    ↓
验证 t_users（认证）
    ↓
查询 t_employees（获取业务数据）
    ↓
加载 Role（获取权限）
    ↓
登录成功
```

## 关联文档

- [员工管理](../employee.md)
- [员工表](./t_employees.md)
- [角色管理表](./t_roles.md)
- [用户角色关联表](./r_user_roles.md)
- [数据库设计规范](../../../DATABASE_SPECIFICATION.md)
