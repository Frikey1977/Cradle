# 企业画像设计

## 1. 功能定位

企业画像定义 Agent 所处的企业环境，包括行业特征、企业文化、价值观和工作风格。它作为组织配置的一部分，在生成提示词时由上下文管理器注入到上下文。

## 2. 数据模型

### 2.1 企业画像 Schema

```typescript
interface EnterpriseProfile {
  name: string;
  industry: string;
  scale: string;
  culture: string;
  values: string[];
  workStyle: WorkStyle;
}

interface WorkStyle {
  pace: 'fast' | 'moderate' | 'steady';
  communication: 'direct' | 'indirect' | 'formal';
  decisionMaking: 'top-down' | 'collaborative' | 'consensus';
}
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 企业名称 |
| industry | string | 行业类型：互联网/金融/制造等 |
| scale | string | 企业规模：50人以下/50-200/200-500/500-1000/1000+ |
| culture | string | 企业文化描述 |
| values | string[] | 核心价值观列表 |
| workStyle.pace | enum | 工作节奏：快/中/稳 |
| workStyle.communication | enum | 沟通风格：直接/委婉/正式 |
| workStyle.decisionMaking | enum | 决策方式：层级/协作/共识 |

## 3. 管理方式

| 方式 | 说明 |
|------|------|
| 组织管理页面 | 管理员在组织管理界面配置企业画像 |
| JSON 格式 | 数据以 JSON 格式存储在组织配置中 |
| 上下文注入 | 运行时由上下文管理器注入到 System Prompt |

## 4. 上下文注入

企业画像由上下文管理器在构建提示词时注入：

```typescript
interface ContextManager {
  injectEnterpriseProfile(organizationId: string): string;
}
```

注入示例：

```
## 企业背景
你服务于 [企业名称]，是一家[行业类型]企业，规模[企业规模]。

## 企业文化
[企业文化描述]

## 核心价值观
- 价值观1
- 价值观2

## 工作风格
- 工作节奏：快节奏/稳健
- 沟通风格：直接高效/委婉含蓄
- 决策方式：协作决策/层级决策
```

## 5. 关联文档

- [组织管理](../organization/README.md)
- [上下文管理器](../agents/runtime.md)
- [五重画像记忆引擎](./five_profiles.md)
- [岗位画像](./profile_position.md)
- [Agent 事实](./profile_agent_fact.md)

## 6. 与其他画像的关系

上下文注入优先级：

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
