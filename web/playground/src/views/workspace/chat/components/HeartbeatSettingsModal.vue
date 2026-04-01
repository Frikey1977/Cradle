<script setup lang="ts">
import type { OrganizationAgentApi } from "#/api/organization/agents";

import { ref, watch, computed } from "vue";
import { useVbenModal } from "@vben/common-ui";
import {
  Form,
  FormItem,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  message,
} from "ant-design-vue";
import { $t } from "#/locales";
import {
  getHeartbeatConfig,
  updateHeartbeatConfig,
} from "#/api/organization/agents";

const props = defineProps<{
  visible: boolean;
  agent: OrganizationAgentApi.Agent | null;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  saved: [];
}>();

const formState = ref<OrganizationAgentApi.HeartbeatConfig>({
  enabled: false,
  intervalSeconds: 1800,
  activeHours: {
    start: "09:00",
    end: "18:00",
    timezone: "Asia/Shanghai",
  },
  prompt: "检查当前事项，如有异常请报告",
});

const loading = ref(false);
const saving = ref(false);

async function loadConfig() {
  if (!props.agent?.id) return;

  loading.value = true;
  try {
    const config = await getHeartbeatConfig(props.agent.id);
    if (config) {
      formState.value = {
        enabled: config.enabled ?? false,
        intervalSeconds: config.intervalSeconds ?? 1800,
        activeHours: {
          start: config.activeHours?.start ?? "09:00",
          end: config.activeHours?.end ?? "18:00",
          timezone: config.activeHours?.timezone ?? "Asia/Shanghai",
        },
        prompt: config.prompt ?? "检查当前事项，如有异常请报告",
        customContext: config.customContext,
      };
    }
  } catch (error) {
    console.error("Failed to load heartbeat config:", error);
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!props.agent?.id) return;

  console.log(`[HeartbeatSettings] Saving config: agentId=${props.agent.id}, intervalSeconds=${formState.value.intervalSeconds}`);
  saving.value = true;
  try {
    const result = await updateHeartbeatConfig(props.agent.id, formState.value);
    console.log(`[HeartbeatSettings] Save result:`, result);
    message.success("保存成功");
    emit("saved");
    modalApi.close();
    emit("update:visible", false);
  } catch (error) {
    message.error("保存失败");
    console.error("Failed to save heartbeat config:", error);
  } finally {
    saving.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: true,
  class: 'w-[1080px]',
  animationType: 'slide',
  onCancel() {
    modalApi.close();
    emit("update:visible", false);
  },
  onConfirm: handleSave,
  onOpenChange(isOpen) {
    emit("update:visible", isOpen);
    if (isOpen && props.agent?.id) {
      loadConfig();
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

const timezoneOptions = [
  { value: "Asia/Shanghai", label: "中国标准时间 (Asia/Shanghai)" },
  { value: "Asia/Tokyo", label: "日本标准时间 (Asia/Tokyo)" },
  { value: "America/New_York", label: "美国东部时间 (America/New_York)" },
  { value: "America/Los_Angeles", label: "美国太平洋时间 (America/Los_Angeles)" },
  { value: "Europe/London", label: "英国时间 (Europe/London)" },
  { value: "UTC", label: "协调世界时 (UTC)" },
];

// 将秒数转换为可读的时间字符串
function formatInterval(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟`;
  } else {
    return `${Math.floor(seconds / 3600)}小时`;
  }
}
</script>

<template>
  <Modal title="心跳设置" :confirm-loading="saving">
    <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
      <FormItem label="心跳状态">
        <Switch
          v-model:checked="formState.enabled"
          checked-children="启用"
          un-checked-children="禁用"
        />
      </FormItem>

      <FormItem label="间隔周期">
        <InputNumber
          v-model:value="formState.intervalSeconds"
          :min="10"
          :max="86400"
          :step="10"
          style="width: 100%"
          placeholder="请输入间隔秒数"
        >
          <template #addonAfter>秒 ({{ formatInterval(formState.intervalSeconds) }})</template>
        </InputNumber>
      </FormItem>

      <FormItem label="工作开始时间">
        <Input
          v-model:value="formState.activeHours.start"
          placeholder="HH:mm"
          style="width: 100%"
        />
      </FormItem>

      <FormItem label="工作结束时间">
        <Input
          v-model:value="formState.activeHours.end"
          placeholder="HH:mm"
          style="width: 100%"
        />
      </FormItem>

      <FormItem label="时区">
        <Select
          v-model:value="formState.activeHours.timezone"
          :options="timezoneOptions"
          style="width: 100%"
        />
      </FormItem>

      <FormItem label="用户指令">
        <Input.TextArea
          v-model:value="formState.prompt"
          :rows="4"
          placeholder="心跳触发时发送给Agent的指令..."
          style="width: 100%"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
