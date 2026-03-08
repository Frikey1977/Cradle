<script setup lang="ts">
/**
 * 主对话区组件
 * 显示消息列表，支持文本和语音消息
 */

import { ref, watch, nextTick, computed } from "vue";
import { Card, Avatar, Tag, Empty, Spin, Button } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import type { OrganizationAgentApi } from "#/api/organization/agents";
import VoicePlayer from "./VoicePlayer.vue";
import MarkdownRenderer from "./MarkdownRenderer.vue";

// 思考过程折叠状态管理
const thinkingCollapsedMap = ref<Record<string, boolean>>({});

// 切换思考过程折叠状态
function toggleThinkingCollapse(messageId: string) {
  thinkingCollapsedMap.value[messageId] = !thinkingCollapsedMap.value[messageId];
}

// 消息分组：将连续的 agent/thinking 消息分为一组
const messageGroups = computed(() => {
  const groups: { type: 'user' | 'agent' | 'system'; messages: ChatMessage[] }[] = [];
  let currentGroup: { type: 'user' | 'agent' | 'system'; messages: ChatMessage[] } | null = null;

  for (const message of props.messages) {
    if (message.type === 'system') {
      // 系统消息单独成组
      groups.push({ type: 'system', messages: [message] });
      currentGroup = null;
    } else if (message.type === 'user') {
      // 用户消息单独成组
      groups.push({ type: 'user', messages: [message] });
      currentGroup = null;
    } else if (message.type === 'thinking' || message.type === 'agent') {
      // thinking 和 agent 消息合并到同一组
      if (currentGroup && currentGroup.type === 'agent') {
        currentGroup.messages.push(message);
      } else {
        currentGroup = { type: 'agent', messages: [message] };
        groups.push(currentGroup);
      }
    }
  }

  return groups;
});

// 语音识别状态
interface VoiceRecognitionState {
  isRecognizing: boolean;
  recognizedText?: string;
}

interface ChatMessage {
  id: string;
  type: "user" | "agent" | "system" | "thinking";
  content: string;
  sender?: string;
  avatar?: string;
  timestamp: number;
  status?: "sending" | "sent" | "error";
  isThinking?: boolean;
  thinkingSteps?: string[];
  // 语音消息相关
  isVoice?: boolean;
  voiceUrl?: string;
  voiceDuration?: number;
  voiceRecognition?: VoiceRecognitionState; // 语音识别状态
  // 图片消息相关
  isImage?: boolean;
  imageUrl?: string;
  imageName?: string;
}

interface Props {
  messages: ChatMessage[];
  agent: OrganizationAgentApi.Agent | null;
  isConnected: boolean;
  autoPlayVoice?: boolean; // 是否自动播放语音
}

const props = defineProps<Props>();

// 消息容器引用
const messageContainerRef = ref<HTMLElement | null>(null);
// 消息组元素引用
const messageGroupRefs = ref<HTMLElement[]>([]);

// 是否显示滚动到底部按钮
const showScrollToBottom = ref(false);

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 打开图片预览
function openImagePreview(imageUrl: string) {
  // 在新窗口打开图片
  window.open(imageUrl, "_blank");
}

// 计算并设置底部空白，确保最新消息可以居中
function adjustBottomPadding() {
  if (!messageContainerRef.value) return;
  
  const container = messageContainerRef.value;
  const containerHeight = container.clientHeight;
  const contentHeight = container.scrollHeight - parseInt(getComputedStyle(container).paddingBottom || '0');
  
  // 如果内容高度小于容器高度的一半，添加适当的底部空白
  // 让最新消息可以位于视口中心
  const minPadding = Math.max(0, containerHeight / 2 - contentHeight + 100);
  container.style.paddingBottom = `${minPadding}px`;
}

