# CLI 基础设施设计

## 1. 模块概述

### 1.1 功能定位

CLI 基础设施模块提供系统级的命令行接口支持，包括：
- CLI 命令执行引擎
- 命令执行的安全管控
- 执行会话管理
- 系统级 CLI 命令（exec）

### 1.2 核心价值

- **统一执行入口**：为 Skill 和 Agent 提供统一的命令执行能力
- **安全保障**：命令审批、沙箱执行、环境隔离
- **可观测性**：执行日志、会话追踪、性能监控

### 1.3 使用场景

- **场景1**：Skill 需要执行系统命令（如 git、docker）
- **场景2**：Agent 需要调用外部 CLI 工具
- **场景3**：用户通过 CLI 与系统交互

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 命令执行 | 执行 shell 命令，支持同步/异步模式 |
| 安全管控 | 命令审批、白名单、沙箱执行 |
| 会话管理 | 执行会话生命周期管理 |
| 环境管理 | 环境变量注入、工作目录控制 |

### 2.2 执行环境类型

```
┌─────────────────────────────────────────────────────────────┐
│                     执行环境选择                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Sandbox   │    │   Gateway   │    │    Node     │    │
│   │   沙箱执行   │    │   网关执行   │    │   节点执行   │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
│   • Docker 容器       • 主机进程        • 远程节点         │
│   • 完全隔离          • 受限权限        • 分布式执行        │
│   • 最安全            • 中等安全        • 依赖网络          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 安全管控机制

#### 2.3.1 执行安全级别

| 级别 | 说明 | 适用场景 |
|------|------|---------|
| **deny** | 完全禁止执行 | 高安全环境 |
| **allowlist** | 白名单审批 | 生产环境（推荐） |
| **full** | 完全允许 | 开发环境 |

#### 2.3.2 审批流程

```
命令执行请求
    ↓
检查安全级别
    ↓
┌─────────────────┐
│  deny → 拒绝     │
│  full → 直接执行 │
│  allowlist → 检查 │
└─────────────────┘
    ↓
匹配白名单规则
    ↓
┌─────────────────────────┐
│  匹配成功 → 执行         │
│  匹配失败 → 发起审批     │
│  ask=always → 始终审批   │
└─────────────────────────┘
    ↓
等待人工审批
    ↓
执行 / 拒绝
```

#### 2.3.3 危险环境变量黑名单

```typescript
const DANGEROUS_ENV_VARS = new Set([
  "LD_PRELOAD",
  "LD_LIBRARY_PATH", 
  "NODE_OPTIONS",
  "PYTHONPATH",
  "BASH_ENV",
  "PATH",  // 禁止修改 PATH
  // ...
]);
```

### 2.4 业务流程

#### 2.4.1 命令执行流程

**输入参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| command | string | 是 | 要执行的命令 |
| workdir | string | 否 | 工作目录 |
| env | object | 否 | 环境变量 |
| timeout | number | 否 | 超时时间（秒） |
| background | boolean | 否 | 是否后台执行 |
| host | string | 否 | 执行环境（sandbox/gateway/node） |
| security | string | 否 | 安全级别（deny/allowlist/full） |
| pty | boolean | 否 | 是否使用伪终端 |

**输出结果**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| sessionId | string | 会话ID |
| status | string | 状态（running/completed/failed） |
| exitCode | number | 退出码 |
| stdout | string | 标准输出 |
| stderr | string | 标准错误 |
| duration | number | 执行时长（毫秒） |

#### 2.4.2 后台执行流程

```
1. 发起执行请求（background=true）
    ↓
2. 创建会话，立即返回 sessionId
    ↓
3. 后台执行命令
    ↓
4. 实时更新执行状态
    ↓
5. 执行完成（notifyOnExit=true 时通知）
```

## 3. 接口设计

### 3.1 CLI 命令

```bash
# 执行命令
cradle exec <command> [options]

# 选项
  --workdir <path>        # 工作目录
  --env <key=value>       # 环境变量（可多次指定）
  --timeout <seconds>     # 超时时间
  --background            # 后台执行
  --host <type>           # 执行环境（sandbox/gateway/node）
  --security <level>      # 安全级别（deny/allowlist/full）
  --pty                   # 使用伪终端

# 示例
cradle exec "git status" --workdir /path/to/repo
cradle exec "npm install" --background --notify-on-exit
```

### 3.2 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/v1/exec | POST | 执行命令 |
| /api/v1/exec/background | POST | 后台执行命令 |
| /api/v1/exec/sessions | GET | 列出现有会话 |
| /api/v1/exec/sessions/:id | GET | 获取会话状态 |
| /api/v1/exec/sessions/:id/stop | POST | 停止会话 |
| /api/v1/exec/approvals | GET | 列出待审批请求 |
| /api/v1/exec/approvals/:id/approve | POST | 批准执行 |
| /api/v1/exec/approvals/:id/reject | POST | 拒绝执行 |

## 4. 数据库设计

- [命令执行会话表](./database/t_exec_session.md)
- [执行审批记录表](./database/t_exec_approval.md)

## 5. 关联文档

- [系统管理模块](./README.md)
- [Agent 运行时层](../agents/runtime.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
