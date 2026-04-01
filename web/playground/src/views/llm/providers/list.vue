<script lang="ts" setup>
import type { LlmProviderApi } from "#/api/llm/providers";

import { ref, onMounted } from "vue";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus, Settings, IconifyIcon } from "@vben/icons";
import { $t } from "#/locales";

import { Button, Card, Tag, Empty, message, Row, Col, Popconfirm } from "ant-design-vue";

import {
  deleteProvider,
  getAllProviders,
} from "#/api/llm/providers";
import { getAllConfigs } from "#/api/llm/configs";
import type { LlmConfigApi } from "#/api/llm/configs";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import type { SystemCodeApi } from "#/api/system/codes";

import Form from "./modules/form.vue";
import ProviderConfigs from "./modules/provider-configs.vue";

interface ProviderWithConfigCount extends LlmProviderApi.LlmProvider {
  configCount?: number;
  configs?: LlmConfigApi.LlmConfig[];
}

// 代码配置缓存
const codeConfigMap = ref<Map<string, SystemCodeApi.Code>>(new Map());

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ConfigsModal, configsModalApi] = useVbenModal({
  connectedComponent: ProviderConfigs,
  destroyOnClose: true,
});

const providerList = ref<ProviderWithConfigCount[]>([]);
const loading = ref(false);

// 加载代码配置数据
async function loadCodeConfigs() {
  try {
    const options = await getCodeOptionsByParentValue("llm.providers.directory");
    const map = new Map<string, SystemCodeApi.Code>();
    for (const opt of options) {
      if (opt.value) {
        map.set(opt.value, opt);
      }
    }
    codeConfigMap.value = map;
  } catch (error) {
    console.error("加载代码配置失败:", error);
  }
}

async function loadProviders() {
  loading.value = true;
  try {
    // 确保代码配置已加载
    if (codeConfigMap.value.size === 0) {
      await loadCodeConfigs();
    }
    
    const result = await getAllProviders();
    // 获取每个提供商的配置列表（最多6条）
    const providersWithConfigs = await Promise.all(
      result.map(async (provider) => {
        try {
          const configs = await getAllConfigs(provider.sid);
          return {
            ...provider,
            configCount: configs.length,
            configs: configs.slice(0, 6), // 只取前6条
          };
        } catch {
          return { ...provider, configCount: 0, configs: [] };
        }
      })
    );
    providerList.value = providersWithConfigs;
  } finally {
    loading.value = false;
  }
}

function onRefresh() {
  loadProviders();
}

function onEdit(row: ProviderWithConfigCount) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onManageConfigs(row: ProviderWithConfigCount) {
  configsModalApi.setData(row).open();
}

