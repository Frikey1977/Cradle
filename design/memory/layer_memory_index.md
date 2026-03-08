# 记忆索引层设计

## 1. 功能定位

记忆索引层是四层记忆系统的第三层，负责长期记忆的向量化存储和语义检索。它接收长期记忆层的 Subject 内容，将其向量化后存储到 Chroma，支持通过语义相似度快速定位 Subject 记忆文件。

## 2. 核心作用

| 维度 | 说明 |
|------|------|
| 向量化存储 | 将 Subject 名称、描述、内容向量化存储 |
| 语义检索 | 支持相似主题的语义搜索 |
| Subject 定位 | 快速定位到相关 Subject 记忆文件 |
| 索引管理 | 动态加载、缓存、销毁索引实例 |

## 3. 存储设计

### 3.1 存储方案

使用 **Chroma** 向量数据库，统一按 Agent 存储：

```
workspace/{agent_id}/
    └── index/
        └── chroma.db           # Subject 向量索引
```

**说明**：
- 所有 Subject 统一存储在一个 Chroma 数据库中
- 不再按年份分片，Subject 是持续累积的
- 检索结果通过 metadata 中的 subject_id 定位文件

### 3.2 Chroma Collection 设计

单个 Collection 存储所有 Subject 的向量：

| Collection | 说明 | 向量化内容 |
|------------|------|-----------|
| `subjects` | Subject 索引 | Subject 名称 + 描述 + 摘要 |

### 3.3 Collection 结构

```typescript
interface SubjectRecord {
  id: string;                    // Subject ID
  embedding: number[];           // Subject 向量
  metadata: {
    subject_id: string;          // Subject ID
    subject_name: string;        // Subject 名称
    subject_description: string; // Subject 描述
    file_path: string;           // 记忆文件路径
    updated_at: string;          // 最后更新时间
    status: string;              // active/dormant/archived
  };
}
```

## 4. 索引管理

### 4.1 实例生命周期

```
首次查询
    ↓
加载 Chroma 实例
    ↓
存入 LRU 缓存
    ↓
30分钟无访问
    ↓
自动销毁实例（释放内存）
```

### 4.2 索引管理器接口

```typescript
interface IndexManager {
  // 获取索引实例
  getIndex(agentId: string): Promise<IndexInstance>;
  
  // 重新加载索引（Subject 更新后）
  reload(agentId: string): Promise<void>;
}

interface IndexInstance {
  client: ChromaClient;
  subjectsCollection: Collection;
  lastAccess: number;
}
```

### 4.3 缓存配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| max | 50 | 最多缓存 50 个 Agent 的索引 |
| ttl | 30分钟 | 无访问自动销毁时间 |

### 4.4 资源开销估算

| 指标 | 单实例 | 50实例（缓存上限） |
|------|--------|-------------------|
| 内存 | ~10-20 MB | ~500-1000 MB |
| 加载延迟 | ~50-100ms | - |
| 查询延迟 | ~5-20ms | - |

## 5. 向量化存储

### 5.1 调用入口

长期记忆层创建或更新 Subject 后，调用索引层接口进行向量化存储：

```
Subject 创建/更新
    ↓
提取 Subject 信息
    ↓
调用索引层存储接口
    ↓
生成向量 Embedding
    ↓
写入 Chroma Collection
```

### 5.2 存储接口定义

```typescript
interface IndexStorage {
  // 存储或更新 Subject 索引
  store(subject: SubjectIndexInfo): Promise<void>;
  
  // 删除 Subject 索引
  remove(subjectId: string): Promise<void>;
  
  // 批量更新（Subject 合并/拆分后）
  batchUpdate(subjects: SubjectIndexInfo[]): Promise<void>;
}

interface SubjectIndexInfo {
  subjectId: string;           // Subject ID
  subjectName: string;         // Subject 名称
  subjectDescription: string;  // Subject 描述
  filePath: string;            // 记忆文件路径
  updatedAt: Date;             // 更新时间
  status: 'active' | 'dormant' | 'archived';
}
```

### 5.3 向量生成策略

```typescript
// 组合 Subject 信息生成向量文本
function generateEmbeddingText(subject: SubjectIndexInfo): string {
  return `${subject.subjectName}\n${subject.subjectDescription}`;
}
```

