# 员工管理设计

## 1. 功能定位

员工管理是组织管理的核心模块，负责**人类员工**的统一管理。

**重要概念**：
- **人类员工**：真实的人，存储在 `t_employees` 表
- **数字员工**：AI Agent，存储在 `t_agent` 表（Agent 管理模块）
- 两者是**平行关系**，不是包含关系

## 2. 员工类型与数据模型

### 2.1 员工类型

| 类型 | 说明 | 数据存储 | 登录系统 |
|------|------|---------|---------|
| 人类员工 | 真实的员工 | `t_employees` + `t_users` | 可以登录 |

**注意**：数字员工（Agent）不在员工管理中管理，而是在 **Agent 管理模块**中管理。

### 2.2 人类员工与数字员工的关系

```
组织管理
├── 员工管理
│   └── t_employees（仅人类员工）
│       ├── 基本信息
│       ├── 能力画像
│       ├── 经历画像
│       ├── 个人事实
│       └── 个人偏好
│
└── Agent管理
    └── t_agent（仅数字员工）
        ├── 基本信息
        ├── 运行时配置
        ├── 技能定义（org-skill）
        └── 服务模式
```

**关系说明**：
- 人类员工可以**绑定**一个或多个 Agent（专属/共享模式）
- 数字员工可以**绑定**一个用户（专属模式）或被多人使用（共享/公共模式）
- 两者通过组织树统一管理，但数据表分离

### 2.3 转岗场景示例

**场景**：张三从技术部调到销售部

**处理逻辑**：
1. 更新 `t_employees.org_id` 到销售部
2. 技术部的"代码助手"Agent 继续留在技术部（**不跟随移动**）
3. 张三在销售部获得新的 Agent（如"客户助手"）
4. 原"代码助手"可以绑定给接替张三的新员工

**原因**：
- Agent 沉淀的是**岗位能力**，不是个人能力
- 技术部的代码规范、项目经验留在技术部
- 销售部的客户需求、沟通方式与销售 Agent 相关

### 2.4 数据权限控制

Agent 回答问题时，**数据权限由用户决定，不是由 Agent 决定**：

```
用户提问
    ↓
系统获取用户身份 → 查询用户岗位（t_positions）
    ↓
获取岗位数据权限范围（data_scope）
    ↓
判断用户是否有权访问请求的数据
    ↓
Agent 根据 Skill 能力提供回答
```

**示例**：
- HR助手（共享 Agent）被所有员工使用
- 普通员工问"我的薪资" → 可以回答（自己的数据）
- 普通员工问"张三的薪资" → 拒绝（无权限）
- HR专员问"张三的薪资" → 可以回答（岗位有权限）

## 3. 功能列表

| 功能 | 说明 |
|------|------|
| 员工录入 | 手工录入或从 EHR 导入员工信息 |
| 简历解析 | 上传简历自动提取员工画像 |
| 信息管理 | 维护员工基本信息和画像 |
| Agent 绑定 | 为员工分配 Agent（专属/共享） |
| 转岗管理 | 处理员工部门调动 |
| 离职管理 | 处理员工离职，保留历史数据 |

## 4. 员工画像结构

员工画像包含以下五个部分，存储在 `t_employees` 表的 `profile_json` 字段中：

```
员工画像（profile_json）
├── 基本信息        # 已在 t_employees 表中定义
├── 能力画像       # 专业技能和工作能力
├── 经历画像       # 工作经历和教育背景
├── 个人事实       # 个人特征和习惯
└── 个人偏好       # 工作偏好和沟通偏好
```

详细字段定义见 [员工表](./database/t_employees.md)。

### 4.1 基本信息

基本信息的必填字段已在 `t_employees` 表中定义：

| 字段 | 类型 | 说明 |
|------|------|------|
| employee_no | VARCHAR(50) | 员工工号 |
| name | VARCHAR(200) | 姓名 |
| oid | VARCHAR(36) | 所属组织 |
| position_id | VARCHAR(36) | 职位 |
| type | VARCHAR(50) | 员工类型（全职/兼职/外包） |
| location | VARCHAR(200) | 工作地点 |
| email | VARCHAR(100) | 邮箱 |
| phone | VARCHAR(20) | 电话 |
| hire_date | DATE | 入职日期 |
| status | VARCHAR(50) | 员工状态（在职/离职/停职/退休） |

详见 [员工表](./database/t_employees.md)。

#### 4.1.1 员工类型（type）

员工类型通过代码表 `organization.employee.type` 定义：

| 值 | 说明 |
|----|------|
| full-time | 全职 |
| part-time | 兼职 |
| outsourcing | 外包 |

#### 4.1.2 工作地点（location）

工作地点通过代码表 `organization.department.location` 定义，记录员工的主要办公地点：

| 值 | 说明 |
|----|------|
| suzhou | 苏州 |
| shenzhen | 深圳 |
| guangzhou | 广州 |

**说明**：
- 工作地点用于标识员工的主要办公场所
- 支持多地点办公的企业管理
- 可用于考勤、差旅、会议安排等业务场景
- 该字段为可选字段，员工可根据实际情况填写

