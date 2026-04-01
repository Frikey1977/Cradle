# 大模型对接设计

## 1. 模块概述

### 1.1 功能定位

大模型对接模块负责提供统一的多提供商 LLM 接入能力，屏蔽不同提供商的 API 差异，为上层应用提供一致的调用接口。

### 1.2 核心价值

- **多提供商统一接入**：支持 OpenAI、Anthropic、Google、本地模型等
- **配置灵活管理**：支持配置文件、环境变量、自动发现等多种配置方式
- **流式响应支持**：支持 SSE 流式输出，实时反馈
- **故障自动转移**：模型调用失败时自动切换备用模型
- **成本透明追踪**：记录输入/输出/缓存 token 成本

### 1.3 使用场景

- **多模型切换**：根据任务类型自动选择最适合的模型
- **成本优化**：根据预算自动选择成本更低的模型
- **本地部署**：支持 Ollama 等本地模型部署
- **企业接入**：支持 AWS Bedrock 等企业级模型服务

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 多提供商支持 | OpenAI、Anthropic、Google、Ollama、Bedrock 等 |
| 统一 API 抽象 | 屏蔽不同提供商的 API 差异 |
| 流式响应处理 | 支持 SSE 流式输出 |
| 自动模型发现 | 自动检测本地/云端可用模型 |
| 成本追踪 | 记录输入/输出/缓存 token 成本 |
| 故障转移 | 模型失败时自动切换 |
| 认证管理 | API Key、OAuth、AWS SDK 等多种认证方式 |

### 2.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Agent/CLI)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Model CLI  │  │   Agent     │  │   Skill     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    模型管理层 (Model Manager)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Provider   │  │   Model     │  │   Auth      │         │
│  │   Config    │  │   Catalog   │  │  Manager    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    执行引擎层 (Execution Engine)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Session   │  │   Stream    │  │   Tool      │         │
│  │   Manager   │  │   Handler   │  │   Handler   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    提供商适配层 (Provider Adapters)          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ OpenAI  │ │Anthropic│ │  Google │ │  Local  │ ...       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 模块职责

| 模块 | 职责 |
|------|------|
| Model Manager | 模型配置管理、Provider 注册、配置合并 |
| Model Catalog | 模型目录维护、自动发现可用模型 |
| Auth Manager | 认证信息管理、Token 刷新、密钥存储 |
| Execution Engine | 会话管理、流式处理、工具调用 |
| Provider Adapters | 各提供商 API 适配、请求/响应转换 |

## 3. 业务流程

### 3.1 配置加载流程

```
输入：config.json, 环境变量

1. 加载显式配置 (config.json 中的 models.providers)
2. 自动发现隐式 Provider
   - 检查环境变量 (OPENAI_API_KEY, ANTHROPIC_API_KEY 等)
   - 检测本地服务 (Ollama)
   - 检测云服务 (AWS Bedrock)
3. 合并配置
   - 模式：merge (合并) 或 replace (替换)
   - 显式配置优先级高于隐式配置
4. 规范化处理
   - 解析 ${ENV_VAR} 语法
   - 从环境变量或 auth profiles 填充 apiKey
   - 标准化模型 ID
5. 持久化到 models.json

输出：合并后的 Provider 配置
```

### 3.2 模型调用流程

```
输入：messages, model, provider

1. 解析模型配置
   - 查找 Provider 配置
   - 查找模型定义
2. 获取认证信息
   - 从环境变量获取 API Key
   - 或从 auth profiles 获取
   - 或进行 OAuth 授权
3. 构建请求
   - 根据 Provider 类型构建请求体
   - 应用兼容性配置
4. 发送请求
   - 支持流式或非流式
   - 设置超时和重试
5. 处理响应
   - 解析响应内容
   - 提取 token 使用信息
   - 计算成本
6. 返回结果

输出：响应内容、token 使用情况、成本
```

### 3.3 流式处理流程

