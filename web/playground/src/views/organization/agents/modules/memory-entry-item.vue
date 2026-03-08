<script lang="ts" setup>
/**
 * 记忆条目组件
 * 支持 Markdown 渲染和原文本切换
 * 支持行内编辑和删除
 */
import { ref, computed } from "vue";
import { Button, Input, message } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import MarkdownRenderer from "#/views/workspace/chat/components/MarkdownRenderer.vue";
import type { ShortTermMemoryEntry } from "#/api/organization/relationships";

interface Props {
  entry: ShortTermMemoryEntry;
  index: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  update: [index: number, entry: ShortTermMemoryEntry];
  delete: [index: number];
}>();

// 是否处于编辑模式
const isEditing = ref(false);
// 编辑中的内容
const editContent = ref("");
// 是否显示原文本
const showRawText = ref(false);

// 判断是否为 agent 消息
const isAgent = computed(() => {
  return props.entry.role === "agent" || props.entry.role === "assistant";
});

// 格式化时间
const formattedTime = computed(() => {
  return new Date(props.entry.timestamp).toLocaleString();
});

// 开始编辑
function startEdit() {
  editContent.value = props.entry.content;
  isEditing.value = true;
}

// 保存编辑
function saveEdit() {
  if (!editContent.value.trim()) {
    message.warning("内容不能为空");
    return;
  }

  const updatedEntry: ShortTermMemoryEntry = {
    ...props.entry,
    content: editContent.value.trim(),
  };

  emit("update", props.index, updatedEntry);
  isEditing.value = false;
  message.success("保存成功");
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false;
  editContent.value = "";
}

// 删除条目
function handleDelete() {
  emit("delete", props.index);
}

// 切换原文本显示
function toggleRawText() {
  showRawText.value = !showRawText.value;
}
</script>

<template>
  <div
    class="memory-entry rounded-lg border p-4 transition-all hover:shadow-md w-[95%]"
    :class="[
      isAgent ? 'bg-green-50 border-green-200 mr-auto' : 'bg-blue-50 border-blue-200 ml-auto'
    ]"
  >
    <!-- 头部：角色标签和时间 -->
    <div class="flex items-center justify-between mb-3">
      <!-- User 消息：信息在右，按钮在左 -->
      <template v-if="!isAgent">
        <!-- 操作按钮组 -->
        <div class="flex items-center gap-1">
          <template v-if="!isEditing">
            <Button
              type="text"
              size="small"
              @click="toggleRawText"
              :title="showRawText ? '显示渲染视图' : '显示原文本'"
            >
              <IconifyIcon :icon="showRawText ? 'mdi:eye-outline' : 'mdi:code-braces'" />
            </Button>
            <Button
              type="text"
              size="small"
              @click="startEdit"
              title="编辑"
            >
              <IconifyIcon icon="mdi:pencil" />
            </Button>
            <Button
              type="text"
              size="small"
              danger
              @click="handleDelete"
              title="删除"
            >
              <IconifyIcon icon="mdi:delete" />
            </Button>
          </template>
          <template v-else>
            <Button
              type="text"
              size="small"
              @click="saveEdit"
              title="保存"
            >
              <IconifyIcon icon="mdi:check" class="text-green-600" />
            </Button>
            <Button
              type="text"
              size="small"
              @click="cancelEdit"
              title="取消"
            >
              <IconifyIcon icon="mdi:close" class="text-gray-500" />
            </Button>
          </template>
        </div>
        <!-- 信息标签 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ entry.type }}</span>
          <span class="text-xs text-gray-400">·</span>
          <span class="text-xs text-gray-400">{{ entry.channel }}</span>
          <span class="text-xs text-gray-400">·</span>
          <span class="text-xs text-gray-400">{{ formattedTime }}</span>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded bg-blue-200 text-blue-700"
          >
            User
          </span>
        </div>
      </template>

      <!-- Agent 消息：信息在左，按钮在右（保持原样） -->
      <template v-else>
        <div class="flex items-center gap-2">
          <span
            class="text-xs font-medium px-2 py-0.5 rounded bg-green-200 text-green-700"
          >
            Agent
          </span>
          <span class="text-xs text-gray-400">{{ formattedTime }}</span>
          <span class="text-xs text-gray-400">·</span>
          <span class="text-xs text-gray-400">{{ entry.channel }}</span>
          <span class="text-xs text-gray-400">·</span>
          <span class="text-xs text-gray-400">{{ entry.type }}</span>
        </div>

        <!-- 操作按钮组 -->
        <div class="flex items-center gap-1">
          <template v-if="!isEditing">
            <Button
              type="text"
              size="small"
              @click="toggleRawText"
              :title="showRawText ? '显示渲染视图' : '显示原文本'"
            >
              <IconifyIcon :icon="showRawText ? 'mdi:eye-outline' : 'mdi:code-braces'" />
            </Button>
            <Button
              type="text"
              size="small"
              @click="startEdit"
              title="编辑"
            >
              <IconifyIcon icon="mdi:pencil" />
            </Button>
            <Button
              type="text"
              size="small"
              danger
              @click="handleDelete"
              title="删除"
            >
              <IconifyIcon icon="mdi:delete" />
            </Button>
          </template>
          <template v-else>
            <Button
              type="text"
              size="small"
              @click="saveEdit"
              title="保存"
            >
              <IconifyIcon icon="mdi:check" class="text-green-600" />
            </Button>
            <Button
              type="text"
              size="small"
              @click="cancelEdit"
              title="取消"
            >
              <IconifyIcon icon="mdi:close" class="text-gray-500" />
            </Button>
          </template>
        </div>
      </template>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 编辑模式 -->
      <div v-if="isEditing" class="edit-mode">
        <Input.TextArea
          v-model:value="editContent"
          :rows="4"
          class="w-full"
          placeholder="输入记忆内容..."
        />
      </div>

      <!-- 原文本模式 -->
      <div
        v-else-if="showRawText"
        class="raw-text-mode bg-white/50 rounded p-3 font-mono text-sm whitespace-pre-wrap break-all"
      >
        {{ entry.content }}
      </div>

      <!-- Markdown 渲染模式 -->
      <div v-else class="markdown-mode bg-white/50 rounded p-3">
        <MarkdownRenderer
          :content="entry.content"
          :show-toggle="false"
          :is-streaming="false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.memory-entry {
  transition: all 0.2s ease;
}

.memory-entry:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.content-area {
  min-height: 40px;
}

.raw-text-mode {
  border: 1px dashed #d9d9d9;
}

.markdown-mode :deep(.markdown-wrapper) {
  display: block;
}

.markdown-mode :deep(.markdown-body) {
  background: transparent;
}

.markdown-mode :deep(.action-buttons-wrapper) {
  display: none;
}
</style>
