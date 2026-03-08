<script lang="ts" setup>
import type { LlmInstanceApi } from "#/api/llm/instances";
import type { LlmConfigApi } from "#/api/llm/configs";

import { ref, onMounted, computed } from "vue";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";
import { $t } from "#/locales";

import { Button, Card, Tag, Empty, message, Row, Col, Popconfirm, Select, Progress } from "ant-design-vue";

import {
  deleteInstance,
  getInstanceList,
  BillingTypeOptions,
} from "#/api/llm/instances";
import { getAllConfigs } from "#/api/llm/configs";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import type { SystemCodeApi } from "#/api/system/codes";
import { IconifyIcon } from "@vben/icons";

import Form from "./modules/form.vue";

interface InstanceWithConfig extends LlmInstanceApi.LlmInstance {
  config?: LlmConfigApi.LlmConfig;
}

// 代码配置缓存
const codeConfigMap = ref<Map<string, SystemCodeApi.Code>>(new Map());
// 模型能力代码配置缓存
const modelAbilityMap = ref<Map<string, string>>(new Map());
// 订阅类型代码配置缓存
const subscribeTypeMap = ref<Map<string, string>>(new Map());
// 模型类型代码配置缓存
const modelTypeMap = ref<Map<string, string>>(new Map());

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const instanceList = ref<InstanceWithConfig[]>([]);
const configList = ref<LlmConfigApi.LlmConfig[]>([]);
const loading = ref(false);
const selectedConfigId = ref<string>("");

// 过滤后的实例列表
const filteredInstanceList = computed(() => {
  if (!selectedConfigId.value) {
    return instanceList.value;
  }
  return instanceList.value.filter(
    (instance) => instance.configId === selectedConfigId.value
  );
});

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

// 加载模型能力代码配置
async function loadModelAbilityCodes() {
  try {
    const options = await getCodeOptionsByParentValue("llm.models.ability");
    const map = new Map<string, string>();
    for (const opt of options) {
      if (opt.value) {
        // 优先使用 title 进行翻译，否则使用 label
        const label = opt.title ? $t(opt.title) : opt.label;
        map.set(opt.value, label);
      }
    }
    modelAbilityMap.value = map;
  } catch (error) {
    console.error("加载模型能力代码配置失败:", error);
  }
}

// 加载订阅类型代码配置
async function loadSubscribeTypeCodes() {
  try {
    const options = await getCodeOptionsByParentValue("llm.providers.subscribe");
    const map = new Map<string, string>();
    for (const opt of options) {
      if (opt.value) {
        const label = opt.title ? $t(opt.title) : opt.label;
        map.set(opt.value, label);
      }
    }
    subscribeTypeMap.value = map;
  } catch (error) {
    console.error("加载订阅类型代码配置失败:", error);
  }
}

// 加载模型类型代码配置
async function loadModelTypeCodes() {
  try {
    const options = await getCodeOptionsByParentValue("llm.models.type");
    const map = new Map<string, string>();
    for (const opt of options) {
      if (opt.value) {
        const label = opt.title ? $t(opt.title) : opt.label;
        map.set(opt.value, label);
      }
    }
    modelTypeMap.value = map;
  } catch (error) {
    console.error("加载模型类型代码配置失败:", error);
  }
}

async function loadData() {
  loading.value = true;
  try {
    // 确保代码配置已加载
    if (codeConfigMap.value.size === 0) {
      await loadCodeConfigs();
    }
    // 加载其他代码配置
    if (modelAbilityMap.value.size === 0) {
      await loadModelAbilityCodes();
    }
    if (subscribeTypeMap.value.size === 0) {
      await loadSubscribeTypeCodes();
    }
    if (modelTypeMap.value.size === 0) {
      await loadModelTypeCodes();
    }
    
    // 并行加载实例列表和配置列表
    const [instancesResult, configs] = await Promise.all([
      getInstanceList(),
      getAllConfigs(),
    ]);

    configList.value = configs;

    // 关联配置信息
    instanceList.value = instancesResult.list.map((instance) => {
      const config = configs.find((c) => c.sid === instance.configId);
      return { ...instance, config };
    });
  } finally {
    loading.value = false;
  }
}

