<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { SystemDeptApi } from "#/api/system/departments";

import { Page, useVbenDrawer } from "@vben/common-ui";
import { Plus } from "@vben/icons";

import { Button, message } from "ant-design-vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import { deleteDept, getDeptList } from "#/api/system/departments";
import { $t } from "#/locales";

import { useColumns } from "./data";
import Form from "./modules/form.vue";

const [FormDrawer, formDrawerApi] = useVbenDrawer({
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
          const rows = await getDeptList();
          return rows;
        },
      },
    },
    rowConfig: {
      keyField: "id",
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: "pid",
      rowField: "id",
      transform: false,
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemDeptApi.SystemDept>) {
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

function onEdit(row: SystemDeptApi.SystemDept) {
  formDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

function onAppend(row: SystemDeptApi.SystemDept) {
  formDrawerApi.setData({ pid: row.id }).open();
}

function onDelete(row: SystemDeptApi.SystemDept) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteDept(row.id)
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
    <FormDrawer @success="onRefresh" />
    <Grid>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t("ui.actionTitle.create", [$t("system.departments.name")]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
