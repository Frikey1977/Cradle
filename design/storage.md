# 数据存储层设计

## 概述

数据存储层负责 Cradle 系统的所有数据持久化，采用模块化设计，各业务模块独立管理其数据表。

> **文档定位**：本文档属于总体架构设计，描述系统级的数据存储策略和架构，不属于特定功能模块。

## 存储架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           数据存储层                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     结构化数据（MySQL）                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │   系统模块    │  │   组织模块    │  │   Agent模块   │          │   │
│  │  │   (system)   │  │(organization)│  │   (agent)    │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │   核心模块    │  │   定时任务    │  │   记忆模块    │          │   │
│  │  │   (core)     │  │   (cron)     │  │  (memory)    │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     向量数据（可选）                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              向量数据库 / 向量索引                          │   │   │
│  │  │           (长期记忆语义检索)                                │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     文件存储                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │   Skills定义  │  │   配置文件    │  │   日志文件    │          │   │
│  │  │  (Markdown)  │  │    (.env)    │  │   (Log)      │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 技术选型

| 数据类型 | 技术 | 说明 |
|---------|------|------|
| 关系数据 | MySQL | 生产环境主数据库 |
| 向量数据 | 向量数据库 / 向量索引插件 | 长期记忆语义检索（可选） |
| 配置数据 | .env / YAML / JSON | 环境变量和配置管理 |
| 日志数据 | 文本文件 / ELK | 按日保存的日志 |
| 技能定义 | Markdown | 技能描述文件 |
| 缓存数据 | Redis（可选） | 会话缓存、热点数据 |

## 数据库模块划分

### System 系统模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_users | 用户信息表 | [system/database/t_users.md](./system/database/t_users.md) |
| t_roles | 角色信息表 | [system/database/t_roles.md](./system/database/t_roles.md) |
| r_user_role | 用户-角色关联表 | [system/database/r_user_roles.md](./system/database/r_user_roles.md) |
| t_modules | 模块管理表 | [system/database/t_modules.md](./system/database/t_modules.md) |
| t_skill | 系统技能定义表 | [system/database/t_skill.md](./system/database/t_skill.md) |
| t_codes | 数据字典表 | [system/database/t_codes.md](./system/database/t_codes.md) |
| t_refresh_token | 刷新令牌表 | [system/database/t_refresh_token.md](./system/database/t_refresh_token.md) |
| t_exec_session | CLI执行会话表 | [system/database/t_exec_session.md](./system/database/t_exec_session.md) |
| t_exec_approval | 执行审批记录表 | [system/database/t_exec_approval.md](./system/database/t_exec_approval.md) |

### Organization 组织模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_departments | 组织架构表 | [organization/database/t_departments.md](./organization/database/t_departments.md) |
| t_departments | 部门信息表 | [organization/database/t_departments.md](./organization/database/t_departments.md) |
| t_positions | 岗位信息表 | [organization/database/t_positions.md](./organization/database/t_positions.md) |
| t_employees | 员工信息表 | [organization/database/t_employees.md](./organization/database/t_employees.md) |
| t_departments_skill | 组织技能定义表 | [organization/database/t_departments_skill.md](./organization/database/t_departments_skill.md) |

### Agent 模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_agent | Agent定义表 | [agent/database/t_agent.md](./agents/database/t_agent.md) |
| r_agent_skill | Agent技能关联表 | [agent/database/r_agent_skill.md](./agents/database/r_agent_skill.md) |

### Core 核心模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_session | 会话表 | [core/database/t_session.md](./core/database/t_session.md) |
| t_context | 上下文表（原Message） | [core/database/t_context.md](./core/database/t_context.md) |
| t_compaction_history | 压缩历史表 | [core/database/t_compaction_history.md](./core/database/t_compaction_history.md) |
| t_model_provider | 模型提供商表 | [core/database/t_model_provider.md](./core/database/t_model_provider.md) |
| t_model_definition | 模型定义表 | [core/database/t_model_definition.md](./core/database/t_model_definition.md) |
| t_model_auth | 模型认证配置表 | [core/database/t_model_auth.md](./core/database/t_model_auth.md) |

