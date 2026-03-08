/**
 * WebSocket 客户端 Hook
 *
 * 功能：
 * 1. 自动连接 Gateway WebSocket
 * 2. JWT Token 认证
 * 3. 心跳保活
 * 4. 自动重连
 * 5. 消息收发
 */

import type { Ref } from "vue";

import { ref, onUnmounted } from "vue";
import { useAccessStore } from "@vben/stores";

export interface WebSocketMessage {
  type: string;
  payload?: Record<string, any>;
}

export interface UseWebSocketOptions {
  /** WebSocket 地址 */
  url?: string;
  /** 自动连接 */
  autoConnect?: boolean;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 自动重连 */
  autoReconnect?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 收到消息回调 */
  onMessage?: (message: WebSocketMessage) => void;
}

export interface UseWebSocketReturn {
  /** WebSocket 实例 */
  ws: Ref<WebSocket | null>;
  /** 网络层连接状态 (WebSocket OPEN) */
  isSocketOpen: Ref<boolean>;
  /** 业务层连接状态 (握手 + 认证完成) */
  isConnected: Ref<boolean>;
  /** 握手状态 */
  isHandshaked: Ref<boolean>;
  /** 认证状态 */
  isAuthenticated: Ref<boolean>;
  /** 连接中 */
  isConnecting: Ref<boolean>;
  /** 错误信息 */
  error: Ref<string | null>;
  /** 连接 */
  connect: (handshakeConfig?: { name: string; client: string; token: string }) => void;
  /** 断开 */
  disconnect: () => void;
  /** 发送消息 */
  send: (message: WebSocketMessage) => boolean;
  /** 发送文本消息 */
  sendText: (content: string) => boolean;
}

/**
 * WebSocket 客户端 Hook
 */
