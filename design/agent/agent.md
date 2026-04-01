# Agent 管理设计

## 1. 模块概述

### 1.1 功能定位

Agent 管理是组织管理的核心子模块，负责**数字员工**（AI Agent）的全生命周期管理。

**重要概念**：
- **数字员工**：AI Agent，存储在 `t_agent` 表
- **人类员工**：真实的人，存储在 `t_employees` 表（员工管理模块）
- 两者是**平行关系**，不是包含关系

### 1.2 核心价值

- **岗位能力沉淀**：Agent 归属组织节点，沉淀该岗位的能力和经验
- **不随人员变动而变动**：人员转岗时，Agent 留在原岗位
- **成本归属明确**：API/算力费用计入 Agent 所属部门
- **知识传承**：岗位经验通过 Agent 传承给接替者

### 1.3 使用场景

**场景1：高管个人助理**
- 为高管配置专属 Agent
- 一对一服务，绑定特定用户
- 了解高管的工作习惯和偏好

**场景2：团队共享助手**
- 技术部的"代码助手"Agent
- 团队共享使用，沉淀团队知识
- 新员工通过 Agent 快速了解团队规范

**场景3：公共服务**
- IT 支持、HR 咨询等公共 Agent
- 全组织可用，提供标准化服务
- 降低重复性咨询工作量

## 2. 核心设计

### 2.1 Skill 配置管理

#### 2.1.1 核心概念

**Skill 的映射关系**：
- **system-skills**：系统级 Skill 注册（`t_skills`）
- **position-skills**：岗位级 Skill 配置（`r_position_skills`）
- **Agent**：通过 `position_id` 关联岗位，继承岗位的 Skill 配置

**关联关系**：
```
t_agent（数字员工）
    └── position_id → t_positions（岗位）
            └── r_position_skills → t_skills（岗位配置的Skill）
```

**设计原则**：
- Agent 不直接配置 Skill，而是通过岗位继承
- 岗位定义了该角色的能力边界和可用工具
- 同一岗位的所有 Agent 共享相同的 Skill 配置

#### 2.1.2 配置继承关系

**两层配置优先级**：
```
Agent 运行时加载 Skill 配置：
    ↓
r_position_skills.config（岗位级，最高优先级）
    ↓ 如果未定义，使用
t_skills.default_config（系统级，最低优先级）
```

**配置合并示例**：

**system-skill 默认配置**（`t_skills`）：
```json
{
  "name": "email-sender",
  "default_config": {
    "maxRecipients": 10,
    "allowAttachments": true
  }
}
```

**position-skill 覆盖配置**（`r_position_skills`）：
```json
{
  "skillId": "skill-email",
  "config": {
    "maxRecipients": 50
  },
  "invocation": "auto"
}
```

**最终生效配置**：
```json
{
  "maxRecipients": 50,      // 来自 position-skill
  "allowAttachments": true  // 来自 system-skill 默认
}
```

#### 2.1.3 获取 Agent Skill 流程

```
输入参数：
└── agent_id: Agent ID（必填）

处理逻辑：
1. 查询 Agent 的 position_id
2. 查询岗位的 r_position_skills 关联记录
3. 获取每个 Skill 的 default_config
4. 合并配置（position 配置优先）
5. 根据 invocation 过滤（disabled 的 Skill 不返回）

输出结果：
└── skills: SkillConfig[]
    ├── skillId: Skill ID
    ├── skillName: Skill 名称
    ├── skillSlug: Skill 标识符
    ├── config: 合并后的配置
    ├── invocation: 调用策略
    └── priority: 优先级
```

#### 2.1.4 使用场景

**场景1：HR Agent 岗位**
```
岗位：HR Assistant（agent 类型）
├── Skill: email-sender（invocation: auto）
├── Skill: db-query（invocation: user_only）
└── Skill: calendar（invocation: auto）

Agent A（HR Assistant 岗位）
└── 可用 Skill：[email-sender, db-query, calendar]

Agent B（HR Assistant 岗位）
└── 可用 Skill：[email-sender, db-query, calendar]
```

**场景2：开发助手岗位**
```
岗位：Dev Assistant（agent 类型）
├── Skill: code-review（invocation: user_only）
├── Skill: git-ops（invocation: auto）
└── Skill: doc-search（invocation: auto）

Agent C（Dev Assistant 岗位）
└── 可用 Skill：[code-review, git-ops, doc-search]
```

