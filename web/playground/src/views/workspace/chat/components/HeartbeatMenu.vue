<script setup lang="ts">
import type { OrganizationAgentApi, HeartbeatLogEntry } from "#/api/organization/agents";

import { ref, computed, watch, h } from "vue";
import { Dropdown, Menu, MenuItem, Tag, message, Button, Modal, Table, Badge } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import { useTimezoneStore } from "@vben/stores";
import {
  getHeartbeatStatus,
  controlHeartbeat,
  getHeartbeatLogs,
} from "#/api/organization/agents";
import HeartbeatSettingsModal from "./HeartbeatSettingsModal.vue";

const timezoneStore = useTimezoneStore();

const props = defineProps<{
  agent: OrganizationAgentApi.Agent | null;
}>();

const emit = defineEmits<{
  openSettings: [];
}>();

const heartbeatStatus = ref<OrganizationAgentApi.HeartbeatStatusResponse | null>(null);
const loading = ref(false);
const settingsModalVisible = ref(false);
const logsModalVisible = ref(false);
const logs = ref<HeartbeatLogEntry[]>([]);
const logsLoading = ref(false);

const isHeartbeatRunning = computed(() => heartbeatStatus.value?.isRunning || false);
const isHeartbeatEnabled = computed(() => heartbeatStatus.value?.enabled || false);

const statusColor = computed(() => {
  if (!isHeartbeatEnabled.value) return "default";
  if (isHeartbeatRunning.value) return "green";
  return "orange";
});

const statusText = computed(() => {
  if (!isHeartbeatEnabled.value) return "已禁用";
  if (isHeartbeatRunning.value) return "运行中";
  return "已停止";
});

