# 聊天模块架构迁移总结

## 迁移完成时间
2026-03-30

## 迁移内容

### 1. 新增文件

#### `src/stores/chat.ts` - Pinia Store
- 全局状态管理
- 消息列表、连接状态、选中 Agent 等状态
- HMR 时状态不丢失

#### `src/services/websocket.ts` - WebSocket 服务层
- 单例模式
- 订阅/发布机制
- 自动重连
- 心跳保活
- 认证流程

#### `src/composables/useChat.ts` - 统一接口
- 整合 WebSocket 服务和 Pinia Store
- 自动订阅/取消订阅
- 组件生命周期管理

#### `docs/chat-architecture.md` - 架构文档
- 架构说明
- 使用示例
- 最佳实践

### 2. 修改文件

#### `src/views/workspace/chat/index.vue`
**主要变更：**
- 导入：`useWebSocket` → `useChat`
- 状态管理：组件级 ref → Pinia Store
- 消息订阅：回调函数 → 订阅/发布机制
- 消息发送：`send()` → `sendMessage()`
- 清理 HMR 相关代码（不再需要）

**具体修改：**
```typescript
// 旧代码
import { useWebSocket } from "#/composables/useWebSocket";

const {
  isSocketOpen,
  isConnected,
  connect,
  disconnect,
  send,
} = useWebSocket({
  url: "ws://localhost:3000/ws/cradle",
  autoReconnect: true,
  onMessage: (message) => {
    handleWebSocketMessage(message);
  },
});

// 新代码
import { useChat } from "#/composables/useChat";

const {
  messages,
  connectionState,
  connect,
  disconnect,
  sendMessage,
  subscribe,
} = useChat();

onMounted(() => {
  subscribe((message) => {
    handleWebSocketMessage(message);
  });
});
```

## 架构对比

### 旧架构问题
```
┌─────────────────────────────────────────┐
│           Vue Components                │
│  - 每个组件创建自己的 WebSocket 实例     │
│  - 消息状态在组件级别管理                │
│  - HMR 时状态丢失                        │
│  - 多个实例导致消息处理混乱              │
└─────────────────────────────────────────┘
```

### 新架构优势
```
┌─────────────────────────────────────────┐
│           Vue Components                │
│  - 使用 useChat() composable            │
│  - 只负责 UI 渲染                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Pinia Store (全局单例)           │
│  - 状态在组件间共享                      │
│  - HMR 时状态不丢失                      │
│  - DevTools 支持                         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      WebSocket Service (单例)            │
│  - 全局唯一连接                          │
│  - 订阅/发布机制                         │
│  - 自动管理生命周期                      │
└─────────────────────────────────────────┘
```

## 解决的问题

| 问题 | 旧方案 | 新方案 |
|------|--------|--------|
| HMR 时状态丢失 | ❌ 组件级 ref | ✅ Pinia Store |
| 多个 WebSocket 连接 | ❌ 每次创建新实例 | ✅ 单例模式 |
| 回调引用问题 | ❌ 闭包引用旧实例 | ✅ 订阅/发布机制 |
| 组件卸载清理 | ❌ 手动管理 | ✅ 自动取消订阅 |
| 类型安全 | ⚠️ 部分类型 | ✅ 完整类型定义 |
| 调试困难 | ❌ 无 DevTools | ✅ Pinia DevTools |

## 需要注意的事项

### 1. 不要在组件卸载时断开连接
```typescript
// ❌ 错误
onUnmounted(() => {
  disconnect(); // 会影响其他组件
});

// ✅ 正确
onUnmounted(() => {
  // 订阅会自动取消，不需要手动断开连接
});
```

### 2. 消息数组的响应式更新
```typescript
// 旧方式（仍然支持）
messages.value.push(newMessage);
messages.value = [...messages.value]; // 触发更新

// 新方式（推荐）
addMessage(newMessage); // 使用 Store action
```

### 3. 连接状态访问
```typescript
// 旧方式
const statusText = computed(() => {
  if (isConnecting.value) return "连接中...";
  // ...
});

// 新方式
const statusText = computed(() => {
  if (connectionState.value.isConnecting) return "连接中...";
  // ...
});
```

## 测试建议

### 1. HMR 测试
- 修改代码后，检查消息是否保留
- 检查 WebSocket 连接是否正常
- 检查订阅是否正常工作

### 2. 多组件测试
- 在多个组件中使用 `useChat()`
- 检查状态是否同步
- 检查消息是否正确分发

### 3. 连接管理测试
- 测试自动重连
- 测试心跳保活
- 测试认证流程

## 后续优化建议

### 1. 添加消息持久化
```typescript
// 在 Store 中添加持久化逻辑
const messages = ref<ChatMessage[]>(
  JSON.parse(localStorage.getItem('chat-messages') || '[]')
);

watch(messages, (val) => {
  localStorage.setItem('chat-messages', JSON.stringify(val));
}, { deep: true });
```

### 2. 添加消息分页
```typescript
// 在 Store 中添加分页逻辑
const pageSize = 50;
const currentPage = ref(1);

const visibleMessages = computed(() => {
  const start = Math.max(0, messages.value.length - pageSize * currentPage.value);
  return messages.value.slice(start);
});
```

### 3. 添加离线支持
```typescript
// 在 WebSocket Service 中添加离线队列
private offlineQueue: WebSocketMessage[] = [];

send(message: WebSocketMessage): boolean {
  if (!this.isConnected) {
    this.offlineQueue.push(message);
    return false;
  }
  // ...
}
```

## 总结

这次迁移将聊天模块从组件级状态管理升级为全局状态管理，解决了 HMR 导致的状态丢失和多实例问题。新架构遵循 Vue 生态的最佳实践，具有更好的可维护性和可扩展性。

**核心优势：**
1. ✅ 单例模式确保 WebSocket 连接唯一
2. ✅ Pinia Store 确保状态全局共享
3. ✅ HMR 时状态不丢失
4. ✅ 自动管理订阅生命周期
5. ✅ 完整的 TypeScript 类型支持
6. ✅ 更好的调试体验（DevTools）
