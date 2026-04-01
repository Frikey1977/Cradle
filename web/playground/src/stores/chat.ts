/**
 * 聊天状态管理 Store
 * 
 * 使用 Pinia 进行全局状态管理，确保：
 * 1. 状态在组件间共享
 * 2. HMR 时状态不丢失
 * 3. 响应式更新
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system' | 'thinking' | 'heartbeat';
  content: string;
  sender?: string;
  avatar?: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
  isHeartbeat?: boolean;
  isThinking?: boolean;
  isStreaming?: boolean;
  isVoice?: boolean;
  voiceUrl?: string;
  voiceDuration?: number;
  voiceRecognition?: {
    isRecognizing: boolean;
    recognizedText?: string;
  };
  isImage?: boolean;
  imageUrl?: string;
  imageName?: string;
  thinkingSteps?: string[];
  replyTo?: string;
}

export interface ConnectionState {
  isSocketOpen: boolean;
  isHandshaked: boolean;
  isAuthenticated: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export const useChatStore = defineStore('chat', () => {
  // ==================== 状态 ====================
  
  // 消息列表（全局单例，HMR 时保持）
  const messages = ref<ChatMessage[]>([]);
  
  // 连接状态
  const connectionState = ref<ConnectionState>({
    isSocketOpen: false,
    isHandshaked: false,
    isAuthenticated: false,
    isConnected: false,
    isConnecting: false,
    error: null,
  });
  
  // 当前选中的 Agent
  const selectedAgentId = ref<string | null>(null);
  
  // ==================== 计算属性 ====================
  
  const messageCount = computed(() => messages.value.length);
  
  const lastMessage = computed(() => 
    messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  );
  
  const heartbeatMessages = computed(() => 
    messages.value.filter(m => m.type === 'heartbeat' || m.isHeartbeat)
  );
  
  // ==================== Actions ====================
  
  /**
   * 添加消息
   */
  function addMessage(message: ChatMessage) {
    messages.value = [...messages.value, message];
  }
  
  /**
   * 更新消息
   */
  function updateMessage(id: string, updates: Partial<ChatMessage>) {
    const index = messages.value.findIndex(m => m.id === id);
    if (index !== -1) {
      const newMessages = [...messages.value];
      newMessages[index] = { ...newMessages[index], ...updates };
      messages.value = newMessages;
    }
  }
  
  /**
   * 查找消息
   */
  function findMessage(predicate: (m: ChatMessage) => boolean) {
    return messages.value.find(predicate);
  }
  
  /**
   * 清空消息
   */
  function clearMessages() {
    messages.value = [];
  }
  
  /**
   * 更新连接状态
   */
  function updateConnectionState(updates: Partial<ConnectionState>) {
    connectionState.value = { ...connectionState.value, ...updates };
  }
  
  /**
   * 设置选中的 Agent
   */
  function setSelectedAgent(agentId: string | null) {
    selectedAgentId.value = agentId;
  }
  
  /**
   * 重置 Store
   */
  function $reset() {
    messages.value = [];
    connectionState.value = {
      isSocketOpen: false,
      isHandshaked: false,
      isAuthenticated: false,
      isConnected: false,
      isConnecting: false,
      error: null,
    };
    selectedAgentId.value = null;
  }
  
  return {
    // 状态
    messages,
    connectionState,
    selectedAgentId,
    
    // 计算属性
    messageCount,
    lastMessage,
    heartbeatMessages,
    
    // Actions
    addMessage,
    updateMessage,
    findMessage,
    clearMessages,
    updateConnectionState,
    setSelectedAgent,
    $reset,
  };
});
