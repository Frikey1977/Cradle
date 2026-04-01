# Skill 系统设计

## 概述

Skill 系统采用 **LLM 理解执行模式**，与 OpenClaw 保持一致。Skill 是知识文档，LLM 理解后自主决定如何执行，而不是预定义命令的参数替换执行。

## 核心设计原则

### 1. LLM 理解执行

```
传统方式（命令解析执行）：
  Skill → 解析命令 → 参数替换 → Shell 执行

OpenClaw/Cradle 方式（LLM 理解执行）：
  Skill 列表 → LLM 选择 → 读取完整内容 → LLM 自主执行
```

### 2. 渐进式披露

```
第一级（Agent 层）：Skill 列表
  - 只传 name + description + location
  - 用于 LLM 判断哪个 Skill 适用

第二级（Executor 层）：完整 Skill 内容
  - LLM 通过 read 工具读取 SKILL.md
  - 理解后自主决定如何执行
```

### 3. 多源合并

```
优先级（从低到高）：
  1. bundled skills（内置）
  2. ~/.cradle/skills（managed）
  3. <workspace>/skills（workspace，最高优先级）
```

## 架构集成

### 三层 Skill 披露架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent 层                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 职责：                                                  │   │
│  │ 1. 识别用户意图                                         │   │
│  │ 2. 从 Position Skills 中筛选相关 Skills                 │   │
│  │ 3. 将相关 Skills + 对话 + 记忆 传递给 Orchestrator      │   │
│  │                                                         │   │
│  │ 披露内容：相关 Skills (1-3个)                           │   │
│  │ - name + description + location                         │   │
│  │ - 只传递与任务相关的 Skills                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 传递：相关 Skills + 对话 + 记忆
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator 层                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 职责：                                                  │   │
│  │ 1. 基于相关 Skills 规划任务步骤                         │   │
│  │ 2. 为每个 Executor 明确指定使用的 Skill                 │   │
│  │ 3. 通过 task 指令告知 Executor 读取 SKILL.md            │   │
│  │                                                         │   │
│  │ 披露内容：任务相关的 Skill metadata                     │   │
│  │ - 在 PlanStep 中设置 skillSlug                          │   │
│  │ - 在 task 指令中明确 Skill 路径                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 传递：明确指令 (包含 Skill 路径)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Executor 层                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 职责：                                                  │   │
│  │ 1. 接收明确任务指令                                     │   │
│  │ 2. 根据指令读取 SKILL.md                                │   │
│  │ 3. 理解后调用工具执行                                   │   │
│  │                                                         │   │
│  │ 披露内容：完整的 SKILL.md 内容                          │   │
│  │ - 通过 read 工具按需读取                                │   │
│  │ - 理解后自主执行                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Agent 层

```
职责：
  - 加载 Position 关联的 Skill 列表
  - 识别用户意图，筛选相关 Skills
  - 将相关 Skills 注入 System Prompt
  - 调用 Orchestrator 时只传递相关 Skills

Skill 筛选逻辑：
  1. 获取 Position 关联的全部 Skills
  2. 分析用户请求和 Agent 思考内容
  3. 选择最相关的 1-3 个 Skills
  4. 只将相关 Skills 传递给 Orchestrator

传递给 Orchestrator：
  {
    task: "用户任务描述",
    skills: [/* 只包含相关的 Skills */],
    conversationHistory: [...],
    memories: [...]
  }
```

### Orchestrator 层

```
职责：
  - 基于 Agent 筛选的 Skills 进行任务编排
  - 在 PlanStep 中明确指定 skillSlug
  - 为 Executor 构建包含 Skill 路径的任务指令

任务规划：
  - 分析任务需要哪些 Skill（从 Agent 传递的列表中选择）
  - 在 PlanStep.config.skillSlug 中指定 Skill
  - 在 task 指令中明确告知读取 SKILL.md 的路径

传递给 Executor：
  ## 执行任务
  
  **目标**: 读取 F:\...\pptx\SKILL.md，了解如何使用 PptxGenJS
  
  **使用 Skill**: pptx
  **Skill 路径**: F:\...\skills\pptx
  
  **重要提示**:
  1. 如果尚未读取，请先读取 F:\...\skills\pptx\SKILL.md
  2. 严格按照 SKILL.md 的指引执行
```

### Executor 层

```
职责：
  - 接收明确的任务指令（包含 Skill 路径）
  - 使用 read 工具读取 SKILL.md
  - 理解后调用其他工具执行

执行流程：
  1. LLM 收到明确任务指令
  2. 根据指令中的路径读取 SKILL.md
  3. 理解 Skill 内容
  4. 调用 exec、write、read 等工具执行
  5. 返回执行结果
```

## Skill 文件格式

### 标准 SKILL.md

```markdown
---
name: pptx
description: "Use this skill any time a .pptx file is involved..."
---

# PPTX Skill

## Quick Reference
...

## Reading Content
```bash
python -m markitdown presentation.pptx
```

## Design Ideas
...
```

### Frontmatter 字段

| 字段 | 必需 | 说明 |
|------|------|------|
| name | 是 | Skill 名称（唯一标识） |
| description | 是 | 简短描述，用于 LLM 判断 |
| homepage | 否 | 文档链接 |
| user-invocable | 否 | 是否可作为用户命令（默认 true） |
| disable-model-invocation | 否 | 是否从 Prompt 中排除（默认 false） |

### Metadata（OpenClaw 兼容）

```yaml
metadata:
  openclaw:
    emoji: "📊"
    homepage: "https://example.com"
    requires:
      bins: ["python"]
      env: ["OPENAI_API_KEY"]
    os: ["darwin", "linux", "win32"]
```

## Skill 加载流程

```typescript
interface SkillLoader {
  // 加载所有 Skill
  loadAll(workspaceDir: string): Promise<SkillEntry[]>;

  // 过滤符合条件的 Skill
  filter(entries: SkillEntry[], context: SkillContext): SkillEntry[];

  // 构建 Prompt
  buildPrompt(entries: SkillEntry[]): string;
}

interface SkillEntry {
  name: string;
  description: string;
  location: string;
  filePath: string;
  metadata?: SkillMetadata;
  invocation?: SkillInvocationPolicy;
}

interface SkillContext {
  os: string;
  availableBins: string[];
  env: Record<string, string>;
  config: Record<string, unknown>;
}
```

## Token 优化

### 路径压缩

```
原始路径：C:\Users\Alice\.cradle\skills\pptx\SKILL.md
压缩后：~/.cradle/skills/pptx/SKILL.md
节省：约 20 字符/Skill
```

### Token 估算

```
基础开销：195 字符（当有 Skill 时）
每个 Skill：97 字符 + len(name) + len(description) + len(location)

示例（10 个 Skill）：
  195 + 10 * (97 + 10 + 50 + 30) = 195 + 1870 = 2065 字符 ≈ 516 tokens
```

## 与旧实现的差异

| 方面 | 旧实现 | 新实现 |
|------|--------|--------|
| Skill 注入 | 完整命令定义 | XML 列表 |
| 执行方式 | 参数替换 + Shell | LLM 自主执行 |
| Token 消耗 | 高 | 低（按需读取） |
| 灵活性 | 低 | 高 |
| 兼容性 | 自定义格式 | OpenClaw/Claude 标准 |

## 迁移计划

1. **保留**：Skill 文件格式、Frontmatter 解析
2. **修改**：Prompt 构建方式（从命令列表改为 XML 列表）
3. **移除**：命令解析、参数替换、Tool 转换
4. **新增**：多源加载、路径压缩、Skill 过滤