<script setup lang="ts">
/**
 * 调试配置弹窗组件
 * 统一的配置管理方式
 */

import { computed, watch } from "vue";
import { Modal, Form, FormItem, Select, Input, Button, Tag, Space, Tabs, TabPane } from "ant-design-vue";
import type { ChannelApi } from "#/api/system/channels";
import FeatureSwitches from "./FeatureSwitches.vue";

// 功能开关配置
interface FeatureConfig {
  stream: boolean;
  voiceResponse: boolean;
  thinkingMessage: boolean;
  voice?: string; // 语音合成音色
  autoPlayVoice?: boolean; // 语音自动播放
}

// 连接配置
interface ConnectionConfig {
  channelId: string;
  identity: string;
  userName: string;
  clientConfig: string;
}

// 高级配置
interface AdvancedConfig {
  metadata: string;
  customParams: string;
}

// 统一的调试配置
interface DebugConfig {
  connection: ConnectionConfig;
  features: FeatureConfig;
  advanced: AdvancedConfig;
}

interface Props {
  visible: boolean;
  isSocketOpen: boolean;
  isHandshaked: boolean;
  isConnected: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
  config: DebugConfig;
  channels: ChannelApi.Channel[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:visible": [visible: boolean];
  connect: [];
  disconnect: [];
  "update:config": [config: DebugConfig];
}>();

// 连接状态文本
const statusText = computed(() => {
  if (props.isConnecting) return "连接中...";
  if (props.isAuthenticated) return "已认证";
  if (props.isHandshaked) return "已握手";
  if (props.isSocketOpen) return "已连接";
  return "未连接";
});

// 连接状态颜色
const statusColor = computed(() => {
  if (props.isConnecting) return "orange";
  if (props.isAuthenticated) return "green";
  if (props.isHandshaked) return "cyan";
  if (props.isSocketOpen) return "blue";
  return "default";
});

// 通道选项
const channelOptions = computed(() => {
  return props.channels.map((channel) => ({
    label: channel.name,
    value: channel.sid,
  }));
});

// 监听通道选择变化，自动填充 clientConfig
watch(
  () => props.config.connection.channelId,
  (newChannelId, oldChannelId) => {
    // 只在通道真正改变时执行（oldChannelId 为 undefined 表示初始加载，不执行）
    if (!oldChannelId && newChannelId) {
      // 初始加载且有 channelId，如果 clientConfig 为空则自动填充
      if (!props.config.connection.clientConfig) {
        const channel = props.channels.find((c) => c.sid === newChannelId);
        if (channel?.clientConfig) {
          updateConnectionConfig("clientConfig", JSON.stringify(channel.clientConfig, null, 2));
        }
      }
    } else if (newChannelId && newChannelId !== oldChannelId) {
      // 用户切换通道，自动填充 clientConfig
      const channel = props.channels.find((c) => c.sid === newChannelId);
      if (channel?.clientConfig) {
        updateConnectionConfig("clientConfig", JSON.stringify(channel.clientConfig, null, 2));
      } else {
        updateConnectionConfig("clientConfig", "");
      }
    } else if (!newChannelId && oldChannelId) {
      // 清除通道时清空 clientConfig
      updateConnectionConfig("clientConfig", "");
    }
  },
);

// 更新连接配置
function updateConnectionConfig(key: keyof ConnectionConfig, value: string) {
  emit("update:config", {
    ...props.config,
    connection: {
      ...props.config.connection,
      [key]: value,
    },
  });
}

// 更新功能开关
function updateFeatures(features: FeatureConfig) {
  emit("update:config", {
    ...props.config,
    features,
  });
}

// 更新高级配置
function updateAdvancedConfig(key: keyof AdvancedConfig, value: string) {
  emit("update:config", {
    ...props.config,
    advanced: {
      ...props.config.advanced,
      [key]: value,
    },
  });
}

// 是否处于连接过程中（包括网络层连接、握手、认证）
const isInConnectionProcess = computed(() => {
  return props.isSocketOpen || props.isConnecting;
});

// 处理连接/断开
function handleToggleConnection() {
  if (isInConnectionProcess.value) {
    emit("disconnect");
  } else {
    // 确保最新的 clientConfig 已同步到父组件
    emit("update:config", { ...props.config });
    // 使用 setTimeout 确保配置更新后再触发连接
    setTimeout(() => {
      emit("connect");
    }, 0);
  }
}

// 关闭弹窗
function handleClose() {
  emit("update:visible", false);
}
</script>

<template>
  <Modal
    :open="visible"
    title="调试配置"
    :footer="null"
    :mask-closable="true"
    :closable="true"
    @cancel="handleClose"
    width="700px"
  >
    <Tabs class="mt-4">
      <!-- 连接配置 -->
      <TabPane key="connection" tab="连接配置">
        <Form layout="vertical">
          <!-- 连接状态 -->
          <FormItem label="连接状态">
            <Space>
              <Tag :color="statusColor">{{ statusText }}</Tag>
              <Button
                :type="isInConnectionProcess ? 'danger' : 'primary'"
                :loading="isConnecting"
                @click="handleToggleConnection"
              >
                {{ isInConnectionProcess ? "断开连接" : "连接" }}
              </Button>
            </Space>
          </FormItem>

