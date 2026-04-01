<script lang="ts" setup>
import type { LlmProviderApi } from "#/api/llm/providers";
import type { LlmConfigApi } from "#/api/llm/configs";

import { computed, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { $t } from "#/locales";

import { Button, Empty, Tag, Skeleton, message, Popconfirm } from "ant-design-vue";
import { Plus, Settings } from "@vben/icons";

import {
  getAllConfigs,
  deleteConfig,
} from "#/api/llm/configs";

import ConfigForm from "./config-form.vue";

const emit = defineEmits<{
  success: [];
}>();

const providerData = ref<LlmProviderApi.LlmProvider | null>(null);
const loading = ref(false);
const configList = ref<LlmConfigApi.LlmConfig[]>([]);

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<LlmProviderApi.LlmProvider>();
      if (data) {
        providerData.value = data;
        loadConfigs();
      }
    }
  },
});

const [ConfigFormModal, configFormModalApi] = useVbenModal({
  connectedComponent: ConfigForm,
});

async function loadConfigs() {
  if (!providerData.value) return;

  loading.value = true;
  try {
    const result = await getAllConfigs(providerData.value.sid);
    configList.value = result;
  } finally {
    loading.value = false;
  }
}

function onCreateConfig() {
  if (!providerData.value) return;
  configFormModalApi.setData({
    providerId: providerData.value.sid,
    providerName: providerData.value.name,
    config: null,
  }).open();
}

function onEditConfig(config: LlmConfigApi.LlmConfig) {
  if (!providerData.value) return;
  configFormModalApi.setData({
    providerId: providerData.value.sid,
    providerName: providerData.value.name,
    config: config,
  }).open();
}

function onFormSuccess() {
  loadConfigs();
  emit("success");
}

async function onDeleteConfig(config: LlmConfigApi.LlmConfig) {
  try {
    await deleteConfig(config.sid);
    message.success($t("ui.actionMessage.deleteSuccess", [config.name]));
    loadConfigs();
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.deleteFailed"));
  }
}

const getModalTitle = computed(() => {
  return providerData.value
    ? `${providerData.value.ename} - ${$t("llm.configs.moduleName")}`
    : $t("llm.configs.moduleName");
});

const getSubscribeTypeLabel = (subscribeType: string) => {
  const key = `llm.configs.subscribeTypes.${subscribeType}`;
  const translated = $t(key);
  return translated !== key ? translated : subscribeType;
};
</script>

<template>
  <Modal class="w-full max-w-[900px] !max-h-none" :title="getModalTitle">
    <div>
      <!-- 提供商基本信息 -->
      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings class="size-5 text-primary" />
          </div>
          <div>
            <h4 class="font-medium">{{ providerData?.ename }}</h4>
            <p class="text-xs text-gray-500">{{ providerData?.description }}</p>
          </div>
          <Tag :color="providerData?.status === 'enabled' ? 'success' : 'error'" class="ml-auto">
            {{ providerData?.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
          </Tag>
        </div>
      </div>

      <!-- 配置列表头部 -->
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-base">{{ $t("llm.configs.listTitle") }}</h3>
          <p class="text-xs text-gray-500 mt-1">{{ $t("llm.configs.listDescription") }}</p>
        </div>
        <Button type="primary" @click="onCreateConfig">
          <Plus class="size-4 mr-1" />
          {{ $t("llm.configs.create") }}
        </Button>
      </div>

      <!-- 配置列表 -->
      <div>
        <Skeleton active :paragraph="{ rows: 4 }" v-if="loading" />

        <div v-else-if="configList.length > 0" class="space-y-3">
          <div
            v-for="config in configList"
            :key="config.sid"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <span class="text-blue-500 font-bold text-lg">{{ $t('llm.configs.configIcon') }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="font-medium">{{ config.name }}</h4>
                    <Tag :color="config.status === 'enabled' ? 'success' : 'error'" size="small">
                      {{ config.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
                    </Tag>
                    <Tag color="blue" size="small">{{ getSubscribeTypeLabel(config.subscribeType) }}</Tag>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">{{ config.description || $t("llm.configs.noDescription") }}</p>
                  <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{{ $t("llm.configs.modelName") }}: {{ config.modelName }}</span>
                    <span>{{ $t("llm.configs.timeout") }}: {{ config.timeout }}{{ $t('llm.configs.timeoutUnit') }}</span>
                    <span>{{ $t("llm.configs.retries") }}: {{ config.retries }}</span>
                  </div>
                  <div class="mt-1 text-xs text-gray-400 truncate max-w-[400px]">
                    {{ config.baseUrl }}
                  </div>
                </div>
              </div>
              <div class="flex gap-2">
                <Button size="small" @click="onEditConfig(config)">
                  <span class="text-xs">{{ $t("common.edit") }}</span>
                </Button>
                <Popconfirm
                  :title="$t('common.confirmDelete')"
                  :description="$t('ui.actionMessage.deleteConfirm', [config.name])"
                  :ok-text="$t('common.confirm')"
                  :cancel-text="$t('common.cancel')"
                  @confirm="onDeleteConfig(config)"
                >
                  <Button size="small" danger>
                    <span class="text-xs">{{ $t("common.delete") }}</span>
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </div>

        <Empty
          v-else
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          :description="$t('llm.configs.empty')"
          class="py-12"
        >
          <template #description>
            <div class="text-center">
              <p class="text-gray-500 mb-2">{{ $t("llm.configs.emptyDescription") }}</p>
              <p class="text-xs text-gray-400">{{ $t("llm.configs.emptyHint") }}</p>
            </div>
          </template>
          <Button type="primary" @click="onCreateConfig">
            <Plus class="size-4 mr-1" />
            {{ $t("llm.configs.create") }}
          </Button>
        </Empty>
      </div>

      <!-- 底部提示 -->
      <div class="mt-4 p-3 bg-blue-50 rounded-lg">
        <p class="text-xs text-blue-600">
          <span class="font-medium">{{ $t("llm.configs.tipTitle") }}:</span>
          {{ $t("llm.configs.tipContent") }}
        </p>
      </div>
    </div>

    <!-- 嵌套表单弹窗 -->
    <ConfigFormModal @success="onFormSuccess" />
  </Modal>
</template>