## 6. 语义检索

### 6.1 检索流程

```
用户查询
    ↓
生成查询向量
    ↓
检索 subjects Collection
    ↓
返回匹配的 Subject 列表
    ↓
通过 file_path 读取完整记忆文件
```

### 6.2 检索接口

```typescript
interface MemorySearch {
  // 语义检索
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 检索活跃 Subject
  searchActive(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 相似 Subject 推荐
  findSimilar(subjectId: string, limit?: number): Promise<SearchResult[]>;
  
  // Subject 识别检索（用于长期记忆归集）
  searchForRecognition(query: string, limit?: number): Promise<RecognitionCandidate[]>;
}

interface SearchOptions {
  limit?: number;              // 返回数量，默认 5
  threshold?: number;          // 相似度阈值，默认 0.7
  includeArchived?: boolean;   // 是否包含已归档，默认 false
}

interface SearchResult {
  subjectId: string;
  subjectName: string;
  subjectDescription: string;
  filePath: string;
  score: number;               // 相似度分数
  updatedAt: Date;
}

// Subject 识别候选
interface RecognitionCandidate {
  subjectId: string;
  subjectName: string;
  subjectDescription: string;
  score: number;               // 相似度分数
}
```

### 6.3 检索示例

**示例1：普通语义检索**

```typescript
// 用户查询
const query = "Q1销售项目的完成情况";

// 检索结果
const results = await memorySearch.search(query, {
  limit: 3,
  threshold: 0.7
});

// 返回
[
  {
    subjectId: "sub_001",
    subjectName: "Q1销售项目",
    subjectDescription: "2026年第一季度销售目标与执行",
    filePath: "subject-sub_001.md",
    score: 0.92,
    updatedAt: "2026-03-20T14:30:00Z"
  }
]
```

**示例2：Subject 识别检索（用于长期记忆归集）**

```typescript
// 对话内容
const conversation = "Q1项目完成了吗？";

// 获取候选 Subject（不设置阈值，获取更多候选）
const candidates = await memorySearch.searchForRecognition(conversation, 5);

// 返回
[
  {
    subjectId: "sub_001",
    subjectName: "Q1销售项目",
    subjectDescription: "2026年第一季度销售目标与执行",
    score: 0.92
  },
  {
    subjectId: "sub_003",
    subjectName: "Q2规划",
    subjectDescription: "第二季度工作规划",
    score: 0.45
  },
  {
    subjectId: "sub_005",
    subjectName: "年度目标",
    subjectDescription: "2026年度经营目标",
    score: 0.38
  }
]

// 将 candidates 作为上下文给大模型判断
// 大模型输出：属于 sub_001
```

## 7. Subject 变更处理

### 7.1 创建 Subject

```
创建新 Subject
    ↓
生成向量
    ↓
添加到 Chroma
```

### 7.2 更新 Subject

```
Subject 内容更新
    ↓
重新生成向量
    ↓
更新 Chroma 记录
```

### 7.3 合并 Subject

```
合并两个 Subject
    ↓
删除旧 Subject 向量
    ↓
添加合并后的新向量
```

### 7.4 归档 Subject

```
Subject 归档
    ↓
更新 status 为 archived
    ↓
默认检索时排除
```

## 8. 与长期记忆层协作

```
长期记忆层                索引层
    │                       │
    ├─ Subject 创建 ───────>├─ 生成向量
    │                       ├─ 存储到 Chroma
    │                       │
    ├─ Subject 更新 ───────>├─ 重新生成向量
    │                       ├─ 更新 Chroma
    │                       │
    ├─ Subject 删除 ───────>├─ 从 Chroma 删除
    │                       │
    │<─ 检索请求 ───────────┤
    │                       ├─ 向量检索
    │<─ 返回 Subject 列表 ──┤
    │                       │
    ├─ 读取完整内容 <───────┤
```

## 9. 关联文档

- [四层记忆系统](./four_layers.md)
- [记忆系统模块索引](./README.md)
- [长期记忆层](./layer_long_term.md)
- [对话日志层](./layer_conversation.md)
