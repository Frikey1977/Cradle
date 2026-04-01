import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OrganizationApi } from "#/api/organization/departments";
import type { OrganizationEmployeeApi } from "#/api/organization/employees";

import { z } from "#/adapter/form";
import { getOrgTree } from "#/api/organization/departments";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";
import { h } from "vue";

/**
 * 翻译组织架构树中的 title 字段，并处理显示标签（带图标）
 * @param orgs - 组织架构列表
 * @returns 翻译后的组织架构列表
 */
function translateOrgTree(orgs: OrganizationApi.Organization[]): any[] {
  return orgs.map((org) => ({
    ...org,
    title: org.icon
      ? h("div", { class: "flex items-center gap-2" }, [
          h(IconifyIcon, { icon: org.icon, class: "size-4 flex-shrink-0" }),
          h("span", org.title ? $t(org.title as any) : ""),
        ])
      : org.title
        ? $t(org.title as any)
        : "",
    children: org.children ? translateOrgTree(org.children) : undefined,
  }));
}

/**
 * 获取组织架构树（带翻译）
 */
async function getOrgTreeWithTranslation() {
  const data = await getOrgTree();
  return translateOrgTree(data);
}

/**
 * 获取编辑表单的字段配置
 * @param onOrgChange - 部门变化时的回调函数，用于加载职位列表
 * @param typeOptions - 员工类型选项
 * @param locationOptions - 工作地点选项
 * @param statusOptions - 员工状态选项
 */
export function useSchema(
  onOrgChange?: (oid: string) => Promise<void>,
  typeOptions?: { label: string; value: string }[],
  locationOptions?: { label: string; value: string }[],
  statusOptions?: { label: string; value: string }[],
): VbenFormSchema[] {
  return [
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: getOrgTreeWithTranslation,
        class: "w-full",
        childrenField: "children",
        labelField: "title",
        treeDefaultExpandAll: true,
        valueField: "sid",
      },
      fieldName: "oid",
      label: $t("organization.employees.orgName"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.employees.orgName")])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        disabled: true,
        options: [],
        placeholder: $t("organization.employees.selectOrgFirst"),
      },
      dependencies: {
        // 当 oid 变化时，清空职位并加载新部门的职位列表
        triggerFields: ["oid"],
        trigger: (value, actions) => {
          if (value?.oid) {
            // 清空当前职位
            actions.setFieldValue("positionId", undefined);
            // 调用回调函数加载新部门的职位列表
            if (onOrgChange) {
              onOrgChange(value.oid);
            }
          }
        },
      },
      fieldName: "positionId",
      label: $t("organization.employees.positionName"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.employees.positionName")])),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("organization.employees.name"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("organization.employees.name"), 2]))
        .max(50, $t("ui.formRules.maxLength", [$t("organization.employees.name"), 50])),
    },
    {
      component: "Input",
      fieldName: "employeeNo",
      label: $t("organization.employees.employeeNo"),
      rules: z
        .string()
        .max(50, $t("ui.formRules.maxLength", [$t("organization.employees.employeeNo"), 50]))
        .optional(),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: typeOptions,
        optionType: "button",
      },
      defaultValue: "full-time",
      fieldName: "type",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.employees.type"),
      rules: z.string().optional(),
    },
    {
      component: "Input",
      fieldName: "email",
      label: $t("organization.employees.email"),
      rules: z.string().email($t("ui.formRules.invalidEmail")).optional(),
    },
    {
      component: "Input",
      fieldName: "phone",
      label: $t("organization.employees.phone"),
      rules: z
        .string()
        .max(20, $t("ui.formRules.maxLength", [$t("organization.employees.phone"), 20]))
        .optional(),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: locationOptions,
        optionType: "button",
      },
      fieldName: "location",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.employees.location"),
      rules: z.string().optional(),
    },
    {
      component: "DatePicker",
      componentProps: {
        format: "YYYY-MM-DD",
        style: { width: "100%" },
        valueFormat: "YYYY-MM-DD",
      },
      fieldName: "hireDate",
      label: $t("organization.employees.hireDate"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: statusOptions,
        optionType: "button",
      },
      defaultValue: "active",
      fieldName: "status",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.employees.status"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.employees.status")])),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 500,
        rows: 3,
        showCount: true,
      },
      fieldName: "description",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.employees.description"),
      rules: z
        .string()
        .max(500, $t("ui.formRules.maxLength", [$t("organization.employees.description"), 500]))
        .optional(),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationEmployeeApi.Employee>,
): VxeTableGridOptions<OrganizationEmployeeApi.Employee>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      title: $t("organization.employees.name"),
      width: 120,
    },
    {
      field: "employeeNo",
      title: $t("organization.employees.employeeNo"),
      width: 120,
    },
    {
      align: "left",
      field: "orgTitle",
      slots: { default: "orgTitle" },
      title: $t("organization.employees.orgName"),
      width: 200,
    },
    {
      field: "positionTitle",
      slots: { default: "positionTitle" },
      title: $t("organization.employees.positionName"),
      width: 150,
    },
    {
      align: "center",
      field: "type",
      slots: { default: "type" },
      title: $t("organization.employees.type"),
      width: 100,
    },
    {
      align: "center",
      field: "location",
      slots: { default: "location" },
      title: $t("organization.employees.location"),
      width: 120,
    },
    {
      field: "email",
      title: $t("organization.employees.email"),
      width: 180,
    },
    {
      field: "phone",
      title: $t("organization.employees.phone"),
      width: 130,
    },
    {
      field: "hireDate",
      title: $t("organization.employees.hireDate"),
      width: 120,
    },
    {
      field: "status",
      slots: { default: "status" },
      title: $t("organization.employees.status"),
      width: 100,
    },
    {
      field: "description",
      showOverflow: "tooltip",
      title: $t("organization.employees.description"),
      width: 200,
    },
    {
      field: "createTime",
      title: $t("organization.employees.createTime"),
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
        options: ["edit", "delete"],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      minWidth: 150,
      showOverflow: false,
      title: $t("organization.employees.operation"),
    },
  ];
}
