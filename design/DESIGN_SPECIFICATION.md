# 设计文档规范

## 一、目录结构规范

### 1.1 总体结构

```
system_design/
├── README.md                          # 系统设计总索引
├── DESIGN_SPECIFICATION.md            # 本文档 - 设计规范说明
├── DATABASE_SPECIFICATION.md          # 数据库设计规范
├── {module}/                          # 【大模块】模块文件夹（小写）
│   ├── README.md                      # 模块索引
│   ├── {submodule}.md                 # 【子模块】子模块设计文档
│   ├── {submodule}.md                 # 【子模块】子模块设计文档
│   └── database/                      # 【数据库】该模块的数据库设计
│       ├── t_{table}.md               # 数据表设计
│       └── v_{view}.md                # 视图设计（如有）
├── {module}/                          # 【大模块】另一个模块文件夹
│   ├── README.md
│   ├── {submodule}.md
│   └── database/
│       └── t_{table}.md
└── ...
```

### 1.2 文件夹说明

| 文件夹层级 | 命名格式 | 说明 | 示例 |
|-----------|---------|------|------|
| 大模块 | `{module}/` | 一个独立的业务领域或系统模块 | `system/`, `agent/`, `memory/` |
| 子模块 | `{submodule}.md` | 大模块下的具体功能模块 | `user.md`, `roles.md` |
| 数据库 | `database/` | 统一存放该大模块的数据库设计 | `system/database/`, `agent/database/` |

### 1.3 大模块划分

| 大模块 | 说明 | 子模块示例 | 数据库表 |
|--------|------|-----------|---------|
| system | 系统管理 | user.md, roles.md, code.md | t_users, t_roles, t_codes |
| agent | Agent核心 | runtime.md, skills.md | t_agent, t_skill |
| memory | 记忆系统 | profile.md, longterm.md | t_profile, t_memory |
| gateway | 网关层 | routing.md, auth.md | t_route, t_session |
| skills | 技能层 | skill_def.md, engine.md | t_skill_def |

## 二、文件命名规范

### 2.1 架构设计文档

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 模块索引 | `README.md` | system/README.md |
| 子模块文档 | `{submodule}.md` | user.md, roles.md |

### 2.2 子模块文档说明

子模块文档包含该模块的完整设计说明，包括：
- 模块的作用和目的
- 使用场景和业务价值
- 业务流程（根据实际需要，不一定是完整CRUD）
- 接口设计
- 关联的数据库表

### 2.3 数据库设计文档

位于 `database/` 子目录下：

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 数据表 | `t_{table}.md` | t_users.md, t_codes.md |
| 视图 | `v_{view}.md` | v_user_detail.md |
| 存储过程 | `p_{procedure}.md` | p_sync_data.md |

## 三、文档内容规范

### 3.1 架构设计文档模板

```markdown
# {模块名}设计

## 1. 模块概述

### 1.1 功能定位
简要说明模块的功能和定位。

### 1.2 核心价值
- 价值点1
- 价值点2

## 2. 功能设计

### 2.1 功能列表
| 功能 | 说明 |
|------|------|
| 功能1 | 说明 |

### 2.2 业务流程
```
流程图或步骤说明
```

## 3. 接口设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/xxx | GET | 说明 |

## 4. 关联文档

- [数据表设计](./database/t_xxx.md)
- [其他模块](../other/module.md)
```

### 3.2 子模块文档模板

```markdown
# {模块名}设计

## 1. 模块概述

### 1.1 功能定位
简要说明模块的功能和定位。

### 1.2 核心价值
- 价值点1
- 价值点2

### 1.3 使用场景
- 场景1：描述什么情况下使用此模块
- 场景2：描述什么情况下使用此模块

## 2. 功能设计

### 2.1 功能列表
| 功能 | 说明 |
|------|------|
| 功能1 | 说明 |
| 功能2 | 说明 |

### 2.2 业务流程
根据实际需要描述关键业务流程，不一定是完整CRUD。

**示例：创建操作**

输入参数：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 名称 |

输出结果：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 主键 |

## 3. 接口设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/xxx | GET | 说明 |

## 4. 数据库设计

- [数据表设计](./database/t_xxx.md)

## 5. 关联文档

- [其他模块](../other/module.md)
```

### 3.3 数据库设计文档模板

按照 [DATABASE_SPECIFICATION.md](./DATABASE_SPECIFICATION.md) 规范：

```markdown
# t_{表名} {中文表名}

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_{表名} |
| 中文名 | {中文名} |
| 说明 | {说明} |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 显示名称 |
| ... | ... | ... | ... | ... | ... | ... |

## 字段详细说明

### {字段名} {字段说明}

详细说明字段的用途、取值范围等。

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_{表名} | sid | 主键 |
| idx_{表名}_{字段} | {字段} | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_{表名} (
    sid VARCHAR(36) PRIMARY KEY,
    ...
);
```

## 关联文档

