<script setup lang="ts">
/**
 * 对话模块 - 与 Agent 进行对话交互
 *
 * 布局：
 * - 左右两栏（可收起/展开），与 organization/employees 一致
 *   - 左侧：Agent 列表
 *   - 右侧：主对话区 + 输入窗口
 * - 调试配置以弹窗形式通过工具条触发
 */

import { ref, onMounted, computed, onUnmounted } from "vue";
import { ColPage } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Tag } from "ant-design-vue";
import { useWebSocket } from "#/composables/useWebSocket";
import { getAgentList } from "#/api/organization/agents";
import type { OrganizationAgentApi } from "#/api/organization/agents";
import { getChannelList } from "#/api/system/channels";
import type { ChannelApi } from "#/api/system/channels";
import { getShortTermMemory, type ShortTermMemoryEntry } from "#/api/organization/relationships";
import { getMyContact } from "#/api/organization/contacts";

import AgentList from "./components/AgentList.vue";
import ChatArea from "./components/ChatArea.vue";
import ChatInput from "./components/ChatInput.vue";
import DebugModal from "./components/DebugModal.vue";
import type { FeatureConfig } from "./components/FeatureSwitches.vue";

// 当前选中的 Agent
const selectedAgent = ref<OrganizationAgentApi.Agent | null>(null);

// Agent 列表
const agentList = ref<OrganizationAgentApi.Agent[]>([]);
const agentLoading = ref(false);

// 防止重复连接的标志
const isConnectingFlag = ref(false);
let connectTimer: ReturnType<typeof setTimeout> | null = null;

// 通道列表
const channelList = ref<ChannelApi.Channel[]>([]);

// 调试配置弹窗显示状态
const debugModalVisible = ref(false);

// 统一的调试配置
const debugConfig = ref({
  // 连接配置
  connection: {
    channelId: "",
    identity: "test-user",
    userName: "测试用户",
    clientConfig: "",
  },
  // 功能开关
  features: {
    stream: true,        // 流式输出
    voiceResponse: true, // 语音回复
    thinkingMessage: true, // 思考过程
    voice: "Cherry",     // 默认音色
    autoPlayVoice: true, // 自动播放语音
  } as FeatureConfig,
  // 高级配置
  advanced: {
    metadata: "{}",
    customParams: "{}",
  },
});

// 语音识别状态
interface VoiceRecognitionState {
  isRecognizing: boolean; // 是否正在识别
  recognizedText?: string; // 识别结果
}

// 消息列表
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
  // 流式消息相关
  isStreaming?: boolean;
  // 图片消息相关
  isImage?: boolean;
  imageUrl?: string;
  imageName?: string;
}

const messages = ref<ChatMessage[]>([]);

// ChatArea 组件引用
const chatAreaRef = ref<InstanceType<typeof ChatArea> | null>(null);



