<script lang="ts" setup>
import type { OnActionClickParams, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { DealApi } from "#/api/customer/deals";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";

import { Button, message } from "ant-design-vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import { deleteDeal, getDealList } from "#/api/customer/deals";
import { $t } from "#/locales";

import { useColumns, useSearchSchema, loadEmployeeMap } from "./data";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useSearchSchema(),
  },
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
          await loadEmployeeMap();
          return await getDealList({
            page: page?.currentPage || 1,
            pageSize: page?.pageSize || 20,
            ...formValues,
          });
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
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<DealApi.Deal>) {
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

function onRefresh() {
  gridApi.query();
}

function onEdit(row: DealApi.Deal) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onDelete(row: DealApi.Deal) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteDeal(row.sid)
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
      </Grid>
    </div>
  </Page>
</template>
