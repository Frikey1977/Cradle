import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { LlmProviderApi } from "#/api/llm/providers";
import { $t } from "#/locales";

export function getStatusOptions() {
  return [
    { color: "success", label: $t("common.enabled"), value: "enabled" },
    { color: "error", label: $t("common.disabled"), value: "disabled" },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<LlmProviderApi.LlmProvider>,
): VxeTableGridOptions<LlmProviderApi.LlmProvider>["columns"] {
  return [
    {
      align: "center",
      field: "name",
      fixed: "left",
      title: $t("llm.providers.name"),
      width: 150,
    },
    {
      align: "center",
      field: "ename",
      title: $t("llm.providers.ename"),
      width: 180,
    },
    {
      align: "center",
      field: "title",
      formatter: ({ row }) => {
        return row.title ? $t(row.title) : "";
      },
      title: $t("llm.providers.title"),
      width: 200,
    },
    {
      align: "left",
      field: "description",
      minWidth: 200,
      showOverflow: true,
      title: $t("llm.providers.description"),
    },
    {
      align: "center",
      field: "sort",
      title: $t("llm.providers.sort"),
      width: 80,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: getStatusOptions() },
      field: "status",
      title: $t("llm.providers.status"),
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
        options: ["edit", "delete"],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("llm.providers.operation"),
      width: 150,
    },
  ];
}
