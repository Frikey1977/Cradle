# 长期记忆层设计

## 1. 功能定位

长期记忆层是四层记忆系统的第二层，负责存储由大模型从对话日志中归集提炼的关键信息。采用**按 Subject 分片**的存储方式，支持跨时间的主题连续性。

## 2. 核心作用

| 维度 | 说明 |
|------|------|
| 主题归集 | 大模型根据对话记录提取主题和关键信息 |
| 跨时间连续 | 同一 Subject 的内容跨天累积，保持连续性 |
| 知识沉淀 | 存储精炼后的主题摘要和关键对话 |
| 论据完整 | 避免跨时间断层导致的论据失证 |

## 3. 存储设计

### 3.1 存储方案

长期记忆采用 **Markdown 文件按 Subject 分片**存储：

```
workspace/{agent_id}/
    └── long_term/                    # 长期记忆文件目录
        ├── subjects.json             # Subject 注册表
        ├── subject-{subject_id}.md   # Subject 记忆文件
        ├── subject-abc123.md         # 示例：项目A记忆
        ├── subject-def456.md         # 示例：客户B记忆
        └── ...
```

**核心优势**：
- 同一 Subject 的内容持续累积，不随时间分散
- 支持跨天、跨周、跨月的主题连续性
- 检索时直接定位到完整主题文件

### 3.2 Subject 注册表

**文件**: `subjects.json`

```json
{
  "subjects": [
    {
      "id": "sub_001",
      "name": "Q1销售项目",
      "description": "2026年第一季度销售目标与执行",
      "created_at": "2026-01-15T09:00:00Z",
      "updated_at": "2026-03-20T14:30:00Z",
      "file_path": "subject-sub_001.md",
      "message_count": 45,
      "last_message_time": "2026-03-20T14:30:00Z",
      "status": "active"
    },
    {
      "id": "sub_002",
      "name": "客户A合作",
      "description": "与重要客户A的合作事项",
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-28T16:00:00Z",
      "file_path": "subject-sub_002.md",
      "message_count": 23,
      "last_message_time": "2026-02-28T16:00:00Z",
      "status": "archived"
    }
  ]
}
```

### 3.3 Subject 记忆文件格式

**文件命名**: `subject-{subject_id}.md`

**文件结构**:
```markdown
# Subject: Q1销售项目

> 创建时间: 2026-01-15  
> 最后更新: 2026-03-20  
> 状态: active

## 主题概述

{Q1销售项目的整体描述}

---

## 2026-01-15

### Topic: 项目启动

**关键对话**:
- [09:30] 张三: 我们需要制定Q1的销售目标
- [09:32] Agent: 建议目标设定为500万，基于去年Q4的400万增长25%
- [09:35] 张三: 同意，但需要增加新客户拓展指标
- [09:36] Agent: 已记录，新增客户目标20家

**决策记录**:
- Q1销售目标：500万
- 新增客户目标：20家

---

## 2026-02-20

### Topic: 中期复盘

**关键对话**:
- [14:00] 李四: Q1已经过去一半，目前完成度如何？
- [14:02] Agent: 当前完成220万，进度44%，略低于时间进度50%
- [14:05] 李四: 差距原因是什么？
- [14:06] Agent: 主要原因是2月份春节假期影响，以及两个大客户延期签约

**决策记录**:
- 加大3月份冲刺力度
- 跟进延期客户，确保3月签约

---

## 2026-03-20

### Topic: 项目收尾

**关键对话**:
- [14:30] 张三: Q1结束了，最终完成情况？
- [14:32] Agent: 最终完成520万，超额4%完成目标
- [14:35] 张三: 新客户呢？
- [14:36] Agent: 新增客户22家，超额完成

**决策记录**:
- Q1目标超额完成
- 启动Q2目标制定

---

## 关键信息汇总

| 时间 | 事项 | 决策 |
|------|------|------|
| 2026-01-15 | 目标制定 | Q1目标500万，新客户20家 |
| 2026-02-20 | 中期复盘 | 加大冲刺力度 |
| 2026-03-20 | 项目收尾 | 超额完成，启动Q2规划 |
```

### 3.4 Subject 生命周期

```
对话发生
    ↓
大模型判断所属 Subject
    ↓
┌─────────────────────────┐
│ Subject 已存在         │
│ → 追加到现有文件       │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ Subject 不存在         │
│ → 创建新 Subject       │
│ → 注册到 subjects.json │
│ → 创建新文件           │
└─────────────────────────┘
    ↓
更新索引层
```

## 4. 主题归集流程

### 4.1 归集触发

归集任务由 Agent 通过 skill 触发执行：

```
Agent 对话过程中
         ↓
    大模型判断需要归集
         ↓
    语义检索获取候选 Subject 列表
         ↓
    大模型判断属于哪个 Subject
         ↓
    调用归集 skill
         ↓
    追加/更新 Subject 文件
         ↓
    更新索引层
```

### 4.2 Subject 识别流程

Subject 识别基于语义检索 + 大模型判断：

```
用户对话内容
    ↓
提取关键信息（去除事务性内容）
    ↓
语义检索索引层 → 获取 Top 5 候选 Subject
    ↓
将候选 Subject + 对话内容作为上下文
    ↓
大模型判断：
  ├─ 属于现有 Subject A → 追加到 A
  ├─ 属于现有 Subject B → 追加到 B
  ├─ 不属于任何 Subject → 创建新 Subject
  └─ 无需归集 → 跳过
```

### 4.3 Subject 识别接口

```typescript
interface SubjectRecognition {
  // 识别对话所属 Subject
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}

interface RecognitionInput {
  conversation: ConversationSnippet[];  // 当前对话片段
  agentId: string;                      // Agent ID
}

interface RecognitionResult {
  action: 'append' | 'create' | 'skip';
  subjectId?: string;                   // append 时提供
  subjectName?: string;                 // create 时提供
  subjectDescription?: string;          // create 时提供
  reasoning: string;                    // 判断理由
}
```

