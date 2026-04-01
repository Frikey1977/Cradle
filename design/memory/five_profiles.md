# 五重画像记忆引擎设计

## 1. 模块概述

### 1.1 功能定位
五重画像记忆引擎是 Cradle 的核心差异化能力，通过五个维度的画像数据，赋予每个 Agent 独特的企业身份、岗位能力、个性风格和交互对象理解能力。

### 1.2 五重画像维度

```
┌─────────────────────────────────────────────────────────────────┐
│                     五重画像记忆引擎                              │
│                    (Quintuple Profile Engine)                    │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  企业画像     │ │   岗位画像    │ │  Agent事实   │             │
│  │(Enterprise)  │ │  (Position)  │ │(Agent Facts) │             │
│  │  行业文化     │ │  职责边界     │ │  行事风格    │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│  ┌──────────────┐ ┌──────────────┐                               │
│  │  特异性      │ │  Contact事实  │                               │
│  │ 关系偏好      │ │              │                               │
│  │(Relationship)│ │(Contact Facts)│                               │
│  └──────────────┘ └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 画像作用

| 画像维度 | 核心作用 | 定义内容 | 使用场景 |
|---------|---------|---------|---------|
| **企业画像** | 定义 Agent 所处的企业环境 | 行业特征、企业文化、价值观、工作风格、组织架构 | 所有对话的基础背景，确保 Agent 符合企业文化和行业规范 |
| **岗位画像** | 定义 Agent 的工作职责和行为边界 | 岗位职责（应该/不应该）、技能清单、战略层级（战略/战术/执行） | 决定 Agent 能做什么、不能做什么，如何规划工作 |
| **Agent 事实** | 定义 Agent 的行事风格和个性特征 | 喜好、厌恶、性格、习惯、行为模式 | 塑造 Agent 的独特个性，使其更有人格魅力 |
| **关系特异性偏好** | 定义 Agent 对特定交互对象的差异化反应 | 与特定 Contact 的亲密度、信任度、互动模式、偏好话题 | 针对不同 Contact 调整沟通方式，建立长期关系 |
| **Contact 事实** | 定义 Contact 的个人信息和偏好 | 职位、工作习惯、沟通偏好、个人爱好 | 个性化服务，记住 Contact 的特殊需求和偏好 |

## 2. 功能设计

### 2.1 企业画像 (Enterprise Profile)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 企业信息管理 | 维护企业基本信息和文化特征 |
| 行业特征配置 | 配置行业特定的知识和规范 |
| 价值观定义 | 定义企业的核心价值观和行为准则 |
| 工作风格设置 | 设置企业的工作节奏和沟通风格 |

#### 数据模型

```typescript
interface EnterpriseProfile {
  id: string;
  name: string;                    // 企业名称
  industry: string;                // 行业类型
  scale: string;                   // 企业规模
  culture: string;                 // 企业文化描述
  values: string[];                // 核心价值观
  workStyle: {
    pace: 'fast' | 'moderate' | 'steady';
    communication: 'direct' | 'indirect' | 'formal';
    decisionMaking: 'top-down' | 'collaborative' | 'consensus';
  };
  organizationStructure: string;   // 组织架构描述
}
```

### 2.2 岗位画像 (Position Profile)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 岗位定义 | 定义岗位的职责和权限 |
| 能力模型 | 定义岗位需要的技能和知识 |
| 战略层级 | 定义岗位的战略定位 |
| 职责边界 | 明确应该做和不应该做的事情 |

#### 数据模型

```typescript
interface PositionProfile {
  id: string;
  name: string;                    // 岗位名称
  department: string;              // 所属部门
  level: 'strategic' | 'tactical' | 'executive';  // 战略层级
  responsibilities: {
    should: string[];              // 应该做的事
    shouldNot: string[];           // 不应该做的事
  };
  skills: string[];                // 技能清单
  authorities: string[];           // 权限范围
  kpis: string[];                  // 关键绩效指标
}
```

### 2.3 Agent 事实 (Agent Facts)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 个性定义 | 定义 Agent 的性格特征 |
| 偏好管理 | 管理 Agent 的喜好和厌恶 |
| 习惯记录 | 记录 Agent 的行为习惯 |
| 风格配置 | 配置沟通和工作风格 |

#### 数据模型

```typescript
interface AgentFact {
  id: string;
  agentId: string;                 // 所属 Agent
  category: 'personality' | 'preference' | 'habit' | 'style';
  content: string;                 // 事实内容
  importance: number;              // 重要程度 (0-1)
  source: string;                  // 来源
  createdAt: Date;
  updatedAt: Date;
}