const logColumns = computed(() => [
  {
    title: "时间",
    dataIndex: "timestamp",
    key: "timestamp",
    width: 180,
    customRender: ({ text }: { text: string | Date }) => {
      if (!text) return "-";
      const date = new Date(text);
      // 使用用户设置的时区格式化时间
      const timeZone = typeof timezoneStore.timezone === 'string' ? timezoneStore.timezone : "Asia/Shanghai";
      return date.toLocaleString("zh-CN", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  },
  {
    title: "类型",
    dataIndex: "type",
    key: "type",
    width: 100,
    customRender: ({ text }: { text: string }) => {
      const typeMap: Record<string, { color: string; label: string }> = {
        started: { color: "green", label: "启动" },
        stopped: { color: "orange", label: "停止" },
        triggered: { color: "blue", label: "触发" },
        completed: { color: "green", label: "完成" },
        error: { color: "red", label: "错误" },
        skipped: { color: "default", label: "跳过" },
      };
      const config = typeMap[text] || { color: "default", label: text };
      return h(Tag, { color: config.color }, () => config.label);
    },
  },
  {
    title: "结果/错误",
    dataIndex: "result",
    key: "result",
    ellipsis: true,
    customRender: ({ record }: { record: HeartbeatLogEntry }) => {
      if (record.error) return record.error;
      if (record.result) return record.result.substring(0, 100);
      return "-";
    },
  },
  {
    title: "下次执行",
    dataIndex: "nextDueAt",
    key: "nextDueAt",
    width: 180,
    customRender: ({ text }: { text: number | null }) => {
      if (!text || text === 0) return "-";
      const date = new Date(text);
      // 使用用户设置的时区显示
      const timeZone = typeof timezoneStore.timezone === 'string' ? timezoneStore.timezone : "Asia/Shanghai";
      return date.toLocaleString("zh-CN", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  },
]);

watch(
  () => props.agent,
  (agent) => {
    if (agent?.id) {
      loadHeartbeatStatus();
    }
  },
  { immediate: true }
);

async function loadHeartbeatStatus() {
  if (!props.agent?.id) return;

  try {
    const status = await getHeartbeatStatus(props.agent.id);
    heartbeatStatus.value = status;
  } catch (error) {
    console.error("Failed to load heartbeat status:", error);
  }
}

async function handleToggleHeartbeat() {
  if (!props.agent?.id) return;

  console.log(`[HeartbeatMenu] Toggle heartbeat clicked, agentId=${props.agent.id}`);
  loading.value = true;
  try {
    const action = isHeartbeatRunning.value ? "stop" : "start";
    console.log(`[HeartbeatMenu] Sending controlHeartbeat request: agentId=${props.agent.id}, action=${action}`);
    const result = await controlHeartbeat({
      agentId: props.agent.id,
      action,
    });
    console.log(`[HeartbeatMenu] controlHeartbeat response:`, result);
    message.success(action === "start" ? "心跳已启动" : "心跳已停止");
    await loadHeartbeatStatus();
  } catch (error) {
    message.error("操作失败");
    console.error("[HeartbeatMenu] Failed to control heartbeat:", error);
  } finally {
    loading.value = false;
  }
}

async function handleTriggerHeartbeat() {
  if (!props.agent?.id) return;

  loading.value = true;
  try {
    await controlHeartbeat({
      agentId: props.agent.id,
      action: "trigger",
    });
    message.success("心跳已触发");
    setTimeout(() => loadHeartbeatLogs(), 1000);
  } catch (error) {
    message.error("触发失败");
    console.error("Failed to trigger heartbeat:", error);
  } finally {
    loading.value = false;
  }
}

function handleOpenSettings() {
  settingsModalVisible.value = true;
}

function handleSettingsSaved() {
  loadHeartbeatStatus();
}

async function handleViewLogs() {
  logsModalVisible.value = true;
  await loadHeartbeatLogs();
}

async function loadHeartbeatLogs() {
  if (!props.agent?.id) return;

  logsLoading.value = true;
  try {
    const result = await getHeartbeatLogs(props.agent.id, 50);
    console.log("[HeartbeatMenu] Loaded logs:", result.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type,
    })));
    logs.value = result;
  } catch (error) {
    console.error("Failed to load heartbeat logs:", error);
  } finally {
    logsLoading.value = false;
  }
}
</script>

<template>
  <Dropdown :trigger="['click']">
    <Button type="text" size="small">
      <template #icon>
        <IconifyIcon icon="mdi:heart-pulse" />
      </template>
      心跳管理
      <Tag :color="statusColor" size="small" style="margin-left: 8px">
        {{ statusText }}
      </Tag>
    </Button>
    <template #overlay>
      <Menu>
        <MenuItem key="settings" @click="handleOpenSettings">
          <span style="display: flex; align-items: center; white-space: nowrap;">
            <IconifyIcon icon="mdi:cog" style="margin-right: 8px" />
            心跳设置
          </span>
        </MenuItem>
        <MenuItem key="logs" @click="handleViewLogs">
          <span style="display: flex; align-items: center; white-space: nowrap;">
            <IconifyIcon icon="mdi:history" style="margin-right: 8px" />
            心跳日志
          </span>
        </MenuItem>
        <Menu.Divider />
        <MenuItem key="toggle" @click="handleToggleHeartbeat" :disabled="loading">
          <span style="display: flex; align-items: center; white-space: nowrap;">
            <IconifyIcon
              :icon="isHeartbeatRunning ? 'mdi:stop' : 'mdi:play'"
              style="margin-right: 8px"
            />
            {{ isHeartbeatRunning ? "停止心跳" : "启动心跳" }}
          </span>
        </MenuItem>
        <MenuItem
          key="trigger"
          @click="handleTriggerHeartbeat"
          :disabled="loading || !isHeartbeatEnabled"
        >
          <span style="display: flex; align-items: center; white-space: nowrap;">
            <IconifyIcon icon="mdi:lightning-bolt" style="margin-right: 8px" />
            立即触发
          </span>
        </MenuItem>
      </Menu>
    </template>
  </Dropdown>

  <HeartbeatSettingsModal
    v-model:visible="settingsModalVisible"
    :agent="props.agent"
    @saved="handleSettingsSaved"
  />

  <Modal
    v-model:open="logsModalVisible"
    title="心跳日志"
    width="900px"
    :footer="null"
  >
    <Table
      :columns="logColumns"
      :dataSource="logs"
      :loading="logsLoading"
      :pagination="{ pageSize: 10 }"
      rowKey="id"
      size="small"
    />
  </Modal>
</template>
