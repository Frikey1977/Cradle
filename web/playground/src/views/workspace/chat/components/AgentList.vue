<script setup lang="ts">
/**
 * 对话对象选择区组件
 * 显示可对话的 Agent 列表
 */

import { computed, ref } from "vue";
import { Card, List, Avatar, Tag, Spin, Empty, Input } from "ant-design-vue";
import type { OrganizationAgentApi } from "#/api/organization/agents";
import { IconifyIcon } from "@vben/icons";

interface Props {
  agents: OrganizationAgentApi.Agent[];
  loading: boolean;
  selectedId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [agent: OrganizationAgentApi.Agent];
}>();

// 搜索关键词
const searchKeyword = ref("");

// 过滤后的 Agent 列表
const filteredAgents = computed(() => {
  if (!searchKeyword.value) return props.agents;
  const keyword = searchKeyword.value.toLowerCase();
  return props.agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(keyword) ||
      agent.agentNo.toLowerCase().includes(keyword) ||
      agent.description?.toLowerCase().includes(keyword)
  );
});

// 选择 Agent
function handleSelect(agent: OrganizationAgentApi.Agent) {
  emit("select", agent);
}

// 获取状态颜色
function getStatusColor(status: string) {
  return status === "enabled" ? "green" : "red";
}

// 获取状态文本
function getStatusText(status: string) {
  return status === "enabled" ? "启用" : "禁用";
}
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- 搜索框 -->
    <div class="px-4 py-2 border-b border-border bg-card">
      <Input
        v-model:value="searchKeyword"
        placeholder="搜索 Agent..."
        allow-clear
      >
        <template #prefix>
          <IconifyIcon icon="mdi:magnify" class="text-muted-foreground" />
        </template>
      </Input>
    </div>

    <!-- Agent 列表 -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <Spin :spinning="loading">
        <List
          v-if="filteredAgents.length > 0"
          :data-source="filteredAgents"
          :split="false"
          class="agent-list-items"
        >
          <template #renderItem="{ item }">
            <List.Item
              :class="[
                'agent-item cursor-pointer transition-all duration-200',
                selectedId === item.id ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted border-l-4 border-transparent',
              ]"
              @click="handleSelect(item)"
            >
              <div class="flex items-start gap-3 w-full px-4 py-3">
                <Avatar
                  :src="item.avatar"
                  :size="48"
                  class="flex-shrink-0"
                >
                  <template #icon>
                    <div class="flex items-center justify-center w-full h-full">
                      <IconifyIcon icon="mdi:robot" class="text-2xl" />
                    </div>
                  </template>
                </Avatar>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-foreground truncate">
                      {{ item.name }}
                    </span>
                    <Tag :color="getStatusColor(item.status)" size="small">
                      {{ getStatusText(item.status) }}
                    </Tag>
                  </div>

                  <div class="text-xs text-muted-foreground mb-1">
                    编号: {{ item.agentNo }}
                  </div>

                  <div
                    v-if="item.description"
                    class="text-xs text-muted-foreground/70 truncate"
                  >
                    {{ item.description }}
                  </div>

                  <div class="flex items-center gap-2 mt-2">
                    <Tag
                      v-if="item.mode"
                      size="small"
                      class="text-xs"
                    >
                      {{ item.mode }}
                    </Tag>
                    <Tag
                      v-if="item.positionTitle"
                      size="small"
                      class="text-xs"
                    >
                      {{ item.positionTitle }}
                    </Tag>
                  </div>
                </div>
              </div>
            </List.Item>
          </template>
        </List>

        <Empty
          v-else
          description="暂无 Agent"
          class="mt-8"
        />
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.agent-list-items :deep(.ant-list-item) {
  padding: 0;
}

.agent-item:hover {
  background-color: hsl(var(--muted));
}
</style>
