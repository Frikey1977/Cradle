import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { SystemModuleApi } from "#/api/system/modules";
import { $t } from "#/locales";

export function getModuleTypeOptions() {
  return [
    {
      color: "processing",
      label: $t("system.modules.typeModule"),
      value: "module",
    },
    { color: "default", label: $t("system.modules.typeFunction"), value: "function" },
    { color: "error", label: $t("system.modules.typeAction"), value: "action" },
    {
      color: "success",
      label: $t("system.modules.typeEmbedded"),
      value: "embedded",
    },
    { color: "warning", label: $t("system.modules.typeLink"), value: "link" },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<SystemModuleApi.SystemModule>,
): VxeTableGridOptions<SystemModuleApi.SystemModule>["columns"] {
  return [
    {
      align: "left",
      field: "title",
      fixed: "left",
      slots: { default: "title" },
      title: $t("system.modules.menuTitle"),
      treeNode: true,
      width: 250,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: getModuleTypeOptions() },
      field: "type",
      title: $t("system.modules.type"),
      width: 100,
    },
    {
      align: "center",
      field: "sort",
      title: $t("system.modules.sort"),
      width: 80,
    },
    {
      field: "auth_code",
      title: $t("system.modules.authCode"),
      width: 200,
    },
    {
      align: "left",
      field: "path",
      title: $t("system.modules.path"),
      width: 200,
    },

    {
      align: "left",
      field: "component",
      formatter: ({ row }) => {
        switch (row.type) {
          case "module":
          case "function": {
            return row.component ?? "";
          }
          case "embedded": {
            return (row as any).iframeSrc ?? "";
          }
          case "link": {
            return (row as any).link ?? "";
          }
        }
        return "";
      },
      minWidth: 200,
      title: $t("system.modules.component"),
    },
    {
      align: "center",
      field: "status",
      slots: { default: "status" },
      title: $t("system.modules.status"),
      width: 100,
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
            code: "append",
            text:  $t("system.modules.createChild"),
          },
          "edit",
          "delete",
        ],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("system.modules.operation"),
      width: 200,
    },
  ];
}
