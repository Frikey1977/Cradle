# 聊天系统架构说明

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  Vue Components                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  chat/index.vue                               │  │
│  │  - 使用 useChat() composable                  │  │
│  │  - 只负责 UI 渲染和用户交互                    │  │
│  └───────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            useChat() Composable                     │
│  - 整合 WebSocket 服务和 Pinia Store               │
│  - 管理组件生命周期                                 │
│  - 自动订阅/取消订阅                                │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│   Pinia Store    │    │  WebSocket Service   │
│  (chat.ts)       │    │  (websocket.ts)      │
│                  │    │                      │
│  - messages      │    │  - 单例模式          │
│  - connection    │◄───┤  - 订阅/发布机制     │
│  - actions       │    │  - 自动重连          │
└──────────────────┘    └──────────────────────┘
```

## 核心优势

### 1. 单例模式
- WebSocket 服务全局唯一
- 避免多次连接
- 统一管理连接生命周期

### 2. Pinia Store
- 状态全局共享
- HMR 时状态不丢失
- 响应式更新
- DevTools 支持

### 3. 订阅/发布机制
- 组件可以随时订阅消息
- 组件卸载时自动取消订阅
- 多个组件可以同时订阅

### 4. 类型安全
- 完整的 TypeScript 类型定义
- 编译时错误检查

## 使用示例

### 基础使用

```vue
<script setup lang="ts">
import { useChat } from '#/composables/useChat';

const {
  messages,
  connectionState,
  connect,
  sendMessage,
  addMessage,
} = useChat();

// 连接
function handleConnect() {
  connect({
    name: 'cradle',
    client: 'cradle-web',
    token: 'your-jwt-token',
  });
}

// 发送消息
function handleSend(content: string) {
  sendMessage({
    type: 'message',
    payload: {
      content,
      agentId: 'agent-123',
    },
  });
}
</script>

<template>
  <div>
    <div v-for="message in messages" :key="message.id">
      {{ message.content }}
    </div>
    
    <button @click="handleConnect">
      {{ connectionState.isConnected ? '已连接' : '连接' }}
    </button>
  </div>
</template>
```

### 高级使用：自定义消息处理

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useChat } from '#/composables/useChat';

const { subscribe, messages } = useChat();

// 自定义消息处理
onMounted(() => {
  const unsubscribe = subscribe((message) => {
    if (message.type === 'custom-event') {
      // 处理自定义事件
      console.log('Custom event:', message.payload);
    }
  });
  
  // 组件卸载时会自动取消订阅
});
</script>
```

### 直接使用 Store

```vue
<script setup lang="ts">
import { useChatStore } from '#/stores/chat';

const chatStore = useChatStore();

// 直接访问状态
console.log(chatStore.messages);
console.log(chatStore.connectionState);

// 调用 actions
chatStore.addMessage({
  id: '1',
  type: 'user',
  content: 'Hello',
  timestamp: Date.now(),
});

chatStore.clearMessages();
</script>
```

### 直接使用 WebSocket 服务

```typescript
import { getWebSocketService } from '#/services/websocket';

// 获取单例
const wsService = getWebSocketService();

// 连接
wsService.connect({
  name: 'cradle',
  client: 'cradle-web',
  token: 'your-token',
});

// 发送消息
wsService.send({
  type: 'message',
  payload: { content: 'Hello' },
});

// 订阅消息
const unsubscribe = wsService.subscribe((message) => {
  console.log('Received:', message);
});

// 取消订阅
unsubscribe();

// 断开连接
wsService.disconnect();
```

## 迁移指南

### 从旧的 useWebSocket 迁移

**旧代码：**
```vue
<script setup lang="ts">
import { useWebSocket } from '#/composables/useWebSocket';

const { isConnected, connect, send } = useWebSocket({
  onMessage: (message) => {
    // 处理消息
  },
});
</script>
```

**新代码：**
```vue
<script setup lang="ts">
import { useChat } from '#/composables/useChat';

const { isConnected, connect, sendMessage, subscribe } = useChat();

// 订阅消息
onMounted(() => {
  subscribe((message) => {
    // 处理消息
  });
});
</script>
```

## 最佳实践

### 1. 状态管理
- 使用 Pinia Store 管理所有聊天状态
- 不要在组件中创建需要持久化的状态

### 2. 组件设计
- 组件只负责 UI 渲染
- 业务逻辑放在 Store 或 Service 中

### 3. 生命周期
- 组件卸载时自动取消订阅
- 不要在组件卸载时断开 WebSocket 连接

### 4. 错误处理
- 在 Service 层统一处理错误
- 通过 Store 更新错误状态

### 5. 性能优化
- 使用 computed 属性避免不必要的计算
- 大列表使用虚拟滚动

## 调试

### Vue DevTools
- 查看 Pinia Store 状态
- 追踪状态变化

### 控制台日志
```typescript
// WebSocket 服务会输出详细日志
[WebSocketService] Connected
[WebSocketService] Received message: {...}
[WebSocketService] Reconnecting... (1/5)
```

### Store 调试
```typescript
// 在控制台中
const chatStore = useChatStore();
console.log(chatStore.messages);
console.log(chatStore.connectionState);
```

## 测试

### 单元测试
```typescript
import { useChatStore } from '#/stores/chat';

describe('Chat Store', () => {
  it('should add message', () => {
    const store = useChatStore();
    store.addMessage({
      id: '1',
      type: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });
    
    expect(store.messages).toHaveLength(1);
  });
});
```

### 集成测试
```typescript
import { getWebSocketService } from '#/services/websocket';

describe('WebSocket Service', () => {
  afterEach(() => {
    WebSocketService.destroyInstance();
  });
  
  it('should connect', () => {
    const service = getWebSocketService();
    service.connect({ name: 'test', client: 'test', token: 'test' });
    // ...
  });
});
```