### Cron 定时任务模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_cron_job | 定时任务配置表 | [cron/database/t_cron_job.md](./cron/database/t_cron_job.md) |
| t_cron_job_history | 定时任务执行历史表 | [cron/database/t_cron_job_history.md](./cron/database/t_cron_job_history.md) |

### Memory 记忆模块

| 表名 | 说明 | 文档 |
|-----|------|------|
| t_subject | 记忆主体表 | [memory/database/t_subject.md](./memory/database/t_subject.md) |
| t_short_term_memory | 短期记忆表 | [memory/database/t_short_term_memory.md](./memory/database/t_short_term_memory.md) |
| t_relationship | Agent-Contact 双向关系表 | [memory/database/t_relationship.md](./memory/database/t_relationship.md) |

## 核心概念关系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        数据关系架构                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   t_departments (组织)                                                          │
│      │                                                                  │
│      ├── t_departments (部门)                                                  │
│      │      └── t_positions (岗位)                                       │
│      │             └── t_employees (员工)                                │
│      │                    └── t_users (用户) ───┐                        │
│      │                                         │                        │
│      └── t_departments_skill (组织技能) ───────────────┤                        │
│                                                │                        │
│   t_agent (Agent) ◄────────────────────────────┘                        │
│      │                                                                  │
│      ├── r_agent_skill ──► t_skill (系统技能)                           │
│      │                                                                  │
│      └── t_session (会话)                                               │
│             └── t_context (上下文)                                      │
│                                                                         │
│   t_cron_job (定时任务) ──► t_agent                                     │
│                                                                         │
│   t_model_provider ──► t_model_definition ──► t_model_auth            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 数据表命名规范

| 前缀 | 含义 | 示例 |
|-----|------|------|
| t_ | 数据表（存储业务数据） | t_users, t_agent |
| r_ | 关系表（多对多关联） | r_user_role, r_agent_skill |
| v_ | 视图（虚拟表） | v_user_role |

## 存储位置

```
cradle/
├── data/                      # 数据目录
│   ├── mysql/                # MySQL 数据文件
│   ├── logs/                 # 日志目录
│   │   ├── app/             # 应用日志
│   │   ├── cli/             # CLI执行日志
│   │   └── conversations/   # 对话日志
│   └── files/                # 文件存储
│       ├── skills/          # 技能定义文件
│       └── uploads/         # 上传文件
├── config/                   # 配置目录
│   ├── .env                 # 环境配置
│   └── database.yml         # 数据库配置
├── src/                      # 源代码
└── skills/                   # 技能定义目录
    └── {skill_id}.md        # 技能描述文件
```

## 数据管理策略

### 备份策略

| 数据类型 | 备份频率 | 保留时间 | 说明 |
|---------|---------|---------|------|
| 数据库全量 | 每日 | 30 天 | 完整数据备份 |
| 数据库增量 | 每小时 | 7 天 | 变更数据备份 |
| 对话日志 | 每日 | 90 天 | 压缩归档 |
| 技能定义 | 每次更新 | 永久 | Git版本控制 |

### 清理策略

| 数据类型 | 清理条件 | 清理动作 |
|---------|---------|---------|
| t_context | 会话结束超过 30 天 | 归档到冷存储 |
| t_short_term_memory | 会话结束 | 自动清理 |
| t_cron_job_history | 超过 90 天 | 归档或删除 |
| 日志文件 | 超过 90 天 | 压缩归档 |

### 归档策略

| 数据类型 | 归档条件 | 存储位置 |
|---------|---------|---------|
| 历史会话 | 超过 30 天 | 冷存储（对象存储） |
| 执行历史 | 超过 90 天 | 压缩归档 |
| 向量记忆 | 低重要性 + 长期未访问 | 降级存储 |

## 关联文档

- [数据库设计规范](./DATABASE_SPECIFICATION.md)
- [系统设计规范](./DESIGN_SPECIFICATION.md)
- [系统模块设计](./system/README.md)
- [组织模块设计](./organization/README.md)
- [Agent模块设计](./agents/README.md)
- [核心模块设计](./core/README.md)
- [定时任务模块设计](./cron/README.md)
- [记忆模块设计](./memory/README.md)