### 2.2 创建 Agent 流程

```
输入参数：
├── oid: 所属组织ID（必填）
├── name: Agent 名称（必填）
├── agent_no: Agent 编号（必填，唯一）
├── description: 描述（可选）
├── mode: 服务模式（默认 exclusive）
├── position_id: 岗位ID（可选，但推荐填写）
├── bind_user_id: 绑定用户ID（专属模式必填）
├── config: 模型配置（JSON）
├── profile: 画像数据（JSON）
├── soul: 灵魂/人格描述（可选）
├── heartbeat: 心跳配置（JSON）
├── avatar: 头像（可选）
└── status: 状态（默认 enabled）

处理逻辑：
1. 校验 oid 存在且有效
2. 校验 agent_no 唯一性
3. 如为专属模式，校验 bind_user_id 有效性
4. 如指定 position_id：
   - 校验岗位存在
   - 校验岗位类型为 'agent'
5. 生成 sid（UUID）
6. 创建 Agent 记录

输出结果：
├── sid: Agent ID
├── name: Agent 名称
└── create_time: 创建时间
```

### 2.3 服务模式说明

| 模式 | 说明 | 绑定用户 | 适用场景 |
|------|------|---------|---------|
| **exclusive** | 专属 | 必填，一对一 | 高管个人助理 |
| **shared** | 共享 | 可选，多对多 | 部门协作助手 |
| **public** | 公共 | 无需绑定 | 公共服务 |
| **department** | 部门 | 部门内共享 | 部门助理 |

**模式切换规则**：
- 专属 → 共享/公共：自动解绑原用户
- 共享/公共 → 专属：必须指定绑定用户

## 3. 数据模型

### 3.1 Agent 实体

```typescript
interface Agent {
  sid: string;                    // 主键 UUID
  name: string;                   // 名称
  eName?: string;                 // 英文名
  title?: string;                 // 翻译标签
  agentNo: string;                // 编号（唯一）
  description?: string;           // 描述
  oid: string;                    // 所属组织ID
  positionId?: string;            // 岗位ID（通过岗位获取Skill）
  mode: 'exclusive' | 'shared' | 'public' | 'department';
  avatar?: string;                // 头像
  config?: AgentConfig;           // 配置（模型、运行时）
  profile?: AgentProfile;         // 画像数据
  soul?: string;                  // 灵魂/人格描述
  heartbeat?: AgentHeartbeat;     // 心跳配置
  status: 'enabled' | 'disabled';
  createTime: string;
}
```

### 3.2 Agent 配置

```typescript
interface AgentConfig {
  model?: {
    provider?: string;            // 模型提供商
    model?: string;               // 模型名称
    temperature?: number;         // 温度
    maxTokens?: number;           // 最大Token数
    systemPrompt?: string;        // 系统提示词
  };
  runtime?: {
    identity?: {
      emoji?: string;             // 表情符号
      displayName?: string;       // 显示名称
    };
    behavior?: {
      humanDelay?: {
        enabled?: boolean;        // 是否启用人工延迟
        minSeconds?: number;      // 最小延迟秒数
        maxSeconds?: number;      // 最大延迟秒数
      };
    };
  };
}
```

### 3.3 Position Skill 配置（Agent通过岗位继承）

```typescript
interface PositionSkill {
  skillId: string;                // Skill ID
  skillName?: string;             // Skill 名称（冗余）
  skillSlug?: string;             // Skill 标识符（冗余）
  config?: Record<string, any>;   // 岗位级配置覆盖
  invocation: 'auto' | 'user_only' | 'disabled';
  priority: number;               // 优先级
}
```

**获取 Agent Skills 的方法**：
```typescript
async function getAgentSkills(agentId: string): Promise<PositionSkill[]> {
  // 1. 获取 Agent 的 position_id
  const agent = await getAgentById(agentId);
  if (!agent?.positionId) {
    return []; // 无岗位的Agent没有Skill
  }
  
  // 2. 获取岗位的 Skill 配置
  return await getPositionSkills(agent.positionId);
}
```

## 4. 关联文档

- [Agent 运行时设计](./runtime.md)
- [任务编排设计](./task-orchestration.md)
- [Agent 数据库设计](./database/t_agents.md)
- [岗位管理设计](../organization/position.md)
- [岗位-Skill关联表](../organization/database/r_position_skills.md)
