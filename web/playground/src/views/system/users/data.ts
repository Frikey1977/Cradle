import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { SystemUserApi } from "#/api/system/users";
import type { VbenFormSchema } from "@vben/common-ui";
import { $t } from "#/locales";
import { z } from "@vben/common-ui";

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<SystemUserApi.User>,
  onStatusChange?: (newStatus: any, row: SystemUserApi.User) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions<SystemUserApi.User>["columns"] {
  return [
    {
      align: "left",
      field: "username",
      fixed: "left",
      slots: { default: "username" },
      title: $t("system.users.username"),
      width: 150,
    },
    {
      align: "left",
      field: "name",
      title: $t("system.users.name"),
      width: 120,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: "status",
      title: $t("system.users.status"),
      width: 100,
    },
    {
      align: "left",
      field: "employeeNo",
      title: $t("system.users.employeeNo"),
      width: 120,
    },
    {
      align: "left",
      field: "departmentsName",
      minWidth: 150,
      title: $t("system.users.departmentsName"),
    },
    {
      align: "left",
      field: "positionName",
      title: $t("system.users.positionName"),
      width: 150,
    },
    {
      align: "left",
      field: "lastLoginTime",
      formatter: ({ cellValue }) => {
        return cellValue ? cellValue : "-";
      },
      title: $t("system.users.lastLoginTime"),
      width: 180,
    },
    {
      align: "left",
      field: "createTime",
      title: $t("system.users.createTime"),
      width: 180,
    },
    {
      align: "right",
      cellRender: {
        attrs: {
          nameField: "name",
          onClick: onActionClick,
        },
        name: "CellOperation",
        options: [
          {
            code: "resetPassword",
            text: $t("system.users.resetPassword"),
          },
          {
            code: "assignRoles",
            text: $t("system.users.assignRoles"),
          },
          "edit",
          "delete",
        ],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("system.users.operation"),
      width: 280,
    },
  ];
}

/**
 * 获取搜索表单配置
 */
export function useSearchFormSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        allowClear: true,
        placeholder: $t("system.users.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("system.users.keyword"),
    },
  ];
}

/**
 * 获取重置密码表单配置
 */
export function useResetPasswordSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        placeholder: $t("system.users.newPasswordPlaceholder"),
        type: "password",
      },
      fieldName: "newPassword",
      label: $t("system.users.newPassword"),
      rules: z
        .string()
        .min(6, $t("ui.formRules.minLength", [$t("system.users.newPassword"), 6]))
        .max(50, $t("ui.formRules.maxLength", [$t("system.users.newPassword"), 50])),
    },
  ];
}