// WebSocket Hook
const {
  isSocketOpen,
  isConnected,
  isHandshaked,
  isAuthenticated,
  isConnecting,
  error,
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

// 连接状态文本
const statusText = computed(() => {
  if (isConnecting.value) return "连接中...";
  if (isAuthenticated.value) return "已认证";
  if (isHandshaked.value) return "已握手";
  if (isSocketOpen.value) return "已连接";
  return "未连接";
});

// 连接状态颜色
const statusColor = computed(() => {
  if (isConnecting.value) return "orange";
  if (isAuthenticated.value) return "green";
  if (isHandshaked.value) return "cyan";
  if (isSocketOpen.value) return "blue";
  return "default";
});

// 加载 Agent 列表
async function loadAgents() {
  agentLoading.value = true;
  try {
    const result = await getAgentList({
      page: 1,
      pageSize: 100,
      status: "enabled",
    });
    agentList.value = result.items;
  } catch (error) {
    console.error("Failed to load agents:", error);
  } finally {
    agentLoading.value = false;
  }
}

// 加载通道列表
async function loadChannels() {
  try {
    const result = await getChannelList({
      status: "enabled",
    });
    channelList.value = result;
  } catch (error) {
    console.error("Failed to load channels:", error);
  }
}

// 加载当前用户的联系人信息
async function loadMyContact() {
  // 防止重复加载
  if (isContactLoaded.value) {
    return;
  }

  try {
    const contact = await getMyContact();
    if (contact && contact.sid) {
      currentUserContactSid.value = contact.sid;
      isContactLoaded.value = true;
      console.log("[Chat] Loaded user contact:", contact.sid);
    }
  } catch (error) {
    console.error("[Chat] Failed to load user contact:", error);
  }
}

// 将短期记忆条目转换为 ChatMessage（适配精简格式）
function convertMemoryToMessage(entry: ShortTermMemoryEntry, agentName: string): ChatMessage {
  // 处理 role：agent 或 assistant 都认为是 agent 消息
  const isAgent = entry.role === "agent" || entry.role === "assistant";
  
  const baseMessage: ChatMessage = {
    id: entry.timestamp.toString(),
    type: isAgent ? "agent" : "user",
    content: entry.content,
    timestamp: entry.timestamp,
    sender: isAgent ? agentName : "我",
  };

  // 处理语音消息
  if (entry.type === "audio") {
    baseMessage.isVoice = true;
    baseMessage.voiceRecognition = {
      isRecognizing: false,
      recognizedText: entry.content,
    };
  }

  return baseMessage;
}

// 当前用户的 contactSid（从调试配置中获取）
const currentUserContactSid = ref<string>("");
// 是否已加载 contact（防止重复加载）
const isContactLoaded = ref(false);

// 加载短期记忆（对话历史）
async function loadShortTermMemory(agentId: string, agentName: string) {
  if (!currentUserContactSid.value) {
    console.warn("[Chat] No user contactSid available");
    return;
  }

  try {
    const history = await getShortTermMemory(agentId, currentUserContactSid.value);
    if (history && history.length > 0) {
      // 将历史记录转换为消息格式
      const historyMessages = history.map(entry => convertMemoryToMessage(entry, agentName));
      messages.value.push(...historyMessages);
      console.log(`[Chat] Loaded ${history.length} messages from short-term memory`);
      
      // 加载记忆后滚动到最新消息（居中显示）
      setTimeout(() => {
        chatAreaRef.value?.scrollToLatestMessage();
      }, 100);
    }
  } catch (error) {
    console.error("[Chat] Failed to load short-term memory:", error);
  }
}

// 选择 Agent
async function handleSelectAgent(agent: OrganizationAgentApi.Agent) {
  selectedAgent.value = agent;
  messages.value = [];
  addSystemMessage(`开始与 ${agent.name} 对话`);

  // 加载短期记忆（使用当前用户 contactSid 和 Agent ID）
  if (currentUserContactSid.value && agent.id) {
    await loadShortTermMemory(agent.id, agent.name);
  }
}

// 添加系统消息
function addSystemMessage(content: string) {
  messages.value.push({
    id: Date.now().toString(),
    type: "system",
    content,
    timestamp: Date.now(),
  });
}

// 处理 WebSocket 消息
function handleWebSocketMessage(message: any) {
  console.log("[Chat] handleWebSocketMessage called, message type:", message.type, "payload keys:", message.payload ? Object.keys(message.payload) : 'no payload');
  
  if (message.type === "message" && message.payload) {
    const payload = message.payload;
    console.log("[Chat] Received message payload:", JSON.stringify(payload, null, 2));
    console.log("[Chat] isRecognitionResult:", payload.isRecognitionResult, "recognizedText:", payload.recognizedText ? 'exists' : 'missing');
    
    // 处理语音识别结果消息
    if (payload.isRecognitionResult && payload.recognizedText) {
      console.log("[Chat] Received recognition result:", payload.recognizedText, "requestId:", payload.requestId);
      
      // 使用 requestId 精确匹配对应的用户语音消息
      const userVoiceMessage = messages.value.find(
        m => m.type === "user" && m.isVoice && m.id === payload.requestId
      );
      
      console.log("[Chat] Found user voice message by requestId:", userVoiceMessage?.id);
      
      if (userVoiceMessage) {
        // 更新消息内容
        userVoiceMessage.content = payload.recognizedText;
        userVoiceMessage.voiceRecognition = {
          isRecognizing: false,
          recognizedText: payload.recognizedText,
        };
        console.log("[Chat] Updated user voice message with recognized text:", payload.recognizedText);
        return; // 不添加新消息
      } else {
        // 如果精确匹配失败，回退到查找正在识别的消息（兼容旧逻辑）
        console.warn("[Chat] No user voice message found by requestId, falling back to last recognizing message");
        const fallbackMessage = [...messages.value].reverse().find(
          m => m.type === "user" && m.isVoice && m.voiceRecognition?.isRecognizing
        );
        
        if (fallbackMessage) {
          fallbackMessage.content = payload.recognizedText;
          fallbackMessage.voiceRecognition = {
            isRecognizing: false,
            recognizedText: payload.recognizedText,
          };
          console.log("[Chat] Updated fallback user voice message:", fallbackMessage.id);
          return;
        }
        
        console.warn("[Chat] No user voice message found to update");
      }
    }
    
    const newMessage: ChatMessage = {
      id: payload.id || Date.now().toString(),
      type: "agent",
      content: payload.content || "",
      sender: payload.sender || selectedAgent.value?.name || "Agent",
      avatar: selectedAgent.value?.avatar,
      timestamp: payload.timestamp || Date.now(),
    };
    
    // 如果有音频数据，转换为语音消息格式
    if (payload.audio) {
      newMessage.isVoice = true;
      // 构建 data URL
      const format = payload.audioFormat || "wav";
      newMessage.voiceUrl = payload.audio.startsWith("data:")
        ? payload.audio
        : `data:audio/${format};base64,${payload.audio}`;
      newMessage.voiceDuration = payload.audioDuration || 0;
    }
    
    messages.value.push(newMessage);
  } else if (message.type === "thinking" && message.payload) {
    // 处理思考过程消息 - 追加到同类型的最后一个消息
    const lastMessage = messages.value[messages.value.length - 1];
    const newContent = message.payload.content || "";
    const newSteps = message.payload.thinkingSteps || newContent.split('\n').filter((s: string) => s.trim());

    if (lastMessage && lastMessage.type === "thinking") {
      // 追加到前面的 thinking 消息
      lastMessage.content += "\n" + newContent;
      lastMessage.thinkingSteps = [...(lastMessage.thinkingSteps || []), ...newSteps];
      lastMessage.timestamp = message.payload.timestamp || Date.now();
    } else {
      // 创建新的 thinking 消息
      messages.value.push({
        id: message.payload.id || Date.now().toString(),
        type: "thinking",
        content: newContent,
        sender: selectedAgent.value?.name || "思考过程",
        avatar: selectedAgent.value?.avatar,
        timestamp: message.payload.timestamp || Date.now(),
        isThinking: true,
        thinkingSteps: newSteps,
      });
    }
  } else if (message.type === "stream-chunk" && message.payload) {
    // 处理流式消息块
    const chunk = message.payload.content || "";
    const replyToId = message.payload.replyTo;

    // 使用 replyToId 作为流式消息的标识，但只查找 Agent 类型的消息
    // 避免与用户消息冲突
    const streamId = replyToId || message.payload.id;

    // 查找是否已存在对应的流式消息（只查找 Agent 类型的消息）
    const existingMessage = messages.value.find(m => m.id === streamId && m.type === "agent");

    if (existingMessage) {
      // 追加到现有流式消息
      existingMessage.content += chunk;
      existingMessage.timestamp = message.payload.timestamp || Date.now();
      existingMessage.status = "sending"; // 确保状态为发送中
    } else {
      // 创建新的流式消息
      messages.value.push({
        id: streamId,
        type: "agent",
        content: chunk,
        sender: message.payload.sender || selectedAgent.value?.name || "Agent",
        avatar: selectedAgent.value?.avatar,
        timestamp: message.payload.timestamp || Date.now(),
        isStreaming: true, // 标记为流式消息
        status: "sending", // 标记为发送中
      });
    }
  } else if (message.type === "stream-end" && message.payload) {
    // 流式消息结束
    const replyToId = message.payload.replyTo;
    const streamId = replyToId || message.payload.id;
    
    // 只查找 Agent 类型的消息，避免与用户消息冲突
    const streamMessage = messages.value.find(m => m.id === streamId && m.type === "agent");
    if (streamMessage) {
      streamMessage.isStreaming = false;
      streamMessage.status = "sent"; // 标记为已发送完成

      // 如果有音频数据，转换为语音消息格式
      if (message.payload.audio) {
        streamMessage.isVoice = true;
        const format = message.payload.audioFormat || "wav";
        streamMessage.voiceUrl = message.payload.audio.startsWith("data:")
          ? message.payload.audio
          : `data:audio/${format};base64,${message.payload.audio}`;
        streamMessage.voiceDuration = message.payload.audioDuration || 0;
        console.log("[Chat] Added audio to stream message:", streamMessage.id, "duration:", streamMessage.voiceDuration);
      }
    } else {
      console.warn("[Chat] Stream message not found for stream-end:", streamId);
    }
  } else if (message.type === "error") {
    addSystemMessage(`错误: ${message.payload?.message || "未知错误"}`);
  }
}

// 发送文本消息
async function handleSendMessage(content: string) {
  if (!selectedAgent.value) {
    addSystemMessage("请先选择 Agent");
    return;
  }

  if (!isAuthenticated.value) {
    addSystemMessage("请先完成连接和认证");
    return;
  }

  const messageId = Date.now().toString();
  messages.value.push({
    id: messageId,
    type: "user",
    content,
    sender: debugConfig.value.connection.userName,
    timestamp: Date.now(),
    status: "sending",
  });

  // 解析 metadata
  let metadata: Record<string, any> = {};
  try {
    metadata = JSON.parse(debugConfig.value.advanced.metadata || "{}");
  } catch {
    // 解析失败使用空对象
  }

  // 调试日志：检查 stream 配置
  console.log("[Chat] debugConfig.features.stream:", debugConfig.value.features.stream);
  const streamValue = debugConfig.value.features.stream !== false;
  console.log("[Chat] Sending message with stream:", streamValue);
  
  const success = send({
    type: "message",
    payload: {
      messageId, // 传递消息ID
      agentId: selectedAgent.value.id,
      channelId: debugConfig.value.connection.channelId,
      identity: debugConfig.value.connection.identity,
      content,
      // 功能开关参数放到 payload 顶层
      stream: streamValue,
      thinkingMessage: debugConfig.value.features.thinkingMessage !== false,
      metadata,
    },
  });

  if (success) {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) msg.status = "sent";
  } else {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) msg.status = "error";
    addSystemMessage("消息发送失败");
  }
}