export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    url = "ws://localhost:3000/ws/cradle",  // 连接到 Cradle Channel
    autoConnect = false,
    heartbeatInterval = 30000,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
  } = options;

  // 当前握手配置
  let currentHandshakeConfig: { name: string; client: string; token: string } = {
    name: "cradle",
    client: "cradle-web",
    token: "",
  };

  const accessStore = useAccessStore();

  // 状态
  const ws = ref<WebSocket | null>(null);
  const isSocketOpen = ref(false);  // 网络层连接状态
  const isHandshaked = ref(false);  // 握手状态
  const isAuthenticated = ref(false);  // 认证状态
  const isConnected = ref(false);  // 业务层连接状态 (握手 + 认证都完成)
  const isConnecting = ref(false);
  const error = ref<string | null>(null);

  // 重连相关
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 清除定时器
   */
  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  /**
   * 启动心跳
   */
  const startHeartbeat = () => {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: "ping" }));
      }
    }, heartbeatInterval);
  };

  /**
   * 发送认证
   */
  // 生成客户端 ID
  const generateClientId = () => {
    return `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  };

  // 发送握手消息
  const sendHandshake = () => {
    const { name, client, token } = currentHandshakeConfig;

    console.log("[WebSocket] Sending handshake...", { name, client, token: token ? "***" : "" });

    ws.value?.send(
      JSON.stringify({
        type: "handshake",
        payload: {
          name,
          client,
          token,
        },
      }),
    );
  };

  const sendAuth = () => {
    let token = accessStore.accessToken;
    console.log("[WebSocket] Raw token from store:", token);

    if (!token) {
      error.value = "No access token available";
      return;
    }

    // 去除 Bearer 前缀（如果存在）
    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
      console.log("[WebSocket] Token after removing Bearer:", token);
    }

    console.log("[WebSocket] Sending auth with token:", token.substring(0, 20) + "...");

    ws.value?.send(
      JSON.stringify({
        type: "auth",
        payload: { token },
      }),
    );
  };

  /**
   * 处理消息
   */
  const handleMessage = (event: MessageEvent) => {
    console.log("[WebSocket] Raw message received:", event.data?.substring(0, 200));
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connected":
          // 连接成功，先发送握手
          sendHandshake();
          break;

        case "handshake_success":
          // 握手成功，发送认证
          isHandshaked.value = true;
          console.log("[WebSocket] Handshake successful:", message.payload);
          sendAuth();
          break;

        case "handshake_error":
          // 握手失败
          isHandshaked.value = false;
          error.value = message.payload?.error || "Handshake failed";
          console.error("[WebSocket] Handshake failed:", message.payload?.error);
          // 握手失败，断开连接
          disconnect();
          break;

        case "auth_success":
          // 认证成功
          isAuthenticated.value = true;
          isConnected.value = true;  // 业务层连接完成
          error.value = null;
          reconnectAttempts = 0; // 重置重连计数
          console.log("[WebSocket] Authenticated, business connection established");
          // 启动心跳
          startHeartbeat();
          break;

        case "auth_error":
          // 认证失败
          isAuthenticated.value = false;
          error.value = message.payload?.error || "Authentication failed";
          console.error("[WebSocket] Auth failed:", message.payload?.error);
          break;

        case "pong":
          // 心跳响应
          break;

        case "ack":
          // 消息确认
          console.log("[WebSocket] Message acknowledged:", message.payload);
          break;

        case "error":
          // 错误消息
          console.error("[WebSocket] Error:", message.payload?.error);
          break;

        case "message":
          // 收到业务消息
          console.log("[WebSocket] Received message:", message.payload);
          onMessage?.(message);
          break;

        default:
          // 其他业务消息
          console.log("[WebSocket] Received:", message);
          onMessage?.(message);
      }
    } catch (err) {
      console.error("[WebSocket] Failed to parse message:", err);
    }
  };

  /**
   * 连接 WebSocket
   */
  const connect = (handshakeConfig?: { name: string; client: string; token: string }) => {
    if (isConnecting.value || ws.value?.readyState === WebSocket.OPEN) {
      return;
    }

    // 更新握手配置
    if (handshakeConfig) {
      currentHandshakeConfig = handshakeConfig;
      console.log("[WebSocket] Updated handshake config:", { 
        name: handshakeConfig.name, 
        client: handshakeConfig.client, 
        token: handshakeConfig.token ? "***" : "" 
      });
    }

    isConnecting.value = true;
    error.value = null;

    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        isSocketOpen.value = true;  // 网络层连接成功
        isConnecting.value = false;
        console.log("[WebSocket] Socket opened, starting handshake...");
      };

      ws.value.onmessage = handleMessage;

      ws.value.onclose = () => {
        isSocketOpen.value = false;
        isHandshaked.value = false;
        isAuthenticated.value = false;
        isConnected.value = false;  // 业务层断开
        isConnecting.value = false;
        clearTimers();

        console.log("[WebSocket] Disconnected");

        // 自动重连
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `[WebSocket] Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`,
          );
          reconnectTimer = setTimeout(connect, reconnectInterval);
        }
      };

      ws.value.onerror = (err) => {
        error.value = "WebSocket error";
        isConnecting.value = false;
        console.error("[WebSocket] Error:", err);
      };
    } catch (err) {
      error.value = "Failed to create WebSocket";
      isConnecting.value = false;
      console.error("[WebSocket] Failed to connect:", err);
    }
  };

  /**
   * 断开连接
   */
  const disconnect = () => {
    clearTimers();
    reconnectAttempts = maxReconnectAttempts; // 阻止自动重连

    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }

    isSocketOpen.value = false;
    isHandshaked.value = false;
    isAuthenticated.value = false;
    isConnected.value = false;
  };

  /**
   * 发送消息
   */
  const send = (message: WebSocketMessage): boolean => {
    // 检查网络层连接
    if (ws.value?.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Socket not open");
      return false;
    }

    // 握手消息和认证消息可以在未完成时发送
    if (message.type === "handshake" || message.type === "auth") {
      try {
        ws.value.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error("[WebSocket] Failed to send:", err);
        return false;
      }
    }

    // 其他消息需要完成完整流程
    if (!isConnected.value) {
      console.error("[WebSocket] Business connection not established (handshake + auth required)");
      return false;
    }

    try {
      ws.value.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error("[WebSocket] Failed to send:", err);
      return false;
    }
  };

  /**
   * 发送文本消息
   */
  const sendText = (content: string): boolean => {
    return send({
      type: "message",
      payload: { content },
    });
  };

  // 自动连接
  if (autoConnect) {
    connect();
  }

  // 组件卸载时清理
  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    isSocketOpen,
    isConnected,
    isHandshaked,
    isAuthenticated,
    isConnecting,
    error,
    connect,
    disconnect,
    send,
    sendText,
  };
}
