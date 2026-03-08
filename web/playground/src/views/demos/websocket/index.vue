<script setup lang="ts">
/**
 * WebSocket 测试页面
 *
 * 功能：
 * 1. 连接 Gateway WebSocket
 * 2. JWT Token 认证
 * 3. 发送/接收消息
 * 4. 显示连接状态
 */

import { ref, computed } from "vue";
import { Page } from "@vben/common-ui";
import { useWebSocket } from "#/composables/useWebSocket";
import { Card, Button, Input, Tag, List, Alert, Space } from "ant-design-vue";

const { TextArea } = Input;

// 消息列表
const messages = ref<
  Array<{
    id: string;
    type: "sent" | "received";
    content: string;
    sender?: string;
    timestamp: number;
  }>
>([]);

// WebSocket Hook
const {
  isConnected,
  isAuthenticated,
  isConnecting,
  error,
  connect,
  disconnect,
  sendText,
} = useWebSocket({
  url: "ws://localhost:3000/ws/cradle",
  autoReconnect: true,
  onMessage: (message) => {
    // 处理收到的消息
    if (message.type === "message" && message.payload) {
      messages.value.push({
        id: message.payload.id || Date.now().toString(),
        type: "received",
        content: message.payload.content || "",
        sender: message.payload.sender || "Unknown",
        timestamp: message.payload.timestamp || Date.now(),
      });
    }
  },
});

// 本地状态
const messageInput = ref("");

// 状态标签
const statusText = computed(() => {
  if (isConnecting.value) return "连接中...";
  if (isAuthenticated.value) return "已认证";
  if (isConnected.value) return "已连接";
  return "未连接";
});

const statusColor = computed(() => {
  if (isConnecting.value) return "orange";
  if (isAuthenticated.value) return "green";
  if (isConnected.value) return "blue";
  return "default";
});

// 发送消息
const handleSend = () => {
  if (!messageInput.value.trim()) return;

  const content = messageInput.value.trim();
  const success = sendText(content);

  if (success) {
    messages.value.push({
      id: Date.now().toString(),
      type: "sent",
      content,
      timestamp: Date.now(),
    });
    messageInput.value = "";
  }
};

// 清空消息
const clearMessages = () => {
  messages.value = [];
};

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>

<template>
  <Page title="WebSocket 测试">
    <div class="websocket-test">
      <!-- 状态卡片 -->
      <Card title="连接状态" class="status-card">
        <Space direction="vertical" style="width: 100%">
          <div class="status-row">
            <span>状态：</span>
            <Tag :color="statusColor">{{ statusText }}</Tag>
          </div>

          <div v-if="error" class="error-message">
            <Alert type="error" :message="error" show-icon />
          </div>

          <Space>
            <Button
              type="primary"
              :loading="isConnecting"
              :disabled="isConnected"
              @click="connect"
            >
              连接
            </Button>
            <Button danger :disabled="!isConnected" @click="disconnect">
              断开
            </Button>
          </Space>
        </Space>
      </Card>

      <!-- 消息卡片 -->
      <Card title="消息测试" class="message-card">
        <Space direction="vertical" style="width: 100%">
          <!-- 消息列表 -->
          <div class="message-list">
            <div
              v-for="msg in messages"
              :key="msg.id"
              :class="['message-item', msg.type]"
            >
              <div class="message-content">
                <Tag :color="msg.type === 'sent' ? 'blue' : 'green'">
                  {{ msg.type === "sent" ? "发送" : "接收" }}
                </Tag>
                <span v-if="msg.sender" class="message-sender">[{{ msg.sender }}]</span>
                <span class="message-text">{{ msg.content }}</span>
              </div>
              <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
            </div>

            <div v-if="messages.length === 0" class="empty-message">
              暂无消息
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="input-area">
            <TextArea
              v-model:value="messageInput"
              :rows="3"
              placeholder="输入消息内容..."
              :disabled="!isAuthenticated"
              @pressEnter.prevent="handleSend"
            />
            <Space style="margin-top: 12px">
              <Button
                type="primary"
                :disabled="!isAuthenticated || !messageInput.trim()"
                @click="handleSend"
              >
                发送
              </Button>
              <Button @click="clearMessages"> 清空 </Button>
            </Space>
          </div>
        </Space>
      </Card>

      <!-- 说明卡片 -->
      <Card title="使用说明" class="info-card">
        <ol>
          <li>点击"连接"按钮建立 WebSocket 连接</li>
          <li>连接成功后自动使用 JWT Token 进行认证</li>
          <li>认证成功后可以发送消息</li>
          <li>支持自动重连和心跳保活</li>
        </ol>

        <div class="code-example">
          <h4>代码示例：</h4>
          <pre>
import { useWebSocket } from '#/composables/useWebSocket';

const { isConnected, isAuthenticated, sendText, connect } = useWebSocket({
  url: 'ws://localhost:3000/ws/cradle',
  autoReconnect: true,
});

// 连接
connect();

// 发送消息
sendText('Hello Gateway!');
          </pre>
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.websocket-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.status-card,
.message-card,
.info-card {
  margin-bottom: 20px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-message {
  margin: 12px 0;
}

.message-list {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.message-item {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
  background: white;
}

.message-item.sent {
  border-left: 3px solid #1890ff;
}

.message-item.received {
  border-left: 3px solid #52c41a;
}

.message-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-text {
  flex: 1;
  word-break: break-all;
}

.message-sender {
  font-weight: bold;
  color: #52c41a;
  margin-right: 4px;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.empty-message {
  text-align: center;
  color: #999;
  padding: 40px;
}

.input-area {
  margin-top: 12px;
}

.code-example {
  margin-top: 16px;
  padding: 12px;
  background: #f6f8fa;
  border-radius: 4px;
}

.code-example h4 {
  margin-bottom: 8px;
}

.code-example pre {
  margin: 0;
  padding: 12px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}
</style>