// 发送语音消息
async function handleSendVoice(audioBlob: Blob, duration: number) {
  if (!selectedAgent.value) {
    addSystemMessage("请先选择 Agent");
    return;
  }

  if (!isAuthenticated.value) {
    addSystemMessage("请先完成连接和认证");
    return;
  }

  const messageId = Date.now().toString();

  // 将音频转换为 Base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = () => {
    const base64Audio = reader.result as string;

    // 添加语音消息到列表
    messages.value.push({
      id: messageId,
      type: "user",
      content: "[语音消息 - 正在识别...]",
      sender: debugConfig.value.connection.userName,
      timestamp: Date.now(),
      status: "sending",
      isVoice: true,
      voiceUrl: base64Audio,
      voiceDuration: duration,
      voiceRecognition: {
        isRecognizing: true,
      },
    });

    // 解析 metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = JSON.parse(debugConfig.value.advanced.metadata || "{}");
    } catch {
      // 解析失败使用空对象
    }

    // 调试日志：打印 voice 值
    console.log("[Chat] Sending voice message with voice:", debugConfig.value.features.voice);
    
    // 发送语音消息
    const success = send({
      type: "message",
      payload: {
        messageId, // 传递消息ID，用于关联识别结果
        agentId: selectedAgent.value!.id,
        channelId: debugConfig.value.connection.channelId,
        identity: debugConfig.value.connection.identity,
        content: "[语音]", // 语音内容会在后端通过 ASR 识别
        audio: base64Audio.split(",")[1], // 去掉 data:audio/webm;base64, 前缀
        audioFormat: "webm",
        audioDuration: duration,
        // 功能开关参数放到 payload 顶层
        stream: debugConfig.value.features.stream !== false,
        thinkingMessage: debugConfig.value.features.thinkingMessage !== false,
        voiceResponse: debugConfig.value.features.voiceResponse !== false,
        voice: debugConfig.value.features.voice || "Cherry", // 音色选择
        metadata,
      },
    });

    if (success) {
      const msg = messages.value.find((m) => m.id === messageId);
      if (msg) msg.status = "sent";
    } else {
      const msg = messages.value.find((m) => m.id === messageId);
      if (msg) msg.status = "error";
      addSystemMessage("语音发送失败");
    }
  };
}

