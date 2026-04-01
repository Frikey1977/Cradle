import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OrganizationApi } from "#/api/organization/departments";
import type { OrganizationPositionApi } from "#/api/organization/positions";
import type { ChangeEvent } from "ant-design-vue/es/_util/EventInterface";
import { z } from "#/adapter/form";
import { getOrgTree } from "#/api/organization/departments";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";
import { h, type Ref } from "vue";

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
 * 获取基本信息 Tab 的表单字段配置
 */
export function useBasicSchema(
  statusOptions: { label: string; value: string }[],
  dataScopeOptions: { label: string; value: string; color?: string }[],
  levelOptions: { label: string; value: string }[],
  typeOptions: { label: string; value: string }[],
  onENameChange?: (value: string) => void,
  formApi?: any,
  titleSuffix?: Ref<string | undefined>,
  onTypeChange?: (value: string) => void,
): VbenFormSchema[] {
  return [
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: getOrgTreeWithTranslation,
        class: "w-full",
        labelField: "title",
        valueField: "sid",
        childrenField: "children",
        treeDefaultExpandAll: true,
        async onChange(value: string) {
          if (onENameChange) {
            const formValues = await formApi?.getValues?.();
            if (formValues?.eName) {
              onENameChange(formValues.eName);
            }
          }
        },
      },
      fieldName: "oid",
      label: $t("organization.positions.orgName"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.positions.orgName")])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: levelOptions,
        optionType: "button",
      },
      fieldName: "level",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.positions.level"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.positions.level")])),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("organization.positions.name"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("organization.positions.name"), 2]))
        .max(200, $t("ui.formRules.maxLength", [$t("organization.positions.name"), 200])),
    },
    {
      component: "Input",
      componentProps: {
        async onChange({ target: { value } }: ChangeEvent) {
          if (onENameChange) {
            onENameChange(value);
          }
        },
      },
      fieldName: "eName",
      label: $t("organization.positions.eName"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.positions.eName"), 200]))
        .optional(),
    },
    {
      component: "Input",
      componentProps() {
        return {
          ...(titleSuffix?.value && { addonAfter: titleSuffix.value }),
          onChange({ target: { value } }: ChangeEvent) {
            if (titleSuffix) {
              try {
                titleSuffix.value = value ? $t(value) : undefined;
              } catch {
                titleSuffix.value = undefined;
              }
            }
          },
        };
      },
      fieldName: "title",
      formItemClass: "col-span-2",
      label: $t("organization.positions.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.positions.title"), 200]))
        .optional(),
    },
    {
      component: "Input",
      fieldName: "code",
      label: $t("organization.positions.code"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.positions.code")]))
        .max(100, $t("ui.formRules.maxLength", [$t("organization.positions.code"), 100])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: typeOptions,
        optionType: "button",
        async onChange(e: any) {
          const value = typeof e === 'string' ? e : e?.target?.value;
          if (onTypeChange && value) {
            onTypeChange(value);
          }
        },
      },
      fieldName: "type",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.positions.type"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.positions.type")])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: dataScopeOptions,
        optionType: "button",
      },
      defaultValue: "self",
      fieldName: "dataScope",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.positions.dataScope"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: statusOptions,
        optionType: "button",
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("organization.positions.status"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.positions.status")])),
    },
  ];
}

/**
 * 获取岗位说明 Tab 的表单字段配置
 */
export function useDescriptionSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        maxLength: 1000,
        rows: 10,
        showCount: true,
        class: "w-full",
      },
      fieldName: "description",
      label: "",
      rules: z
        .string()
        .max(1000, $t("ui.formRules.maxLength", [$t("organization.positions.description"), 1000]))
        .optional(),
    },
  ];
}

/**
 * 获取技能管理 Tab 的表单字段配置
 * 仅当岗位类型为 agent 时显示
 */
export function useSkillsSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      fieldName: "skillName",
      label: $t("organization.positions.skills.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.positions.skills.name")])),
    },
    {
      component: "Select",
      componentProps: {
        options: [
          { label: $t("organization.positions.skills.level.basic"), value: "basic" },
          { label: $t("organization.positions.skills.level.intermediate"), value: "intermediate" },
          { label: $t("organization.positions.skills.level.advanced"), value: "advanced" },
          { label: $t("organization.positions.skills.level.expert"), value: "expert" },
        ],
        placeholder: $t("organization.positions.skills.levelPlaceholder"),
      },
      fieldName: "skillLevel",
      label: $t("organization.positions.skills.level"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.positions.skills.level")])),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 500,
        rows: 3,
        showCount: true,
        class: "w-full",
      },
      fieldName: "skillDescription",
      label: $t("organization.positions.skills.description"),
      formItemClass: "col-span-2",
      controlClass: "w-full",
      rules: z
        .string()
        .max(500, $t("ui.formRules.maxLength", [$t("organization.positions.skills.description"), 500]))
        .optional(),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationPositionApi.Position>,
): VxeTableGridOptions<OrganizationPositionApi.Position>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      slots: { default: "name" },
      title: $t("organization.positions.name"),
      width: 150,
    },
    {
      field: "title",
      title: $t("organization.positions.title"),
      width: 200,
      slots: { default: "title" },
    },
    {
      field: "code",
      title: $t("organization.positions.code"),
      width: 150,
    },
    {
      align: "left",
      field: "organization",
      title: $t("organization.positions.orgName"),
      width: 200,
      formatter: ({ row }: { row: OrganizationPositionApi.Position }) => {
        const title = row.organization?.title;
        return title ? $t(title as any) : row.organization?.name || "-";
      },
    },
    {
      field: "level",
      title: $t("organization.positions.level"),
      width: 120,
      slots: { default: "level" },
    },
    {
      field: "dataScope",
      title: $t("organization.positions.dataScope"),
      width: 120,
      slots: { default: "dataScope" },
    },
    {
      align: "center",
      field: "status",
      slots: { default: "status" },
      title: $t("organization.positions.status"),
      width: 100,
    },
    {
      field: "description",
      title: $t("organization.positions.description"),
      minWidth: 200,
      showOverflow: "tooltip",
    },
    {
      field: "createTime",
      title: $t("organization.positions.createTime"),
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
      title: $t("organization.positions.operation"),
    },
  ];
}
