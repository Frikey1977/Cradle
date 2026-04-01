<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { OrganizationEmployeeApi } from "#/api/organization/employees";
import type { OrganizationApi } from "#/api/organization/departments";
import type { TreeProps } from "ant-design-vue";

import { ColPage, useVbenModal } from "@vben/common-ui";
import { IconifyIcon, Plus } from "@vben/icons";

import { Button, message, Tree } from "ant-design-vue";
import { h, onMounted, onUnmounted, ref } from "vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import {
  deleteEmployee,
  getEmployeeList,
} from "#/api/organization/employees";
import { getOrgTree } from "#/api/organization/departments";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import { $t } from "#/locales";

import { useColumns } from "./data";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const statusOptions = ref<{ label: string; value: string }[]>([]);
const typeOptions = ref<{ label: string; value: string }[]>([]);
const locationOptions = ref<{ label: string; value: string }[]>([]);

async function loadStatusOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.employees.status");
    statusOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.status.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load status options:', error);
  }
}

async function loadTypeOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.employees.type");
    typeOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.type.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load type options:', error);
  }
}

async function loadLocationOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.departments.location");
    locationOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.location.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load location options:', error);
  }
}

onMounted(() => {
  loadStatusOptions();
  loadTypeOptions();
  loadLocationOptions();
});

function getStatusClass(status: string) {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'inactive':
    case 'suspend':
    case 'retired':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

const selectedOrgId = ref<string>();
const treeSelectedKeys = ref<string[]>([]);
const orgTreeData = ref<TreeProps['treeData']>([]);
const expandedKeys = ref<string[]>([]);
const colPageRef = ref<{ collapseLeft: () => void; expandLeft: () => void } | null>(null);

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

// 转换组织数据为树形数据格式
function convertToTreeData(orgs: OrganizationApi.Organization[]): TreeProps['treeData'] {
  return orgs.map((org) => ({
    key: org.sid,
    title: h('div', { class: 'flex items-center gap-2' }, [
      h(IconifyIcon, { icon: org.icon || 'carbon:organization', class: 'size-4 flex-shrink-0' }),
      h('span', $t(org.title)),
    ]),
    sid: org.sid,
    name: org.name,
    icon: org.icon,
    code: org.code,
    type: org.type,
    children: org.children ? convertToTreeData(org.children) : undefined,
  }));
}

// 加载组织树
async function loadOrgTree() {
  const data = await getOrgTree();
  orgTreeData.value = convertToTreeData(data);
  // 默认展开所有节点
  expandedKeys.value = getAllNodeKeys(data);
}

// 获取所有节点key
function getAllNodeKeys(nodes: any[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.sid);
    if (node.children && node.children.length > 0) {
      keys.push(...getAllNodeKeys(node.children));
    }
  }
  return keys;
}

// 初始化加载组织树
loadOrgTree();

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
          const params: any = {
            page: page?.currentPage,
            pageSize: page?.pageSize,
            ...formValues,
          };
          if (selectedOrgId.value) {
            params.oid = selectedOrgId.value;
          }
          const result = await getEmployeeList(params);
          return {
            items: result.items,
            total: result.total,
          };
        },
      },
    },
    rowConfig: {
      keyField: "id",
      isHover: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    onCellDblclick: ({ row }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<OrganizationEmployeeApi.Employee>) {
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
  formModalApi.setData({ oid: selectedOrgId.value }).open();
}

function onEdit(row: OrganizationEmployeeApi.Employee) {
  formModalApi.setData(row).open();
}

function onDelete(row: OrganizationEmployeeApi.Employee) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteEmployee(row.id)
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

function onRefresh(oid?: string) {
  if (oid && oid !== selectedOrgId.value) {
    selectedOrgId.value = oid;
    treeSelectedKeys.value = [oid];
    expandToNode(oid);
  } else if (oid === null || oid === undefined) {
    selectedOrgId.value = undefined;
    treeSelectedKeys.value = [];
  }
  gridApi.query();
}

// 展开到指定节点
function expandToNode(orgId: string) {
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
  
  const path = findPath(orgTreeData.value || [], orgId);
  if (path) {
    expandedKeys.value = [...new Set([...expandedKeys.value, ...path])];
  }
}

// 处理组织树选择
function onSelectOrg(selectedKeys: any[]) {
  const oid = selectedKeys[0];
  if (!oid) return;
  
  treeSelectedKeys.value = [oid];
  selectedOrgId.value = oid;
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
        <div class="px-3 py-2 font-semibold text-sm border-b border-border whitespace-nowrap bg-muted">{{ $t('organization.departments.name') }}</div>
        <div class="flex-1 overflow-auto p-2 bg-background scrollbar-theme">
          <Tree
            :tree-data="orgTreeData"
            :expanded-keys="expandedKeys"
            :selected-keys="treeSelectedKeys"
            @select="onSelectOrg"
            @update:expanded-keys="(keys: any[]) => expandedKeys = keys as string[]"
            block-node
            class="org-tree whitespace-nowrap"
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
      <template #type="{ row }">
        {{ typeOptions.find(opt => opt.value === row.type)?.label || row.type }}
      </template>
      <template #location="{ row }">
        {{ locationOptions.find(opt => opt.value === row.location)?.label || row.location }}
      </template>
      <template #status="{ row }">
        <span :class="getStatusClass(row.status)">
          {{ statusOptions.find(opt => opt.value === row.status)?.label || row.status }}
        </span>
      </template>
      <template #orgTitle="{ row }">
        {{ row.orgTitle ? $t(row.orgTitle) : '' }}
      </template>
      <template #positionTitle="{ row }">
        {{ row.positionTitle ? $t(row.positionTitle) : '' }}
      </template>
      </Grid>
    </div>
  </ColPage>
</template>

<style scoped>
.org-tree {
  font-size: 14px;
}

.org-tree :deep(.ant-tree-treenode) {
  padding: 4px 0;
}

.org-tree :deep(.ant-tree-node-content-wrapper) {
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.org-tree :deep(.ant-tree-node-content-wrapper:hover) {
  background-color: hsl(var(--primary) / 0.1);
}

.org-tree :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected) {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
  font-weight: 500;
}

.org-tree :deep(.ant-tree-switcher) {
  width: 20px;
  height: 20px;
  line-height: 20px;
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