// 发送图文消息
async function handleSendWithImages(content: string, images: { base64: string; name: string }[]) {
  if (!selectedAgent.value) {
    addSystemMessage("请先选择 Agent");
    return;
  }

  if (!isAuthenticated.value) {
    addSystemMessage("请先完成连接和认证");
    return;
  }

  const messageId = Date.now().toString();

  // 添加图文消息到列表
  messages.value.push({
    id: messageId,
    type: "user",
    content: content || `[图片: ${images.map(img => img.name).join(", ")}]`,
    sender: debugConfig.value.connection.userName,
    timestamp: Date.now(),
    status: "sending",
    isImage: images.length > 0,
    imageUrl: images[0]?.base64, // 显示第一张图片
    imageName: images.map(img => img.name).join(", "),
  });
  console.log("[Chat] Image message added:", messageId, "Total messages:", messages.value.length);

  // 解析 metadata 并添加功能开关参数
  let metadata: Record<string, any> = {};
  try {
    metadata = JSON.parse(debugConfig.value.advanced.metadata || "{}");
  } catch {
    // 解析失败使用空对象
  }
  // 添加功能开关参数
  metadata.stream = debugConfig.value.features.stream !== false;
  metadata.thinkingMessage = debugConfig.value.features.thinkingMessage !== false;
  metadata.isImage = images.length > 0;

  // 发送图文消息
  const success = send({
    type: "message",
    payload: {
      messageId, // 传递消息ID
      agentId: selectedAgent.value.id,
      channelId: debugConfig.value.connection.channelId,
      identity: debugConfig.value.connection.identity,
      content: content || `[图片: ${images.map(img => img.name).join(", ")}]`,
      images: images.map(img => img.base64.split(",")[1]), // 去掉 data:image/xxx;base64, 前缀
      metadata,
    },
  });

  if (success) {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) msg.status = "sent";
  } else {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) msg.status = "error";
    addSystemMessage("图文发送失败");
  }
}

