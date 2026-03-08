<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { SystemCodeApi } from "#/api/system/codes";
import type { TreeProps } from "ant-design-vue";

import { ColPage, useVbenModal } from "@vben/common-ui";
import { IconifyIcon, Plus } from "@vben/icons";

import { Button, message, Tree } from "ant-design-vue";
import { h, onMounted, onUnmounted, ref } from "vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import {
  deleteCode,
  getCodeList,
  getCodeTree,
  getCodeOptionsByParentValue,
} from "#/api/system/codes";
import { $t } from "#/locales";

import { useColumns } from "./data";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const selectedCodeId = ref<string>();
const treeSelectedKeys = ref<string[]>([]);
const codeTreeData = ref<TreeProps['treeData']>([]);
const expandedKeys = ref<string[]>([]);
const colPageRef = ref<{ collapseLeft: () => void; expandLeft: () => void } | null>(null);
// 类型图标映射缓存
const typeIconMap = ref<Map<string, string>>(new Map());

// 监听窗口大小变化，小于200px时自动收起左侧
const LEFT_MIN_PIXELS = 200;
function checkWindowSize() {
  const windowWidth = window.innerWidth;
  const leftWidthPercent = 18; // left-width 百分比
  const leftWidthPixels = (windowWidth * leftWidthPercent) / 100;

  if (leftWidthPixels < LEFT_MIN_PIXELS && colPageRef.value) {
    try {
      colPageRef.value.collapseLeft();
    } catch (error) {
      // 忽略面板未初始化时的错误
    }
  }
}

// 组件挂载时添加监听
onMounted(() => {
  // 延迟检查，确保组件已完全初始化
  setTimeout(checkWindowSize, 100);
  window.addEventListener('resize', checkWindowSize);
});

// 组件卸载时移除监听
onUnmounted(() => {
  window.removeEventListener('resize', checkWindowSize);
});

// 根据节点类型获取对应的图标（从代码管理中配置的图标）
function getIconByType(type?: string): string {
  if (!type) return 'carbon:folder';
  // 优先从类型图标映射中获取
  const icon = typeIconMap.value.get(type);
  if (icon) return icon;
  // 默认图标
  return 'carbon:folder';
}

// 获取节点要显示的图标（优先使用类型配置的图标，其次使用节点自身的图标）
function getNodeIcon(code: SystemCodeApi.Code): string {
  // 优先根据类型获取图标
  const typeIcon = typeIconMap.value.get(code.type || '');
  if (typeIcon) return typeIcon;
  // 如果类型没有配置图标，使用节点自身的图标
  if (code.icon) return code.icon;
  // 默认图标
  return 'carbon:folder';
}

// 加载类型图标映射
async function loadTypeIconMap() {
  const options = await getCodeOptionsByParentValue('system.codes.type');
  const map = new Map<string, string>();
  for (const opt of options) {
    if (opt.value && opt.icon) {
      map.set(opt.value, opt.icon);
    }
  }
  typeIconMap.value = map;
}

// 转换代码数据为树形数据格式
// 过滤掉 value 类型的节点，只显示到 function 类型
function convertToTreeData(codes: SystemCodeApi.Code[]): TreeProps['treeData'] {
  return codes
    .filter((code) => code.type !== 'value') // 过滤掉 value 类型的节点
    .map((code) => ({
      key: code.sid,
      // 使用 title 字段（翻译键）进行翻译显示，并添加图标
      title: h('div', { class: 'flex items-center gap-2' }, [
        h(IconifyIcon, { icon: getNodeIcon(code), class: 'size-4 flex-shrink-0' }),
        h('span', code.title ? $t(code.title) : ''),
      ]),
      sid: code.sid,
      name: code.name,
      type: code.type,
      value: code.value,
      icon: code.icon,
      children: code.children && code.children.length > 0 ? convertToTreeData(code.children) : undefined,
    }));
}

// 加载代码树
async function loadCodeTree() {
  // 先加载类型图标映射
  await loadTypeIconMap();
  const data = await getCodeTree();
  codeTreeData.value = convertToTreeData(data);
  // 将树数据设置到 window，供 form.vue 使用
  (window as any).codeTreeData = codeTreeData.value;
  // 默认展开到 function 类型（不包含 value 类型）
  expandedKeys.value = getExpandableNodeKeys(data);
}

// 获取需要展开的节点key（展开到 function 类型，不包含 value 类型）
function getExpandableNodeKeys(nodes: SystemCodeApi.Code[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    // 如果当前节点不是 value 类型，则加入展开列表
    if (node.type !== 'value') {
      keys.push(node.sid);
      // 如果子节点中有非 value 类型的，继续递归
      if (node.children && node.children.length > 0) {
        const hasNonValueChildren = node.children.some(child => child.type !== 'value');
        if (hasNonValueChildren) {
          keys.push(...getExpandableNodeKeys(node.children));
        }
      }
    }
  }
  return keys;
}