```
输入：session, runId, callbacks

1. 订阅会话事件
   - onReasoningStream: 推理内容流
   - onPartialReply: 部分回复
   - onToolResult: 工具结果
   - onAgentEvent: Agent 事件
2. 启动流式调用
   - 设置 streamFn
   - 应用额外参数
3. 处理流式事件
   - 接收 SSE 数据块
   - 解析 reasoning 标签
   - 分发到对应回调
4. 完成处理
   - 组装完整响应
   - 清理订阅

输出：流式事件、最终响应
```

### 3.4 故障转移流程

```
输入：request, primaryModel, fallbackModels

1. 尝试主模型
   - 发送请求
   - 如果成功，返回结果
2. 主模型失败
   - 解析错误类型 (auth, rate_limit, overload, context_overflow)
   - 判断是否可重试
3. 尝试备用模型
   - 按优先级遍历备用模型列表
   - 调整请求参数 (如需要)
   - 发送请求
4. 记录故障
   - 记录失败原因
   - 更新模型健康状态
5. 返回结果或错误

输出：响应结果 或 错误信息
```

### 3.5 自动模型发现流程

**Ollama 发现**
```
1. 检查 Ollama 服务是否可用
   - 访问 http://127.0.0.1:11434/api/tags
2. 获取模型列表
3. 转换为标准模型定义
   - 模型 ID
   - 上下文窗口 (默认 128K)
   - 成本 (本地模型为 0)
4. 添加到 Provider 配置
```

**AWS Bedrock 发现**
```
1. 检查 AWS 凭证
2. 调用 Bedrock ListFoundationModels API
3. 过滤支持的模型
4. 转换为标准模型定义
5. 添加到 Provider 配置
```

## 4. 接口设计

### 4.1 内部接口

| 接口 | 输入 | 输出 | 说明 |
|------|------|------|------|
| ModelManager.loadConfig | configPath | ModelsConfig | 加载配置 |
| ModelManager.mergeProviders | implicit, explicit | Providers | 合并配置 |
| ModelManager.discoverModels | provider | ModelDefinition[] | 自动发现模型 |
| AuthManager.getApiKey | provider, profileId | string? | 获取 API Key |
| AuthManager.refreshToken | provider | boolean | 刷新 Token |
| LLMAdapter.complete | request | CompletionResponse | 非流式完成 |
| LLMAdapter.stream | request, callbacks | StreamResult | 流式完成 |
| SessionManager.createSession | params | Session | 创建会话 |
| SessionManager.subscribe | params | Subscription | 订阅事件 |

### 4.2 CLI 接口

**模型管理命令**

| 命令 | 说明 |
|------|------|
| `cradle models list [--json]` | 列出可用模型 |
| `cradle models set <provider/model>` | 设置默认模型 |
| `cradle models info <provider/model>` | 查看模型信息 |
| `cradle models auth login --provider <provider>` | 登录授权 |
| `cradle models auth paste-token --provider <provider>` | 粘贴 Token |
| `cradle models auth logout --provider <provider>` | 退出登录 |

**模型调用命令**

| 命令 | 说明 |
|------|------|
| `cradle models complete <message> [--model <model>]` | 单次完成 |
| `cradle models chat [--model <model>]` | 交互式对话 |

## 5. 数据模型

### 5.1 核心实体

**ModelDefinition (模型定义)**

| 属性 | 类型 | 说明 |
|------|------|------|
| id | string | 模型唯一标识 |
| name | string | 显示名称 |
| api | ModelApi | API 类型 |
| reasoning | boolean | 是否支持推理 |
| input | string[] | 支持的输入类型 (text, image) |
| cost | CostConfig | 成本配置 |
| contextWindow | number | 上下文窗口大小 |
| maxTokens | number | 最大输出 token |
| headers | object? | 自定义请求头 |
| compat | CompatConfig? | 兼容性配置 |

**ModelApi (API 类型)**

| 类型 | 说明 |
|------|------|
| openai-completions | OpenAI Completions API |
| openai-responses | OpenAI Responses API |
| anthropic-messages | Anthropic Messages API |
| google-generative-ai | Google Generative AI API |
| github-copilot | GitHub Copilot API |
| bedrock-converse-stream | AWS Bedrock Converse API |