// Agent 个性配置示例
const agentPersonality = {
  traits: ['专业', '友好', '高效'],
  preferences: {
    likes: ['数据驱动', '清晰沟通', '提前规划'],
    dislikes: ['模糊指令', '临时变更', '重复劳动']
  },
  habits: ['每天早上检查日程', '主动汇报进度', '记录重要决策'],
  communicationStyle: '简洁明了，注重效率'
};
```

### 2.4 关系特异性偏好 (Relationship Preference)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 关系建立 | 建立和维护用户关系 |
| 亲密度管理 | 跟踪与用户的亲密程度 |
| 信任度评估 | 评估用户对 Agent 的信任度 |
| 互动模式 | 定义与特定用户的互动方式 |

#### 数据模型

```typescript
interface RelationshipPreference {
  id: string;
  agentId: string;                 // Agent ID
  userId: string;                  // 用户 ID
  intimacy: number;                // 亲密度 (0-100)
  trust: number;                   // 信任度 (0-100)
  interactionMode: {
    formality: 'formal' | 'casual' | 'intimate';
    frequency: 'high' | 'medium' | 'low';
    topics: string[];              // 偏好话题
  };
  specialPreferences: string[];    // 特殊偏好
  history: {
    totalConversations: number;
    lastInteraction: Date;
    keyMemories: string[];
  };
}
```

### 2.5 Contact 事实 (Contact Facts)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 信息收集 | 收集 Contact 的基本信息 |
| 偏好学习 | 学习 Contact 的工作和沟通偏好 |
| 习惯记录 | 记录 Contact 的行为习惯 |
| 个性化服务 | 基于 Contact 事实提供个性化服务 |

#### 数据模型

```typescript
interface ContactFact {
  id: string;
  contactId: string;               // Contact ID
  category: 'basic' | 'work' | 'communication' | 'personal';
  content: string;                 // 事实内容
  confidence: number;              // 置信度 (0-1)
  source: string;                  // 来源
  isVerified: boolean;             // 是否已验证
  createdAt: Date;
  updatedAt: Date;
}

// Contact 画像示例
const contactProfile = {
  basic: {
    name: '张三',
    department: '技术部',
    position: '高级工程师',
    joinDate: '2020-03-15'
  },
  work: {
    workingHours: '9:00-18:00',
    focusTime: '上午',
    preferredTools: ['VS Code', 'Jira', 'Slack'],
    workStyle: '独立工作，不喜欢频繁打扰'
  },
  communication: {
    preferredChannel: '异步沟通',
    responseTime: '24小时内',
    detailLevel: '详细，喜欢了解背景'
  }
};
```

## 3. 画像构建流程

### 3.1 初始化流程

```
创建 Agent
    ↓
[企业画像] ← 继承企业默认配置
    ↓
[岗位画像] ← 根据岗位模板初始化
    ↓
[Agent 事实] ← 应用预设个性模板
    ↓
[关系偏好] ← 初始化为默认值
    ↓
[Contact 事实] ← 从 Contact 档案导入
    ↓
Agent 准备就绪
```

### 3.2 动态学习流程

```
对话进行
    ↓
提取关键信息
    ↓
┌─────────────┬─────────────┬─────────────┐
↓             ↓             ↓             ↓
Agent Facts  Relationship  Contact Facts  Position
更新         Preference    更新           Profile
             更新                         更新
    ↓
画像更新完成
```

## 4. 画像应用

### 4.1 System Prompt 构建

```typescript
function buildSystemPrompt(profiles: QuintupleProfiles): string {
  return `
## 企业背景
${profiles.enterprise.culture}

## 工作职责
### 应该做的
${profiles.position.responsibilities.should.map(r => `- ${r}`).join('\n')}

### 不应该做的
${profiles.position.responsibilities.shouldNot.map(r => `- ${r}`).join('\n')}

## 工作风格
${profiles.agentFacts
  .filter(f => f.category === 'habit')
  .map(f => `- ${f.content}`)
  .join('\n')}

## 沟通偏好
${profiles.relationships.map(r => `- 与${r.targetUserId}: ${r.content}`).join('\n')}
  `.trim();
}
```

### 4.2 个性化响应

```typescript
function personalizeResponse(
  response: string,
  relationship: RelationshipPreference
): string {
  // 根据亲密度调整语气
  if (relationship.intimacy > 80) {
    // 使用更亲切的语言
  } else if (relationship.intimacy < 30) {
    // 使用更正式的语言
  }
  
  // 根据用户偏好调整详细程度
  // ...
  
  return personalizedResponse;
}
```

## 5. 数据库设计

### 5.1 五重画像表

| 表名 | 类型 | 说明 | 文档 |
|------|------|------|------|
| t_enterprise_profile | 数据表 | 企业画像表 | [查看](./database/t_enterprise_profile.md) |
| t_positions_profile | 数据表 | 岗位画像表 | [查看](./database/t_positions_profile.md) |
| t_agent_fact | 数据表 | Agent 事实表 | [查看](./database/t_agent_fact.md) |
| t_relationship | 数据表 | Agent-Contact 双向关系表（关系特异性偏好） | [查看](./database/t_relationship.md) |
| t_contact_fact | 数据表 | Contact 事实表 | [查看](./database/t_contact_fact.md) |

## 6. 关联文档

- [记忆系统模块索引](./README.md)
- [四层记忆系统](./four_layers.md)
- [Agent 运行时设计](../agents/runtime.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
