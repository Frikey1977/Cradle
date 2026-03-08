# Agent 管理模块

## 模块概述

Agent 管理模块是组织管理的子模块，负责**数字员工**（AI Agent）的统一管理。

**重要概念**：
- **数字员工**：AI Agent，存储在 `t_agents` 表
- **人类员工**：真实的人，存储在 `t_employees` 表（员工管理模块）
- 两者是**平行关系**，共同构成企业员工体系

## 核心设计原则

### 1. 岗位能力沉淀

Agent 归属组织节点，沉淀该岗位的能力和经验：
- **不随人员变动而变动**：人员转岗时，Agent 留在原岗位
- **成本归属明确**：API/算力费用计入 Agent 所属部门
- **知识传承**：岗位经验通过 Agent 传承给接替者

### 2. 数据权限分离

- **Agent 决定能力范围**：通过 org-skill 定义可用 Skill
- **用户决定数据权限**：通过岗位（t_positions）的数据权限范围（data_scope）控制

### 3. 服务模式灵活

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **专属** | 一对一服务 | 高管个人助理 |
| **共享** | 多用户共享 | 部门协作助手 |
| **公共** | 全组织可用 | 公共服务（IT/HR支持） |

### 4. 运行时架构（1 Worker = 1 Agent）

每个 Agent 运行在独立的 Worker 进程中，实现完全隔离：

```
Master 进程
    ├── Channel 插件（身份识别、路由决策）
    └── Worker 进程管理
            ↓
    Worker-1 (Agent-A)    Worker-2 (Agent-B)    Worker-3 (Agent-C)
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │AgentRuntime │       │AgentRuntime │       │AgentRuntime │
    │  - 心跳     │       │  - 心跳     │       │  - 心跳     │
    │  - Context  │       │  - Context  │       │  - Context  │
    │  - LLM      │       │  - LLM      │       │  - LLM      │
    └─────────────┘       └─────────────┘       └─────────────┘
```

**优势**：
- 完全隔离：Agent 之间互不影响
- 无协调问题：无需分布式锁
- 故障隔离：单个 Agent 崩溃不影响其他 Agent
- 心跳简化：每个 Worker 只管理一个心跳

## 文档索引

| 文档 | 说明 |
|------|------|
| [AGENT_INSTANTIATION.md](./AGENT_INSTANTIATION.md) | Agent 实例化与运行时架构设计 |
| [runtime.md](./runtime.md) | Agent 运行时层详细设计 |
| [heartbeat.md](./heartbeat.md) | Agent 心跳机制设计 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Agent 系统整体架构 |
| [database/t_agents.md](./database/t_agents.md) | Agent 数据库表设计 |
| [database/r_agents_skills.md](./database/r_agents_skills.md) | Agent-Skill 关联表设计 |

## 数据模型

### 核心关系

```
组织管理
├── 员工管理
│   └── t_employees（人类员工）
│       └── 可以绑定 Agent（专属/共享）
│
└── Agent管理
    └── t_agents（数字员工）
        ├── oid → 所属组织（沉淀岗位能力）
        ├── mode → 服务模式（exclusive/shared/public/department）
        ├── config → 模型配置 + 运行时配置
        ├── profile → 个人事实与偏好
        ├── heartbeat → 心跳配置
        └── r_agents_skills → Skill 关联
```

### 运行时架构

```
t_agents (数据库配置)
    ↓
AgentRuntime (内存对象，每个 Worker 一个)
    ├── ContextModule (上下文构建)
    ├── LLMService (LLM 调用)
    ├── HeartbeatScheduler (心跳调度)
    └── RuntimeState (运行时状态)
```

### 与组织模块的关系

| 模块 | 管理对象 | 数据表 |
|------|---------|--------|
| 组织管理 | 组织架构 | t_departments |
| 岗位管理 | 员工岗位 | t_positions |
| 技能定义 | Agent 技能 | t_skills |
| 员工管理 | 人类员工 | t_employees |
| **Agent管理** | **数字员工** | **t_agents** |

## 功能列表