**CostConfig (成本配置)**

| 属性 | 类型 | 说明 |
|------|------|------|
| input | number | 输入 token 成本 ($/1M tokens) |
| output | number | 输出 token 成本 |
| cacheRead | number | 缓存读取成本 |
| cacheWrite | number | 缓存写入成本 |

**CompatConfig (兼容性配置)**

| 属性 | 类型 | 说明 |
|------|------|------|
| supportsStore | boolean? | 是否支持 store 参数 |
| supportsDeveloperRole | boolean? | 是否支持 developer 角色 |
| supportsReasoningEffort | boolean? | 是否支持 reasoning_effort |
| maxTokensField | string? | max_tokens 字段名 |

**ModelProviderConfig (Provider 配置)**

| 属性 | 类型 | 说明 |
|------|------|------|
| baseUrl | string | API 基础 URL |
| apiKey | string? | API Key 或环境变量名 |
| auth | ModelProviderAuthMode? | 认证方式 |
| api | ModelApi? | 默认 API 类型 |
| headers | object? | 全局请求头 |
| models | ModelDefinition[] | 模型列表 |

**ModelProviderAuthMode (认证方式)**

| 模式 | 说明 |
|------|------|
| api-key | API Key 认证 |
| aws-sdk | AWS SDK 认证 |
| oauth | OAuth 认证 |
| token | Token 认证 |

**ModelsConfig (模型配置)**

| 属性 | 类型 | 说明 |
|------|------|------|
| mode | "merge" \| "replace"? | 配置合并模式 |
| providers | Record<string, ModelProviderConfig>? | Provider 配置 |
| bedrockDiscovery | BedrockDiscoveryConfig? | Bedrock 自动发现配置 |

### 5.2 请求/响应模型

**CompletionRequest (完成请求)**

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型标识 |
| messages | Message[] | 是 | 消息列表 |
| maxTokens | number? | 否 | 最大输出 token |
| temperature | number? | 否 | 温度参数 |
| stream | boolean? | 否 | 是否流式 |
| tools | Tool[]? | 否 | 工具定义 |

**CompletionResponse (完成响应)**

| 属性 | 类型 | 说明 |
|------|------|------|
| content | string | 响应内容 |
| usage | TokenUsage | Token 使用情况 |
| cost | number | 成本 ($) |
| model | string | 使用的模型 |
| finishReason | string? | 结束原因 |

**TokenUsage (Token 使用)**

| 属性 | 类型 | 说明 |
|------|------|------|
| input | number | 输入 token 数 |
| output | number | 输出 token 数 |
| cacheRead | number? | 缓存读取 token 数 |
| cacheWrite | number? | 缓存写入 token 数 |

## 6. 数据库设计

### 6.1 数据表

- [t_model_provider 模型提供商表](./database/t_model_provider.md)
- [t_model_definition 模型定义表](./database/t_model_definition.md)
- [t_model_auth 模型认证表](./database/t_model_auth.md)

## 7. 关联文档

### 7.1 参考实现

本文档参考 OpenClaw 的大模型对接实现：

| 功能 | 参考文件 |
|------|----------|
| 配置管理 | `src/agents/models-config.ts` |
| 类型定义 | `src/config/types.models.ts` |
| 模型目录 | `src/agents/model-catalog.ts` |
| Provider 配置 | `src/agents/models-config.providers.ts` |
| 认证管理 | `src/agents/model-auth.ts` |
| 流式处理 | `src/agents/pi-embedded-runner/run/attempt.ts` |
| 会话订阅 | `src/agents/pi-embedded-subscribe.ts` |
| 运行管理 | `src/agents/pi-embedded-runner/runs.ts` |

### 7.2 关联模块

- [上下文管理](./context-manager.md)
- [Agent 模块](../agents/README.md)
- [技能模块](../skills/README.md)
