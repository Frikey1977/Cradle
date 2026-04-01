<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t, $te } from "#/locales";

import { MenuBadge } from '@vben-core/menu-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteModule, getModuleChildren, getModuleList, SystemModuleApi } from '#/api/system/modules';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params) => {
          const rows = await getModuleList();
          // 数据加载后，只展开非 action 类型的行
          setTimeout(() => {
            expandNonActionRows(rows);
          }, 0);
          return rows;
        },
      },
    },
    rowConfig: {
      keyField: 'sid',
      isHover: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      rowField: 'sid',
      transform: false,
    },
    onCellDblclick: ({ row }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemModuleApi.SystemModule>) {
  switch (code) {
    case 'append': {
      onAppend(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    default: {
      break;
    }
  }
}

function onRefresh() {
  gridApi.query();
}

// 展开非 action 类型的行（展开到 function 级别，不展开 action）
function expandNonActionRows(rows: SystemModuleApi.SystemModule[]) {
  for (const row of rows) {
    if (row.children && row.children.length > 0) {
      // 检查子节点是否包含非 action 类型
      const hasNonActionChild = row.children.some(child => child.type !== 'action');
      // 如果子节点包含非 action 类型，则展开当前行
      if (hasNonActionChild) {
        gridApi.grid?.setTreeExpand(row, true);
      }
      // 递归处理子节点
      expandNonActionRows(row.children);
    }
  }
}
function onEdit(row: SystemModuleApi.SystemModule) {
  formModalApi.setData(row).open();
}
function onCreate() {
  formModalApi.setData({}).open();
}
function onAppend(row: SystemModuleApi.SystemModule) {
  formModalApi.setData({ pid: row.sid }).open();
}

function onDelete(row: SystemModuleApi.SystemModule) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteModule(row.sid)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <div class="h-full rounded-lg border border-border overflow-hidden bg-background">
      <Grid class="h-full">
        <template #toolbar-tools>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
          {{ $t('common.create') }}
        </Button>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-1">
          <div class="size-5 flex-shrink-0">
            <IconifyIcon
              v-if="row.type === 'action'"
              icon="carbon:security"
              class="size-full"
            />
            <IconifyIcon
              v-else-if="row.icon"
              :icon="row.icon || 'carbon:circle-dash'"
              class="size-full"
            />
          </div>
          <span class="flex-auto">{{ $t(row.title || row.name) }}</span>
          <div class="items-center justify-end"></div>
        </div>
        <MenuBadge
          v-if="row.meta?.badgeType"
          class="menu-badge"
          :badge="row.meta.badge"
          :badge-type="row.meta.badgeType"
          :badge-variants="row.meta.badgeVariants"
        />
      </template>
      <template #status="{ row }">
        <span :class="row.status === 'enabled' ? 'text-green-600' : 'text-red-600'">
          {{ row.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
        </span>
      </template>
      </Grid>
    </div>
  </Page>
</template>
<style lang="scss" scoped>
.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  & > :deep(div) {
    padding-top: 0;
    padding-bottom: 0;
  }
}
</style>
