<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { OrganizationContactApi } from "#/api/organization/contacts";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";

import { Button, message } from "ant-design-vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import {
  deleteContact,
  getContactList,
} from "#/api/organization/contacts";
import { $t } from "#/locales";

import { useColumns, useSearchSchema } from "./data";
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
          const params: any = {
            page: page?.currentPage,
            pageSize: page?.pageSize,
            ...formValues,
          };
          const result = await getContactList(params);
          return {
            items: result.items,
            total: result.total,
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
    onCellDblclick: ({ row }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<OrganizationContactApi.Contact>) {
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
  formModalApi.setData({}).open();
}

function onEdit(row: OrganizationContactApi.Contact) {
  formModalApi.setData(row).open();
}

function onDelete(row: OrganizationContactApi.Contact) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.sid]),
    duration: 0,
    key: "action_process_msg",
  });
  deleteContact(row.sid)
    .then(() => {
      message.success({
        content: $t("ui.actionMessage.deleteSuccess", [row.sid]),
        key: "action_process_msg",
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
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
            {{ $t("ui.actionTitle.create", [$t("organization.contacts.name")]) }}
          </Button>
        </template>
      </Grid>
    </div>
  </Page>
</template>