| 功能 | 说明 |
|------|------|
| Agent 创建 | 在指定组织节点下创建数字员工 |
| 基础配置 | 设置名称、描述、头像、欢迎语 |
| 模型配置 | 配置 LLM 模型参数（存储在 config 字段） |
| 技能绑定 | 通过 r_agents_skills 关联 Skill |
| 服务模式 | 设置 exclusive/shared/public/department |
| 心跳配置 | 配置心跳间隔、活跃时间、提示词 |
| 运行时配置 | 配置行为参数（延迟、身份等） |
| 状态管理 | 启用/停用/暂停 Agent |
| 成本查看 | 查看 API 调用费用统计 |

## 管理界面

### 界面布局

```
┌─────────────────────────────────────────────────────────┐
│  组织树（左侧）                                           │
│  ├── 示例科技有限公司                                      │
│  │   ├── 技术部                                           │
│  │   │   └── 后端组                                        │
│  │   ├── 销售部                                           │
│  │   └── 人事部                                           │
│  └── ...                                                  │
├─────────────────────────────────────────────────────────┤
│  Agent 列表（右侧）                                        │
│  ┌─────────────┬──────────┬──────────┬─────────┐        │
│  │ 名称        │ 服务模式 │ 状态     │ 操作    │        │
│  ├─────────────┼──────────┼──────────┼─────────┤        │
│  │ 代码助手    │ 共享     │ 启用     │ [编辑]  │        │
│  │ 张总助理    │ 专属     │ 启用     │ [编辑]  │        │
│  │ IT支持      │ 公共     │ 启用     │ [编辑]  │        │
│  └─────────────┴──────────┴──────────┴─────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 操作流程

**创建 Agent**：
```
1. 展开组织树，选择目标组织节点
2. 点击"创建 Agent"
3. 填写基础信息（名称、描述）
4. 选择 Skill（通过 r_agents_skills 关联）
5. 设置服务模式（exclusive/shared/public）
6. 配置心跳参数（interval, activeHours, prompt）
7. 配置模型参数（可选，存储在 config.model）
8. 配置运行时行为（可选，存储在 config.runtime）
9. 保存创建
10. Master 自动 fork 新的 Worker 进程
```

**编辑 Agent**：
```
1. 在列表中选择 Agent
2. 修改基础信息
3. 调整 Skill 配置
4. 修改服务模式
5. 保存变更（实时生效）
```

## 服务模式详解

### 专属模式（exclusive）

**特点**：
- 一对一服务关系
- 通过 t_relationship 表建立 Agent-Contact 关系
- 可访问该用户的个人数据

**适用场景**：
- 高管个人助理
- VIP 客户服务
- 核心岗位专属支持

**数据权限**：
- 可以访问绑定用户的个人数据
- 受用户岗位数据权限约束

### 共享模式（shared）

**特点**：
- 多用户共享使用
- 多个 Contact 通过 t_relationship 关联到同一个 Agent
- 根据当前对话用户确定数据权限

**适用场景**：
- 部门协作助手
- 团队共享工具
- 项目组支持

**数据权限**：
- 根据当前对话用户的岗位确定权限
- 不同用户看到不同数据范围

### 公共模式（public）

**特点**：
- 全组织可用
- 无需通过 t_relationship 绑定
- 提供标准化服务

**适用场景**：
- IT 技术支持
- HR 政策咨询
- 公司 FAQ

**数据权限**：
- 只能访问公开数据
- 或根据用户身份动态调整

### 部门模式（department）

**特点**：
- 绑定到特定部门
- 部门内所有成员可用
- 通过 t_relationship 批量建立关系

**适用场景**：
- 部门内部工具
- 垂直业务支持

## 运行时生命周期

### Agent 启动流程

```
Master 进程启动
    ↓
读取 t_agents 表中 status='enabled' 的 Agent
    ↓
为每个 Agent fork 独立的 Worker 进程
    ↓
Worker 进程内：
    - 创建 AgentRuntime 对象
    - 加载 Agent 配置
    - 初始化 ContextModule
    - 启动 HeartbeatScheduler
    ↓
Agent 进入运行状态，等待消息
```

### 消息处理流程

```
用户发送消息
    ↓
