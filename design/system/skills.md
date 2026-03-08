# 系统技能管理设计（AgentSkills 兼容）

## 1. 功能定位

系统技能管理是系统级基础设施，负责 **AgentSkills 标准 Skill** 的安装索引、版本管理和权限控制。

### 1.1 核心设计原则

**数据库表 = 安装索引 + 元数据管理**
- 数据库存储：Skill 安装位置、版本、启用状态、权限配置
- 文件系统存储：实际 SKILL.md 内容（遵循 [AgentSkills 标准](https://agentskills.io)）
- 运行时加载：从文件系统读取 SKILL.md，按 AgentSkills 标准解析执行

**完全兼容 AgentSkills 标准**：
- 支持 AgentSkills 标准格式的 Skill（SKILL.md）
- 运行时行为与 OpenClaw 完全一致
- **安全管控**：所有 Skill 必须经过企业管理员审核后才能上传使用
- **建议流程**：从 [ClawHub](https://clawhub.com) 等渠道下载 → 安全审核 → 本地上传 → 内部使用

### 1.2 核心价值

- **生态兼容**：支持 AgentSkills 标准格式，可复用公开 Skill（需审核）
- **标准化**：遵循 AgentSkills 行业标准
- **版本控制**：支持 Skill 的版本管理和升级
- **权限管控**：控制哪些 Skill 可以被使用

## 2. 与 AgentSkills 标准的关系

### 2.1 AgentSkills 标准格式

每个 Skill 是一个文件夹，包含 `SKILL.md`：

```markdown
---
name: github
description: "Interact with GitHub using the gh CLI"
metadata:
  {
    "openclaw":
      {
        "emoji": "🐙",
        "requires": { "bins": ["gh"], "env": ["GITHUB_TOKEN"] },
        "install": [{ "id": "brew", "kind": "brew", "formula": "gh" }],
        "primaryEnv": "GITHUB_TOKEN"
      }
  }
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub...
```

### 2.2 我们的实现

```
┌─────────────────────────────────────────────────────────────┐
│                     数据库存储（t_skill）                      │
├─────────────────────────────────────────────────────────────┤
│  name: "GitHub"                                              │
│  slug: "github"                                              │
│  source_type: "local"                                        │
│  source_url: "https://clawhub.com/skills/github"            │  // 原始来源（仅记录）
│  install_path: "local/github"                                │
│  skill_md_path: "registry/github/SKILL.md"                  │
│  metadata: { requires: {...}, install: {...} }              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   文件系统存储（SKILL.md）                     │
├─────────────────────────────────────────────────────────────┤
│  {skills_root}/local/github/SKILL.md                        │
│  ├── YAML frontmatter（name, description, metadata）         │
│  └── Markdown content（Skill 使用说明）                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      运行时加载                               │
├─────────────────────────────────────────────────────────────┤
│  1. 读取 SKILL.md 文件                                        │
│  2. 解析 YAML frontmatter                                     │
│  3. 按 AgentSkills 标准执行                                   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Skill 来源类型

**安全原则**：仅支持本地上传，不允许未经审核的 Skill 进入企业内部

| 类型 | 说明 | 示例 |
|------|------|------|
| **builtin** | 系统内置 | 随系统安装的基础 Skill（经过安全审核） |
| **local** | 本地上传 | 企业管理员审核后上传的 Skill |

**注意事项**：
- **不支持直接从 ClawHub 等公开仓库安装**：避免引入未经审核的 Skill 带来安全隐患
- **不支持从 Git 仓库直接克隆**：防止引入不可信代码
- **所有 Skill 必须经过企业管理员审核**：通过本地上传方式导入
- **Skill 审核流程**：下载公开 Skill → 安全审核 → 本地上传 → 内部使用

## 4. Skill 安装流程

### 4.1 Skill 审核与上传流程（推荐）

```
从公开渠道获取 Skill（如 ClawHub、GitHub）
    ↓
安全审核：检查 SKILL.md 内容和关联代码
    ↓
确认无安全隐患后，通过管理界面上传
    ↓
系统验证 SKILL.md 格式（AgentSkills 标准）
    ↓
复制到 {skills_root}/local/{skill-name}/
    ↓
解析 SKILL.md 获取 metadata
    ↓
写入 t_skill 数据库记录（source_type: local）
    ↓
完成安装，可在 org-skill 中引用
```

**安全审核要点**：
- 检查 SKILL.md 中的指令是否存在恶意代码
- 验证 required binaries 是否为可信工具
- 确认 env 变量不会泄露敏感信息
- 审查自定义脚本的安全性

### 4.2 本地 Skill 上传（管理员）

```
用户上传 Skill 文件夹
    ↓
验证 SKILL.md 格式（AgentSkills 标准）
    ↓
复制到 {skills_root}/local/{skill-name}/
    ↓
解析 SKILL.md 获取 metadata
    ↓
写入 t_skill 数据库记录（source_type: local）
    ↓
完成安装
```

## 5. 功能列表

| 功能 | 说明 |
|------|------|
| Skill 浏览 | 浏览已安装的 Skill 列表 |
| Skill 浏览 | 浏览已安装的 Skill 列表 |
| Skill 上传 | 管理员上传经过审核的 Skill |
| Skill 更新 | 更新 Skill 到最新版本（需重新审核） |
| Skill 卸载 | 删除已安装的 Skill |
| Skill 启用/禁用 | 控制 Skill 的可用状态 |
| Skill 导出 | 导出 Skill 用于备份或共享 |
| Skill 审核记录 | 查看 Skill 的审核历史和版本变更 |

## 6. 与 org-skills 的关系

```
system-skills（系统级安装索引）
    ├── github (v1.0.0) [local - 已审核]
    ├── notion (v2.1.0) [local - 已审核]
    └── slack (v1.5.0) [builtin]
            ↓ 被引用
org-skills（组织级 Skill 组合）
    ├── Dev-Team-Skill
    │   └── 可用 Skill：[github, notion]
    └── HR-Team-Skill
        └── 可用 Skill：[slack]
            ↓ 分配给 Agent
Agent（运行时）
    ├── 读取 SKILL.md 文件
    ├── 应用 org-skill 配置
    ├── 应用 agent-skill 配置覆盖
    └── 按 AgentSkills 标准执行
```

## 7. 运行时行为

### 7.1 Skill 加载流程

```
1. Agent 启动
   ↓
2. 查询 t_skill 获取所有启用的 Skill 元数据
   ↓
3. 根据 install_path 读取 SKILL.md 文件
   ↓
4. 按 AgentSkills 标准解析 SKILL.md
   ↓
5. 根据 metadata.requires 进行过滤（bins/env/config）
   ↓
6. 将符合条件的 Skill 加入可用列表
   ↓
7. 构建 System Prompt 时注入 Skill 描述
```

### 7.2 配置合并规则

```
最终生效配置：
    r_agent_skill.config（Agent 级，最高优先级）
←   t_departments_skill.config（组织级）
←   SKILL.md 默认配置（最低优先级）
```

### 7.3 环境变量注入

```
1. 读取 r_agent_skill.env
2. 读取 t_departments_skill.env
3. 合并（Agent 级优先）
4. 注入到 Agent 运行时环境
5. 处理 primaryEnv → apiKey 映射
```

## 8. 与 OpenClaw 的兼容性

| 方面 | OpenClaw | 我们的实现 |
|------|----------|-----------|
| **Skill 格式** | SKILL.md + YAML frontmatter | ✅ 完全一致 |
| **加载优先级** | workspace > managed > bundled | ✅ 通过 source_type 区分 |
| **过滤机制** | requires.bins/env/config | ✅ 完全一致 |
| **配置注入** | openclaw.json entries | ✅ 通过 org-skill/agent-skill 配置 |
| **安装方式** | ClawHub CLI / 手动复制 | ✅ Web UI + 自动同步 |
| **环境变量** | skills.entries.<skill>.env | ✅ r_agent_skill.env |
| **调用策略** | user-invocable / disable-model-invocation | ✅ r_agent_skill.invocation |

## 9. 接口设计

### 9.1 路由列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/skill` | Skill 列表（已安装） |
| GET | `/api/system/skill/:id` | Skill 详情 |
| POST | `/api/system/skill/upload` | 上传 Skill（本地文件，需管理员权限） |
| PUT | `/api/system/skill/:id/update` | 更新 Skill（需重新审核） |
| DELETE | `/api/system/skill/:id` | 卸载 Skill |
| PUT | `/api/system/skill/:id/status` | 启用/禁用 Skill |
| GET | `/api/system/skill/:id/audit-log` | 获取 Skill 审核历史 |

### 9.2 上传 Skill 接口（管理员）

```typescript
// 上传经过审核的 Skill
POST /api/system/skill/upload
Content-Type: multipart/form-data
Authorization: Bearer {admin_token}

// 请求体
{
  "file": <skill-folder.zip>,           // Skill 文件夹压缩包（必须包含 SKILL.md）
  "slug": "github",                     // Skill 标识符
  "version": "1.0.0",                   // 版本号
  "audit_notes": "已审核，无安全隐患"    // 审核备注
}

// 响应
{
  "code": 200,
  "data": {
    "id": "skill-001",
    "name": "GitHub",
    "slug": "github",
    "version": "1.0.0",
    "source_type": "local",
    "status": "active",
    "audit_info": {
      "auditor": "admin@company.com",
      "audit_time": "2026-02-13T10:00:00Z",
      "audit_notes": "已审核，无安全隐患"
    }
  }
}
```

## 10. 数据表设计

- [系统技能表（AgentSkills 兼容）](./database/t_system_skills.md)

## 11. 关联文档

- [系统管理模块](./README.md)
- [组织技能定义](../organization/skills.md)
- [Agent 管理设计](../agents/agents.md)
- [AgentSkills 标准](https://agentskills.io)
- [OpenClaw Skills 文档](/docs/tools/skills.md)
- [ClawHub](https://clawhub.com)
