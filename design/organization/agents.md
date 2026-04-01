# Agents 前端管理设计

## 1. 模块概述

### 1.1 功能定位

Agents 前端管理是组织管理模块的子功能，提供**数字员工**（AI Agents）的可视化管理界面。

**依赖关系**：
- 依赖 [Agents 核心设计](../agents/agents.md) 提供的业务逻辑和数据模型
- 依赖 [组织管理](departments.md) 提供的组织树结构
- 依赖 [员工管理](employees.md) 提供的用户数据

### 1.2 管理场景

**场景1：管理员配置 Agent**
- 在组织节点下创建 Agent
- 配置 Agent 的基本信息和 Skill
- 管理 Agent 的服务模式

**场景2：绑定用户**
- 为专属 Agent 绑定/解绑用户
- 查看 Agent 的使用情况

**场景3：权限管理**
- 配置 Agent 的数据权限范围
- 管理 Agent 的成本归属

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 | 对应接口 |
|------|------|---------|
| Agents 列表 | 基于组织树查看 Agents 列表 | GET /api/agents |
| 创建 Agent | 在指定组织节点创建 Agent | POST /api/agents |
| 编辑 Agent | 修改 Agent 基本信息和配置 | PUT /api/agents/:id |
| 删除 Agent | 逻辑删除 Agent | DELETE /api/agents/:id |
| 绑定用户 | 专属模式下绑定/解绑用户 | POST /api/agents/:id/bind-user |
| 解绑用户 | 解绑已绑定的用户 | POST /api/agents/:id/unbind-user |
| 配置 Skill | 管理 Agent 的 Skill 配置 | POST /api/agents/:id/skills |
| 查看 Skill 配置 | 获取合并后的 Skill 配置 | GET /api/agents/:id/skills |
| 服务模式切换 | 切换专属/共享/公共模式 | PUT /api/agents/:id/service-mode |

### 2.2 页面设计

#### 2.2.1 Agents 列表页

**布局**：
```
+------------------------------------------+
| 组织树          |  Agents 列表             |
|                 |  +------------------+   |
| [组织A]         |  | 搜索框 | 新建按钮 |   |
|   [部门1]       |  +------------------+   |
|   [部门2] ◀──   |  +------------------+   |
| [组织B]         |  | Agent卡片1       |   |
|                 |  | - 名称           |   |
|                 |  | - 编号           |   |
|                 |  | - 服务模式       |   |
|                 |  | - 操作按钮       |   |
|                 |  +------------------+   |
|                 |  | Agent卡片2       |   |
|                 |  +------------------+   |
+------------------------------------------+
```

**交互**：
- 点击组织树节点，筛选该节点下的 Agents
- 支持按名称、编号搜索
- 卡片展示关键信息，点击进入详情

#### 2.2.2 Agent 详情/编辑页

**标签页结构**：
```
+------------------------------------------+
| Agent 名称                    [编辑] [删除] |
+------------------------------------------+
| [基本信息] [Skill配置] [用户绑定] [运行日志] |
+------------------------------------------+
```

**基本信息页**：
- 名称、编号、描述
- 所属组织（可修改）
- 服务模式（专属/共享/公共）
- 头像、欢迎语
- 模型配置（JSON 编辑器）
- 运行时配置（JSON 编辑器）

**Skill 配置页**：
- 显示继承的组织 Skill 列表
- 可覆盖单个 Skill 的配置
- 可禁用特定 Skill
- 配置编辑器（表单 + JSON）

**用户绑定页**（专属模式显示）：
- 当前绑定用户展示
- 用户选择器（从员工列表选择）
- 绑定/解绑操作

### 2.3 创建 Agent 向导

**步骤1：基本信息**
- 名称（必填）
- 编号（必填，唯一）
- 描述
- 所属组织（从组织树选择）

**步骤2：服务模式**
- 选择服务模式：
  - 专属：一对一服务
  - 共享：团队共享
  - 公共：全组织可用
- 专属模式需选择绑定用户

**步骤3：Skill 配置**
- 选择组织 Skill（可选）
- 预览继承的 Skill 列表
- 配置覆盖（可选）

**步骤4：高级配置**
- 模型配置
- 运行时配置
- 头像、欢迎语

## 3. 接口设计

### 3.1 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/agents | GET | Agents 列表（支持组织筛选） |
| /api/agents/:id | GET | 获取 Agent 详情 |
| /api/agents | POST | 创建 Agent |
| /api/agents/:id | PUT | 更新 Agent |
| /api/agents/:id | DELETE | 删除 Agent |
| /api/agents/:id/bind-user | POST | 绑定用户（专属模式） |
| /api/agents/:id/unbind-user | POST | 解绑用户 |
| /api/agents/:id/skills | POST | 配置 Agent Skill（覆盖/禁用） |
| /api/agents/:id/skills | GET | 获取 Skill 配置（含继承合并） |
| /api/agents/agent-no-exists | GET | 检查 Agent 编号是否已存在 |

### 3.2 接口详情

#### GET /api/agents

**请求参数**：
```typescript
interface AgentQuery {
  org_id?: string;           // 组织ID，可选
  service_mode?: string;     // 服务模式筛选，可选
  keyword?: string;          // 关键词搜索，可选
  page?: number;             // 页码，默认1
  page_size?: number;        // 每页数量，默认20
}
```

**响应**：
```typescript
interface AgentListResponse {
  list: Array<{
    sid: string;
    name: string;
    agent_no: string;
    org_id: string;
    org_name: string;
    service_mode: 'exclusive' | 'shared' | 'public';
    bind_user_name: string | null;
    avatar: string;
    create_time: string;
  }>;
  total: number;
}
```

#### POST /api/agents

**请求参数**：
```typescript
interface CreateAgentDto {
  org_id: string;
  name: string;
  agent_no: string;
  description?: string;
  service_mode: 'exclusive' | 'shared' | 'public';
  skill_id?: string;
  bind_user_id?: string;
  model_config?: Record<string, any>;
  runtime_config?: Record<string, any>;
  avatar?: string;
  welcome_message?: string;
}
```

#### POST /api/agents/:id/bind-user

**请求参数**：
```typescript
interface BindUserDto {
  user_id: string;
}
```

#### POST /api/agents/:id/skills

**请求参数**：
```typescript
interface AgentSkillConfigDto {
  skill_id: string;
  config?: Record<string, any>;
  is_enabled?: number;       // 0=禁用, 1=启用
  priority?: number;         // 优先级
}
```

## 4. 权限控制

### 4.1 功能权限

| 功能 | 所需权限 |
|------|---------|
| 查看 Agents 列表 | organization:agents:view |
| 创建 Agent | organization:agents:create |
| 编辑 Agent | organization:agents:update |
| 删除 Agent | organization:agents:delete |
| 绑定用户 | organization:agents:bind-user |
| 配置 Skill | organization:agents:config-skill |

### 4.2 数据权限

- 用户只能查看其有权限的组织节点下的 Agents
- 基于组织树的数据权限继承
- 超级管理员可查看所有 Agents

## 5. 关联文档

- [Agents 核心设计](../agents/agents.md) - Agents 业务逻辑和架构设计
- [组织管理](departments.md) - 组织树管理
- [员工管理](employees.md) - 用户数据管理
- [岗位技能关系表](./database/r_position_skills.md) - 岗位 Skill 关联
- [员工管理表](./database/t_employeess.md) - 员工数据
- [Agents 定义表](../agents/database/t_agents.md)
- [Agents-Skills 关联表](../agents/database/r_agents_skills.md) - 关联模型
