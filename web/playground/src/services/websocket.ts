/**
 * WebSocket 服务层
 * 
 * 单例模式，负责：
 * 1. 管理 WebSocket 连接生命周期
 * 2. 订阅/发布机制
 * 3. 自动重连
 * 4. 心跳保活
 * 5. 认证流程
 */

import { useChatStore } from '../stores/chat';
import { useAccessStore } from '@vben/stores';

export interface WebSocketMessage {
  type: string;
  payload?: Record<string, any>;
}

export interface WebSocketServiceOptions {
  url?: string;
  heartbeatInterval?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

type MessageCallback = (message: WebSocketMessage) => void;

/**
 * WebSocket 服务类（单例）
 */
class WebSocketService {
  private static instance: WebSocketService | null = null;
  
  private ws: WebSocket | null = null;
  private url: string;
  private heartbeatInterval: number;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  
  // 订阅者管理
  private subscribers: Set<MessageCallback> = new Set();
  
  // 握手配置
  private handshakeConfig: { name: string; client: string; token: string } = {
    name: 'cradle',
    client: 'cradle-web',
    token: '',
  };
  
  private constructor(options: WebSocketServiceOptions = {}) {
    this.url = options.url || 'ws://localhost:3000/ws/cradle';
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(options?: WebSocketServiceOptions): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(options);
    }
    return WebSocketService.instance;
  }
  
  /**
   * 订阅消息
   * 返回取消订阅函数
   */
  subscribe(callback: MessageCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  /**
   * 发布消息给所有订阅者
   */
  private publish(message: WebSocketMessage): void {
    this.subscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[WebSocketService] Callback error:', error);
      }
    });
  }
  
  /**
   * 连接 WebSocket
   */
  connect(handshakeConfig?: { name: string; client: string; token: string }): void {
    const chatStore = useChatStore();
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    if (handshakeConfig) {
      this.handshakeConfig = handshakeConfig;
    }
    
    chatStore.updateConnectionState({ isConnecting: true, error: null });
    
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      chatStore.updateConnectionState({
        isConnecting: false,
        error: 'Failed to create WebSocket',
      });
      console.error('[WebSocketService] Failed to connect:', error);
    }
  }
  
  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;
    
    const chatStore = useChatStore();
    
    this.ws.onopen = () => {
      chatStore.updateConnectionState({
        isSocketOpen: true,
        isConnecting: false,
        error: null,
      });
      
      // 注意：不要在这里发送握手
      // 等待服务器发送 connected 消息后再发送握手
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocketService] Failed to parse message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[WebSocketService] Error:', error);
      chatStore.updateConnectionState({
        error: 'WebSocket error',
      });
    };
    
    this.ws.onclose = () => {
      chatStore.updateConnectionState({
        isSocketOpen: false,
        isHandshaked: false,
        isAuthenticated: false,
        isConnected: false,
      });
      
      this.clearTimers();
      
      // 自动重连
      if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
  }
  
  /**
   * 处理消息
   */
  private handleMessage(message: WebSocketMessage): void {
    const chatStore = useChatStore();
    
    switch (message.type) {
      case 'connected':
        // 连接成功，发送握手（包含 token）
        this.send({
          type: 'handshake',
          payload: {
            name: this.handshakeConfig.name,
            client: this.handshakeConfig.client,
            token: this.handshakeConfig.token,
          },
        });
        break;
        
      case 'handshake_success':
        chatStore.updateConnectionState({ isHandshaked: true });
        // 发送认证
        const accessStore = useAccessStore();
        let authToken = accessStore.accessToken;
        
        // 去除 Bearer 前缀（如果存在）
        if (authToken && authToken.startsWith('Bearer ')) {
          authToken = authToken.slice(7);
        }
        
        this.send({
          type: 'auth',
          payload: {
            token: authToken,
          },
        });
        break;
        
      case 'auth_success':
        chatStore.updateConnectionState({
          isAuthenticated: true,
          isConnected: true,
          error: null,
        });
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        break;
        
      case 'auth_error':
      case 'handshake_error':
        chatStore.updateConnectionState({
          error: message.payload?.error || `${message.type} failed`,
        });
        this.disconnect();
        break;
        
      case 'pong':
        // 心跳响应
        break;
        
      case 'message':
        // 业务消息 - 发布给订阅者
        this.publish(message);
        break;
        
      default:
        // 其他消息 - 发布给订阅者
        this.publish(message);
    }
  }
  
  /**
   * 发送消息
   */
  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error('[WebSocketService] Socket not open');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocketService] Failed to send:', error);
      return false;
    }
  }
  
  /**
   * 断开连接
   */
  disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    const chatStore = useChatStore();
    chatStore.updateConnectionState({
      isSocketOpen: false,
      isHandshaked: false,
      isAuthenticated: false,
      isConnected: false,
    });
  }
  
  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }
  
  /**
   * 清除定时器
   */
  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }
  
  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * 销毁实例（用于测试或特殊场景）
   */
  static destroyInstance(): void {
    if (WebSocketService.instance) {
      WebSocketService.instance.disconnect();
      WebSocketService.instance = null;
    }
  }
}

// 导出单例获取函数
export const getWebSocketService = (options?: WebSocketServiceOptions): WebSocketService => {
  return WebSocketService.getInstance(options);
};

// 导出类型
export type { WebSocketService };
