# Cradle - 企业级 AI 助理平台

## 项目简介

Cradle 是一个面向企业的**私有化部署 AI 助理平台**，旨在为每个员工提供一对一的 Agent，配合完成工作、校对工作目标，并沉淀岗位工作逻辑，最终形成企业的数字员工资产。

### 核心特性

**项目原生国际化跨语言支持**
 - 原生的多语言系统，适用于各种语言环境组织背景

**Cradle Web 可视化管理**
 - Agent 记忆可编辑、可剪裁
 - Agent 根据其岗位工作需要，通过可视化方式配置管理Skill
 - Agent 工作过程可视化、可跟踪，Token消耗过程一目了然
 - Agent 具有与多用户交流互动能力，对话记忆隔离
 - Agent 具有独立的心跳管理功能，根据不同场景设置心跳频率以及工作内容
 - Agent 具有强大的上下文管理能力，预定义上下文能够节省90%的Token消耗

**三重画像** 让Agent在互动中清晰知道自己是谁、对方是谁、双方关系如何从而做出合理的反应
 - 用户画像：包括并不限于内部员工、客户、供应商、陌生人
 - Agent画像：包括并不限于公司、部门、岗位职责以及各级组织文化
 - 关系画像，用户与Agent之间的关系，具体由LLM从对话中进行信息提取，渐进式维护

**六重记忆** 让Agent记住他与不同的用户之间的对话
 - Agent画像，让Agent知道自己是谁，明确的自我认知让LLM能够精准的处理相应的工作任务
 - 短期记忆，近期互动对话内容（对20轮以前的进行语义和信息密度蒸馏以节省上下文）
 - *记忆索引*，基于语义的记忆索引，按对话主题进行向量化处理，保存到向量数据库，metadata指向长期记忆的物理文件
 - *长期记忆*，蒸馏后的对话作为长期记忆按日期文件存储，metadata指向原始对话
 - *原始对话*，以Log方式按日保存全部原始内容，用于审计、迁移
 - *集体潜意识*，Agent执行过程中的最佳实践可以提炼并扩散到其他Agent，由记忆管理器自动加载
 - *岗位技能最佳实践*，根据历史任务聚合提炼成为可沉淀岗位资产 

**Skill兼容系统** Cradle可以使用在其他系统中构建的Skill
 - 用户（管理员）可以在Cradle中定义和管理Skill
 - Agent携带的Skill与其岗位设置相关连，Agent只携带与工作目标相关的Skill
 - Skill能够承担80%的二次开发以业务拓展场景

**基于Playwright + CDP 流程自动化能力**
 - 通过有头或无头浏览器模式实现网页模拟操作，完全解决网站反爬机制
 - 实现模拟人类访问网页，操作录入数据等操作
 - 自动识别与人工标注结合的工作模式，更加节省Token

**多LLM供应商支持**
 - 提供多LLM供应商路由聚合能力，可以同时接入不同平台的API
 - 允许同一个供应商配置不同APIKey连接实例，以优化Token使用策略
 - Cradle能够根据token限额，订阅方式动态选择LLM访问实例

**多IM通道接入支持**
 - 支持多IM通道接入，Whatsapp，Wechat，DingTalk等
 - IM身份归一化处理，支持多通道身份统一，认得来自不同通道的同一个人

**Agent-Executor分离架构设计**
 - Agent：携带完整上下文，识别用户意图编排任务，提供非阻塞对话能力，任务执行期间不影响对话
 - Executor，仅携带工作上下文，目标聚焦上下文简洁且，隔离高效
 - Handler，简单的命令任务执行，处理随时可完成的指令
 - Agent，新旧任务可以并行处理


## 技术栈

### 后端

| 技术 | 版本 | 说明 |
|-----|------|------|
| TypeScript | 5.3+ | 开发语言 |
| Node.js | 18+ | 运行时 |
| Fastify | 4.25+ | Web 框架 |
| SQLite | 12.8+ | 数据库 (预编译二进制文件已包含) |
| WebSocket | 8.19+ | 实时通信 |
| Playwright | 1.40+ | 浏览器自动化 |

