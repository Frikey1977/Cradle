# 上下文管理设计

## 1. 模块概述

### 1.1 功能定位

**ContextManager** 是 Agent 的**上下文管理中心**，负责构建、优化和管理 Agent 运行时的完整上下文。它不仅包含传统的上下文构建功能，还承担记忆管理、ReAct 循环管理、子 Agent 任务协调等高级职责。

### 1.2 核心价值

- **智能上下文构建**：整合多维度画像、记忆、技能等构建完整上下文
- **上下文优化**：自动压缩、清理无意义内容，优化 token 使用
- **记忆管理**：向量检索、记忆权重更新、记忆沉淀
- **ReAct 循环管理**：Todo List 管理、步骤追踪、推理过程记录
- **子 Agent 协调**：任务分解、分配、执行监控、结果汇总

### 1.3 架构位置

```
AgentRuntime
    └── ContextManager (上下文管理中心)
        ├── 上下文构建 (Context Building)
        │   ├── 画像整合 (用户/公司/部门/岗位/Agent/关系)
        │   ├── 对话历史管理
        │   └── 相关记忆检索
        │
        ├── 上下文优化 (Context Optimization)
        │   ├── 上下文压缩
        │   ├── 内容清理
        │   └── Token 预估
        │
        ├── 记忆管理 (Memory Management)
        │   ├── 向量检索
        │   ├── 记忆存储
        │   └── 权重更新
        │
        ├── ReAct 管理 (ReAct Management)
        │   ├── Todo List
        │   ├── 步骤追踪
        │   └── 推理记录
        │
        └── 任务编排 (Task Orchestration)
            ├── 任务分解
            ├── 子 Agent 管理
            └── 结果汇总
```

## 2. 三类核心画像

### 2.1 画像分类

| 画像类型 | 包含内容 | 用途 |
|---------|---------|------|
| **用户画像** | contact + company + department + position | 了解对方是谁 |
| **Agent 画像** | agent + company + department + position | 知道自己是谁 |
| **关系画像** | contact_agent + agent_contact | 了解双方关系 |

### 2.2 Agent 岗位画像

Agent 也是数字员工，有自己的岗位画像：

```
t_agents
    ├── profile (JSON) → Agent 自身画像
    ├── position_id → t_positions (Agent 的岗位画像)
    └── oid → t_departments (Agent 所属部门)
```

### 2.3 公司信息的双重作用

| 场景 | 公司信息来源 | 说明 |
|------|-------------|------|
| **对方是员工** | 用户画像中的 company | 通过 t_employees → t_departments 根节点 |
| **对方是陌生人** | Agent 画像中的 company | 通过 t_agents → t_departments 根节点 |
| **确认过程中** | Agent 主动询问并确认 | 动态更新到对话上下文 |

## 3. ContextManager 核心设计

### 3.1 类结构

```typescript
class ContextManager {
  private agentId: string;
  
  // 状态
  private masterTaskList: MasterTask[] = [];
  private subTaskSteps: SubTaskStep[] = [];
  private todoList: ReActTodo[] = [];
  
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  // ========== 上下文构建 ==========
  async build(params: ContextParams): Promise<EnhancedContext>;
  private async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection>;
  private async getConversationHistory(conversationId?: string): Promise<ConversationMessage[]>;
  private async retrieveMemories(content: string): Promise<Memory[]>;
  private async getAvailableSkills(): Promise<ToolDefinition[]>;
  
  // ========== 上下文优化 ==========
  async compress(messages: ConversationMessage[], targetTokens: number): Promise<CompactResult>;
  async clean(messages: ConversationMessage[]): Promise<ConversationMessage[]>;
  private estimateTokens(messages: ConversationMessage[]): number;
  
  // ========== 记忆管理 ==========
  async storeMemory(content: string, type: string, metadata?: any): Promise<void>;
  async updateMemoryWeight(memoryId: string, weight: number): Promise<void>;
  
  // ========== ReAct 管理 ==========
  addTodo(todo: ReActTodo): void;
  completeTodo(todoId: string, result: string): void;
  getPendingTodos(): ReActTodo[];
  addStep(step: SubTaskStep): void;
  getReactState(): ReActState;
  buildReactPrompt(): string;
  
  // ========== 任务编排 ==========
  async createTaskPlan(userRequest: string): Promise<MasterTask[]>;
  async assignTask(taskId: string): Promise<SubAgent>;
  async aggregateResults(): Promise<string>;
  getTaskTree(): TaskTreeNode[];
}
```

### 3.2 核心数据结构

