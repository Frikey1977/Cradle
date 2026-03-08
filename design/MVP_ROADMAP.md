# Cradle MVP 任务目标

## 项目愿景
构建企业级AI助理平台，让每个员工拥有专属Agent，通过自然语言交互完成工作任务。

---

## 第一阶段 MVP：基础交互能力

### 目标
实现用户登录系统，与Agent进行基础对话，Agent基于五重画像信息由大模型生成个性化回复。

### 用户场景
```
用户：登录Web系统 → 打开Chat窗口 → 发送"你是谁？请介绍一下你自己"
Agent：基于企业画像、岗位画像、Agent事实等信息生成个性化自我介绍
```

### 核心功能模块

#### 1. 用户认证模块
- 用户登录（用户名/密码）
- JWT Token认证机制（AccessToken + RefreshToken）
- 登录状态管理

#### 2. Agent管理模块
- Agent基础信息管理
- 五重画像数据加载（企业画像、岗位画像、Agent事实）
- 服务模式配置（专属/共享/公共）

#### 3. 实时通信模块
- WebSocket连接建立与维护
- 消息帧格式支持（Request/Response/Event）
- 心跳机制与自动重连
- 连接池管理

#### 4. 大模型对接模块
- 多Provider支持（OpenAI/Anthropic等）
- 统一API抽象
- 流式响应处理
- 上下文构建（SystemPrompt + 用户输入）

#### 5. 会话管理模块
- 会话创建与维护
- 上下文消息存储
- 基础对话历史

### 数据表需求
- t_users（用户表）
- t_agent（Agent定义表）
- t_session（会话表）
- t_context（上下文表）

### 交付标准
- [ ] 用户可成功登录系统
- [ ] WebSocket连接稳定，支持断线重连
- [ ] Agent能根据五重画像信息生成个性化回复
- [ ] 对话内容可正常存储和展示

---

## 第二阶段：简单任务执行

### 目标
Agent能够理解用户意图，调用Skill完成具体任务（如日程安排）。

### 用户场景
```
用户：帮我明天下午3点安排一个和研发团队的会议，讨论版本发布计划
Agent：追问缺失信息（时长）→ 调用日历Skill → 生成会议议程 → 返回确认信息
```

### 核心功能模块

#### 1. 意图识别能力
- 自然语言意图分类
- 实体提取（时间、人物、主题等）
- 信息完整性检查

#### 2. 对话状态管理
- 多轮对话状态机
- 信息收集流程
- 上下文保持

#### 3. Skill系统
- Skill注册与发现
- Skill调用协议
- 基础Skill实现：
  - 日历管理Skill（查询、创建、更新）
  - 文档生成Skill（议程生成）

#### 4. ReAct执行模式
- 思考-行动-观察循环
- Skill调用编排
- 结果整合与格式化

### 数据表需求
- t_skill（Skill定义表）
- r_agent_skill（Agent-Skill关联表）
- 扩展t_agent（增加skill配置）

### 交付标准
- [ ] Agent能识别"创建日程"意图
- [ ] 能主动追问缺失信息
- [ ] 成功调用日历Skill创建日程
- [ ] 返回格式化的确认信息

---

## 第三阶段：复杂任务编排

### 目标
Agent能够分解复杂任务，协调多个Skill和子Agent并行执行，实时反馈执行进度。

### 用户场景
```
用户：帮我准备Q4季度销售分析报告，周五管理层会议汇报
Agent：任务规划 → 数据提取 → 数据分析 → 可视化 → 报告生成 → 实时反馈进度 → 交付完整报告
```

### 核心功能模块

#### 1. 工作流编排引擎
- 任务分解与DAG构建
- 子任务依赖管理
- 并行执行控制
- 执行进度追踪

#### 2. 主-子Agent架构
- 主Agent（协调决策）
- 数据Agent（数据提取）
- 分析Agent（数据分析）
- 报告Agent（文档生成）

#### 3. 扩展Skill生态
- 数据查询Skill（CRM/ERP对接）
- 数据分析Skill（统计分析）
- 可视化Skill（图表生成）
- 文档生成Skill（PPT/Excel/PDF）

#### 4. 执行监控系统
- 任务执行状态追踪
- 异常检测与处理
- 执行日志记录
- 失败重试与降级

#### 5. 完整记忆系统
- 短期记忆（会话上下文）
- 长期记忆（历史任务参考）
- 执行知识（经验沉淀）

### 数据表需求
- 工作流相关表
- 执行监控相关表（t_execution_log等）
- 记忆系统表（t_short_term_memory等）

### 交付标准
- [ ] Agent能自动分解复杂任务
- [ ] 支持多子任务并行执行
- [ ] 实时推送执行进度
- [ ] 生成完整的分析报告
- [ ] 异常情况下能自动重试或降级

---

## 多Agent协同开发建议

### 模块划分建议

| 开发Agent | 负责模块 | 依赖关系 |
|----------|---------|---------|
| **Agent-Auth** | 用户认证、权限控制 | 无 |
| **Agent-DB** | 数据库设计、ORM、迁移 | 无 |
| **Agent-Gateway** | WebSocket服务、HTTP API | 依赖DB |
| **Agent-Core** | 大模型对接、上下文管理 | 依赖Gateway |
| **Agent-Agent** | Agent运行时、对话管理 | 依赖Core |
| **Agent-Skill** | Skill系统、基础Skill实现 | 依赖Agent |
| **Agent-Workflow** | 工作流编排、任务调度 | 依赖Skill |
| **Agent-UI** | 前端界面、Chat组件 | 依赖Gateway |

### 接口契约定义优先级
1. 数据库Schema（Agent-DB优先完成）
2. WebSocket协议（Agent-Gateway定义）
3. Skill调用协议（Agent-Skill定义）
4. 工作流编排接口（Agent-Workflow定义）

### 并行开发策略
- 无依赖模块可完全并行（Auth、DB、UI可同时启动）
- 核心模块按依赖链顺序开发（Gateway → Core → Agent → Skill → Workflow）
- 每个模块定义清晰的接口契约后，下游模块可基于Mock数据并行开发

---

## 设计文档索引

### 架构设计
- [总体架构](system_design/overall.md)
- [数据库规范](system_design/DATABASE_SPECIFICATION.md)
- [设计规范](system_design/DESIGN_SPECIFICATION.md)

### 模块设计
- [Gateway架构](system_design/gateway/architecture.md)
- [WebSocket协议](system_design/gateway/protocol.md)
- [大模型对接](system_design/core/llm-adapter.md)
- [Agent运行时](system_design/agents/runtime.md)
- [Skill系统](system_design/system/skills.md)
- [工作流编排](system_design/workflow/workflow.md)

### 数据库设计
- [用户表](system_design/system/database/t_users.md)
- [Agent表](system_design/agents/database/t_agent.md)
- [会话表](system_design/core/database/t_session.md)
- [上下文表](system_design/core/database/t_context.md)
- [Skill表](system_design/system/database/t_skill.md)

---

*文档版本：1.0*
*更新日期：2026-02-14*