### 前端

| 技术 | 版本 | 说明 |
|-----|------|------|
| Vue 3 | 3.4+ | 前端框架 |
| TypeScript | 5.3+ | 开发语言 |
| Vben Admin | 5.0+ | 中后台模板 |
| Ant Design Vue | 4.x | UI 组件库 |
| Pinia | 2.x | 状态管理 |

## 快速开始

### ⚠️ 注意事项

**项目文件夹路径请尽量避免使用英文以外的字符（包括空格），以免出现不可预期的问题。**

### 开发环境准备

推荐使用 **Trae** 作为开发 IDE，以下扩展建议安装：

| 扩展名称 | 说明 |
|---------|------|
| SQLite3 Editor | SQLite 数据库可视化编辑 |
| i18n Ally | 国际化辅助工具 |
| Iconify IntelliSense | 图标库智能提示 |
| ESLint | 代码规范检查 |
| Code Formatter & Minifier | 代码格式化与压缩 |
| Tailwind CSS IntelliSense | Tailwind CSS 智能提示 |
| Vue (Official) | Vue 官方扩展 |

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git

### 安装步骤

1. **克隆项目**

```bash
git clone https://gitee.com/aosenai/cradle
```

2. **初始化数据库**

```bash
# 将 data.init 文件夹复制为 data，即可完成数据库初始化
cp -r data.init data
```

3. **安装依赖**

```bash
# 启用 corepack
npm install -g pnpm

# 安装项目依赖
npx pnpm install
```

4. **部署预编译二进制文件（Windows 推荐）**

项目已包含预编译的 better-sqlite3 二进制文件，部署时自动安装：

```bash
# 安装依赖
npx pnpm install

# 部署预编译二进制文件
node prebuilt/install-sqlite.js
```

