import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OrganizationAgentApi } from "#/api/organization/agents";
import type { OrganizationApi } from "#/api/organization/departments";

import { z } from "#/adapter/form";
import { getOrgTree } from "#/api/organization/departments";
import { $t } from "#/locales";
import { h, ref } from "vue";
import { IconifyIcon } from "@vben/icons";

// 组织架构缓存，用于显示部门名称
const orgMap = ref<Map<string, OrganizationApi.Organization>>(new Map());

/**
 * 加载组织架构数据到缓存
 */
export async function loadOrgMap() {
  try {
    const data = await getOrgTree();
    const map = new Map<string, OrganizationApi.Organization>();
    const flattenOrg = (orgs: OrganizationApi.Organization[]) => {
      for (const org of orgs) {
        map.set(org.sid, org);
        if (org.children && org.children.length > 0) {
          flattenOrg(org.children);
        }
      }
    };
    flattenOrg(data);
    orgMap.value = map;
  } catch (error) {
    console.error('加载组织架构数据失败:', error);
  }
}

/**
 * 获取部门显示名称（带翻译，无图标）
 */
export function getOrgDisplayName(oid: string | undefined) {
  if (!oid) return '-';
  const org = orgMap.value.get(oid);
  if (!org) return '-';
  return org.title ? $t(org.title as any) : org.name;
}

/**
 * 服务模式选项
 */
export const serviceModeOptions = [
  { label: $t("organization.agents.serviceModeExclusive"), value: "exclusive" },
  { label: $t("organization.agents.serviceModeShared"), value: "shared" },
  { label: $t("organization.agents.serviceModePublic"), value: "public" },
  { label: $t("organization.agents.serviceModeDepartment"), value: "department" },
];

/**
 * 获取服务模式显示文本
 */
export function getServiceModeLabel(mode: OrganizationAgentApi.ServiceMode): string {
  const option = serviceModeOptions.find((item) => item.value === mode);
  return option?.label || mode;
}

/**
 * 获取编辑表单的字段配置
 */
export function useSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      fieldName: "name",
      label: $t("organization.agents.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.agents.name")]))
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.name"), 200])),
    },
    {
      component: "Input",
      fieldName: "eName",
      label: $t("organization.agents.eName"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.eName"), 200]))
        .optional(),
    },
    {
      component: "Input",
      fieldName: "title",
      label: $t("organization.agents.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.title"), 200]))
        .optional(),
    },
    {
      component: "Input",
      fieldName: "agentNo",
      label: $t("organization.agents.agentNo"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.agents.agentNo")]))
        .max(100, $t("ui.formRules.maxLength", [$t("organization.agents.agentNo"), 100])),
    },
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: getOrgTree,
        class: "w-full",
        childrenField: "children",
        labelField: "name",
        treeDefaultExpandAll: true,
        valueField: "sid",
      },
      fieldName: "oid",
      label: $t("organization.agents.orgName"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.agents.orgName")])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: serviceModeOptions,
        optionType: "button",
      },
      defaultValue: "exclusive",
      fieldName: "mode",
      label: $t("organization.agents.serviceMode"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.agents.serviceMode")])),
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.avatarPlaceholder"),
      },
      fieldName: "avatar",
      label: $t("organization.agents.avatar"),
      rules: z.string().max(500, $t("ui.formRules.maxLength", [$t("organization.agents.avatar"), 500])).optional(),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 1000,
        rows: 3,
        showCount: true,
      },
      fieldName: "description",
      label: $t("organization.agents.description"),
      rules: z.string().max(1000, $t("ui.formRules.maxLength", [$t("organization.agents.description"), 1000])).optional(),
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
      label: $t("organization.agents.status"),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationAgentApi.Agent>,
): VxeTableGridOptions<OrganizationAgentApi.Agent>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      slots: { default: "name" },
      title: $t("organization.agents.name"),
      width: 150,
    },
    {
      field: "eName",
      title: $t("organization.agents.eName"),
      width: 150,
    },
    {
      field: "agentNo",
      title: $t("organization.agents.agentNo"),
      width: 120,
    },
    {
      align: "left",
      field: "oid",
      title: $t("organization.agents.orgName"),
      width: 200,
      slots: {
        default: ({ row }: { row: OrganizationAgentApi.Agent }) => {
          return getOrgDisplayName(row.oid);
        },
      },
    },
    {
      field: "positionTitle",
      slots: { default: "positionTitle" },
      title: $t("organization.agents.positionName"),
      width: 150,
    },
    {
      field: "mode",
      slots: { default: "mode" },
      title: $t("organization.agents.serviceMode"),
      width: 100,
    },
    {
      field: "status",
      slots: { default: "status" },
      title: $t("organization.agents.status"),
      width: 100,
    },
    {
      field: "description",
      showOverflow: "tooltip",
      title: $t("organization.agents.description"),
      width: 200,
    },
    {
      field: "createTime",
      title: $t("organization.agents.createTime"),
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
      title: $t("organization.agents.operation"),
    },
  ];
}