// 更新调试配置
function handleUpdateConfig(config: typeof debugConfig.value) {
  debugConfig.value = config;
  // 保存到 localStorage
  localStorage.setItem("chatDebugConfig", JSON.stringify(config));
}

// 打开调试配置弹窗
function openDebugModal() {
  debugModalVisible.value = true;
}

// 处理连接
function handleConnect() {
  // 防止重复连接
  if (isConnectingFlag.value || isAuthenticated.value) {
    console.log("[Chat] Connection already in progress or established, skipping...");
    return;
  }
  
  isConnectingFlag.value = true;
  console.log("[Chat] handleConnect called, clientConfig:", debugConfig.value.connection.clientConfig);
  
  // 解析 clientConfig 并传递给 connect
  let config = { name: "cradle", client: "cradle-web", token: "" };
  if (debugConfig.value.connection.clientConfig) {
    try {
      const parsed = JSON.parse(debugConfig.value.connection.clientConfig);
      // 支持两种格式：直接格式 或 payload 包装格式
      if (parsed.payload) {
        // 格式: { type: "handshake", payload: { name, token, identify } }
        // identify = 通道标识, name = 客户端名称
        config = {
          name: parsed.payload.identify || "cradle",
          client: parsed.payload.name || "cradle-web",
          token: parsed.payload.token || "",
        };
      } else {
        // 格式: { name, client, token }
        config = {
          name: parsed.name || "cradle",
          client: parsed.client || "cradle-web",
          token: parsed.token || "",
        };
      }
      console.log("[Chat] Parsed config:", config);
    } catch (e) {
      console.error("[Chat] Failed to parse clientConfig:", e);
    }
  }
  connect(config);
}

onMounted(() => {
  loadAgents();
  loadChannels();
  // 加载当前用户的联系人信息
  loadMyContact();
  // 从 localStorage 恢复调试配置，然后自动连接
  loadDebugConfig();
  // 延迟一点确保配置已加载，然后自动建立连接
  connectTimer = setTimeout(() => {
    if (!isAuthenticated.value && !isConnectingFlag.value) {
      handleConnect();
    }
  }, 500);
});

onUnmounted(() => {
  // 清理定时器
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  // 断开连接
  disconnect();
});

