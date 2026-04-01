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

import { ref, onMounted, computed, onUnmounted, watch, nextTick } from "vue";
import { ColPage } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Tag } from "ant-design-vue";
import { useChat } from "#/composables/useChat";
import { getMyAgents, registerClient, unregisterClient } from "#/api/organization/agents";
import type { OrganizationAgentApi } from "#/api/organization/agents";
import { getChannelList } from "#/api/system/channels";
import type { ChannelApi } from "#/api/system/channels";
import { getShortTermMemory, type ShortTermMemoryEntry } from "#/api/organization/relationships";
import { getMyContact } from "#/api/organization/contacts";
import { updateContactLanguage, updateContactProfileLanguage } from "#/api/organization/language";

import AgentList from "./components/AgentList.vue";
import ChatArea from "./components/ChatArea.vue";
import ChatInput from "./components/ChatInput.vue";
import DebugModal from "./components/DebugModal.vue";
import HeartbeatMenu from "./components/HeartbeatMenu.vue";
import ContextManagerModal from "./components/ContextManagerModal.vue";
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

// 上下文管理弹窗显示状态
const contextManagerVisible = ref(false);

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
  type: "user" | "agent" | "system" | "thinking" | "heartbeat";
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
  // 心跳消息标记
  isHeartbeat?: boolean;
}

// 使用新的 useChat composable
const {
  messages,
  connectionState,
  connect,
  disconnect,
  sendMessage,
  addMessage,
  updateMessage,
  findMessage,
  clearMessages,
  subscribe,
} = useChat();

// 连接状态文本
const statusText = computed(() => {
  if (connectionState.value.isConnecting) return "连接中...";
  if (connectionState.value.isAuthenticated) return "已认证";
  if (connectionState.value.isHandshaked) return "已握手";
  if (connectionState.value.isSocketOpen) return "已连接";
  return "未连接";
});

// 连接状态颜色
const statusColor = computed(() => {
  if (connectionState.value.isConnecting) return "orange";
  if (connectionState.value.isAuthenticated) return "green";
  if (connectionState.value.isHandshaked) return "cyan";
  if (connectionState.value.isSocketOpen) return "blue";
  return "default";
});

// 连接状态计算属性
const isSocketOpen = computed(() => connectionState.value.isSocketOpen);
const isConnected = computed(() => connectionState.value.isConnected);
const isHandshaked = computed(() => connectionState.value.isHandshaked);
const isAuthenticated = computed(() => connectionState.value.isAuthenticated);
const isConnecting = computed(() => connectionState.value.isConnecting);
const error = computed(() => connectionState.value.error);

// ChatArea 组件引用
const chatAreaRef = ref<InstanceType<typeof ChatArea> | null>(null);

// 订阅取消函数
let unsubscribe: (() => void) | null = null;

// 订阅 WebSocket 消息
onMounted(() => {
  // 如果已经有订阅，先取消
  if (unsubscribe) {
    unsubscribe();
  }
  
  unsubscribe = subscribe((message) => {
    handleWebSocketMessage(message);
  });
});

// 组件卸载时取消订阅
onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
});