```typescript
// 增强上下文
interface EnhancedContext {
  systemPrompt: string;
  modelConfig: ModelConfig;
  conversationHistory: ConversationMessage[];
  memories: Memory[];
  availableTools: ToolDefinition[];
  metadata: ContextMetadata;
  reactState?: ReActState;      // ReAct 当前状态
  taskTree?: TaskTreeNode[];    // 任务树（如果有子任务）
}

// 画像集合 - 三类核心画像
interface ProfileCollection {
  // 用户画像 (来自 t_contacts.profile + 关联的组织信息)
  contact?: ContactProfile;
  
  // Agent 画像 (来自 t_agents.profile + 关联的组织信息)
  agent?: AgentProfile;
  
  // 关系画像 (来自 t_relationship，双向)
  relationship?: RelationshipProfile;
  
  // 场景画像 (动态识别)
  scenario?: ScenarioProfile;
}

// ========== 用户画像 ==========
interface ContactProfile {
  contactId: string;
  type: 'employee' | 'customer' | 'partner' | 'visitor';
  sourceId?: string;            // 关联的 t_employees.sid（当 type='employee' 时）
  name: string;
  
  // 完整的 profile JSON
  profile?: Record<string, any>;
  
  // 组织信息（仅当 type='employee' 时存在）
  organization?: {
    company?: CompanyInfo;      // 公司信息
    department?: DepartmentInfo; // 部门信息
    position?: PositionInfo;    // 岗位信息
  };
}

// ========== Agent 画像 ==========
interface AgentProfile {
  agentId: string;
  name: string;
  eName?: string;
  agentNo: string;
  
  // 完整的 profile JSON (包含 facts, preferences, owners 等)
  profile?: Record<string, any>;
  
  // 组织信息
  organization?: {
    company?: CompanyInfo;      // 公司信息
    department?: DepartmentInfo; // 部门信息
    position?: PositionInfo;    // 岗位信息
  };
}

// ========== 公司信息 ==========
interface CompanyInfo {
  companyId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  type: string;
}

// ========== 部门信息 ==========
interface DepartmentInfo {
  departmentId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  type: string;
  parentId?: string;
  path: string;
  leaderId?: string;
}

// ========== 岗位信息 ==========
interface PositionInfo {
  positionId: string;
  name: string;
  eName?: string;
  code: string;
  description?: string;
  level?: string;
  type?: string;
  // 其他字段根据实际表结构动态获取
}

// ========== 关系画像 ==========
interface RelationshipProfile {
  relationshipId: string;
  agentId: string;
  contactId: string;
  
  // 用户对 Agent 的偏好
  contactToAgent?: Record<string, any>;
  
  // Agent 对用户的偏好
  agentToContact?: Record<string, any>;
}

// ========== 场景画像 ==========
interface ScenarioProfile {
  timeContext: string;          // 时间上下文
  locationContext?: string;     // 位置上下文
  businessContext?: string;     // 业务上下文
  urgency?: string;             // 紧急程度
}

// 画像加载参数
interface ProfileLoadParams {
  agentId: string;
  contactId: string;
  conversationId?: string;
}

// ReAct Todo
interface ReActTodo {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

// ReAct 步骤
interface SubTaskStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  thought?: string;
  action?: {
    type: 'tool_call' | 'respond' | 'delegate';
    tool?: string;
    parameters?: any;
    targetAgent?: string;
  };
  observation?: string;
  timestamp: number;
  duration?: number;
}

// 主任务（Master Agent 管理）
interface MasterTask {
  id: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  assignedTo?: string;        // 子 Agent ID
  subAgentType: string;       // 子 Agent 类型
  context: {
    systemPrompt: string;
    tools: string[];
    memoryScope: 'global' | 'task' | 'isolated';
  };
  timeout: number;
  maxIterations: number;
  result?: TaskResult;
  error?: string;
  children?: MasterTask[];    // 子任务
}

// 任务树节点（用于监控）
interface TaskTreeNode {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agentType: string;
  agentName: string;
  progress: number;
  duration: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  children: TaskTreeNode[];
  steps: SubTaskStep[];
  logs: LogEntry[];
}
```

## 4. 核心功能详解

### 4.1 画像加载流程

```
loadProfiles(params)
    ↓
获取 Agent 信息（Agent 自己是谁）
    ├── 从 t_agents 读取基础信息
    ├── 解析 profile JSON (完整内容)
    ├── t_agents.position_id → t_positions (Agent 岗位)
    ├── t_agents.oid → t_departments (Agent 部门)
    └── 部门树根节点 → Agent 公司
    ↓
获取 Contact 信息（对面是谁）
    ├── 从 t_contacts 读取基础信息
    ├── 解析 profile JSON (完整内容)
    └── 如果 contact.type='employee'
        ├── t_employees 读取员工信息
        ├── t_employees.oid → t_departments (用户部门)
        ├── t_employees.position_id → t_positions (用户岗位)
        └── 部门树根节点 → 用户公司
    ↓
获取关系画像
    └── 从 t_relationship 读取
        ├── contact_agent (用户对 Agent 偏好)
        └── agent_contact (Agent 对用户偏好)
    ↓
生成场景画像
    ├── 分析当前时间
    ├── 分析对话历史
    └── 分析业务上下文
    ↓
返回 ProfileCollection
```