### 4.4 识别示例

**场景**：用户说 "Q1项目完成了吗？"

```
步骤1: 语义检索
  查询向量: "Q1项目完成情况"
  返回候选:
    1. sub_001 - Q1销售项目 (score: 0.92)
    2. sub_003 - Q2规划 (score: 0.45)
    3. sub_005 - 年度目标 (score: 0.38)

步骤2: 大模型判断
  输入: {
    "对话": "Q1项目完成了吗？",
    "候选Subject": [
      {"id": "sub_001", "name": "Q1销售项目", "description": "..."},
      {"id": "sub_003", "name": "Q2规划", "description": "..."}
    ]
  }
  
  输出: {
    "action": "append",
    "subjectId": "sub_001",
    "reasoning": "用户询问Q1项目完成情况，与sub_001高度相关"
  }
```

### 4.5 内容过滤规则

| 类型 | 是否保留 | 说明 |
|------|---------|------|
| 业务决策 | ✅ 保留 | 重要决策需要长期记忆 |
| 知识问答 | ✅ 保留 | 有价值的信息交换 |
| 任务分配 | ✅ 保留 | 工作安排和责任划分 |
| 问题排查 | ✅ 保留 | 问题分析和解决方案 |
| 简单问候 | ❌ 排除 | "你好"、"在吗"等 |
| 确认回复 | ❌ 排除 | "好的"、"收到"等 |
| 简单感谢 | ❌ 排除 | "谢谢"、"辛苦了"等 |
| 无效对话 | ❌ 排除 | 中断、重复、无意义内容 |

## 5. Subject 管理

### 5.1 Subject 状态

| 状态 | 说明 | 转换条件 |
|------|------|---------|
| active | 活跃中 | 默认状态，持续有更新 |
| dormant | 休眠中 | 30天无更新自动转入 |
| archived | 已归档 | 项目结束或手动归档 |

### 5.2 Subject 合并

当发现两个 Subject 实际上是同一主题时，支持合并：

```typescript
interface SubjectMerge {
  // 将 sourceSubject 合并到 targetSubject
  merge(sourceId: string, targetId: string): Promise<void>;
}
```

### 5.3 Subject 拆分

当一个 Subject 过于庞大时，支持拆分为多个子 Subject：

```typescript
interface SubjectSplit {
  // 按时间或主题拆分
  split(subjectId: string, splitPoints: SplitPoint[]): Promise<string[]>;
}
```

## 6. 数据模型

### 6.1 Subject 定义

```typescript
interface Subject {
  id: string;                  // Subject 唯一标识
  name: string;                // Subject 名称
  description: string;         // Subject 描述
  createdAt: Date;             // 创建时间
  updatedAt: Date;             // 最后更新时间
  filePath: string;            // 记忆文件路径
  messageCount: number;        // 消息数量
  lastMessageTime: Date;       // 最后消息时间
  status: 'active' | 'dormant' | 'archived';
  tags?: string[];             // 标签
}
```

### 6.2 Subject 文件结构

```typescript
interface SubjectMemoryFile {
  subject: SubjectInfo;
  entries: DailyEntry[];       // 按日期组织的条目
  summary?: SubjectSummary;    // 关键信息汇总
}

interface DailyEntry {
  date: string;                // YYYY-MM-DD
  topics: TopicEntry[];
}

interface TopicEntry {
  id: string;
  summary: string;
  keyConversations: ConversationSnippet[];
  decisions?: string[];
}
```

## 7. 接口设计

### 7.1 Subject 管理接口

```typescript
interface SubjectManager {
  // 创建 Subject
  create(name: string, description: string): Promise<Subject>;
  
  // 获取 Subject
  get(subjectId: string): Promise<Subject>;
  
  // 列出所有 Subject
  list(options?: ListOptions): Promise<Subject[]>;
  
  // 更新 Subject
  update(subjectId: string, updates: Partial<Subject>): Promise<Subject>;
  
  // 归档 Subject
  archive(subjectId: string): Promise<void>;
  
  // 合并 Subject
  merge(sourceId: string, targetId: string): Promise<void>;
  
  // 拆分 Subject
  split(subjectId: string, splitPoints: SplitPoint[]): Promise<string[]>;
}
```

### 7.2 记忆写入接口

```typescript
interface LongTermMemoryWriter {
  // 追加到 Subject
  append(subjectId: string, entry: DailyEntry): Promise<void>;
  
  // 自动识别并追加
  autoAppend(conversation: ConversationSnippet[]): Promise<Subject>;
}
```

### 7.3 记忆读取接口

```typescript
interface LongTermMemoryReader {
  // 获取 Subject 完整内容
  getSubject(subjectId: string): Promise<SubjectMemoryFile>;
  
  // 获取指定日期范围的内容
  getByDateRange(subjectId: string, startDate: Date, endDate: Date): Promise<DailyEntry[]>;
  
  // 搜索 Subject 内容
  search(subjectId: string, keyword: string): Promise<TopicEntry[]>;
  
  // 获取所有活跃 Subject
  getActiveSubjects(): Promise<Subject[]>;
}
```

## 8. 与索引层协作

```
新内容追加到 Subject 文件
         ↓
    提取 Subject 名称和摘要
         ↓
    向量化存储到索引层
         ↓
    支持语义检索
```

## 9. 关联文档

- [四层记忆系统](./four_layers.md)
- [记忆系统模块索引](./README.md)
- [对话日志层](./layer_conversation.md)
- [记忆索引层](./layer_memory_index.md)
- [Subject 管理表](./database/t_subject.md)
