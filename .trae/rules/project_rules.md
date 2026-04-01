# Project Rules for Cradle

## 通用规则
1. 始终使用中文回复用户
2. 保持代码风格一致性
3. 优先使用项目中已有的工具和库

## 重构规则
1. 当改变原有逻辑结构时需要同步更新相关设计文档，设计文档位于 cradle/design

## 命令执行规则
1. 在 Trae 环境中执行命令时，优先使用 `npx` 前缀
2. 推荐格式：`npx pnpm exec <command>` 或 `npx <package>`
3. 避免直接使用 `pnpm exec` 或本地安装的 CLI 命令，可能在沙箱环境中受限

## 服务重启规则
项目包含三个服务，重启时需要全部重启：

### 1. Gateway Master（后端主服务）
```bash
cd f:\01. cradle-main\cradle
npx pnpm run gateway:master
```

### 2. Gateway Worker（后端工作进程）
```bash
cd f:\01. cradle-main\cradle
npx pnpm run dev
```

### 3. Web Playground（前端开发服务器）
```bash
cd f:\01. cradle-main\cradle\web\playground
npx pnpm dev
```


**注意**：
- Gateway Master 在主终端启动，需要监控其输出
- Gateway Worker 和 Web Playground 在后台运行，不需要监控
- 重启前务必先停止所有 node 进程