function onDelete(row: ProviderWithConfigCount) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteProvider(row.sid)
    .then(() => {
      message.success({
        content: $t("ui.actionMessage.deleteSuccess", [row.name]),
        key: "action_process_msg",
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function getProviderIcon(provider: ProviderWithConfigCount): string {
  // 优先从代码配置中获取图标
  const codeConfig = codeConfigMap.value.get(provider.name);
  if (codeConfig?.icon) {
    return codeConfig.icon;
  }
  // 如果没有代码配置，使用默认图标
  return "carbon:cloud-service-management";
}

function getProviderColor(provider: ProviderWithConfigCount): string {
  // 优先从代码配置中获取颜色
  const codeConfig = codeConfigMap.value.get(provider.name);
  if (codeConfig?.color) {
    return codeConfig.color;
  }
  // 如果没有代码配置，使用默认颜色
  return "#666666";
}

onMounted(() => {
  loadProviders();
});
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <ConfigsModal @success="onRefresh" />
    
    <div class="p-4">
      <!-- 头部工具栏 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold">{{ $t("llm.providers.moduleName") }}</h2>
          <p class="text-sm text-muted-foreground mt-1">{{ $t("llm.providers.moduleDiscription") }}</p>
        </div>
        <Button type="primary" @click="onCreate">
          <Plus class="size-4 mr-1" />
          {{ $t("common.create") }}
        </Button>
      </div>

      <!-- 提供商卡片列表 -->
      <Row :gutter="[24, 24]">
        <Col v-for="provider in providerList" :key="provider.sid" :xs="24" :sm="12" :lg="8">
          <Card 
            :loading="loading"
            class="provider-card h-full"
            :body-style="{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }"
            @dblclick="onEdit(provider)"
          >
            <div class="flex flex-col h-full flex-1">
              <!-- 头部：图标和名称 -->
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-start gap-3">
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 overflow-hidden"
                    :style="{ backgroundColor: getProviderIcon(provider).startsWith('/') ? 'transparent' : getProviderColor(provider) }"
                  >
                    <img
                      v-if="getProviderIcon(provider).startsWith('/')"
                      :src="getProviderIcon(provider)"
                      class="w-full h-full object-contain"
                      :alt="provider.name"
                    />
                    <IconifyIcon v-else :icon="getProviderIcon(provider)" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-semibold text-lg">{{ provider.ename }}</h3>
                      <Tag :color="provider.status === 'enabled' ? 'success' : 'error'" size="small">
                        {{ provider.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
                      </Tag>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ provider.name }}</p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <Button
                    size="small"
                    @click="onEdit(provider)"
                  >
                    {{ $t("common.edit") }}
                  </Button>
                </div>
              </div>

              <!-- 描述 -->
              <p class="text-sm text-muted-foreground mb-3 h-[20px] line-clamp-2">
                {{ provider.description || $t("llm.providers.noDescription") }}
              </p>

              <!-- 分隔线 -->
              <div class="border-t border-border my-2"></div>

              <!-- 配置列表区 -->
              <div class="mb-3 flex-1 min-h-0">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium text-muted-foreground">{{ $t("llm.providers.modelConfigs") }}</span>
                  <Tag size="small" :color="provider.configCount && provider.configCount > 0 ? 'blue' : 'default'" class="text-xs">
                    {{ provider.configCount || 0 }}{{ $t("llm.providers.configCount") }}
                  </Tag>
                </div>
                <Empty
                  v-if="!provider.configCount"
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                  :description="$t('llm.providers.noConfigs')"
                  class="py-2"
                />
                <div v-else class="space-y-1.5">
                  <div
                    v-for="config in provider.configs"
                    :key="config.sid"
                    class="flex items-center justify-between py-1.5 px-2 bg-muted rounded text-xs"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-medium text-muted-foreground truncate max-w-[120px]">{{ config.name }}</span>
                      <Tag :color="config.status === 'enabled' ? 'success' : 'default'" size="small" class="text-[10px] px-1">
                        {{ config.status === 'enabled' ? $t("llm.providers.statusEnabled") : $t("llm.providers.statusDisabled") }}
                      </Tag>
                    </div>
                    <span class="text-muted-foreground/70 truncate max-w-[100px]">{{ config.modelName }}</span>
                  </div>
                  <div v-if="(provider.configCount || 0) > 6" class="text-xs text-muted-foreground text-center py-1">
                    {{ $t("llm.providers.moreConfigs", [String(provider.configCount! - 6)]) }}
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex gap-2 mt-auto">
                <Button
                  type="primary"
                  ghost
                  size="small"
                  class="flex-1"
                  @click="onManageConfigs(provider)"
                >
                  <Settings class="size-3.5 mr-1" />
                  {{ $t("llm.providers.configManage") }}
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <!-- 空状态 -->
      <Empty 
        v-if="!loading && providerList.length === 0" 
        :description="$t('llm.providers.empty')"
        class="py-20"
      >
        <Button type="primary" @click="onCreate">
          <Plus class="size-4 mr-1" />
          {{ $t("common.create") }}
        </Button>
      </Empty>
    </div>
  </Page>
</template>

<style lang="scss" scoped>
.provider-card {
  transition: all 0.3s ease;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
    border-color: hsl(var(--border) / 0.8);
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