Channel Plugin（Master 进程）
    - 身份识别：token → employee_id → contact_id
    - 路由决策：查询 t_relationship 确定 agentId
    ↓ IPC
Worker 进程接收消息
    ↓
AgentRuntime.handleMessage()
    ├─ 调用 ContextModule.buildContext()（五重画像、记忆等）
    ├─ 调用 LLMService.generate()（LLM 推理）
    └─ 返回响应
    ↓ IPC
Master 进程返回响应给用户
```

### 心跳执行流程

```
HeartbeatScheduler 触发
    ↓
检查条件：
    - 心跳是否启用
    - 是否在活跃时间窗
    - Agent 是否空闲
    ↓
构建心跳消息（isHeartbeat: true）
    ↓
AgentRuntime.handleMessage()
    ├─ ContextModule.buildContext()
    ├─ LLMService.generate()
    └─ 处理响应
    ↓
HEARTBEAT_OK 抑制检查
    ↓
投递给用户（如有需要）
    ↓
调度下次心跳
```

## 与员工管理的关系

### 绑定关系

```
t_employees（人类员工）        t_agents（数字员工）
     │                              │
     │ 专属模式：t_relationship      │
     │  - type: 'agent_contact'      │
     │  - binding_mode: 'exclusive'  │
     └──────────────────────────────┘
            一对一绑定

     │                              │
     │ 共享/公共模式：多对多关系     │
     │  - t_relationship             │
     │  - binding_mode: 'shared'     │
     │                              │
            多对多使用
```

### 协作场景

| 场景 | 人类员工 | 数字员工 | 关系 |
|------|---------|---------|------|
| 高管助理 | 张总 | 张总助理 | 专属一对一 |
| 团队支持 | 技术部全员 | 代码助手 | 共享多对一 |
| 公共服务 | 全公司员工 | IT支持 | 公共多对多 |

## 成本管理

### 成本归属

| 服务模式 | 成本归属 | 说明 |
|---------|---------|------|
| 专属 | 绑定用户所在部门 | 随用户调动而变动 |
| 共享 | Agent 所属组织 | 固定归属 |
| 公共 | Agent 所属组织 | 固定归属 |

### 成本统计

```sql
-- 按组织统计 Agent 成本
SELECT 
    o.name as org_name,
    COUNT(a.sid) as agent_count,
    SUM(a.api_cost_monthly) as monthly_cost
FROM t_agents a
JOIN t_departments o ON a.oid = o.sid
WHERE a.deleted = 0
GROUP BY a.oid;
```

## 数据库设计

### 数据表

| 表名 | 说明 | 文档 |
|------|------|------|
| t_agents | Agent 定义表（数字员工） | [database/t_agents.md](./database/t_agents.md) |
| t_relationship | Agent-Contact 关系表（替代废弃的 r_agents_contacts） | [database/t_relationship.md](../organization/database/t_relationship.md) |

### 关系表

| 表名 | 说明 | 文档 |
|------|------|------|
| r_agents_skills | Agent-Skill 关联表 | [database/r_agents_skills.md](./database/r_agents_skills.md) |
| r_channel_agent | 通道-Agent 绑定表 | [database/r_channel_agent.md](../gateway/database/r_channel_agent.md) |

### 关联表

| 表名 | 说明 |
|------|------|
| t_employees | 人类员工表（通过 contact 间接关联） |
| t_contacts | 联系人表（身份归一化） |
| t_departments | 组织部门表 |
| t_skills | 技能定义表 |

## 废弃说明

以下表已废弃，统一使用 `t_relationship` 表管理关系：

| 废弃表名 | 替代方案 |
|---------|---------|
| r_agents_contacts | t_relationship (type='agent_contact') |
| r_agents_users | t_relationship (通过 contact 间接关联) |

## 相关文档

- [Agent 实例化架构](./AGENT_INSTANTIATION.md) - Agent 运行时架构详细设计
- [Agent 运行时层](./runtime.md) - AgentRuntime 详细设计
- [Agent 心跳设计](./heartbeat.md) - 心跳机制设计
- [Agent 系统架构](./ARCHITECTURE.md) - 整体架构设计
- [数据库设计 - t_agents](./database/t_agents.md) - Agent 表结构