// 滚动到最新消息并使其位于视口中心
function scrollToLatestMessage() {
  nextTick(() => {
    if (!messageContainerRef.value) return;

    const container = messageContainerRef.value;
    const containerHeight = container.clientHeight;

    // 先调整底部空白
    adjustBottomPadding();

    // 获取最后一个消息组元素
    const lastGroup = messageGroupRefs.value[messageGroupRefs.value.length - 1];

    if (lastGroup) {
      // 计算需要将最新消息居中时的滚动位置
      const lastGroupTop = lastGroup.offsetTop;
      const lastGroupHeight = lastGroup.offsetHeight;
      const targetScrollTop = lastGroupTop - containerHeight / 2 + lastGroupHeight / 2;

      // 确保滚动位置不小于0，但不超过最大可滚动范围
      const maxScrollTop = container.scrollHeight - containerHeight;
      container.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    } else {
      // 如果没有消息组，滚动到底部
      container.scrollTop = container.scrollHeight;
    }
  });
}

// 兼容旧代码的别名
function scrollToBottom() {
  scrollToLatestMessage();
}

// 暴露方法给父组件
defineExpose({
  scrollToLatestMessage,
  scrollToBottom,
});

// 监听消息变化，自动滚动到底部
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    // 清理无效的 refs
    if (newLength < oldLength) {
      messageGroupRefs.value = messageGroupRefs.value.slice(0, newLength);
    }
    scrollToLatestMessage();
  }
);

// 监听最后一条消息的内容变化（用于 thinking 消息追加）
watch(
  () => props.messages[props.messages.length - 1]?.content,
  () => {
    scrollToLatestMessage();
  }
);

// 获取消息状态图标
function getStatusIcon(status?: string) {
  switch (status) {
    case "sending":
      return "mdi:clock-outline";
    case "sent":
      return "mdi:check";
    case "error":
      return "mdi:alert-circle";
    default:
      return "";
  }
}

// 获取消息状态颜色
function getStatusColor(status?: string) {
  switch (status) {
    case "sending":
      return "text-muted-foreground";
    case "sent":
      return "text-green-500";
    case "error":
      return "text-red-500";
    default:
      return "";
  }
}
</script>

