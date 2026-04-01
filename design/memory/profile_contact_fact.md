# Contact 事实设计

## 1. 功能定位

Contact 事实定义 Contact 的个人信息和偏好，作为 Contact 配置的一部分，在生成提示词时由上下文管理器注入到上下文。

## 2. 数据模型

### 2.1 Contact 画像 Schema

```typescript
interface ContactProfile {
  basic: ContactBasic;
  work: ContactWork;
  communication: ContactCommunication;
}

interface ContactBasic {
  name: string;
  department: string;
  position: string;
  email: string;
}

interface ContactWork {
  workingHours: string;
  focusTime: string;
  expertise: string[];
}

interface ContactCommunication {
  preferredChannel: string;
  detailLevel: 'brief' | 'moderate' | 'detailed';
  tone: 'formal' | 'casual' | 'friendly';
}
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| basic.name | string | Contact 姓名 |
| basic.department | string | 所属部门 |
| basic.position | string | 职位 |
| basic.email | string | 邮箱 |
| work.workingHours | string | 工作时间 |
| work.focusTime | string | 专注时段 |
| work.expertise | string[] | 专业领域 |
| communication.preferredChannel | string | 首选沟通渠道 |
| communication.detailLevel | enum | 详细程度：简洁/适中/详细 |
| communication.tone | enum | 沟通语气：正式/随意/友好 |

## 3. 管理方式

| 方式 | 说明 |
|------|------|
| 员工管理页面 | 管理员（HR）在员工管理界面配置 |
| 简历解析 | 上传简历自动提取 |
| JSON 格式 | 数据以 JSON 格式存储在 Contact 配置中 |
| 上下文注入 | 运行时由上下文管理器注入到 System Prompt |

## 4. 数据来源

Contact 画像的数据来源于 [员工管理](../organization/employee.md) 模块：

- 手工录入：HR 在员工管理页面输入
- 简历解析：上传简历自动提取
- EHR 同步：由 HR Agent 自动从企业 HR 系统同步

## 5. 上下文注入

Contact 事实由上下文管理器在构建提示词时注入：

```typescript
interface ContextManager {
  injectContactProfile(contactId: string): string;
}
```

注入示例：

```
## Contact 信息
- 姓名：[姓名]
- 部门：[部门]
- 职位：[职位]
- 专业领域：[领域1]、[领域2]

## 沟通偏好
- 详细程度：适中
- 沟通语气：友好
- 首选渠道：即时通讯
```

## 6. 与 Agent 的关系

Contact 通过组织管理模块与 Agent 建立绑定关系：

| 绑定模式 | 说明 | 记忆隔离 |
|---------|------|---------|
| shared | 共享 Agent，多个 Contact 共用 | Contact 间共享记忆 |
| exclusive | 专属 Agent，仅服务单一 Contact | 记忆独立，不共享 |

## 7. 关联文档

- [t_contact_fact 表](./database/t_contact_fact.md) - Contact 事实表
- [五重画像记忆引擎](./five_profiles.md)
- [关系偏好](./profile_relationship.md)
- [Agent 事实](./profile_agent_fact.md)
- [员工管理](../organization/employee.md)
