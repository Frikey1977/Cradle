<script setup lang="ts">
import type { OrganizationAgentApi } from "#/api/organization/agents";

import { ref, watch, computed } from "vue";
import { useVbenModal } from "@vben/common-ui";
import { Tabs, TabPane, Button, Switch, message, Spin } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import ContextEditorTab from "./ContextEditorTab.vue";
import RequestBodyTab from "./RequestBodyTab.vue";
import RawContextTab from "./RawContextTab.vue";

const props = defineProps<{
  visible: boolean;
  agent: OrganizationAgentApi.Agent | null;
  contactId?: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const customContextEnabled = ref(false);
const contextBlocks = ref<OrganizationAgentApi.ContextBlock[]>([]);
const loading = ref(false);
const activeTab = ref("editor");

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: true,
  class: 'w-[1080px]',
  animationType: 'slide',
  onCancel() {
    modalApi.close();
    emit("update:visible", false);
  },
  onOpenChange(isOpen) {
    emit("update:visible", isOpen);
    if (isOpen && props.agent?.id) {
      loadContext();
    }
  },
});

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      modalApi.open();
    }
  }
);

async function loadContext() {
  if (!props.agent?.id) return;

  loading.value = true;
  try {
    // 从心跳配置中获取自定义上下文
    const heartbeat = props.agent.heartbeat;
    if (heartbeat?.customContext) {
      customContextEnabled.value = heartbeat.customContext.enabled ?? false;
      contextBlocks.value = heartbeat.customContext.blocks ?? [];
    }

    // 如果没有自定义上下文，生成默认上下文块
    if (contextBlocks.value.length === 0) {
      contextBlocks.value = generateDefaultBlocks();
    }
  } catch (error) {
    console.error("Failed to load context:", error);
  } finally {
    loading.value = false;
  }
}

function generateDefaultBlocks(): OrganizationAgentApi.ContextBlock[] {
  return [
    {
      id: `block-${Date.now()}-1`,
      role: "system",
      content: "你是一个智能助手，请根据用户的需求提供帮助。",
      enabled: true,
      order: 0,
    },
  ];
}

function handleBlocksUpdate(blocks: OrganizationAgentApi.ContextBlock[]) {
  contextBlocks.value = blocks;
}

function handleRestore() {
  contextBlocks.value = generateDefaultBlocks();
  message.success("已还原为默认上下文");
}

const assembledRequestBody = computed(() => {
  const enabledBlocks = contextBlocks.value
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order);

  return {
    messages: enabledBlocks.map((block) => ({
      role: block.role,
      content: block.content,
    })),
    totalChars: enabledBlocks.reduce((sum, block) => sum + block.content.length, 0),
  };
});
</script>

<template>
  <Modal
    title="上下文管理"
    :show-confirm-button="false"
    :show-cancel-button="false"
  >
    <Spin :spinning="loading">
      <div class="context-manager">
        <div class="context-header">
          <div class="custom-context-switch">
            <span>自定义上下文：</span>
            <Switch
              v-model:checked="customContextEnabled"
              checked-children="启用"
              un-checked-children="禁用"
            />
            <span class="hint">
              {{ customContextEnabled ? "使用编辑后的上下文" : "使用Agent原本的上下文" }}
            </span>
          </div>
          <Button @click="handleRestore" :disabled="!customContextEnabled">
            <IconifyIcon icon="mdi:restore" style="margin-right: 4px" />
            还原
          </Button>
        </div>

        <Tabs v-model:activeKey="activeTab" class="context-tabs">
          <TabPane key="editor" tab="上下文编辑">
            <ContextEditorTab
              v-if="activeTab === 'editor'"
              :blocks="contextBlocks"
              :enabled="customContextEnabled"
              @update:blocks="handleBlocksUpdate"
            />
          </TabPane>
          <TabPane key="request" tab="请求体">
            <RequestBodyTab
              v-if="activeTab === 'request'"
              :request-body="assembledRequestBody"
            />
          </TabPane>
          <TabPane key="raw" tab="原始上下文">
            <RawContextTab
              v-if="activeTab === 'raw' && agent?.id"
              :agent-id="agent.id"
              :contact-id="contactId"
            />
          </TabPane>
        </Tabs>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.context-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

.custom-context-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}

.context-tabs {
  flex: 1;
  overflow: hidden;
}

.context-tabs :deep(.ant-tabs-content) {
  height: calc(100% - 46px);
}

.context-tabs :deep(.ant-tabs-tabpane) {
  height: 100%;
  overflow: auto;
}
</style>
