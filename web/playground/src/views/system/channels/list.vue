<script lang="ts" setup>
import type { ChannelApi } from "#/api/system/channels";

import { ref, onMounted } from "vue";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";
import { $t } from "#/locales";

import { Button, Card, Tag, Empty, message, Row, Col, Popconfirm } from "ant-design-vue";

import {
  deleteChannel,
  getChannelList,
} from "#/api/system/channels";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import type { SystemCodeApi } from "#/api/system/codes";
import { IconifyIcon } from "@vben/icons";

import Form from "./modules/form.vue";

// 代码配置缓存
const codeConfigMap = ref<Map<string, SystemCodeApi.Code>>(new Map());

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const channelList = ref<ChannelApi.Channel[]>([]);
const loading = ref(false);

// 加载代码配置数据
async function loadCodeConfigs() {
  try {
    const options = await getCodeOptionsByParentValue("system.channels.client");
    const map = new Map<string, SystemCodeApi.Code>();
    for (const opt of options) {
      if (opt.value) {
        map.set(opt.value, opt as unknown as SystemCodeApi.Code);
      }
    }
    codeConfigMap.value = map;
  } catch (error) {
    console.error("加载代码配置失败:", error);
  }
}

async function loadData() {
  loading.value = true;
  try {
    // 确保代码配置已加载
    if (codeConfigMap.value.size === 0) {
      await loadCodeConfigs();
    }
    
    const list = await getChannelList();
    channelList.value = list;
  } finally {
    loading.value = false;
  }
}

function onRefresh() {
  loadData();
}

function onEdit(row: ChannelApi.Channel) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

function onDelete(row: ChannelApi.Channel) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.channelName]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteChannel(row.sid)
    .then(() => {
      message.success({
        content: $t("ui.actionMessage.deleteSuccess", [row.channelName]),
        key: "action_process_msg",
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    active: $t("system.channels.status.active"),
    error: $t("system.channels.status.error"),
    disabled: $t("system.channels.status.disabled"),
  };
  return statusMap[status] || status;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "success";
    case "error":
      return "error";
    case "disabled":
      return "default";
    default:
      return "default";
  }
}

function getChannelIcon(channelName: string): string {
  const code = codeConfigMap.value.get(channelName);
  if (code?.icon) {
    return code.icon;
  }
  // 默认图标
  return "mdi:connection";
}

// 判断是否为本地图片路径
function isLocalImage(icon: string): boolean {
  return icon && (icon.startsWith('/') || icon.startsWith('./') || icon.startsWith('../') || icon.startsWith('http'));
}

function getChannelColor(channelName: string): string {
  const code = codeConfigMap.value.get(channelName);
  if (code?.color) {
    return code.color;
  }
  return "#1890ff";
}

function getChannelDisplayName(channelName: string): string {
  const code = codeConfigMap.value.get(channelName);
  if (code?.title) {
    return $t(code.title);
  }
  return channelName;
}

// 格式化配置显示
function formatConfig(config: Record<string, any>): string {
  if (!config || Object.keys(config).length === 0) {
    return "-";
  }
  const keys = Object.keys(config);
  if (keys.length === 0) return "-";
  return keys.slice(0, 3).join(", ") + (keys.length > 3 ? "..." : "");
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
          <h2 class="text-xl font-semibold">{{ $t("system.channels.moduleName") }}</h2>
          <p class="text-sm text-muted-foreground mt-1">{{ $t("system.channels.moduleDescription") || '管理 IM 通道配置' }}</p>
        </div>
        <Button type="primary" @click="onCreate">
          <Plus class="size-4 mr-1" />
          {{ $t("common.create") }}
        </Button>
      </div>

      <!-- 通道卡片列表 -->
      <Row :gutter="[0, 16]">
        <Col v-for="channel in channelList" :key="channel.sid" :span="24">
          <Card
            :loading="loading"
            class="channel-card"
            :body-style="{ padding: '20px' }"
            @dblclick="onEdit(channel)"
          >
            <div class="flex flex-col gap-4">
              <!-- 第一行：头部信息 -->
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <!-- 图标 -->
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 overflow-hidden"
                    :style="{ backgroundColor: getChannelColor(channel.name) }"
                  >
                    <template v-if="isLocalImage(getChannelIcon(channel.name))">
                      <img
                        :src="getChannelIcon(channel.name)"
                        class="w-full h-full object-cover"
                        alt="channel icon"
                      />
                    </template>
                    <template v-else>
                      <IconifyIcon :icon="getChannelIcon(channel.name)" />
                    </template>
                  </div>
                  <!-- 名称和标签 -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 class="font-semibold text-lg truncate">{{ getChannelDisplayName(channel.name) }}</h3>
                      <Tag :color="getStatusColor(channel.status)" size="small">
                        {{ getStatusLabel(channel.status) }}
                      </Tag>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <span class="font-medium text-primary">{{ channel.name }}</span>
                      <span v-if="channel.description" class="text-muted-foreground truncate max-w-[300px]">{{ channel.description }}</span>
                    </div>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div class="flex gap-2 flex-shrink-0">
                  <Button size="small" @click="onEdit(channel)">
                    {{ $t("common.edit") }}
                  </Button>
                  <Popconfirm
                    :title="$t('common.confirmDelete')"
                    :ok-text="$t('common.confirm')"
                    :cancel-text="$t('common.cancel')"
                    @confirm="onDelete(channel)"
                  >
                    <Button danger size="small">
                      {{ $t("common.delete") }}
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <!-- 配置信息 -->
              <div class="bg-muted/50 rounded-lg p-3">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">{{ $t("system.channels.config") }}:</span>
                    <span class="text-xs text-foreground truncate">{{ formatConfig(channel.config) }}</span>
                  </div>
                  <div v-if="channel.lastError" class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">{{ $t("system.channels.lastError") }}:</span>
                    <span class="text-xs text-red-500 truncate">{{ channel.lastError }}</span>
                  </div>
                  <div v-if="channel.lastConnectedAt" class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">{{ $t("system.channels.lastConnectedAt") }}:</span>
                    <span class="text-xs text-foreground">{{ channel.lastConnectedAt }}</span>
                  </div>
                </div>
              </div>

              <!-- 底部信息 -->
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ $t("system.channels.createTime") }}: {{ channel.createTime }}</span>
                <span>{{ $t("system.channels.updateTime") }}: {{ channel.updateTime }}</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <!-- 空状态 -->
      <div v-if="channelList.length === 0 && !loading" class="py-12">
        <Empty :description="$t('ui.emptyText')" />
      </div>
    </div>
  </Page>
</template>

<style scoped>
.channel-card {
  transition: all 0.3s;
  border: 1px solid hsl(var(--border));
}
.channel-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: hsl(var(--border) / 0.8);
}
</style>
