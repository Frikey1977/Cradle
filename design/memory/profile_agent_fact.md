# Agent 事实设计

## 1. 功能定位

Agent 事实定义 Agent 的行事风格和个性特征，作为 Agent 配置的一部分，在生成提示词时由上下文管理器注入到上下文。

## 2. 数据模型

### 2.1 Agent 事实 Schema

```typescript
interface AgentPersona {
  personality: AgentPersonality;
  communication: AgentCommunication;
}

interface AgentPersonality {
  traits: string[];
  likes: string[];
  dislikes: string[];
}

interface AgentCommunication {
  tone: 'formal' | 'casual' | 'friendly';
  detailLevel: 'brief' | 'moderate' | 'detailed';
  responseStyle: 'direct' | 'structured' | 'narrative';
}
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| personality.traits | string[] | Agent 性格特征，如：专业、高效、友好 |
| personality.likes | string[] | Agent 喜欢的事项 |
| personality.dislikes | string[] | Agent 厌恶的事项 |
| communication.tone | enum | 沟通语气：正式/随意/友好 |
| communication.detailLevel | enum | 详细程度：简洁/适中/详细 |
| communication.responseStyle | enum | 响应风格：直接/结构化/叙述 |

## 3. 管理方式

| 方式 | 说明 |
|------|------|
| Web 端编辑 | 用户通过 Web 界面配置 Agent 事实 |
| 默认值 | 新建 Agent 时使用系统默认 Persona |
| 上下文注入 | 运行时由上下文管理器注入到 System Prompt |

## 4. 上下文注入

Agent 事实由上下文管理器在构建提示词时注入：

```typescript
interface ContextManager {
  injectAgentPersona(agent: Agent): string;
}
```

注入示例：

```
## Agent 性格
- 专业、高效、主动
- 喜欢数据驱动的决策
- 厌恶模糊不清的指令

## 沟通风格
- 语气：专业但友好
- 详细程度：适中
- 响应风格：结构化输出
```

## 5. 关联文档

- [Agent 定义表](./database/t_agent.md)
- [上下文管理器](../agents/runtime.md)
- [五重画像记忆引擎](./five_profiles.md)
- [Contact 事实](./profile_contact_fact.md)
- [关系偏好](./profile_relationship.md)

## 6. 与其他画像的关系

### 6.1 Contact 绑定

Agent 与 Contact 的绑定关系在组织管理模块中配置：

| 绑定模式 | 说明 | 记忆共享 |
|---------|------|---------|
| 共享 | 一个 Agent 服务多个 Contact | Contact 间共享记忆 |
| 专属 | Agent 仅服务单一 Contact | 记忆独立，不共享 |

绑定关系由 [关系偏好](./profile_relationship.md) 模块管理。

### 6.2 上下文注入优先级

```
企业画像（组织级）
    ↓
岗位画像（岗位级）
    ↓
Agent 事实（Agent级）
    ↓
Contact 事实（Contact 级）
    ↓
关系偏好（交互级）
```
