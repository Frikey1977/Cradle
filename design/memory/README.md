# Memory 记忆系统模块

## 模块概述

记忆系统模块是 Cradle 的核心能力之一，采用**四层记忆架构**和**五重画像记忆引擎**，为 Agent 提供持久化、可检索的记忆能力。

## 架构设计

### 四层记忆系统

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: 对话日志层 (Conversation Logs)                 │
│  • 存储路径: workspace/{agent_id}/{contact_id}/conversation/ │
│  • 分层策略: 活跃层(当月) → 近期层(年/月) → 历史层(打包)   │
│  • 存储形式: 平格式文本文件，按日期存储                    │
│  • 文件名: YYYY-MM-DD.log                               │
│  • 索引: SQLite 数据库 (按年分表)                        │
│  • 用途: 审计追溯、数据恢复、重新蒸馏                      │
└─────────────────────────────────────────────────────────┘
                              │ (信息蒸馏)
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2: 长期记忆层 (Long-term Memory)                  │
│  • 存储形式: 向量数据库 (SQLite-vec)                      │
│  • 内容: 对话日志的蒸馏版 (关键事实、决策、知识)           │
│  • 用途: 语义检索、知识复用                               │
└─────────────────────────────────────────────────────────┘
                              │ (建立索引)
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3: 记忆索引层 (Memory Index)                      │
│  • 存储形式: SQLite 表                                  │
│  • 内容: 主题 → 长期记忆ID 的映射                         │
│  • 用途: 快速定位、主题检索                               │
└─────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────┐
│  Layer 4: 短期记忆层 (Short-term Memory)                 │
│  • 存储形式: 内存/Redis                                 │
│  • 内容: 当前会话窗口内的近期对话                          │
│  • 用途: 维持对话连贯性                                   │
└─────────────────────────────────────────────────────────┘
```

### 五重画像记忆引擎

| 画像维度 | 核心作用 | 存储表 |
|---------|---------|--------|
| **企业画像** | 定义 Agent 所处的企业环境 | t_enterprise_profile |
| **岗位画像** | 定义 Agent 的工作职责和行为边界 | t_positions_profile |
| **Agent 事实** | 定义 Agent 的行事风格和个性特征 | t_agent_fact |
| **关系特异性偏好** | 定义 Agent 对特定交互对象的差异化反应 | t_relationship |
| **Contact 事实** | 定义 Contact 的个人信息和偏好 | t_contact_fact |

## 文档索引

### 设计文档

| 文档 | 说明 |
|------|------|
| [四层记忆系统](./four_layers.md) | 四层记忆架构详细设计 |
| [五重画像引擎](./five_profiles.md) | 五重画像记忆引擎设计 |

### 四层记忆详细设计

| 文档 | 说明 |
|------|------|
| [对话日志层](./layer_conversation.md) | Layer 1: 原始对话日志存储 |
| [长期记忆层](./layer_long_term.md) | Layer 2: 蒸馏后的关键信息存储 |
| [记忆索引层](./layer_memory_index.md) | Layer 3: 主题索引管理 |
| [短期记忆层](./layer_short_term.md) | Layer 4: 当前会话上下文管理 |

### 五重画像详细设计

| 文档 | 说明 |
|------|------|
| [企业画像](./profile_enterprise.md) | 定义 Agent 所处的企业环境 |
| [岗位画像](./profile_position.md) | 定义 Agent 的工作职责和行为边界 |
| [Agent 事实](./profile_agent_fact.md) | 定义 Agent 的行事风格和个性特征 |
| [关系偏好](./profile_relationship.md) | 定义 Agent 对特定 Contact 的差异化反应 |
[Contact 事实](./profile_contact_fact.md) | 定义 Contact 的个人信息和偏好 |

### 存储设计

#### 对话日志层 (文件存储)

| 文档 | 说明 |
|------|------|
| [对话日志存储设计](./conversation_storage.md) | 平格式文件存储方案 |

**存储结构**（按年分层，位置不变）：
```
workspace/{agent_id}/{contact_id}/conversation/
├── 2026/                        # 2026年目录
│   ├── index.db                 # 2026年索引
│   ├── 2026-01-15.log           # 日志文件
│   ├── 2026-01-16.log.gz        # 已压缩日志
│   └── ...
├── 2025/                        # 2025年目录
│   ├── index.db
│   └── ...
├── 2024/                        # 2024年目录
└── archive/                     # 长期归档（超过3年）
    └── 2023_all.tar.gz
```

**核心原则**：文件创建时直接根据年份放入对应目录，位置永不改变。

**存储策略**：
| 阶段 | 存储方式 | 触发条件 |
|------|---------|---------|
| 写入 | 原始文本 | 根据时间年份直接写入 |
| 压缩 | gzip压缩 | 超过30天 |
| 归档 | tar.gz打包 | 超过3年 |

**多 Contact 场景**：
```
workspace/agent_001/
├── contact_001/conversation/   # Contact 1的对话
├── contact_002/conversation/   # Contact 2的对话
└── contact_003/conversation/   # Contact 3的对话
```

**相关数据表** (仅元数据):
| 表名 | 类型 | 说明 | 文档 |
|------|------|------|------|
| t_conversation | 数据表 | 会话元数据 | [查看](./database/t_conversation.md) |

#### 长期记忆层

| 表名 | 类型 | 说明 | 文档 |
|------|------|------|------|
| t_long_term_memory | 数据表 | 长期记忆表 | [查看](./database/t_long_term_memory.md) |

#### 记忆索引层

| 表名 | 类型 | 说明 | 文档 |
|------|------|------|------|
| t_memory_index | 数据表 | 记忆索引表 | [查看](./database/t_memory_index.md) |
| r_memory_topic | 关系表 | 记忆-主题关联表 | [查看](./database/r_memory_topic.md) |

#### 五重画像层

| 表名 | 类型 | 说明 | 文档 |
|------|------|------|------|
| t_enterprise_profile | 数据表 | 企业画像表 | [查看](./database/t_enterprise_profile.md) |
| t_positions_profile | 数据表 | 岗位画像表 | [查看](./database/t_positions_profile.md) |
| t_agent_fact | 数据表 | Agent 事实表 | [查看](./database/t_agent_fact.md) |
| t_relationship | 数据表 | Agent-Contact 双向关系表（关系特异性偏好） | [查看](./database/t_relationship.md) |
| t_contact_fact | 数据表 | Contact 事实表 | [查看](./database/t_contact_fact.md) |

## 关联文档

- [系统架构设计](../ARCHITECTURE.md)
- [Agent 运行时设计](../agents/runtime.md)
- [Gateway 网关层设计](../gateway/routing.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
