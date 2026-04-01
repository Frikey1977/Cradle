<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { OrganizationApi } from "#/api/organization/departments";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";

import { Button, message } from "ant-design-vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import { deleteOrg, getOrgTree } from "#/api/organization/departments";
import { $t } from "#/locales";

import { useColumns, loadEmployeeMap } from "./data";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: "auto",
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          // 加载员工数据用于显示负责人名称
          await loadEmployeeMap();
          const rows = await getOrgTree();
          return rows;
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
    treeConfig: {
      parentField: "parentId",
      rowField: "sid",
      transform: false,
      expandAll: true,
    },
    onCellDblclick: ({ row }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<OrganizationApi.Organization>) {
  switch (code) {
    case "append": {
      onAppend(row);
      break;
    }
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

function onRefresh() {
  gridApi.query();
}

function onEdit(row: OrganizationApi.Organization) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onAppend(row: OrganizationApi.Organization) {
  formModalApi.setData({ parentId: row.sid, type: getDefaultChildType(row.type) }).open();
}

function getDefaultChildType(parentType: string): string {
  switch (parentType) {
    case "company":
      return "branch";
    case "branch":
      return "departments";
    case "departments":
      return "group";
    default:
      return "group";
  }
}

function onDelete(row: OrganizationApi.Organization) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteOrg(row.sid)
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
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <div class="h-full rounded-lg border border-border overflow-hidden bg-background">
      <Grid class="h-full">
        <template #toolbar-tools>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t("common.create") }}
          </Button>
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