function onRefresh() {
  loadData();
}

function onEdit(row: InstanceWithConfig) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

function onDelete(row: InstanceWithConfig) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteInstance(row.sid)
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

function getBillingTypeLabel(type: string): string {
  const option = BillingTypeOptions.find((opt) => opt.value === type);
  return option ? $t(option.label) : type;
}

function getBillingTypeColor(type: string): string {
  const option = BillingTypeOptions.find((opt) => opt.value === type);
  return option?.color || "default";
}

// 获取模型能力的显示标签
function getModelAbilityLabel(ability: string): string {
  return modelAbilityMap.value.get(ability) || ability;
}

// 获取订阅类型的显示标签
function getSubscribeTypeLabel(subscribeType: string): string {
  return subscribeTypeMap.value.get(subscribeType) || subscribeType;
}

// 获取模型类型的显示标签
function getModelTypeLabel(modelType: string): string {
  return modelTypeMap.value.get(modelType) || modelType;
}

function getProviderIcon(providerName: string): string {
  // 优先从代码配置中获取图标
  const codeConfig = codeConfigMap.value.get(providerName);
  if (codeConfig?.icon) {
    return codeConfig.icon;
  }
  // 如果没有代码配置，使用默认图标
  return "carbon:cloud-service-management";
}

function getProviderColor(providerName: string): string {
  // 优先从代码配置中获取颜色
  const codeConfig = codeConfigMap.value.get(providerName);
  if (codeConfig?.color) {
    return codeConfig.color;
  }
  // 如果没有代码配置，使用默认颜色
  return "#666666";
}

function getConfigName(configId: string): string {
  const config = configList.value.find((c) => c.sid === configId);
  return config?.name || configId;
}

function getProviderDisplayName(providerName: string): string {
  // 尝试翻译提供商名称，如果没有翻译则返回原值
  const key = `llm.providers.names.${providerName}`;
  const translated = $t(key);
  // 如果翻译结果与key相同，说明没有对应的翻译，返回原值
  return translated === key ? providerName : translated;
}

function getQuotaPercentage(instance: InstanceWithConfig): number {
  if (!instance.dailyQuota || instance.dailyQuota === 0) return 0;
  return Math.min(100, Math.round((instance.dailyUsed / instance.dailyQuota) * 100));
}

function getQuotaStatus(percentage: number): "success" | "normal" | "exception" {
  if (percentage < 50) return "success";
  if (percentage < 80) return "normal";
  return "exception";
}

function formatNumber(num: number): string {
  // 使用 1024 作为进率（二进制单位）
  if (num >= 1048576) {
    // 1M = 1024 * 1024
    return (num / 1048576).toFixed(1) + "M";
  }
  if (num >= 1024) {
    return (num / 1024).toFixed(1) + "K";
  }
  return num.toString();
}

// 格式化上下文大小，使用 1024 进率
function formatContextSize(num: number): string {
  if (num >= 1048576) {
    return (num / 1048576).toFixed(1) + "M";
  }
  if (num >= 1024) {
    return (num / 1024).toFixed(1) + "K";
  }
  return num.toString();
}

function isInCooldown(instance: InstanceWithConfig): boolean {
  if (!instance.cooldownUntil) return false;
  return new Date(instance.cooldownUntil) > new Date();
}