// 从 localStorage 加载调试配置
function loadDebugConfig() {
  try {
    const savedConfig = localStorage.getItem("chatDebugConfig");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // 合并保存的配置到当前配置，确保默认值不会被 undefined 覆盖
      debugConfig.value = {
        connection: {
          ...debugConfig.value.connection,
          ...parsed.connection,
        },
        features: {
          ...debugConfig.value.features,
          ...(parsed.features || {}),
          // 确保关键字段有默认值，不会被 undefined 覆盖
          stream: parsed.features?.stream ?? debugConfig.value.features.stream,
          voiceResponse: parsed.features?.voiceResponse ?? debugConfig.value.features.voiceResponse,
          thinkingMessage: parsed.features?.thinkingMessage ?? debugConfig.value.features.thinkingMessage,
          voice: parsed.features?.voice ?? debugConfig.value.features.voice,
          autoPlayVoice: parsed.features?.autoPlayVoice ?? debugConfig.value.features.autoPlayVoice,
        },
        advanced: {
          ...debugConfig.value.advanced,
          ...parsed.advanced,
        },
      };
    }
  } catch (e) {
    console.error("[Chat] Failed to load debug config from localStorage:", e);
  }
}
</script>

<template>
  <ColPage
    auto-content-height
    :left-width="22"
    :right-width="78"
    :left-min-width="15"
    :left-max-width="30"
    :left-collapsible="true"
    :left-collapsed-width="0"
    :resizable="true"
    :split-line="true"
    :split-handle="true"
  >
    <template #left="{ isCollapsed, expand }">
      <div
        v-if="isCollapsed"
        class="h-full flex items-center justify-center bg-card border-r border-border cursor-pointer hover:bg-muted/50"
        @click="expand"
      >
        <Button shape="circle" type="primary" title="展开 Agent 列表">
          <IconifyIcon icon="mdi:robot" class="size-5" />
        </Button>
      </div>
      <div
        v-else
        class="h-full flex flex-col rounded-lg border border-border mr-2 min-w-[200px] overflow-hidden"
      >
        <div class="px-3 py-2 font-semibold text-sm border-b border-border whitespace-nowrap bg-muted">
          选择对话对象
        </div>
        <div class="flex-1 overflow-auto p-2 bg-background scrollbar-theme">
          <AgentList
            :agents="agentList"
            :loading="agentLoading"
            :selected-id="selectedAgent?.id"
            @select="handleSelectAgent"
          />
        </div>
      </div>
    </template>

    <!-- 右侧主内容区 -->
    <div class="h-full flex flex-col min-w-0 rounded-lg border border-border ml-2 overflow-hidden bg-background">
      <!-- 工具条 -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-card">
        <div class="flex items-center gap-3">
          <template v-if="selectedAgent">
            <span class="font-medium text-foreground">{{ selectedAgent.name }}</span>
            <Tag :color="statusColor">
              {{ statusText }}
            </Tag>
          </template>
          <span v-else class="text-muted-foreground">请选择一个 Agent 开始对话</span>
        </div>
        <Button type="default" @click="openDebugModal">
          <IconifyIcon icon="mdi:cog" class="mr-1" />
          调试配置
        </Button>
      </div>

      <!-- 对话区 -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <ChatArea
          ref="chatAreaRef"
          :messages="messages"
          :agent="selectedAgent"
          :is-connected="isConnected"
          :auto-play-voice="debugConfig.features.autoPlayVoice !== false"
        />
      </div>

      <!-- 输入区 -->
      <ChatInput
        :disabled="!selectedAgent || !isAuthenticated"
        @send="handleSendMessage"
        @send-voice="handleSendVoice"
        @send-with-images="handleSendWithImages"
      />
    </div>

    <!-- 调试配置弹窗 -->
    <DebugModal
      v-model:visible="debugModalVisible"
      :is-socket-open="isSocketOpen"
      :is-handshaked="isHandshaked"
      :is-connected="isConnected"
      :is-authenticated="isAuthenticated"
      :is-connecting="isConnecting"
      :error="error"
      :config="debugConfig"
      :channels="channelList"
      @connect="handleConnect"
      @disconnect="disconnect"
      @update:config="handleUpdateConfig"
    />
  </ColPage>
</template>

<style scoped>
:deep(.custom-scrollbar) {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

:deep(.custom-scrollbar::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.custom-scrollbar::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb) {
  background-color: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
  background-color: hsl(var(--muted-foreground) / 0.5);
}

/* 滚动条容器背景 */
.scrollbar-theme {
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

.scrollbar-theme::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.scrollbar-theme::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-theme::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

.scrollbar-theme::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}

/* 滚动条角落 */
.scrollbar-theme::-webkit-scrollbar-corner {
  background: hsl(var(--background));
}
</style>