// 初始化加载代码树
loadCodeTree();

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: "auto",
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const params: SystemCodeApi.CodeQuery = {
            page: page?.currentPage,
            pageSize: page?.pageSize,
            ...formValues,
          };
          // 如果选中了树节点，查询该节点下的子项；否则查询根级节点（parentId 为 null）
          params.parentId = selectedCodeId.value || "";
          const result = await getCodeList(params);
          return {
            items: result,
            total: result.length,
          };
        },
      },
    },
    rowConfig: {
      keyField: "sid",
      isHover: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    onCellDblclick: ({ row }: { row: SystemCodeApi.Code }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions<SystemCodeApi.Code>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemCodeApi.Code>) {
  switch (code) {
    case "delete": {
      onDelete(row);
      break;
    }
    case "edit": {
      onEdit(row);
      break;
    }
    default: {
      break;
    }
  }
}

function onCreate() {
  formModalApi.setData({ parentId: selectedCodeId.value }).open();
}

function onEdit(row: SystemCodeApi.Code) {
  formModalApi.setData(row).open();
}

function onDelete(row: SystemCodeApi.Code) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteCode(row.sid)
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

async function onRefresh(codeId?: string | null) {
  if (codeId && codeId !== selectedCodeId.value) {
    // 传入新的 codeId，更新选中状态
    selectedCodeId.value = codeId;
    treeSelectedKeys.value = [codeId];
    expandToNode(codeId);
  } else if (codeId === null) {
    // 显式传入 null 时，清空选中状态
    selectedCodeId.value = undefined;
    treeSelectedKeys.value = [];
  }
  // 如果 codeId 为 undefined，保持当前选中状态不变
  // 刷新左侧树和右侧列表
  await loadCodeTree();
  gridApi.query();
}

// 展开到指定节点
function expandToNode(codeId: string) {
  const findPath = (nodes: any[], targetId: string, path: string[] = []): string[] | null => {
    for (const node of nodes) {
      if (node.key === targetId) {
        return [...path, node.key];
      }
      if (node.children) {
        const result = findPath(node.children, targetId, [...path, node.key]);
        if (result) return result;
      }
    }
    return null;
  };

  const path = findPath(codeTreeData.value || [], codeId);
  if (path) {
    expandedKeys.value = [...new Set([...expandedKeys.value, ...path])];
  }
}

// 处理代码树选择
function onSelectCode(selectedKeys: any[]) {
  const codeId = selectedKeys[0];
  if (!codeId) return;

  treeSelectedKeys.value = [codeId];
  selectedCodeId.value = codeId;
  gridApi.query();
}
</script>

<template>
  <ColPage
    ref="colPageRef"
    auto-content-height
    :left-width="18"
    :right-width="82"
    :left-min-width="10"
    :left-max-width="25"
    :left-collapsible="true"
    :left-collapsed-width="0"
    :resizable="true"
    :split-line="false"
    :split-handle="true"
  >
    <template #left="{ isCollapsed, expand }">
      <div v-if="isCollapsed" class="h-full flex items-center justify-center" @click="expand">
        <Button shape="circle" type="primary">
          <Plus class="size-4" />
        </Button>
      </div>
      <div v-else class="h-full flex flex-col rounded-lg border border-border mr-2 min-w-[200px] overflow-hidden">
        <div class="px-3 py-2 font-semibold text-sm border-b border-border whitespace-nowrap bg-muted">{{ $t('system.codes.treeTitle') }}</div>
        <div class="flex-1 overflow-auto p-2 bg-background scrollbar-theme">
          <Tree
            :tree-data="codeTreeData"
            :expanded-keys="expandedKeys"
            :field-names="{ title: 'title', key: 'key', children: 'children' }"
            :selected-keys="treeSelectedKeys"
            @select="onSelectCode"
            @update:expanded-keys="(keys: any[]) => expandedKeys = keys as string[]"
            block-node
            class="code-tree whitespace-nowrap"
          />
        </div>
      </div>
    </template>

    <FormModal @success="onRefresh" />
    <div class="h-full rounded-lg border border-border overflow-hidden bg-background">
      <Grid class="h-full">
        <template #toolbar-tools>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t("common.create") }}
          </Button>
        </template>
      <template #name="{ row }">
        <div class="flex items-center gap-2">
          <div
            v-if="row.icon"
            class="size-6 rounded flex items-center justify-center overflow-hidden"
            :style="{ backgroundColor: row.color || 'hsl(var(--muted))' }"
          >
            <!-- 本地图片文件 -->
            <img
              v-if="row.icon.endsWith('.png') || row.icon.endsWith('.jpg') || row.icon.endsWith('.jpeg') || row.icon.endsWith('.svg') || row.icon.endsWith('.gif')"
              :src="row.icon.startsWith('/') ? row.icon : '/' + row.icon"
              class="size-4 object-contain"
              :alt="row.name"
            />
            <!-- Iconify 图标 -->
            <IconifyIcon v-else class="size-4" :icon="row.icon" />
          </div>
          <span>{{ row.name }}</span>
        </div>
      </template>
      <template #title="{ row }">
        <span>{{ row.title ? $t(row.title) : '' }}</span>
      </template>
      <template #color="{ row }">
        <div v-if="row.color" class="flex items-center gap-2">
          <div class="w-6 h-6 rounded border border-border" :style="{ backgroundColor: row.color }"></div>
          <span class="text-muted-foreground text-xs">{{ row.color }}</span>
        </div>
        <span v-else class="text-muted-foreground">-</span>
      </template>
      <template #status="{ row }">
        <span :class="row.status === 'enabled' ? 'text-green-600' : 'text-red-600'">
          {{ row.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
        </span>
      </template>
      </Grid>
    </div>
  </ColPage>
</template>

<style scoped>
.code-tree {
  font-size: 14px;
}

/* 滚动条容器背景 */
.scrollbar-theme {
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

.scrollbar-theme::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.scrollbar-theme::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-theme::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

.scrollbar-theme::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}

/* 滚动条角落 */
.scrollbar-theme::-webkit-scrollbar-corner {
  background: hsl(var(--background));
}
</style>