<template>
  <Card class="chat-area flex-1 flex flex-col w-full" :bordered="false">
    <!-- 头部：当前对话对象信息 -->
    <div
      v-if="agent"
      class="chat-header flex items-center gap-3 px-4 py-3 border-b border-border bg-card"
    >
      <Avatar :src="agent.avatar" :size="40">
        <template #icon>
          <div class="flex items-center justify-center w-full h-full">
            <IconifyIcon icon="mdi:robot" class="text-xl" />
          </div>
        </template>
      </Avatar>
      <div class="flex-1">
        <div class="font-medium text-foreground">{{ agent.name }}</div>
        <div class="text-xs text-muted-foreground">
          {{ agent.description || "暂无描述" }}
        </div>
      </div>
      <Tag :color="isConnected ? 'green' : 'red'">
        {{ isConnected ? "已连接" : "未连接" }}
      </Tag>
    </div>

    <!-- 消息列表 -->
    <div
      ref="messageContainerRef"
      class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0 message-container"
    >
      <template v-if="messages.length > 0">
        <!-- 按分组渲染消息 -->
        <div
          v-for="(group, groupIndex) in messageGroups"
          :key="groupIndex"
          :ref="(el) => { if (el) messageGroupRefs[groupIndex] = el as HTMLElement }"
          :class="[
            'message-group flex gap-3',
            group.type === 'user' ? 'flex-row-reverse' : '',
          ]"
        >
          <!-- 系统消息 -->
          <template v-if="group.type === 'system'">
            <div class="w-full flex justify-center">
              <div class="bg-yellow-500/10 text-yellow-600 text-center px-4 py-2 rounded-lg text-sm max-w-[80%]">
                {{ group.messages[0].content }}
              </div>
            </div>
          </template>

          <!-- 用户消息组 -->
          <template v-else-if="group.type === 'user'">
            <!-- 头像 -->
            <Avatar
              :size="36"
              class="flex-shrink-0"
            >
              <template #icon>
                <div class="flex items-center justify-center w-full h-full">
                  <IconifyIcon icon="mdi:account" />
                </div>
              </template>
            </Avatar>

            <!-- 消息内容 -->
            <div class="message-content max-w-[70%] items-end">
              <!-- 发送者名称 -->
              <div class="text-xs text-muted-foreground mb-1 px-1">
                {{ group.messages[0].sender }}
              </div>

              <!-- 遍历组内所有消息 -->
              <template v-for="message in group.messages" :key="message.id">
                <!-- 图片消息 -->
                <div
                  v-if="message.isImage && message.imageUrl"
                  class="message-bubble px-4 py-2 rounded-lg bg-primary/20 text-foreground rounded-br-none mb-2"
                >
                  <img
                    :src="message.imageUrl"
                    :alt="message.imageName || '图片'"
                    class="max-w-[200px] max-h-[200px] rounded cursor-pointer hover:opacity-90 transition-opacity"
                    @click="openImagePreview(message.imageUrl!)"
                  />
                  <div class="text-xs mt-1 opacity-80">{{ message.imageName }}</div>
                </div>

                <!-- 文本消息气泡 -->
                <div
                  v-if="message.content"
                  :class="[
                    'message-bubble px-4 py-2 rounded-lg text-sm bg-primary/20 text-foreground rounded-br-none mb-2',
                    message.voiceRecognition?.isRecognizing ? 'opacity-70' : '',
                  ]"
                >
                  <!-- 语音识别中状态 -->
                  <div v-if="message.voiceRecognition?.isRecognizing" class="flex items-center gap-2">
                    <span class="animate-pulse">🎤</span>
                    <span>{{ message.content }}</span>
                    <span class="animate-pulse">...</span>
                  </div>
                  <!-- 识别完成或普通文本 - 使用 Markdown 渲染 -->
                  <div v-else>
                    <MarkdownRenderer 
                      :content="message.content" 
                      :is-streaming="message.status === 'sending'"
                    />
                  </div>
                </div>

                <!-- 语音播放器 -->
                <div
                  v-if="message.isVoice && message.voiceUrl"
                  class="message-bubble px-4 py-2 rounded-lg bg-primary/20 text-foreground rounded-br-none mb-2"
                >
                  <VoicePlayer
                    :audio-url="message.voiceUrl"
                    :duration="message.voiceDuration"
                    :auto-play="false"
                  />
                </div>
              </template>

              <!-- 时间和状态 -->
              <div class="flex items-center gap-1 mt-1 px-1">
                <span class="text-xs text-muted-foreground">
                  {{ formatTime(group.messages[group.messages.length - 1].timestamp) }}
                </span>
                <IconifyIcon
                  v-if="group.messages[group.messages.length - 1].status"
                  :icon="getStatusIcon(group.messages[group.messages.length - 1].status!)"
                  :class="['text-xs', getStatusColor(group.messages[group.messages.length - 1].status!)]"
                />
              </div>
            </div>
          </template>

          <!-- Agent 消息组（包含 thinking 和 agent 消息） -->
          <template v-else-if="group.type === 'agent'">
            <!-- 头像 -->
            <Avatar
              :src="agent?.avatar"
              :size="36"
              class="flex-shrink-0"
            >
              <template #icon>
                <div class="flex items-center justify-center w-full h-full">
                  <IconifyIcon icon="mdi:robot" />
                </div>
              </template>
            </Avatar>

            <!-- 消息内容 -->
            <div class="message-content max-w-[70%] items-start">
              <!-- 发送者名称 -->
              <div class="text-xs text-muted-foreground mb-1 px-1 flex items-center gap-2">
                <span>{{ agent?.name || 'Agent' }}</span>
                <span class="text-xs text-muted-foreground ml-auto">
                  {{ formatTime(group.messages[group.messages.length - 1].timestamp) }}
                </span>
              </div>

              <!-- 遍历组内所有消息 -->
              <template v-for="message in group.messages" :key="message.id">
                <!-- 思考过程消息 -->
                <div
                  v-if="message.type === 'thinking'"
                  class="message-bubble px-4 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-bl-none border border-slate-200 dark:border-slate-700 mb-2"
                >
                  <!-- 折叠状态：只显示最后一行 -->
                  <div v-if="thinkingCollapsedMap[message.id] !== false" class="flex items-center justify-between gap-2">
                    <span class="truncate">
                      {{ (message.thinkingSteps || message.content.split('\n').filter(s => s.trim())).slice(-1)[0] }}
                    </span>
                    <Button
                      type="link"
                      size="small"
                      class="text-xs flex-shrink-0"
                      @click="toggleThinkingCollapse(message.id)"
                    >
                      <template #icon>
                        <IconifyIcon icon="mdi:chevron-down" />
                      </template>
                      展开
                    </Button>
                  </div>

                  <!-- 展开状态：显示全部 -->
                  <div v-else>
                    <div class="thinking-steps space-y-1">
                      <div
                        v-for="(step, index) in message.thinkingSteps || message.content.split('\n').filter(s => s.trim())"
                        :key="index"
                        class="thinking-step flex items-start gap-2"
                      >
                        <span class="step-icon text-primary mt-0.5">•</span>
                        <span class="step-text">{{ step }}</span>
                      </div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <Button
                        type="link"
                        size="small"
                        class="text-xs"
                        @click="toggleThinkingCollapse(message.id)"
                      >
                        <template #icon>
                          <IconifyIcon icon="mdi:chevron-up" />
                        </template>
                        收起
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- 普通 Agent 消息 -->
                <template v-else>
                  <!-- 图片消息 -->
                  <div
                    v-if="message.isImage && message.imageUrl"
                    class="message-bubble px-4 py-2 rounded-lg bg-muted text-foreground rounded-bl-none mb-2"
                  >
                    <img
                      :src="message.imageUrl"
                      :alt="message.imageName || '图片'"
                      class="max-w-[200px] max-h-[200px] rounded cursor-pointer hover:opacity-90 transition-opacity"
                      @click="openImagePreview(message.imageUrl!)"
                    />
                    <div class="text-xs mt-1 opacity-80">{{ message.imageName }}</div>
                  </div>

                  <!-- 文本消息气泡 - 使用 Markdown 渲染 -->
                  <div
                    v-if="message.content"
                    class="message-bubble px-4 py-2 rounded-lg text-sm bg-muted text-foreground rounded-bl-none mb-2"
                  >
                    <MarkdownRenderer 
                      :content="message.content" 
                      :is-streaming="message.status === 'sending'"
                    />
                  </div>

                  <!-- 语音播放器 -->
                  <div
                    v-if="message.isVoice && message.voiceUrl"
                    class="message-bubble px-4 py-2 rounded-lg bg-muted text-foreground rounded-bl-none mb-2"
                  >
                    <VoicePlayer
                      :audio-url="message.voiceUrl"
                      :duration="message.voiceDuration"
                      :auto-play="autoPlayVoice !== false"
                    />
                  </div>
                </template>
              </template>
            </div>
          </template>
        </div>
      </template>

      <!-- 空状态 -->
      <Empty
        v-else-if="!agent"
        description="请选择一个 Agent 开始对话"
        class="h-full flex flex-col justify-center"
      />
      <Empty
        v-else
        description="开始发送消息吧"
        class="h-full flex flex-col justify-center"
      />
    </div>
  </Card>
</template>

<style scoped>
.chat-area {
  height: 100%;
  min-height: 0;
}

.chat-area :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  min-height: 0;
  overflow: hidden;
}

.message-content {
  display: flex;
  flex-direction: column;
}

.message-bubble {
  word-break: break-word;
  /* 不设置 white-space，让 MarkdownRenderer 内部控制 */
}

/* 消息容器：底部 padding 由 JS 动态计算，确保最后一个消息可以滚动到视口中心 */
.message-container {
  padding-bottom: 0;
  transition: padding-bottom 0.3s ease;
}
</style>