> ℹ️ 预编译文件位于 `prebuilt/win32-x64/`，支持 Node.js 24.x 版本。如果部署失败，请参考 [手动编译方案](#手动编译方案)。

5. **配置环境变量**

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置必要参数
```

6. **启动服务**

Trae中@Builder：启动服务，即可自动启动所有服务。

```bash
# 启动 Gateway Master（主服务）
npx pnpm run gateway:master

# 启动 Cradle API Service 服务（在另一个终端）
npx pnpm run dev

# 启动 Cradle 前端服务（在另一个终端）
cd web/playground
npx pnpm install
npx pnpm dev
```

### 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| Cradle Web UI | http://localhost:5555 | 前端管理界面 选择Admin登录 |
| Cradle API Service | http://localhost:5320/api/health | API 服务健康检测 |
| Cradle Gateway Master | http://localhost:3000/health | 网关主服务健康检测 |
| Cradle Browser MCP | http://localhost:18791/health | 浏览器 MCP 服务健康检测 |

## 项目结构

```
cradle/
├── src/                          # 后端源代码
│   ├── agent/                    # Agent 运行时
│   │   ├── browser/              # 浏览器自动化
│   │   ├── context/              # 上下文管理
│   │   ├── executor/             # 执行器
│   │   ├── heartbeat/            # 心跳机制
│   │   ├── memory/               # 记忆系统
│   │   ├── runtime/              # 运行时核心
│   │   ├── skills/               # 技能系统
│   │   └── tools/                # 工具集
│   ├── gateway/                  # 网关层
│   │   ├── channels/             # 通道管理
│   │   ├── core/                 # 核心逻辑
│   │   └── routes/               # API 路由
│   ├── llm/                      # 大模型对接
│   │   ├── adapters/             # 适配器
│   │   ├── providers/            # 提供商管理
│   │   └── runtime/              # 运行时
│   ├── organization/             # 组织管理
│   ├── system/                   # 系统管理
│   └── store/                    # 数据存储
├── web/                          # 前端代码
│   ├── apps/                     # 应用目录
│   ├── packages/                 # 共享包
│   └── playground/               # 主应用
├── design/                       # 设计文档
│   ├── agent/                    # Agent 设计
│   ├── core/                     # 核心设计
│   ├── gateway/                  # 网关设计
│   ├── memory/                   # 记忆系统设计
│   └── system/                   # 系统设计
└── scripts/                      # 工具脚本
```

## 核心功能

### 1. Agent 管理

- 创建和配置企业 Agent
- Agent 与员工绑定
- Agent 技能管理

### 2. 记忆系统

- **四层记忆架构**
  - 对话层：短期对话历史
  - 工作层：工作任务记忆
  - 知识层：领域知识库
  - 档案层：长期身份信息

- **五重画像体系**
  - 企业画像
  - 部门画像
  - 岗位画像
  - 员工画像
  - Agent 画像

### 3. 技能系统

- 基于 YAML 的技能定义
- 工具调用能力
- 浏览器自动化
- 自定义技能开发

### 4. 多通道接入

- Web 界面（主入口）
- WebSocket 实时通信
- 可扩展的通道架构

### 5. 大模型对接

- 多提供商支持 (OpenAI, Anthropic, 阿里千问等)
- 负载均衡和故障转移
- 统一的适配器接口

## 文档

- [设计文档](./design/README.md) - 系统架构和设计规范
- [数据库设计](./design/DATABASE_SPECIFICATION.md) - 数据表结构
- [编码规范](./design/CODING_STANDARDS.md) - 开发规范
- [Gateway 文档](./design/gateway/README.md) - 网关层设计

## 贡献指南

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feat/xxx`
3. 提交更改: `git commit -am 'feat: add xxx'`
4. 推送分支: `git push origin feat/xxx`
5. 提交 Pull Request

### 提交规范

- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

## 许可证

本项目采用 **Apache License 2.0** 开源协议。

### 使用条款

- **个人及商业企业自用**：完全免费，您具有完全的使用与二次开发权力，并且拥有该知识产权
- **产品化包装及商业化服务**：使用本项目进行任何形式的产品化包装，以及向任何第三方用户提供商业化收费服务的，需要经过书面授权

### 授权联系

如需商业授权，请联系：**frikey@126.com**

---

## 技术支持与服务

Cradle 开发组为用户提供专业的有偿技术服务，包括但不限于：

| 服务类型 | 说明 |
|---------|------|
| **系统实施咨询** | 帮助企业快速完成 Cradle 系统的部署与集成 |
| **业务解决方案咨询** | 基于行业特点，提供 AI 助理应用场景的解决方案设计 |
| **二次开发技术培训** | 为技术团队提供 Cradle 架构、技能开发等深度培训 |
| **产品功能定制开发** | 根据企业特定需求，进行功能定制与扩展开发 |

如有服务需求，欢迎联系：**frikey@126.com**

---

## 生态建设与发展规划

我们诚挚邀请更多有识之士加入 Cradle 生态建设，共同推进企业 AI 助理领域的发展：

### 我们在寻找

- **架构型开发者** - 对系统架构有深入理解，能够推动 Cradle 技术演进
- **行业专家** - 具备业务思维，能够将 AI 技术与行业场景深度融合

### 共同愿景

我们相信，企业 AI 助理市场潜力巨大。通过共建生态，我们不仅可以为企业客户提供更优质的服务，更能在这场智能化变革中共享价值、共同分配新的财富机遇。

**让我们一起，做大蛋糕，共享未来！**

联系邮箱：**frikey@126.com**

---

## 附录

### 手动编译方案

如果预编译二进制文件部署失败，可以手动编译 better-sqlite3：

**前置要求**：
- Visual Studio Build Tools 或 Visual Studio（包含 C++ 工作负载）
- Python 3.x

**编译步骤**：
```bash
# 进入 better-sqlite3 目录并重新编译
cd node_modules/better-sqlite3
npx node-gyp rebuild
cd ../..
```

**打包预编译文件（供团队使用）**：
```bash
# 在已编译的环境中运行打包脚本
node scripts/package-sqlite-binary.js

# 将生成的 prebuilt/ 目录提交到 Git，供其他成员使用
```