// 加载 Agent 列表（只加载与当前用户绑定的 Agent）
async function loadAgents() {
  agentLoading.value = true;
  try {
    const result = await getMyAgents();
    agentList.value = result.items;

    const savedAgentId = localStorage.getItem("selectedAgentId");
    if (savedAgentId && !selectedAgent.value) {
      const savedAgent = agentList.value.find(a => a.id === savedAgentId);
      if (savedAgent) {
        selectedAgent.value = savedAgent;

        // 检查是否已存在相同内容的系统消息，避免重复添加
        const existingMessage = messages.value.find(
          m => m.type === "system" && m.content === `继续与 ${savedAgent.name} 对话`
        );
        if (!existingMessage) {
          addSystemMessage(`继续与 ${savedAgent.name} 对话`);
        }

        if (currentUserContactSid.value && savedAgent.id) {
          await loadShortTermMemory(savedAgent.id, savedAgent.name);
        }
      }
    }
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
    return;
  }

  try {
    const history = await getShortTermMemory(agentId, currentUserContactSid.value);
    if (history && history.length > 0) {
      // 将历史记录转换为消息格式
      const historyMessages = history.map(entry => convertMemoryToMessage(entry, agentName));
      // 清空现有消息并添加历史消息
      messages.value = [...historyMessages];
      
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
  localStorage.setItem("selectedAgentId", agent.id);
  messages.value = [];
  addSystemMessage(`开始与 ${agent.name} 对话`);

  // 加载短期记忆（使用当前用户 contactSid 和 Agent ID）
  if (currentUserContactSid.value && agent.id) {
    await loadShortTermMemory(agent.id, agent.name);
  }
}

// 添加系统消息
function addSystemMessage(content: string) {
  addMessage({
    id: Date.now().toString(),
    type: "system",
    content,
    timestamp: Date.now(),
  });
}

// 处理 WebSocket 消息
function handleWebSocketMessage(message: any) {
  if (message.type === "message" && message.payload) {
    handleChatMessage(message.payload);
  } else if (message.type === "thinking" && message.payload) {
    handleThinkingMessage(message.payload);
  } else if (message.type === "stream-chunk" && message.payload) {
    handleStreamChunk(message.payload);
  } else if (message.type === "stream-end" && message.payload) {
    handleStreamEnd(message.payload);
  } else if (message.type === "error") {
    addSystemMessage(`错误: ${message.payload?.message || "未知错误"}`);
  }
}

// 处理聊天消息
function handleChatMessage(payload: any) {
  // 处理语音识别结果消息
  if (payload.isRecognitionResult && payload.recognizedText) {
    // 使用 requestId 精确匹配对应的用户语音消息
    const userVoiceMessage = messages.value.find(
      m => m.type === "user" && m.isVoice && m.id === payload.requestId
    );
    
    if (userVoiceMessage) {
      userVoiceMessage.content = payload.recognizedText;
      userVoiceMessage.voiceRecognition = {
        isRecognizing: false,
        recognizedText: payload.recognizedText,
      };
      return;
    }
    
    // 如果精确匹配失败，回退到查找正在识别的消息
    const fallbackMessage = [...messages.value].reverse().find(
      m => m.type === "user" && m.isVoice && m.voiceRecognition?.isRecognizing
    );
    
    if (fallbackMessage) {
      fallbackMessage.content = payload.recognizedText;
      fallbackMessage.voiceRecognition = {
        isRecognizing: false,
        recognizedText: payload.recognizedText,
      };
      return;
    }
  }
  
  // 查找是否有对应的占位消息（通过 replyTo 关联）
  const replyToId = payload.replyTo;
  const placeholderMessage = replyToId 
    ? messages.value.find(m => m.id === `agent-${replyToId}` && m.type === "agent" && m.isThinking)
    : null;
  
  if (placeholderMessage) {
    // 更新占位消息
    placeholderMessage.content = payload.content || "";
    placeholderMessage.sender = payload.sender || selectedAgent.value?.name || "Agent";
    placeholderMessage.timestamp = payload.timestamp || Date.now();
    placeholderMessage.status = "sent";
    placeholderMessage.isThinking = false;
    
    // 如果有音频数据，转换为语音消息格式
    if (payload.audio) {
      placeholderMessage.isVoice = true;
      const format = payload.audioFormat || "wav";
      placeholderMessage.voiceUrl = payload.audio.startsWith("data:")
        ? payload.audio
        : `data:audio/${format};base64,${payload.audio}`;
      placeholderMessage.voiceDuration = payload.audioDuration || 0;
    }
  } else {
    // 检测是否是心跳消息（没有 replyTo）
    const isHeartbeatMessage = payload.replyTo === null || payload.replyTo === undefined;

    if (isHeartbeatMessage) {
      // 心跳消息：直接创建并添加消息
      addMessage({
        id: `heartbeat-${Date.now()}`,
        type: "heartbeat",
        content: `[心跳] ${payload.content}`,
        sender: payload.sender || selectedAgent.value?.name || "Agent",
        avatar: selectedAgent.value?.avatar,
        timestamp: payload.timestamp || Date.now(),
        isHeartbeat: true,
        status: "sent",
      });
    } else {
      // 普通消息：创建新消息
      const newMessage: ChatMessage = {
        id: payload.id || Date.now().toString(),
        type: "agent",
        content: payload.content || "",
        sender: payload.sender || selectedAgent.value?.name || "Agent",
        avatar: selectedAgent.value?.avatar,
        timestamp: payload.timestamp || Date.now(),
        isHeartbeat: false,
      };

      // 如果有音频数据，转换为语音消息格式
      if (payload.audio) {
        newMessage.isVoice = true;
        const format = payload.audioFormat || "wav";
        newMessage.voiceUrl = payload.audio.startsWith("data:")
          ? payload.audio
          : `data:audio/${format};base64,${payload.audio}`;
        newMessage.voiceDuration = payload.audioDuration || 0;
      }

      addMessage(newMessage);
    }

    // 滚动到最新消息
    nextTick(() => {
      chatAreaRef.value?.scrollToLatestMessage();
    });
  }
}

// 处理思考过程消息
function handleThinkingMessage(payload: any) {
  const lastMessage = messages.value[messages.value.length - 1];
  const newContent = payload.content || "";
  const newSteps = payload.thinkingSteps || newContent.split('\n').filter((s: string) => s.trim());

  if (lastMessage && lastMessage.type === "thinking") {
    // 追加到前面的 thinking 消息
    lastMessage.content += "\n" + newContent;
    lastMessage.thinkingSteps = [...(lastMessage.thinkingSteps || []), ...newSteps];
    lastMessage.timestamp = payload.timestamp || Date.now();
  } else {
    // 创建新的 thinking 消息
    addMessage({
      id: payload.id || Date.now().toString(),
      type: "thinking",
      content: newContent,
      sender: selectedAgent.value?.name || "思考过程",
      avatar: selectedAgent.value?.avatar,
      timestamp: payload.timestamp || Date.now(),
      isThinking: true,
      thinkingSteps: newSteps,
    });
  }
}

// 处理流式消息块
function handleStreamChunk(payload: any) {
  const chunk = payload.content || "";
  const replyToId = payload.replyTo;
  const streamId = replyToId || payload.id;
  const placeholderId = `agent-${replyToId}`;
  
  // 检查是否是心跳消息的流式块（replyTo 以 "heartbeat-" 开头）
  const isHeartbeatStream = replyToId && replyToId.startsWith("heartbeat-");

  if (isHeartbeatStream) {
    // 处理心跳消息的流式块
    const existingMessage = messages.value.find(m => m.id === streamId && (m.type === "heartbeat" || m.isHeartbeat));
    
    if (existingMessage) {
      // 追加到现有心跳消息
      existingMessage.content += chunk;
      existingMessage.timestamp = payload.timestamp || Date.now();
      existingMessage.status = "sending";
    } else {
      // 创建新的流式心跳消息
      addMessage({
        id: streamId,
        type: "heartbeat",
        content: `[心跳] ${chunk}`,
        sender: payload.sender || selectedAgent.value?.name || "Agent",
        avatar: selectedAgent.value?.avatar,
        timestamp: payload.timestamp || Date.now(),
        isHeartbeat: true,
        isStreaming: true,
        status: "sending",
      });
    }
    return;
  }

  // 首先查找占位消息（不再要求 isThinking，因为第一个 chunk 会将其设为 false）
  const placeholderMessage = messages.value.find(m => m.id === placeholderId && m.type === "agent");
  
  if (placeholderMessage) {
    // 更新占位消息为流式消息
    placeholderMessage.content += chunk;
    placeholderMessage.timestamp = payload.timestamp || Date.now();
    placeholderMessage.status = "sending";
    placeholderMessage.isThinking = false;
    placeholderMessage.isStreaming = true;
  } else {
    // 查找是否已存在对应的流式消息
    const existingMessage = messages.value.find(m => m.id === streamId && m.type === "agent");

    if (existingMessage) {
      // 追加到现有流式消息
      existingMessage.content += chunk;
      existingMessage.timestamp = payload.timestamp || Date.now();
      existingMessage.status = "sending";
    } else {
      // 创建新的流式消息
      addMessage({
        id: streamId,
        type: "agent",
        content: chunk,
        sender: payload.sender || selectedAgent.value?.name || "Agent",
        avatar: selectedAgent.value?.avatar,
        timestamp: payload.timestamp || Date.now(),
        isStreaming: true,
        status: "sending",
      });
    }
  }
}

// 处理流式消息结束
function handleStreamEnd(payload: any) {
  const replyToId = payload.replyTo;
  const streamId = replyToId || payload.id;
  const placeholderId = `agent-${replyToId}`;
  
  // 检查是否是心跳消息的流式结束（replyTo 以 "heartbeat-" 开头）
  const isHeartbeatStream = replyToId && replyToId.startsWith("heartbeat-");
  
  if (isHeartbeatStream) {
    // 处理心跳消息的流式结束
    const heartbeatMessage = messages.value.find(m => m.id === streamId && (m.type === "heartbeat" || m.isHeartbeat));
    
    if (heartbeatMessage) {
      heartbeatMessage.isStreaming = false;
      heartbeatMessage.status = "sent";
    }
    return;
  }
  
  // 首先查找占位消息
  const placeholderMessage = messages.value.find(m => m.id === placeholderId && m.type === "agent");
  // 然后查找流式消息
  const streamMessage = messages.value.find(m => m.id === streamId && m.type === "agent");
  
  const targetMessage = placeholderMessage || streamMessage;
  
  if (targetMessage) {
    targetMessage.isStreaming = false;
    targetMessage.isThinking = false;
    targetMessage.status = "sent";

    // 如果有音频数据，转换为语音消息格式
    if (payload.audio) {
      targetMessage.isVoice = true;
      const format = payload.audioFormat || "wav";
      targetMessage.voiceUrl = payload.audio.startsWith("data:")
        ? payload.audio
        : `data:audio/${format};base64,${payload.audio}`;
      targetMessage.voiceDuration = payload.audioDuration || 0;
    }
  }
}

// 全局调试函数：检查 WebSocket 连接状态
(window as any).checkWebSocketStatus = () => {
  console.log("[Debug] WebSocket Status:");
  console.log("  - isSocketOpen:", isSocketOpen.value);
  console.log("  - isHandshaked:", isHandshaked.value);
  console.log("  - isAuthenticated:", isAuthenticated.value);
  console.log("  - isConnecting:", isConnecting.value);
  console.log("  - messages count:", messages.value.length);
  console.log("  - selectedAgent:", selectedAgent.value?.name);
};

// 全局调试函数：模拟 WebSocket 消息
(window as any).simulateWebSocketMessage = (content: string, senderId?: string, replyTo?: string | null) => {
  const message = {
    type: "message",
    payload: {
      id: "simulated-" + Date.now(),
      content: content,
      sender: selectedAgent.value?.name || "Agent",
      senderId: senderId || selectedAgent.value?.id || "test-agent-id",
      timestamp: Date.now(),
      replyTo: replyTo
    }
  };
  
  handleWebSocketMessage(message);
};



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
  const agentMessageId = `agent-${messageId}`;
  
  // 添加用户消息
  addMessage({
    id: messageId,
    type: "user",
    content,
    sender: debugConfig.value.connection.userName,
    timestamp: Date.now(),
    status: "sending",
  });

  // 添加 Agent 思考中占位消息
  addMessage({
    id: agentMessageId,
    type: "agent",
    content: "",
    sender: selectedAgent.value?.name || "Agent",
    avatar: selectedAgent.value?.avatar,
    timestamp: Date.now(),
    status: "sending",
    isThinking: true,
  });

  // 解析 metadata
  let metadata: Record<string, any> = {};
  try {
    metadata = JSON.parse(debugConfig.value.advanced.metadata || "{}");
  } catch {
    // 解析失败使用空对象
  }

  const streamValue = debugConfig.value.features.stream !== false;
  
  const success = sendMessage({
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
  const agentMessageId = `agent-${messageId}`;

  // 将音频转换为 Base64
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = () => {
    const base64Audio = reader.result as string;

    // 添加语音消息到列表
    addMessage({
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

    // 添加 Agent 思考中占位消息
    addMessage({
      id: agentMessageId,
      type: "agent",
      content: "",
      sender: selectedAgent.value?.name || "Agent",
      avatar: selectedAgent.value?.avatar,
      timestamp: Date.now(),
      status: "sending",
      isThinking: true,
    });

    // 解析 metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = JSON.parse(debugConfig.value.advanced.metadata || "{}");
    } catch {
      // 解析失败使用空对象
    }

    // 发送语音消息
    const success = sendMessage({
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
  const agentMessageId = `agent-${messageId}`;

  // 添加图文消息到列表
  addMessage({
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

  // 添加 Agent 思考中占位消息
  addMessage({
    id: agentMessageId,
    type: "agent",
    content: "",
    sender: selectedAgent.value?.name || "Agent",
    avatar: selectedAgent.value?.avatar,
    timestamp: Date.now(),
    status: "sending",
    isThinking: true,
  });

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
  const success = sendMessage({
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

// 打开上下文管理弹窗
function openContextManager() {
  contextManagerVisible.value = true;
}

// 处理连接
function handleConnect() {
  // 防止重复连接
  if (isConnectingFlag.value || isAuthenticated.value) {
    return;
  }
  
  isConnectingFlag.value = true;
  
  // 监听连接状态变化，在连接成功或断开时重置标志
  const unwatch = watch([isAuthenticated, isSocketOpen], ([authenticated, socketOpen]) => {
    if (authenticated || !socketOpen) {
      // 连接成功认证完成，或连接断开时重置标志
      isConnectingFlag.value = false;
      unwatch();
    }
    
    // 认证成功后注册客户端到 Agent
    if (authenticated && selectedAgent.value && currentUserContactSid.value) {
      registerClientToAgent(selectedAgent.value.id, currentUserContactSid.value);
    }
  });
  
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
    } catch (e) {
      console.error("[Chat] Failed to parse clientConfig:", e);
    }
  }
  connect(config);
}

/**
 * 注册客户端到 Agent
 * WebSocket 认证成功后调用，用于接收心跳消息等推送
 */
async function registerClientToAgent(agentId: string, contactId: string) {
  try {
    await registerClient(agentId, contactId);
  } catch (error) {
    console.error(`[Chat] Failed to register client:`, error);
  }
}

/**
 * 从 Agent 注销客户端
 * WebSocket 断开连接时调用
 */
async function unregisterClientFromAgent(agentId: string, contactId: string) {
  try {
    await unregisterClient(agentId, contactId);
  } catch (error) {
    console.error(`[Chat] Failed to unregister client:`, error);
  }
}

async function handleLanguageChange(event: Event) {
  const customEvent = event as CustomEvent<{ locale: string }>;
  const newLocale = customEvent.detail?.locale;

  if (!newLocale) {
    return;
  }
  
  const agentId = selectedAgent.value?.id || localStorage.getItem("selectedAgentId");

  if (currentUserContactSid.value) {
    try {
      await updateContactProfileLanguage(currentUserContactSid.value, newLocale);

      if (agentId) {
        await updateContactLanguage(
          currentUserContactSid.value,
          agentId,
          newLocale,
        );
      }

      addMessage({
        id: Date.now().toString(),
        type: "system",
        content: `语言已切换为: ${newLocale}，下次对话将使用新语言`,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("[Chat] Failed to update language:", error);
      addMessage({
        id: Date.now().toString(),
        type: "system",
        content: `语言切换失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      });
    }
  }
}

onMounted(async () => {
  await loadMyContact();
  await loadAgents();
  loadChannels();
  loadDebugConfig();
  connectTimer = setTimeout(() => {
    if (!isAuthenticated.value && !isConnectingFlag.value) {
      handleConnect();
    }
  }, 500);

  window.addEventListener("language-changed", handleLanguageChange);
  
  const pendingLanguageChange = localStorage.getItem("pendingLanguageChange");
  if (pendingLanguageChange) {
    localStorage.removeItem("pendingLanguageChange");
    setTimeout(() => {
      handleLanguageChange(new CustomEvent("language-changed", {
        detail: { locale: pendingLanguageChange }
      }));
    }, 100);
  }
});

onUnmounted(() => {
  // 清理定时器
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  
  // 注意：不要在这里断开 WebSocket 连接
  // 因为 WebSocket 服务是单例模式，其他组件可能还在使用
  // 订阅会在组件卸载时自动取消（通过 useChat composable）
  
  window.removeEventListener("language-changed", handleLanguageChange);
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
    :left-width="18"
    :right-width="82"
    :left-min-width="18"
    :left-max-width="35"
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
        <div class="flex items-center gap-2">
          <HeartbeatMenu v-if="selectedAgent" :agent="selectedAgent" />
          <Button type="default" size="small" @click="openContextManager" :disabled="!selectedAgent">
            <IconifyIcon icon="mdi:code-braces" class="mr-1" />
            上下文管理
          </Button>
          <Button type="default" size="small" @click="openDebugModal">
            <IconifyIcon icon="mdi:cog" class="mr-1" />
            参数设置
          </Button>

        </div>
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

    <!-- 上下文管理弹窗 -->
    <ContextManagerModal
      v-model:visible="contextManagerVisible"
      :agent="selectedAgent"
      :contact-id="currentUserContactSid"
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