          <!-- 通道选择 -->
          <FormItem label="通道">
            <Select
              :value="config.connection.channelId"
              :options="channelOptions"
              placeholder="选择通道"
              allow-clear
              @change="(val) => updateConnectionConfig('channelId', val || '')"
            />
          </FormItem>

          <!-- 客户端配置 -->
          <FormItem label="客户端配置 (JSON)">
            <Input.TextArea
              :value="config.connection.clientConfig"
              placeholder='{"name": "cradle", "client": "cradle-web", "token": "xxx"}'
              :rows="6"
              @input="(e) => updateConnectionConfig('clientConfig', (e.target as HTMLTextAreaElement).value)"
            />
          </FormItem>

          <!-- 身份标识 -->
          <FormItem label="身份标识">
            <Input
              :value="config.connection.identity"
              placeholder="身份标识"
              @change="(e) => updateConnectionConfig('identity', (e.target as HTMLInputElement).value)"
            />
          </FormItem>

          <!-- 用户名称 -->
          <FormItem label="用户名称">
            <Input
              :value="config.connection.userName"
              placeholder="用户名称"
              @change="(e) => updateConnectionConfig('userName', (e.target as HTMLInputElement).value)"
            />
          </FormItem>
        </Form>
      </TabPane>

      <!-- 功能开关 -->
      <TabPane key="features" tab="功能开关">
        <div class="py-2">
          <div class="text-muted-foreground text-sm mb-4">
            配置 Agent 对话的各项功能开关
          </div>
          <FeatureSwitches
            :features="config.features"
            @update:features="updateFeatures"
          />
        </div>
      </TabPane>

      <!-- 高级配置 -->
      <TabPane key="advanced" tab="高级配置">
        <Form layout="vertical">
          <!-- 元数据 -->
          <FormItem label="元数据 (JSON)">
            <Input.TextArea
              :value="config.advanced.metadata"
              placeholder='{"key": "value"}'
              :rows="6"
              @input="(e) => updateAdvancedConfig('metadata', (e.target as HTMLTextAreaElement).value)"
            />
            <div class="text-muted-foreground text-xs mt-1">
              自定义元数据将随消息一起发送到后端
            </div>
          </FormItem>

          <!-- 自定义参数 -->
          <FormItem label="自定义参数 (JSON)">
            <Input.TextArea
              :value="config.advanced.customParams"
              placeholder='{"temperature": 0.7, "maxTokens": 2048}'
              :rows="4"
              @input="(e) => updateAdvancedConfig('customParams', (e.target as HTMLTextAreaElement).value)"
            />
            <div class="text-muted-foreground text-xs mt-1">
              自定义 LLM 调用参数（开发中）
            </div>
          </FormItem>
        </Form>
      </TabPane>
    </Tabs>

    <!-- 错误提示 -->
    <div v-if="error" class="mt-4 text-red-500 text-sm">
      {{ error }}
    </div>
  </Modal>
</template>
