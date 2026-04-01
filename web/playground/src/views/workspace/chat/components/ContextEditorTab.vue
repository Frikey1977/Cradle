<script setup lang="ts">
import type { OrganizationAgentApi } from "#/api/organization/agents";

import { ref, watch, computed } from "vue";
import {
  Button,
  Card,
  Select,
  Input,
  Switch,
  Space,
  Popconfirm,
  message,
} from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";

const props = defineProps<{
  blocks: OrganizationAgentApi.ContextBlock[];
  enabled: boolean;
}>();

const emit = defineEmits<{
  "update:blocks": [blocks: OrganizationAgentApi.ContextBlock[]];
}>();

const localBlocks = ref<OrganizationAgentApi.ContextBlock[]>([]);

watch(
  () => props.blocks,
  (blocks) => {
    localBlocks.value = [...blocks];
  },
  { immediate: true, deep: true }
);

const roleOptions = [
  { value: "system", label: "System" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
];

function generateId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function handleAddBlock() {
  const newBlock: OrganizationAgentApi.ContextBlock = {
    id: generateId(),
    role: "system",
    content: "",
    enabled: true,
    order: localBlocks.value.length,
  };
  localBlocks.value.push(newBlock);
  emit("update:blocks", localBlocks.value);
  message.success("已添加新块");
}

function handleDeleteBlock(index: number) {
  localBlocks.value.splice(index, 1);
  // 重新排序
  localBlocks.value.forEach((block, i) => {
    block.order = i;
  });
  emit("update:blocks", localBlocks.value);
  message.success("已删除块");
}

function handleBlockChange(index: number, field: keyof OrganizationAgentApi.ContextBlock, value: any) {
  localBlocks.value[index][field] = value as never;
  emit("update:blocks", localBlocks.value);
}

function handleMoveUp(index: number) {
  if (index <= 0) return;
  const temp = localBlocks.value[index];
  localBlocks.value[index] = localBlocks.value[index - 1];
  localBlocks.value[index - 1] = temp;
  // 更新排序
  localBlocks.value.forEach((block, i) => {
    block.order = i;
  });
  emit("update:blocks", localBlocks.value);
}

function handleMoveDown(index: number) {
  if (index >= localBlocks.value.length - 1) return;
  const temp = localBlocks.value[index];
  localBlocks.value[index] = localBlocks.value[index + 1];
  localBlocks.value[index + 1] = temp;
  // 更新排序
  localBlocks.value.forEach((block, i) => {
    block.order = i;
  });
  emit("update:blocks", localBlocks.value);
}

const totalChars = computed(() => {
  return localBlocks.value
    .filter((b) => b.enabled)
    .reduce((sum, block) => sum + block.content.length, 0);
});

const enabledCount = computed(() => {
  return localBlocks.value.filter((b) => b.enabled).length;
});
</script>

<template>
  <div class="context-editor" :class="{ disabled: !enabled }">
    <div class="editor-header">
      <div class="stats">
        <span>共 {{ localBlocks.length }} 个块</span>
        <span>启用 {{ enabledCount }} 个</span>
        <span>总字符数: {{ totalChars }}</span>
      </div>
      <Button type="primary" @click="handleAddBlock" :disabled="!enabled">
        <IconifyIcon icon="mdi:plus" style="margin-right: 4px" />
        添加块
      </Button>
    </div>

    <div class="blocks-list">
      <Card
        v-for="(block, index) in localBlocks"
        :key="block.id"
        class="block-card"
        :class="{ disabled: !block.enabled }"
      >
        <template #title>
          <div class="block-header">
            <div class="block-info">
              <Select
                v-model:value="block.role"
                :options="roleOptions"
                style="width: 120px"
                :disabled="!enabled"
                @change="(val) => handleBlockChange(index, 'role', val)"
              />
              <span class="block-index">块 #{{ index + 1 }}</span>
            </div>
            <div class="block-actions">
              <Switch
                v-model:checked="block.enabled"
                size="small"
                :disabled="!enabled"
                @change="(val) => handleBlockChange(index, 'enabled', val)"
              />
              <Space>
                <Button
                  size="small"
                  :disabled="!enabled || index === 0"
                  @click="handleMoveUp(index)"
                >
                  <IconifyIcon icon="mdi:arrow-up" />
                </Button>
                <Button
                  size="small"
                  :disabled="!enabled || index === localBlocks.length - 1"
                  @click="handleMoveDown(index)"
                >
                  <IconifyIcon icon="mdi:arrow-down" />
                </Button>
                <Popconfirm
                  title="确定要删除这个块吗？"
                  @confirm="handleDeleteBlock(index)"
                >
                  <Button size="small" danger :disabled="!enabled">
                    <IconifyIcon icon="mdi:delete" />
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        </template>
        <Input.TextArea
          v-model:value="block.content"
          :rows="4"
          placeholder="输入内容..."
          :disabled="!enabled || !block.enabled"
          @change="(e) => handleBlockChange(index, 'content', e.target.value)"
        />
      </Card>

      <div v-if="localBlocks.length === 0" class="empty-state">
        <IconifyIcon icon="mdi:text-box-outline" size="48" />
        <p>暂无上下文块</p>
        <Button type="primary" @click="handleAddBlock" :disabled="!enabled">
          添加第一个块
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.context-editor.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

.stats {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 13px;
}

.blocks-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.block-card {
  margin-bottom: 12px;
}

.block-card.disabled {
  opacity: 0.5;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.block-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.block-index {
  color: #999;
  font-size: 12px;
}

.block-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
}

.empty-state p {
  margin: 16px 0;
}
</style>