### 4.2 数据库表关系

```
t_agents (Agent 基础信息)
    ├── profile (JSON) → Agent 完整画像
    ├── position_id → t_positions (Agent 岗位)
    ├── oid → t_departments (Agent 部门)
    └── agent_id → t_relationship.agent_id

t_contacts (联系人/用户)
    ├── profile (JSON) → 用户完整画像
    ├── type='employee' → source_id → t_employees.sid
    └── contact_id → t_relationship.contact_id

t_employees (员工)
    ├── oid → t_departments.sid (用户部门)
    └── position_id → t_positions.sid (用户岗位)

t_departments (部门/公司)
    ├── parent_id = NULL → 公司（根节点）
    └── 整条记录即部门/公司完整信息

t_positions (岗位)
    └── 整条记录即岗位完整信息

t_relationship (关系)
    ├── contact_agent (JSON) → 用户对 Agent 偏好
    └── agent_contact (JSON) → Agent 对用户偏好
```

### 4.3 上下文压缩流程

```
compress(messages, targetTokens)
    ↓
估算当前 token 数
    ↓
是否需要压缩?
    ├── 否 → 返回原消息
    ↓
是
    ↓
保留最近 N 条消息（默认4条）
    ↓
对旧消息分块
    ↓
并行生成部分摘要
    ↓
合并为最终摘要
    ↓
创建摘要消息替换旧消息
    ↓
返回压缩后的消息
```

## 5. 系统提示词构建

### 5.1 提示词格式原则

- **使用 Markdown 格式**：大模型理解性好，节省 token
- **去掉 JSON 结构化标记**：减少冗余字符
- **完整 profile 内容**：不只是 facts，包含所有信息
- **信任级别从关系画像获取**：owner 字段在 t_relationship.agent_contact 中

### 5.2 提示词模板

```markdown
# 身份设定

## 你的身份
姓名：{agent.name}
编号：{agent.agentNo}
岗位：{agent.organization.position.name}
部门：{agent.organization.department.name}
公司：{agent.organization.company.name}

### 关于你
{agent.profile 的所有内容，以 markdown 列表形式展开}

### 你的职责
{agent.organization.position.description}

### 信任级别
{if relationship.agentToContact?.owner === true}
当前用户是你的负责人，拥有对你的管理权限
{endif}

---

## 当前用户
姓名：{contact.name}
类型：{contact.type}

{if contact.type === 'employee'}
岗位：{contact.organization.position.name}
部门：{contact.organization.department.name}
公司：{contact.organization.company.name}

### 公司背景
{contact.organization.company.description}

### 部门信息
{contact.organization.department.description}

### 岗位职责
{contact.organization.position.description}
{else}
公司：待确认（请在交谈中了解用户所在公司）
{endif}

### 关于用户
{contact.profile 的所有内容，以 markdown 列表形式展开}

---

## 双方关系
{if relationship.contactToAgent}
### 用户对你的偏好
{relationship.contactToAgent 的所有内容}
{endif}

{if relationship.agentToContact}
### 你对用户的了解
{relationship.agentToContact 的所有内容}
{endif}

---

## 相关记忆
- {memory.content}
- {memory.content}

---

## 行为准则
1. 如果对方是陌生人，主动了解其公司和需求
2. 根据对方身份调整沟通方式
3. 保持友好、专业的态度
4. 不确定时主动询问
5. 尊重用户隐私
```

### 5.3 profile 展开示例

**原始 JSON**（Agent profile）：
```json
{
  "facts": {
    "basic": { "name": "小助手", "type": "AI员工" },
    "work": { "expertise": ["客服", "技术支持"], "experience": "3年" }
  },
  "preferences": {
    "basic": { "language": "zh-CN" },
    "work": { "likes": ["帮助用户", "学习新知识"], "dislikes": ["无意义对话"] }
  }
}
```

**关系表中的信任级别**（t_relationship.agent_contact）：
```json
{
  "owner": true
}
```

**展开为 Markdown**：
```markdown
### 关于你
- **基本信息**
  - 姓名：小助手
  - 类型：AI员工
- **工作信息**
  - 专业技能：客服、技术支持
  - 工作经验：3年
- **个人偏好**
  - 语言：zh-CN
  - 喜欢：帮助用户、学习新知识
  - 不喜欢：无意义对话

### 信任级别
当前用户是你的负责人，拥有对你的管理权限
```

## 6. 关联文档

- [t_contacts](../../organization/database/t_contacts.md) - 联系人表（用户画像）
- [t_employees](../../organization/database/t_employee.md) - 员工表
- [t_departments](../../organization/database/t_org.md) - 部门架构表（公司/部门画像）
- [t_positions](../../organization/database/t_position.md) - 岗位表（岗位画像）
- [t_agents](../../agent/database/t_agents.md) - Agent表（Agent画像）
- [t_relationship](../../memory/database/t_relationship.md) - 关系表（双向关系画像）
