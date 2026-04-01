/**
 * 聊天功能 Composable
 * 
 * 整合 WebSocket 服务和 Pinia Store，提供统一的聊天接口
 * 
 * 优势：
 * 1. 单例模式确保 WebSocket 连接唯一
 * 2. Pinia Store 确保状态全局共享
 * 3. HMR 时状态不丢失
 * 4. 组件卸载时自动取消订阅
 */

import { computed } from 'vue';
import { useChatStore } from '../stores/chat';
import { getWebSocketService } from '../services/websocket';
import type { WebSocketMessage } from '../services/websocket';
import type { ChatMessage, ConnectionState } from '../stores/chat';

export interface UseChatOptions {
  autoConnect?: boolean;
}

export interface UseChatReturn {
  // 状态
  messages: ReturnType<typeof computed<ChatMessage[]>>;
  connectionState: ReturnType<typeof computed<ConnectionState>>;
  messageCount: ReturnType<typeof computed<number>>;
  lastMessage: ReturnType<typeof computed<ChatMessage | null>>;
  
  // 连接管理
  connect: (handshakeConfig: { name: string; client: string; token: string }) => void;
  disconnect: () => void;
  isConnected: ReturnType<typeof computed<boolean>>;
  
  // 消息操作
  sendMessage: (message: WebSocketMessage) => boolean;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  findMessage: (predicate: (m: ChatMessage) => boolean) => ChatMessage | undefined;
  clearMessages: () => void;
  
  // 订阅消息
  subscribe: (callback: (message: WebSocketMessage) => void) => () => void;
}

/**
 * 聊天功能 Composable
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { autoConnect = false } = options;
  
  // 获取 Store
  const chatStore = useChatStore();
  
  // 获取 WebSocket 服务单例
  const wsService = getWebSocketService();
  
  /**
   * 连接 WebSocket
   */
  function connect(handshakeConfig: { name: string; client: string; token: string }): void {
    wsService.connect(handshakeConfig);
  }
  
  /**
   * 断开连接
   */
  function disconnect(): void {
    wsService.disconnect();
  }
  
  /**
   * 发送消息
   */
  function sendMessage(message: WebSocketMessage): boolean {
    return wsService.send(message);
  }
  
  /**
   * 订阅消息（手动订阅）
   */
  function subscribe(callback: (message: WebSocketMessage) => void): () => void {
    return wsService.subscribe(callback);
  }
  
  return {
    // 状态（从 Store 获取）
    // 使用可写的 computed 以保持与旧代码的兼容性
    messages: computed({
      get: () => chatStore.messages,
      set: (val) => {
        // 直接替换 Store 中的消息数组
        chatStore.messages.splice(0, chatStore.messages.length, ...val);
      },
    }),
    connectionState: computed(() => chatStore.connectionState),
    messageCount: computed(() => chatStore.messageCount),
    lastMessage: computed(() => chatStore.lastMessage),
    
    // 连接管理
    connect,
    disconnect,
    isConnected: computed(() => chatStore.connectionState.isConnected),
    
    // 消息操作
    sendMessage,
    addMessage: chatStore.addMessage,
    updateMessage: chatStore.updateMessage,
    findMessage: chatStore.findMessage,
    clearMessages: chatStore.clearMessages,
    
    // 订阅
    subscribe,
  };
}
