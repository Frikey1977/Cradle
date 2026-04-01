<script lang="ts" setup>
import type { OrganizationRelationshipApi } from "#/api/organization/relationships";

import { computed, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Input, Select, message, Popconfirm, Upload } from "ant-design-vue";
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
const isDragging = ref(false);

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

// 下载记忆为 JSON 文件
function downloadMemory() {
  if (shortTermMemoryData.value.length === 0) {
    message.warning($t("organization.agents.memory.noMemoryToDownload"));
    return;
  }

  const memoryData = {
    agentId: agentId.value,
    contactId: contactId.value,
    contactName: contactName.value,
    exportTime: new Date().toISOString(),
    entries: shortTermMemoryData.value,
  };

  const blob = new Blob([JSON.stringify(memoryData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `memory-${contactName.value || contactId.value.slice(0, 8)}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  message.success($t("organization.agents.memory.downloadSuccess"));
}

// 处理拖拽进入
function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = true;
}

// 处理拖拽离开
function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
}

// 处理拖拽悬停
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// 验证记忆文件是否匹配当前 Agent 和 Contact
function validateMemoryFile(parsed: any): { valid: boolean; error?: string } {
  // 检查是否有 agentId
  if (parsed.agentId && parsed.agentId !== agentId.value) {
    return {
      valid: false,
      error: $t("organization.agents.memory.agentMismatch", {
        expected: agentId.value.slice(0, 8),
        actual: parsed.agentId.slice(0, 8),
      }),
    };
  }

  // 检查是否有 contactId
  if (parsed.contactId && parsed.contactId !== contactId.value) {
    return {
      valid: false,
      error: $t("organization.agents.memory.contactMismatch", {
        expected: contactName.value || contactId.value.slice(0, 8),
        actual: parsed.contactName || parsed.contactId?.slice(0, 8),
      }),
    };
  }

  return { valid: true };
}

// 处理文件拖放
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    message.error($t("organization.agents.memory.invalidFileType"));
    return;
  }

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      message.error($t("organization.agents.memory.invalidMemoryFormat"));
      return;
    }

    // 验证 Agent 和 Contact 匹配
    const validation = validateMemoryFile(parsed);
    if (!validation.valid) {
      message.error(validation.error!);
      return;
    }

    // 验证条目格式
    const validEntries = parsed.entries.filter((entry: any) => {
      return entry.timestamp && entry.role && entry.content !== undefined;
    });

    if (validEntries.length === 0) {
      message.error($t("organization.agents.memory.noValidEntries"));
      return;
    }

    // 合并现有记忆和导入的记忆
    const mergedMemory = [...shortTermMemoryData.value, ...validEntries];
    await updateShortTermMemory(agentId.value, contactId.value, mergedMemory);
    shortTermMemoryData.value = mergedMemory;

    message.success($t("organization.agents.memory.importSuccess", { count: validEntries.length }));
    emit("success");
  } catch (error) {
    message.error($t("organization.agents.memory.importFailed"));
  }
}

// 处理文件选择上传
async function handleFileUpload(file: File) {
  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    message.error($t("organization.agents.memory.invalidFileType"));
    return false;
  }

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      message.error($t("organization.agents.memory.invalidMemoryFormat"));
      return false;
    }

    // 验证 Agent 和 Contact 匹配
    const validation = validateMemoryFile(parsed);
    if (!validation.valid) {
      message.error(validation.error!);
      return false;
    }

    // 验证条目格式
    const validEntries = parsed.entries.filter((entry: any) => {
      return entry.timestamp && entry.role && entry.content !== undefined;
    });

    if (validEntries.length === 0) {
      message.error($t("organization.agents.memory.noValidEntries"));
      return false;
    }

    // 合并现有记忆和导入的记忆
    const mergedMemory = [...shortTermMemoryData.value, ...validEntries];
    await updateShortTermMemory(agentId.value, contactId.value, mergedMemory);
    shortTermMemoryData.value = mergedMemory;

    message.success($t("organization.agents.memory.importSuccess", { count: validEntries.length }));
    emit("success");
    return false; // 阻止默认上传行为
  } catch (error) {
    message.error($t("organization.agents.memory.importFailed"));
    return false;
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
              { label: $t('organization.agents.memory.roleAssistant'), value: 'agent' },
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
        <div class="flex items-center gap-2">
          <Button type="default" size="small" @click="downloadMemory">
            <IconifyIcon icon="mdi:download" />
            <span class="ml-1">{{ $t('organization.agents.memory.download') }}</span>
          </Button>
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
      </div>

      <!-- 记忆列表 -->
      <div v-if="shortTermMemoryLoading" class="text-center py-8 flex-1 overflow-y-auto">
        {{ $t('ui.actionMessage.loading') }}
      </div>
      <div
        v-else-if="shortTermMemoryData.length === 0"
        class="flex-1 flex flex-col items-center justify-center text-gray-400"
        @dragenter="handleDragEnter"
        @dragleave="handleDragLeave"
        @dragover="handleDragOver"
        @drop="handleDrop"
      >
        <div
          :class="[
            'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          ]"
        >
          <IconifyIcon icon="mdi:cloud-upload" class="text-4xl mb-4" :class="isDragging ? 'text-blue-500' : 'text-gray-400'" />
          <p class="mb-2">{{ $t("organization.agents.memory.noMemoryData") }}</p>
          <p class="text-sm text-gray-400 mb-4">{{ $t("organization.agents.memory.dragToImport") }}</p>
          <Upload
            :before-upload="handleFileUpload"
            :show-upload-list="false"
            accept=".json"
          >
            <Button type="default">
              <IconifyIcon icon="mdi:upload" />
              <span class="ml-1">{{ $t('organization.agents.memory.selectFile') }}</span>
            </Button>
          </Upload>
        </div>
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