- [模块设计](../{module}.md)
```

## 四、目录结构示例

```
system_design/
├── README.md                          # 系统设计总索引
├── DESIGN_SPECIFICATION.md            # 设计文档规范
├── DATABASE_SPECIFICATION.md          # 数据库设计规范
├── system/                            # 系统管理模块
│   ├── README.md                      # 系统管理模块索引
│   ├── user.md                        # 用户管理设计（含业务说明）
│   ├── roles.md                        # 角色管理设计（含业务说明）
│   ├── code.md                        # 代码管理设计（含业务说明）
│   └── database/                      # 数据库设计
│       ├── t_users.md                  # 用户表
│       ├── t_roles.md                  # 角色表
│       ├── t_codes.md                  # 代码表
│       └── t_users_roles.md             # 用户角色关联表
├── agents/                            # Agents模块
│   ├── README.md                      # Agents模块索引
│   ├── runtime.md                     # 运行时设计
│   ├── skills.md                      # Skills设计
│   └── database/                      # 数据库设计
│       ├── t_agents.md                # Agents表
│       └── r_agents_skills.md         # Agents-Skills关联表
├── memory/                            # 记忆模块
│   ├── README.md                      # 记忆模块索引
│   ├── profile.md                     # 画像设计
│   ├── longterm.md                    # 长期记忆设计
│   └── database/                      # 数据库设计
│       ├── t_enterprise_profile.md    # 企业画像表
│       └── t_long_term_memory.md      # 长期记忆表
└── gateway/                           # 网关模块
    ├── README.md                      # 网关模块索引
    └── routing.md                     # 路由设计
```

## 五、规范检查清单

创建新模块时，请检查：

### 5.1 目录结构
- [ ] 模块文件夹使用小写命名
- [ ] 模块内包含 `README.md` 索引文件
- [ ] 子模块文档使用 `{submodule}.md` 命名

### 5.2 子模块文档
- [ ] 子模块文档包含：作用、使用场景、功能列表
- [ ] 子模块文档包含：业务流程（根据实际需要）
- [ ] 子模块文档包含：接口设计、关联数据库表

### 5.3 命名规范
- [ ] **模块名称使用复数形式**：如 `agents.md`、`users.md`、`roles.md`
- [ ] **数据表名使用复数形式**：如 `t_agents`、`t_users`、`t_roles`
- [ ] **关系表名使用复数形式**：如 `r_agents_skills`、`r_users_roles`

### 5.4 数据库设计
- [ ] 数据库设计放在 `database/` 子目录
- [ ] 数据表文档使用 `t_{table}.md` 命名
- [ ] 数据库设计符合 [DATABASE_SPECIFICATION.md](./DATABASE_SPECIFICATION.md)

### 5.5 文档规范
- [ ] 文档末尾包含关联文档链接

## 六、系统架构设计理念

### 6.1 Module/Function/Action 三层架构

系统采用 **Module/Function/Action** 三层架构设计理念，确保系统结构清晰、职责分明。

#### 概念定义

| 层级 | 概念 | 说明 | 示例 |
|------|------|------|------|
| 第一层 | **Module** | 系统模块，独立的功能领域 | system, org, agent, memory |
| 第二层 | **Function** | 功能点，模块内的具体功能 | user, role, departments, employee |
| 第三层 | **Action** | 操作，对功能的具体操作 | list, create, update, delete |

#### 应用场景

**1. 路由设计**
```
/api/{module}/{function}/{action}

示例：
/api/system/module     # 系统管理-模块管理-列表
/api/system/user      # 系统管理-用户管理-列表
/api/departments/departments          # 组织管理-部门管理-列表
```

**2. 数据库设计**
```
模块名：system
  ├── 功能：module (菜单模块管理)
  ├── 功能：user (用户管理)
  ├── 功能：role (角色管理)
  └── 功能：code (代码字典)

表命名：t_{function}
  - t_modules (模块表)
  - t_users (用户表)
  - t_roles (角色表)
```

**3. 权限设计**
```
权限码格式：{module}:{function}:{action}

示例：
system:module:view      # 查看模块
system:user:create      # 创建用户
org:departments:delete         # 删除部门
```

#### 设计原则

1. **Module 独立**：每个 Module 是独立的业务领域，不与其他 Module 耦合
2. **Function 单一**：每个 Function 只负责一个明确的功能点
3. **Action 标准**：Action 使用标准命名（list/get/create/update/delete）
4. **命名一致**：Module/Function/Action 的命名在路由、数据库、权限中保持一致

### 6.2 代码规范
- [ ] 设计文档可包含接口定义、数据结构声明（TypeScript interface/type）
- [ ] 设计文档**禁止**包含实现代码片段（class 实现、函数实现、SQL 执行语句等）
- [ ] 实现代码应在 `src/` 目录的代码文件中，而非设计文档中

**允许的内容示例**：
```typescript
interface MemoryFile {
  id: string;
  date: Date;
  subject: string;
}

type MemoryStatus = 'active' | 'archived';
```

**禁止的内容示例**:
```typescript
class MemoryManager {
  async save(file: MemoryFile): Promise<void> {
    await this.db.insert(file);  // ❌ 实现代码
  }
}
```

## 六、关联文档

- [系统设计总索引](./README.md)
- [数据库设计规范](./DATABASE_SPECIFICATION.md)
