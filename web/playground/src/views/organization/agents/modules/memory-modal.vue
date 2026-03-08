<script lang="ts" setup>
import type { OrganizationRelationshipApi } from "#/api/organization/relationships";

import { computed, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Input, Select, message, Popconfirm } from "ant-design-vue";
import { $t } from "#/locales";

import {
  getShortTermMemory,
  updateShortTermMemory,
} from "#/api/organization/relationships";
import MemoryEntryItem from "./memory-entry-item.vue";

const emit = defineEmits<{
  success: [];
}>();

const agentId = ref<string>("");
const contactId = ref<string>("");
const contactName = ref<string>("");
const shortTermMemoryData = ref<OrganizationRelationshipApi.ShortTermMemoryEntry[]>([]);
const shortTermMemoryLoading = ref(false);
const newMemoryContent = ref("");
const newMemoryRole = ref<"user" | "agent">("user");
const newMemoryChannel = ref<string>("cradle");
const newMemoryType = ref<"text" | "audio" | "image" | "file">("text");

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: true,
  height: 600,
  onCancel() {
    modalApi.close();
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<{
        agentId: string;
        contactId: string;
        contactName: string;
      }>();
      if (data) {
        agentId.value = data.agentId;
        contactId.value = data.contactId;
        contactName.value = data.contactName;
        loadShortTermMemory();
      }
    } else {
      // 关闭时清空数据
      agentId.value = "";
      contactId.value = "";
      contactName.value = "";
      shortTermMemoryData.value = [];
      newMemoryContent.value = "";
      newMemoryRole.value = "user";
      newMemoryChannel.value = "cradle";
      newMemoryType.value = "text";
    }
  },
});

// 加载短期记忆
async function loadShortTermMemory() {
  if (!agentId.value || !contactId.value) return;

  shortTermMemoryLoading.value = true;
  try {
    const data = await getShortTermMemory(agentId.value, contactId.value);
    shortTermMemoryData.value = data || [];
  } catch (error) {
    message.error($t("organization.agents.memory.loadFailed"));
  } finally {
    shortTermMemoryLoading.value = false;
  }
}