#### 4.1.3 员工状态（status）

员工状态通过代码表 `organization.employee.status` 定义：

| 值 | 说明 |
|----|------|
| active | 在职 |
| inactive | 离职 |
| suspend | 停职 |
| retired | 退休 |

### 4.2 能力画像（profile_json）

| JSON字段 | 类型 | 说明 |
|----------|------|------|
| skills | string[] | 专业技能 |
| certifications | string[] | 资质证书 |
| expertise | string[] | 专业领域 |
| level | string | 职级水平 |

### 4.3 经历画像（profile_json）

| JSON字段 | 类型 | 说明 |
|----------|------|------|
| education | Education[] | 教育经历 |
| workHistory | WorkExperience[] | 工作经历 |
| projects | Project[] | 项目经验 |

### 4.4 个人事实（profile_json）

| JSON字段 | 类型 | 说明 |
|----------|------|------|
| personality | string[] | 性格特征 |
| habits | string[] | 工作习惯 |
| traits | string[] | 个人特质 |

### 4.5 个人偏好（profile_json）

| JSON字段 | 类型 | 说明 |
|----------|------|------|
| workStyle | string | 工作风格 |
| communicationStyle | string | 沟通风格 |
| focusTime | string | 专注时段 |
| preferredTools | string[] | 常用工具 |

## 5. 录入方式

### 5.1 手工录入

管理员（HR）在员工管理页面手工输入员工信息：

| 方式 | 适用场景 |
|------|---------|
| 逐条录入 | 少量新员工入职 |
| 批量导入 | 大规模员工入职（CSV/Excel） |

### 5.2 简历解析

上传简历文件，系统自动提取五项画像内容：

```
简历上传 → NLP解析 → 结构化提取 → 人工确认 → 存入员工画像
```

支持格式：PDF、Word、图片（OCR）

### 5.3 EHR 同步

HR Agent（数字员工）自动从企业 HR 系统同步员工信息：

```
HR Agent 定时/触发 → 连接EHR API → 获取员工数据 → 更新员工画像
```

详见 [Agent 运行时层](../agents/runtime.md) 中的 Agent 类型设计。

## 6. Agent 绑定

### 6.1 绑定模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 专属 Agent | 员工独享一个 Agent | 高管、核心岗位 |
| 共享 Agent | 多员工共用一个 Agent | 通用业务岗位 |
| 无 Agent | 暂不分配 Agent | 待分配 |

### 6.2 绑定流程

```
选择员工
    ↓
选择 Agent（从 t_agent 列表中选择）
    ↓
设置绑定模式（专属/共享）
    ↓
完成绑定
    ↓
更新 t_agent.bind_user_id（专属模式）
```

**注意**：Agent 本身在 Agent 管理模块中创建和维护，员工管理只负责绑定关系。

## 7. 与 User 表的关系

### 7.1 关系说明

Employee 和 User 是**一对一**的关系：

| 员工类型 | Employee 表 | User 表 | 关系 |
|---------|------------|---------|------|
| 人类员工 | 有记录 | 有记录 | 1:1 关联 |

### 7.2 数据分工

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| **业务数据** | t_employees | 工号、姓名、组织、职位、画像等 |
| **认证数据** | t_users | 用户名、密码、登录状态等 |
| **权限数据** | r_user_role | 用户与角色的关联 |

### 7.3 创建流程

**人类员工创建流程**：

```
HR 在员工管理页面创建员工
    ↓
填写业务信息（姓名、部门、职位等）
    ↓
系统自动创建 t_employees 记录
    ↓
设置登录信息（用户名、密码）
    ↓
系统自动创建 t_users 记录
    ↓
更新 t_employees.user_id = t_users.sid
    ↓
分配角色（权限）
    ↓
创建完成
```

### 7.4 登录流程

```
用户输入用户名密码
    ↓
验证 t_users（认证通过）
    ↓
查询 t_employees（通过 user_id 关联）
    ↓
获取员工业务数据（组织、职位、画像等）
    ↓
查询 r_user_role（获取角色权限）
    ↓
登录成功，进入系统
```

### 7.5 与 Contact 画像的关系

员工管理中的「个人事实」和「个人偏好」对应 [Contact 事实](../memory/profile_contact_fact.md)：

| 员工画像 | Contact 画像 |
|---------|-------------|
| 个人事实 | 基础信息 + 部分工作信息 |
| 个人偏好 | 沟通偏好 |

Contact 画像数据存储在 t_contacts.facts 中。

## 8. 关联文档

- [员工表](./database/t_employees.md)
- [用户管理表](./database/t_users.md)
- [组织架构表](./database/t_departments.md)
- [岗位表](./database/t_positions.md)
- [Agent 定义表](../agents/database/t_agent.md)
- [Contact 画像（个人事实+个人偏好）](../memory/profile_contact_fact.md)
- [关系偏好](../memory/profile_relationship.md)
- [岗位管理设计](./position.md)
