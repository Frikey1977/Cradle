<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { SystemUserApi } from "#/api/system/users";

import { Page, useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";

import { message, Modal } from "ant-design-vue";
import { ref } from "vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import {
  deleteUser,
  getUserList,
  updateUserStatus,
} from "#/api/system/users";
import { $t } from "#/locales";

import { useColumns, useSearchFormSchema } from "./data";
import AssignRolesModal from "./modules/assign-roles.vue";
import ResetPasswordModal from "./modules/reset-password.vue";

const [ResetPasswordModalComponent, resetPasswordModalApi] = useVbenModal({
  connectedComponent: ResetPasswordModal,
  destroyOnClose: true,
});

const [AssignRolesModalComponent, assignRolesModalApi] = useVbenModal({
  connectedComponent: AssignRolesModal,
  destroyOnClose: true,
});

const currentUser = ref<SystemUserApi.User | null>(null);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useSearchFormSchema(),
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: "auto",
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 10,
    },
    proxyConfig: {
      ajax: {
        query: async (params: any) => {
          const page = params.page || 1;
          const pageSize = params.pageSize || 10;
          const formValues = params.formValues || {};
          const result = await getUserList({
            page,
            pageSize,
            keyword: formValues.keyword,
          });
          return {
            items: result.list,
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
    // 表格宽度充满容器
    autoResize: true,
    columnConfig: {
      resizable: true,
    },
  } as VxeTableGridOptions<SystemUserApi.User>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemUserApi.User>) {
  switch (code) {
    case "resetPassword": {
      onResetPassword(row);
      break;
    }
    case "assignRoles": {
      onAssignRoles(row);
      break;
    }
    case "delete": {
      onDelete(row);
      break;
    }
    case "edit": {
      onEditStatus(row);
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

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: 'enabled' | 'disabled',
  row: SystemUserApi.User,
) {
  const status: Record<string, string> = {
    'enabled': $t('common.enabled'),
    'disabled': $t('common.disabled'),
  };
  try {
    await confirm(
      `你要将${row.name}的状态切换为 【${status[newStatus]}】 吗？`,
      `切换状态`,
    );
    await updateUserStatus(row.sid, { status: newStatus });
    return true;
  } catch {
    return false;
  }
}

// 重置密码
function onResetPassword(row: SystemUserApi.User) {
  currentUser.value = row;
  resetPasswordModalApi.setData({ userId: row.sid, username: row.username });
  resetPasswordModalApi.open();
}

// 分配角色
function onAssignRoles(row: SystemUserApi.User) {
  currentUser.value = row;
  assignRolesModalApi.setData({ userId: row.sid, username: row.username });
  assignRolesModalApi.open();
}

// 编辑状态（启用/停用）
async function onEditStatus(row: SystemUserApi.User) {
  const newStatus = row.status === 'enabled' ? 'disabled' : 'enabled';
  const statusText = newStatus === 'enabled' ? $t("common.enabled") : $t("common.disabled");
  try {
    await updateUserStatus(row.sid, { status: newStatus });
    message.success($t("system.users.statusUpdateSuccess", [statusText]));
    onRefresh();
  } catch (error: any) {
    message.error(error.message || $t("ui.actionMessage.operationFailed"));
  }
}

// 删除用户
async function onDelete(row: SystemUserApi.User) {
  try {
    await deleteUser(row.sid);
    message.success($t("ui.actionMessage.deleteSuccess"));
    onRefresh();
  } catch (error: any) {
    message.error(error.message || $t("ui.actionMessage.deleteFailed"));
  }
}

// 处理重置密码成功
function handleResetPasswordSuccess() {
  onRefresh();
}

// 处理分配角色成功
function handleAssignRolesSuccess() {
  onRefresh();
}
</script>

<template>
  <Page auto-content-height>
    <div class="h-full rounded-lg border border-border overflow-hidden bg-background">
      <Grid class="h-full">
        <template #username="{ row }">
          <div class="flex items-center gap-2">
            <IconifyIcon class="size-4 text-blue-500" icon="lucide:user" />
            <span>{{ row.username }}</span>
          </div>
        </template>
        <template #status="{ row }">
          <span
            :class="row.status === 'enabled' ? 'text-green-500' : 'text-red-500'"
          >
            {{ row.status === 'enabled' ? $t("common.enabled") : $t("common.disabled") }}
          </span>
        </template>
      </Grid>
    </div>

    <ResetPasswordModalComponent @success="handleResetPasswordSuccess" />
    <AssignRolesModalComponent @success="handleAssignRolesSuccess" />
  </Page>
</template>
