# 记忆系统数据库设计

## 概述

记忆系统采用**混合存储架构**：
- **文件存储**：对话日志、长期记忆（Markdown）
- **向量数据库**：记忆索引（Chroma）
- **关系数据库**：Subject管理、短期记忆、关系偏好

## 存储分层

| 层级 | 存储方式 | 说明 |
|------|---------|------|
| 对话日志层 | 文件系统 | 按年月日存储日志文件，JSON格式 |
| 长期记忆层 | Markdown 文件 | 按 Subject 分片存储，跨时间连续 |
| 记忆索引层 | Chroma 向量库 | Subject 语义检索 |
| Subject管理层 | 关系数据库 | Subject 元数据管理 |
| 短期记忆层 | 关系数据库 | 会话近期消息（15条） |
| 关系偏好层 | 关系数据库 | Agent-User 绑定关系 |

## 数据库表清单

| 表名 | 说明 | 文档 |
|------|------|------|
| t_subject | Subject 管理表 | [查看](./t_subject.md) |
| t_short_term_memory | 短期记忆表 | [查看](./t_short_term_memory.md) |
| t_relationship | Agent-Contact 双向关系表 | [查看](./t_relationship.md) |

## 统一存储路径

所有记忆统一按 Agent 存储，不再按用户隔离：

```
workspace/{agent_id}/
├── conversation/                 # 对话日志
│   └── YYYY/
│       └── YYYY-MM-DD.log      # JSON格式日志
├── long_term/                    # 长期记忆（按Subject）
│   ├── subjects.json             # Subject注册表
│   ├── subject-sub_001.md        # Subject记忆文件
│   └── subject-sub_002.md
└── index/
    └── chroma.db                 # Subject向量索引
```

**设计原则**：
- 所有员工（用户）的对话统一存储在同一个 Agent 目录下
- 长期记忆按 Subject 分片，支持跨时间连续性
- 在日志内容中通过 `speaker.user_id` 区分不同用户
- 支持员工离职交接，新员工可查看完整历史上下文

## Subject 设计优势

| 传统按日存储 | Subject 分片存储 |
|-------------|-----------------|
| 跨天项目分散在多文件 | 同一项目持续累积在一个文件 |
| 难以追踪完整上下文 | 完整项目历史一目了然 |
| 检索需跨文件查询 | 直接定位到 Subject 文件 |
| 论据容易失证 | 完整论据链保持连续 |

## 员工交接场景

```
员工A离职，员工B接手同一岗位
    ↓
员工B与Agent开始会话
    ↓
Agent查询短期记忆（按session）
    ↓
返回最近15条消息（含员工A的对话）
    ↓
员工B了解上下文，继续工作
    ↓
如需了解历史项目
    ↓
语义检索 Subject → 获取完整项目记忆
```

## 文件存储清单

| 存储类型 | 路径 | 说明 |
|---------|------|------|
| 对话日志 | `workspace/{agent_id}/conversation/YYYY/YYYY-MM-DD.log` | JSON格式，含发言人信息 |
| Subject注册表 | `workspace/{agent_id}/long_term/subjects.json` | Subject元数据索引 |
| Subject记忆 | `workspace/{agent_id}/long_term/subject-{id}.md` | Markdown格式，跨时间累积 |
| 记忆索引 | `workspace/{agent_id}/index/chroma.db` | Chroma向量库 |

## 关联文档

- [四层记忆系统](../four_layers.md)
- [对话日志层](../layer_conversation.md)
- [长期记忆层](../layer_long_term.md)
- [记忆索引层](../layer_memory_index.md)
- [短期记忆层](../layer_short_term.md)
- [关系偏好](../profile_relationship.md)
