# Gateway 快速启动指南

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  统一入口: Gateway Master (Port 3000)                   │
│  ├── HTTP REST API: /health, /stats, /webhook/*         │
│  └── WebSocket: /ws (WebUI 实时通信)                    │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼────────┐ ┌─────▼─────┐ ┌───────▼────────┐
│   WebUI (Port    │ │  Backend  │ │   IM 通道      │
│   5666)          │ │   API     │ │   (钉钉/微信)  │
│                  │ │   3001    │ │                │
└──────────────────┘ └───────────┘ └────────────────┘
```

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway Master | **3000** | 统一入口（HTTP + WebSocket） |
| Backend API | 3001 | Fastify REST API |
| Frontend Dev | 5666 | Vue3 开发服务器 |

## 启动步骤

### 1. 启动后端服务

```bash
cd cradle
npm run dev
```

服务启动后：
- Backend API: http://localhost:3001
- 数据库连接自动建立

### 2. 启动 Gateway Master

```bash
# 方式1: 使用 CLI
npm run gateway:master -- --port 3000

# 方式2: 使用配置文件
npm run gateway:start
```

服务启动后：
- Gateway: http://localhost:3000
- WebSocket: ws://localhost:3000/ws

### 3. 启动前端开发服务器

```bash
cd web/apps/admin
npm run dev
```

服务启动后：
- Frontend: http://localhost:5666

## 配置说明

### 前端代理配置

文件: `web/apps/admin/vite.config.mts`

```typescript
export default defineConfig({
  server: {
    port: 5666,
    proxy: {
      // API 请求代理到后端
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      // WebSocket 代理到 Gateway
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
```

### Gateway 配置

文件: `gateway.config.json`

```json
{
  "master": {
    "port": 3000,
    "workerCount": 4,
    "heartbeatTimeout": 30000,
    "maxQueueSize": 10000,
    "webhookPathPrefix": "/webhook"
  },
  "channels": [
    {
      "id": "webui-1",
      "name": "WebUI Channel",
      "type": "webui",
      "enabled": true,
      "config": {
        "wsPath": "/ws"
      }
    }
  ]
}
```

## 测试方法

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": 1700000000000,
  "stats": {
    "workers": 4,
    "queueSize": 0,
    "processedMessages": 0
  }
}
```

### 2. WebSocket 连接测试

使用浏览器控制台：

```javascript
// 连接 WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// 监听连接成功
ws.onopen = () => {
  console.log('Connected');
  
  // 发送认证
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { userId: 'user-001', userName: 'Test User' }
  }));
};

// 监听消息
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

// 发送消息
ws.send(JSON.stringify({
  type: 'message',
  payload: { content: 'Hello Gateway!' }
}));
```

### 3. 使用测试脚本

```bash
# 测试 Gateway 功能
node test-gateway.mjs

# 测试 WebSocket 连接
node test-webui-channel.mjs
```

## 消息协议

### WebSocket 消息格式

```typescript
// 连接成功
{ type: "connected", payload: { clientId: "ws_xxx" } }

// 认证请求
{ type: "auth", payload: { userId: "xxx", userName: "xxx" } }

// 认证成功
{ type: "auth_success", payload: { userId: "xxx", userName: "xxx" } }

// 发送消息
{ type: "message", payload: { content: "消息内容" } }

// 消息确认
{ type: "ack", payload: { messageId: "msg_xxx" } }

// 心跳
{ type: "ping" }
{ type: "pong" }

// 错误
{ type: "error", payload: { error: "错误信息" } }
```

## 故障排查

### 端口冲突

```bash
# 检查端口占用
netstat -ano | findstr :3000

# 结束占用进程
taskkill /PID <PID> /F
```

### 连接失败

1. **检查服务状态**
   ```bash
   curl http://localhost:3000/health
   ```

2. **检查防火墙**
   - 确保端口 3000 未被防火墙拦截

3. **检查代理配置**
   - 确认 vite.config.mts 中的代理配置正确

### Worker 进程退出

```bash
# 查看日志
npm run gateway:start 2>&1

# 检查配置文件
cat gateway.config.json | jq .
```

## 生产部署

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "gateway:start"]
```

### Nginx 反向代理

```nginx
upstream gateway {
    server localhost:3000;
}

server {
    listen 80;
    server_name gateway.example.com;
    
    # WebSocket 支持
    location /ws {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # HTTP API
    location / {
        proxy_pass http://gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 相关文档

- [架构设计](./architecture.md)
- [通道设计](./channels.md)
- [路由设计](./routing.md)
- [协议设计](./protocol.md)
