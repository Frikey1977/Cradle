<script setup lang="ts">
/**
 * 调试测试区组件
 * 用于设置连接参数、测试配置、模拟不同通道
 */

import { computed } from "vue";
import { Card, Button, Input, Select, Tag, Space, Collapse, Alert } from "ant-design-vue";
import type { ChannelApi } from "#/api/system/channels";

const { TextArea } = Input;
const { Panel } = Collapse;

interface Props {
  isConnected: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
  config: {
    channelId: string;
    identity: string;
    userName: string;
    metadata: string;
  };
  channels: ChannelApi.Channel[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  connect: [];
  disconnect: [];
  "update:config": [config: Props["config"]];
}>();

// 连接状态文本
const statusText = computed(() => {
  if (props.isConnecting) return "连接中...";
  if (props.isAuthenticated) return "已认证";
  if (props.isConnected) return "已连接";
  return "未连接";
});

// 连接状态颜色
const statusColor = computed(() => {
  if (props.isConnecting) return "orange";
  if (props.isAuthenticated) return "green";
  if (props.isConnected) return "blue";
  return "default";
});

// 通道选项
const channelOptions = computed(() => {
  return props.channels.map((channel) => ({
    label: channel.name,
    value: channel.sid,
  }));
});

// 更新配置
function updateConfig(key: keyof Props["config"], value: string) {
  emit("update:config", { ...props.config, [key]: value });
}

// 处理连接/断开
function handleToggleConnection() {
  if (props.isConnected) {
    emit("disconnect");
  } else {
    emit("connect");
  }
}
</script>

<template>
  <Card class="debug-panel" size="small" :bordered="false">
    <Collapse :bordered="false" default-active-key="debug">
      <Panel key="debug" header="调试测试区">
        <div class="flex flex-wrap items-center gap-4">
          <!-- 连接状态 -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">状态:</span>
            <Tag :color="statusColor">{{ statusText }}</Tag>
          </div>

          <!-- 连接按钮 -->
          <Button
            :type="isConnected ? 'danger' : 'primary'"
            :loading="isConnecting"
            @click="handleToggleConnection"
          >
            {{ isConnected ? "断开连接" : "连接" }}
          </Button>

          <!-- 通道选择 -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">通道:</span>
            <Select
              :value="config.channelId"
              :options="channelOptions"
              placeholder="选择通道"
              class="w-40"
              allow-clear
              @change="(val) => updateConfig('channelId', val || '')"
            />
          </div>

          <!-- 身份标识 -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">身份:</span>
            <Input
              :value="config.identity"
              placeholder="身份标识"
              class="w-32"
              @change="(e) => updateConfig('identity', (e.target as HTMLInputElement).value)"
            />
          </div>

          <!-- 用户名称 -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">用户名:</span>
            <Input
              :value="config.userName"
              placeholder="用户名称"
              class="w-32"
              @change="(e) => updateConfig('userName', (e.target as HTMLInputElement).value)"
            />
          </div>

          <!-- 元数据 -->
          <div class="flex items-center gap-2 flex-1 min-w-[200px]">
            <span class="text-sm text-gray-500">元数据:</span>
            <TextArea
              :value="config.metadata"
              placeholder='{"key": "value"}'
              :rows="1"
              class="flex-1"
              @change="(e) => updateConfig('metadata', (e.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>

        <!-- 错误提示 -->
        <Alert
          v-if="error"
          type="error"
          :message="error"
          class="mt-3"
          show-icon
          closable
        />
      </Panel>
    </Collapse>
  </Card>
</template>

<style scoped>
.debug-panel {
  border-bottom: 1px solid #f0f0f0;
}

.debug-panel :deep(.ant-card-body) {
  padding: 12px 16px;
}

.debug-panel :deep(.ant-collapse-content-box) {
  padding: 12px 0;
}
</style>
