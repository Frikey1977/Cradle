import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { LlmLogsApi } from "#/api/llm/logs";
import { $t } from "#/locales";

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<LlmLogsApi.LogEntry>,
): VxeTableGridOptions<LlmLogsApi.LogEntry>["columns"] {
  return [
    {
      align: "center",
      field: "type",
      fixed: "left",
      slots: { default: "type" },
      title: $t("llm.logs.type"),
      width: 100,
    },
    {
      align: "left",
      field: "timestamp",
      formatter: ({ cellValue }) => {
        if (!cellValue) return "-";
        const date = new Date(cellValue);
        return date.toLocaleString();
      },
      title: $t("llm.logs.timestamp"),
      width: 180,
    },
    {
      align: "left",
      field: "model",
      slots: { default: "model" },
      title: $t("llm.logs.model"),
      width: 150,
    },
    {
      align: "center",
      field: "provider",
      slots: { default: "provider" },
      title: $t("llm.logs.provider"),
      width: 120,
    },
    {
      align: "center",
      field: "duration",
      slots: { default: "duration" },
      title: $t("llm.logs.duration"),
      width: 100,
    },
    {
      align: "center",
      field: "hasToolCalls",
      slots: { default: "hasToolCalls" },
      title: $t("llm.logs.hasToolCalls"),
      width: 120,
    },
    {
      align: "left",
      field: "contentPreview",
      minWidth: 300,
      slots: { default: "contentPreview" },
      title: $t("llm.logs.contentPreview"),
    },
    {
      align: "right",
      cellRender: {
        attrs: {
          nameField: "timestamp",
          onClick: onActionClick,
        },
        name: "CellOperation",
        options: [
          {
            code: "view",
            text: $t("llm.logs.viewDetail"),
            type: "primary",
          },
        ],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("llm.logs.operation"),
      width: 120,
    },
  ];
}