// 复制 SID 到剪贴板
async function copySid(sid: string) {
  try {
    await navigator.clipboard.writeText(sid);
    message.success($t("llm.instances.sidCopied"));
  } catch (error) {
    message.error($t("llm.instances.sidCopyFailed"));
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />

    <div class="p-4">
      <!-- 头部工具栏 -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold">{{ $t("llm.instances.moduleName") }}</h2>
          <p class="text-sm text-muted-foreground mt-1">{{ $t("llm.instances.moduleDescription") }}</p>
        </div>
        <Button type="primary" @click="onCreate">
          <Plus class="size-4 mr-1" />
          {{ $t("common.create") }}
        </Button>
      </div>

      <!-- 过滤器 -->
      <div class="mb-4 flex items-center gap-4">
        <span class="text-sm text-muted-foreground">{{ $t("llm.instances.filterByConfig") }}:</span>
        <Select
          v-model:value="selectedConfigId"
          style="width: 280px"
          :placeholder="$t('llm.instances.selectConfig')"
          allow-clear
        >
          <Select.Option v-for="config in configList" :key="config.sid" :value="config.sid">
            {{ config.name }}
          </Select.Option>
        </Select>
      </div>

      <!-- 实例卡片列表 -->
      <Row :gutter="[0, 16]">
        <Col v-for="instance in filteredInstanceList" :key="instance.sid" :span="24">
          <Card
            :loading="loading"
            class="instance-card"
            :body-style="{ padding: '20px' }"
            @dblclick="onEdit(instance)"
          >
            <div class="flex flex-col gap-4">
              <!-- 第一行：头部信息 -->
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <!-- 图标 -->
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 overflow-hidden"
                    :class="{ 'bg-muted': isInCooldown(instance) }"
                    :style="isInCooldown(instance) ? {} : { backgroundColor: getProviderIcon(instance.providerName).startsWith('/') ? 'transparent' : getProviderColor(instance.providerName) }"
                  >
                    <img
                      v-if="getProviderIcon(instance.providerName).startsWith('/')"
                      :src="getProviderIcon(instance.providerName)"
                      class="w-full h-full object-contain"
                      :alt="instance.providerName"
                    />
                    <IconifyIcon v-else :icon="getProviderIcon(instance.providerName)" />
                  </div>
                  <!-- 名称和标签 -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 class="font-semibold text-lg truncate">{{ instance.name }}</h3>
                      <Tag :color="instance.status === 'enabled' ? 'success' : 'error'" size="small">
                        {{ instance.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
                      </Tag>
                      <Tag :color="getBillingTypeColor(instance.billingType)" size="small">
                        {{ getBillingTypeLabel(instance.billingType) }}
                      </Tag>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <span class="font-medium text-primary">{{ getProviderDisplayName(instance.providerName) }}</span>
                      <span>|</span>
                      <span class="truncate">{{ getConfigName(instance.configId) }}</span>
                      <span>|</span>
                      <span class="text-xs text-muted-foreground/60 font-mono bg-muted px-1.5 py-0.5 rounded">{{ instance.sid }}</span>
                      <Button
                        type="text"
                        size="small"
                        class="text-xs px-1 h-5 min-w-0"
                        @click="copySid(instance.sid)"
                      >
                        <IconifyIcon icon="carbon:copy" class="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <!-- 配额进度（放在编辑按钮前面） -->
                <div v-if="instance.dailyQuota" class="w-32 flex-shrink-0 mr-4">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-muted-foreground">{{ $t("llm.instances.dailyQuota") }}</span>
                    <span class="text-xs text-muted-foreground/70">{{ formatNumber(instance.dailyUsed) }}/{{ formatNumber(instance.dailyQuota) }}</span>
                  </div>
                  <Progress
                    :percent="getQuotaPercentage(instance)"
                    :status="getQuotaStatus(getQuotaPercentage(instance))"
                    size="small"
                    :show-info="false"
                  />
                </div>
                <!-- 操作按钮 -->
                <div class="flex gap-2 flex-shrink-0">
                  <Button size="small" @click="onEdit(instance)">
                    {{ $t("common.edit") }}
                  </Button>
                  <Popconfirm
                    :title="$t('common.confirmDelete')"
                    :description="$t('ui.actionMessage.deleteConfirm', [instance.name])"
                    :ok-text="$t('common.confirm')"
                    :cancel-text="$t('common.cancel')"
                    @confirm="onDelete(instance)"
                  >
                    <Button danger size="small">
                      {{ $t("common.delete") }}
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <!-- 描述 -->
              <p class="text-sm text-muted-foreground line-clamp-2">
                {{ instance.description || $t("llm.instances.noDescription") }}
              </p>

              <!-- 配置信息 -->
              <div class="bg-muted rounded-lg p-3">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <!-- 模型能力 -->
                  <div class="col-span-2 md:col-span-5">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-muted-foreground">{{ $t("llm.configs.modelAbility") }}:</span>
                      <template v-if="instance.config?.modelAbility && instance.config.modelAbility.length > 0">
                        <Tag v-for="ability in instance.config.modelAbility" :key="ability" size="small" color="purple" class="text-[10px] px-1">
                          {{ getModelAbilityLabel(ability) }}
                        </Tag>
                      </template>
                      <span v-else class="text-xs text-muted-foreground/70">-</span>
                    </div>
                  </div>
                  <!-- 模型类型 -->
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">{{ $t("llm.configs.modelType") }}:</span>
                    <Tag size="small" class="text-[10px] px-1">{{ instance.config?.modelType ? getModelTypeLabel(instance.config.modelType) : '-' }}</Tag>
                  </div>
                  <!-- 订阅类型 -->
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">{{ $t("llm.configs.subscribeType") }}:</span>
                    <Tag size="small" class="text-[10px] px-1">{{ instance.config?.subscribeType ? getSubscribeTypeLabel(instance.config.subscribeType) : '-' }}</Tag>
                  </div>
                  <!-- 认证方式 -->
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">{{ $t("llm.configs.authMethod") }}:</span>
                    <Tag size="small" :color="instance.config?.authMethod === 'api_token' ? 'blue' : 'green'" class="text-[10px] px-1">
                      {{ instance.config?.authMethod === 'api_token' ? 'Token' : 'Key' }}
                    </Tag>
                  </div>
                  <!-- 上下文大小 -->
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">{{ $t("llm.configs.contextSize") }}:</span>
                    <span class="text-xs text-muted-foreground/70">{{ instance.config?.contextSize ? formatContextSize(instance.config.contextSize) : '-' }}</span>
                  </div>
                </div>
              </div>

              <!-- 限制信息和状态信息 -->
              <div class="flex flex-wrap items-center gap-4">
                <!-- 限制信息 -->
                <div class="flex flex-wrap gap-2">
                  <Tag v-if="instance.rpmLimit" size="small" class="text-xs">
                    {{ $t("llm.instances.rpm") }}: {{ instance.rpmLimit }}
                  </Tag>
                  <Tag v-if="instance.tpmLimit" size="small" class="text-xs">
                    {{ $t("llm.instances.tpm") }}: {{ formatNumber(instance.tpmLimit) }}
                  </Tag>
                  <Tag size="small" class="text-xs">
                    {{ $t("llm.instances.weight") }}: {{ instance.weight }}
                  </Tag>
                </div>

                <!-- 状态信息 -->
                <div class="flex flex-wrap gap-4 text-xs text-muted-foreground ml-auto">
                  <span v-if="instance.failCount > 0" class="text-error">{{ $t("llm.instances.failCount") }}: {{ instance.failCount }}</span>
                  <span v-if="isInCooldown(instance)" class="text-warning">{{ $t("llm.instances.cooldownUntil") }}: {{ new Date(instance.cooldownUntil!).toLocaleString() }}</span>
                  <span v-if="instance.lastUsedAt">{{ $t("llm.instances.lastUsedAt") }}: {{ new Date(instance.lastUsedAt).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <!-- 空状态 -->
      <Empty
        v-if="!loading && filteredInstanceList.length === 0"
        :description="$t('llm.instances.empty')"
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
.instance-card {
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