// 添加记忆条目
async function addMemoryEntry() {
  if (!newMemoryContent.value.trim()) {
    message.warning($t("organization.agents.memory.contentRequired"));
    return;
  }

  try {
    const newEntry: OrganizationRelationshipApi.ShortTermMemoryEntry = {
      timestamp: Date.now(),
      channel: newMemoryChannel.value,
      role: newMemoryRole.value,
      content: newMemoryContent.value.trim(),
      type: newMemoryType.value,
    };

    const updatedMemory = [...shortTermMemoryData.value, newEntry];
    await updateShortTermMemory(agentId.value, contactId.value, updatedMemory);

    shortTermMemoryData.value = updatedMemory;
    newMemoryContent.value = "";
    message.success($t("ui.actionMessage.createSuccess"));
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 更新记忆条目
async function updateMemoryEntry(index: number, updatedEntry: OrganizationRelationshipApi.ShortTermMemoryEntry) {
  try {
    const updatedMemory = [...shortTermMemoryData.value];
    updatedMemory[index] = updatedEntry;
    
    await updateShortTermMemory(agentId.value, contactId.value, updatedMemory);
    shortTermMemoryData.value = updatedMemory;
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 删除记忆条目
async function deleteMemoryEntry(index: number) {
  try {
    const updatedMemory = shortTermMemoryData.value.filter((_, i) => i !== index);
    await updateShortTermMemory(agentId.value, contactId.value, updatedMemory);

    shortTermMemoryData.value = updatedMemory;
    message.success($t("ui.actionMessage.deleteSuccess"));
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 清空所有记忆
async function clearAllMemory() {
  try {
    await updateShortTermMemory(agentId.value, contactId.value, []);
    shortTermMemoryData.value = [];
    message.success($t("organization.agents.memory.clearAllSuccess"));
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

const getModalTitle = computed(() =>
  $t("organization.agents.memory.shortTermMemoryTitle", {
    name: contactName.value || "-",
  })
);

// 获取 modal 状态
const modalState = modalApi.useStore();

// 根据全屏状态动态调整 modal 宽度和高度
const modalClass = computed(() => {
  return modalState.value?.fullscreen ? "w-full memory-modal" : "w-full max-w-[1080px] memory-modal";
});

// 根据全屏状态动态调整内容区域高度
const contentStyle = computed(() => {
  return modalState.value?.fullscreen 
    ? { height: 'calc(100vh - 130px)' } 
    : { height: '520px' };
});
</script>

<template>
  <Modal :class="modalClass" :title="getModalTitle">
    <div class="p-4 flex flex-col" :style="contentStyle">
      <!-- 添加新记忆 -->
      <div class="mb-6 p-4 bg-gray-50 rounded-lg border flex-shrink-0">
        <div class="flex items-center gap-3 mb-3">
          <Select
            v-model:value="newMemoryRole"
            style="width: 120px"
            :options="[
              { label: $t('organization.agents.memory.roleUser'), value: 'user' },
              { label: $t('organization.agents.memory.roleAgent'), value: 'agent' },
            ]"
          />
          <Select
            v-model:value="newMemoryChannel"
            style="width: 120px"
            :options="[
              { label: 'Cradle', value: 'cradle' },
              { label: 'WeChat', value: 'wechat' },
            ]"
          />
          <Select
            v-model:value="newMemoryType"
            style="width: 120px"
            :options="[
              { label: '文本', value: 'text' },
              { label: '语音', value: 'audio' },
              { label: '图片', value: 'image' },
              { label: '文件', value: 'file' },
            ]"
          />
        </div>
        <div class="flex gap-2">
          <Input.TextArea
            v-model:value="newMemoryContent"
            :placeholder="$t('organization.agents.memory.contentPlaceholder')"
            :rows="3"
            class="flex-1"
          />
          <Button type="primary" @click="addMemoryEntry" class="self-end">
            <IconifyIcon icon="mdi:plus" />
            <span class="ml-1">添加</span>
          </Button>
        </div>
      </div>

      <!-- 记忆列表标题栏 -->
      <div v-if="!shortTermMemoryLoading && shortTermMemoryData.length > 0" class="flex items-center justify-between mb-3 flex-shrink-0">
        <span class="text-sm text-gray-500">
          {{ $t('organization.agents.memory.totalCount', { count: shortTermMemoryData.length }) }}
        </span>
        <Popconfirm
          :title="$t('organization.agents.memory.clearAllConfirmTitle')"
          :description="$t('organization.agents.memory.clearAllConfirmDesc')"
          :ok-text="$t('ui.action.confirm')"
          :cancel-text="$t('ui.action.cancel')"
          @confirm="clearAllMemory"
        >
          <Button type="primary" danger size="small">
            <IconifyIcon icon="mdi:delete-sweep" />
            <span class="ml-1">{{ $t('organization.agents.memory.clearAll') }}</span>
          </Button>
        </Popconfirm>
      </div>

      <!-- 记忆列表 -->
      <div v-if="shortTermMemoryLoading" class="text-center py-8 flex-1 overflow-y-auto">
        {{ $t('ui.actionMessage.loading') }}
      </div>
      <div v-else-if="shortTermMemoryData.length === 0" class="text-center text-gray-400 py-8 flex-1 overflow-y-auto">
        {{ $t("organization.agents.memory.noMemoryData") }}
      </div>
      <div v-else class="space-y-4 overflow-y-auto pr-2 flex-1">
        <MemoryEntryItem
          v-for="(entry, index) in shortTermMemoryData"
          :key="entry.timestamp + '-' + index"
          :entry="entry"
          :index="index"
          @update="updateMemoryEntry"
          @delete="deleteMemoryEntry"
        />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* 修复 Modal 滚动条问题 - 让内容区固定高度，只有列表滚动 */
:deep(.memory-modal .vben-modal-body) {
  overflow: hidden !important;
  padding: 0 !important;
}

:deep(.memory-modal .ant-modal-body) {
  overflow: hidden !important;
  padding: 0 !important;
}
</style>
