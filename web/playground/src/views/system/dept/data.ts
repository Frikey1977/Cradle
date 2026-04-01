import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { SystemDeptApi } from "#/api/system/departments";
import { z } from "#/adapter/form";
import { getDeptList } from "#/api/system/departments";
import { $t } from "#/locales";

/**
 * 获取编辑表单的字段配置
 */
export function useSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      fieldName: "name",
      label: $t("system.departments.name"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("system.departments.name"), 2]))
        .max(50, $t("ui.formRules.maxLength", [$t("system.departments.name"), 50])),
    },
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: getDeptList,
        class: "w-full",
        labelField: "name",
        valueField: "id",
        childrenField: "children",
        treeDefaultExpandAll: true,
      },
      fieldName: "pid",
      label: $t("system.departments.parent"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: [
          { label: $t("common.enabled"), value: "enabled" },
          { label: $t("common.disabled"), value: "disabled" },
        ],
        optionType: "button",
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("system.departments.status"),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 200,
        rows: 3,
        showCount: true,
      },
      fieldName: "remark",
      label: $t("system.departments.remark"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("system.departments.remark"), 200]))
        .optional(),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<SystemDeptApi.SystemDept>,
): VxeTableGridOptions<SystemDeptApi.SystemDept>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      title: $t("system.departments.name"),
      treeNode: true,
      width: 250,
    },
    {
      cellRender: { name: "CellTag" },
      field: "status",
      title: $t("system.departments.status"),
      width: 100,
    },
    {
      field: "remark",
      minWidth: 200,
      title: $t("system.departments.remark"),
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
            text: $t("ui.actionTitle.create", [$t("system.departments.name")]),
          },
          "edit",
          {
            code: "delete",
            disabled: (row: SystemDeptApi.SystemDept) => {
              return !!(row.children && row.children.length > 0);
            },
          },
        ],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("system.departments.operation"),
      width: 220,
    },
  ];
}
