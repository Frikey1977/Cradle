import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OrganizationContactApi } from "#/api/organization/contacts";

import { z } from "#/adapter/form";
import { $t } from "#/locales";

import { getContactStatusOptions, getContactTypeOptions } from "./modules/schema";

/**
 * 获取搜索表单配置
 */
export function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        options: getContactTypeOptions(),
        placeholder: $t("ui.placeholder.select"),
      },
      fieldName: "type",
      label: $t("organization.contacts.type"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        options: getContactStatusOptions(),
        placeholder: $t("ui.placeholder.select"),
      },
      fieldName: "status",
      label: $t("organization.contacts.status"),
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.contacts.keywordPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("organization.contacts.keyword"),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationContactApi.Contact>,
): VxeTableGridOptions<OrganizationContactApi.Contact>["columns"] {
  return [
    {
      field: "sourceName",
      fixed: "left",
      title: $t("organization.contacts.sourceName"),
      width: 150,
      formatter: ({ cellValue, row }) => {
        // 只有员工类型显示sourceName
        return row.type === "employee" ? cellValue || "-" : "-";
      },
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: getContactTypeOptions() },
      field: "type",
      title: $t("organization.contacts.type"),
      width: 120,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: getContactStatusOptions() },
      field: "status",
      title: $t("organization.contacts.status"),
      width: 120,
    },
    {
      field: "description",
      showOverflow: "tooltip",
      title: $t("organization.contacts.description"),
      width: 300,
    },
    {
      field: "createTime",
      title: $t("organization.contacts.createTime"),
      width: 180,
    },
    {
      align: "right",
      cellRender: {
        attrs: {
          nameField: "sid",
          onClick: onActionClick,
        },
        name: "CellOperation",
        options: ["edit", "delete"],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      minWidth: 150,
      showOverflow: false,
      title: $t("organization.contacts.operation"),
    },
  ];
}
