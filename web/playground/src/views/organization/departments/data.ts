import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OrganizationApi } from "#/api/organization/departments";
import type { ChangeEvent } from "ant-design-vue/es/_util/EventInterface";
import { z } from "#/adapter/form";
import { getOrgTree, isOrgCodeExists } from "#/api/organization/departments";
import { getEmployeeList } from "#/api/organization/employees";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";
import { h, type Ref, ref } from "vue";

// 用于存储当前编辑的组织ID
let currentOrgSid: string | undefined;

export function setCurrentOrgSid(sid: string | undefined) {
  currentOrgSid = sid;
}

// 员工列表缓存，用于显示负责人名称
const employeeMap = ref<Map<string, string>>(new Map());

/**
 * 加载所有员工数据到缓存
 */
export async function loadEmployeeMap() {
  try {
    const result = await getEmployeeList({
      status: 'active',
      pageSize: 10000,
    });
    const map = new Map<string, string>();
    result.items.forEach((emp) => {
      map.set(emp.id, emp.name);
    });
    employeeMap.value = map;
  } catch (error) {
    console.error('加载员工数据失败:', error);
  }
}

/**
 * 获取负责人名称
 */
export function getLeaderName(leaderId: string | undefined): string {
  if (!leaderId) return '-';
  return employeeMap.value.get(leaderId) || leaderId;
}

/**
 * 生成翻译键
 * 格式：organization.department.{type}.{code}
 * 处理规则：全小写、去空格
 */
export function generateTitle(type: string, code: string): string {
  if (!type || !code) return "";
  const normalizedType = type.toLowerCase().replace(/\s+/g, "");
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  return `organization.department.${normalizedType}.${normalizedCode}`;
}

export function getOrgTypeOptions() {
  return [
    { color: "error", label: $t("organization.departments.typeCompany"), value: "company" },
    { color: "warning", label: $t("organization.departments.typeBranch"), value: "branch" },
    { color: "processing", label: $t("organization.departments.typeDept"), value: "departments" },
    { color: "success", label: $t("organization.departments.typeGroup"), value: "group" },
  ];
}

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
 * 获取部门下的员工选项
 * @param orgId - 部门ID
 */
async function getEmployeeOptionsByOrg(orgId?: string) {
  if (!orgId) return [];
  const result = await getEmployeeList({
    oid: orgId,
    status: 'active',
    pageSize: 1000,
  });
  return result.items.map((emp) => ({
    label: emp.name,
    value: emp.id,
  }));
}

/**
 * 获取编辑表单的字段配置
 * @param onTitleChange - 当 code 或 type 变化时触发的回调
 * @param titleSuffix - 标题翻译后缀
 * @param currentOrgId - 当前部门ID（用于加载负责人选项）
 * @param employeeOptions - 员工选项列表
 */
/**
 * 获取基本信息表单配置
 * @param onTitleChange - title 变化时的回调函数
 * @param titleSuffix - title 后缀
 * @param currentOrgId - 当前组织ID
 * @param employeeOptions - 员工选项列表
 */
export function useBasicInfoSchema(
  onTitleChange?: (type: string, code: string) => void,
  titleSuffix?: Ref<string | undefined>,
  currentOrgId?: Ref<string | undefined>,
  employeeOptions?: Ref<{ label: string; value: string }[]>,
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
      },
      fieldName: "parentId",
      label: $t("organization.departments.parent"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: getOrgTypeOptions(),
        optionType: "button",
        async onChange(e: any) {
          const newType = e?.target?.value;
          if (onTitleChange && newType) {
            onTitleChange(newType, "");
          }
        },
      },
      defaultValue: "departments",
      fieldName: "type",
      formItemClass: "col-span-2 md:col-span-2",
      label: $t("organization.departments.type"),
      rules: "required",
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("organization.departments.name"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("organization.departments.name"), 2]))
        .max(50, $t("ui.formRules.maxLength", [$t("organization.departments.name"), 50])),
    },
    {
      component: "Input",
      fieldName: "eName",
      label: $t("organization.departments.eName"),
      rules: z
        .string()
        .max(100, $t("ui.formRules.maxLength", [$t("organization.departments.eName"), 100]))
        .optional(),
    },
    {
      component: "Input",
      componentProps: {
        async onChange({ target: { value } }: { target: { value: string } }) {
          if (onTitleChange && value) {
            onTitleChange("", value);
          }
        },
      },
      fieldName: "code",
      label: $t("organization.departments.code"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("organization.departments.code"), 2]))
        .max(50, $t("ui.formRules.maxLength", [$t("organization.departments.code"), 50]))
        .regex(/^[A-Za-z0-9_-]+$/, $t("ui.formRules.invalidFormat"))
        .refine(
          async (value: string) => {
            return !(await isOrgCodeExists(value, currentOrgSid));
          },
          (value: string) => ({
            message: $t("ui.formRules.alreadyExists", [$t("organization.departments.code"), value]),
          }),
        ),
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
      label: $t("organization.departments.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.departments.title"), 200]))
        .optional(),
    },
    {
      component: "IconPicker",
      componentProps: {
        prefix: "carbon",
      },
      fieldName: "icon",
      label: $t("organization.departments.icon"),
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        style: { width: "100%" },
      },
      defaultValue: 0,
      fieldName: "sort",
      label: $t("organization.departments.sort"),
    },
    {
      component: "Select",
      componentProps() {
        return {
          allowClear: true,
          class: "w-full",
          options: employeeOptions?.value || [],
          placeholder: $t("organization.departments.selectLeader"),
        };
      },
      fieldName: "leaderId",
      label: $t("organization.departments.leader"),
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
      label: $t("organization.departments.status"),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 300,
        rows: 3,
        showCount: true,
      },
      fieldName: "description",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.departments.description"),
      rules: z
        .string()
        .max(300, $t("ui.formRules.maxLength", [$t("organization.departments.description"), 300]))
        .optional(),
    },
  ];
}

/**
 * 企业文化描述表单配置（纯文本 textarea，使用 culture 字段）
 */
export function useCultureSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        placeholder: $t("organization.departments.culturePlaceholder"),
        rows: 20,
        class: "w-full",
        maxlength: 600,
        showCount: true,
      },
      fieldName: "culture",
      label: "",
      rules: z.string().max(600, $t("organization.departments.cultureMaxLength")).optional(),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OrganizationApi.Organization>,
): VxeTableGridOptions<OrganizationApi.Organization>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      slots: {
        default: ({ row }: { row: OrganizationApi.Organization }) => {
          // name 列直接显示 name 字段
          return h("div", { class: "flex items-center gap-2" }, [
            row.icon ? h(IconifyIcon, { icon: row.icon, class: "size-4 flex-shrink-0" }) : null,
            h("span", row.name),
          ]);
        },
      },
      title: $t("organization.departments.name"),
      treeNode: true,
      width: 250,
    },
    {
      align: "left",
      field: "title",
      slots: {
        default: ({ row }: { row: OrganizationApi.Organization }) => {
          // 直接输出 key 的翻译结果，不做额外处理
          if (!row.title) {
            return h("span", { class: "text-gray-400" }, "-");
          }
          return h("span", $t(row.title));
        },
      },
      title: $t("organization.departments.title"),
      width: 200,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: getOrgTypeOptions() },
      field: "type",
      title: $t("organization.departments.type"),
      width: 120,
    },
    {
      align: "center",
      field: "code",
      title: $t("organization.departments.code"),
      width: 150,
    },
    {
      align: "center",
      field: "sort",
      title: $t("organization.departments.sort"),
      width: 80,
    },
    {
      field: "leaderId",
      slots: {
        default: ({ row }: { row: OrganizationApi.Organization }) => {
          return h("span", getLeaderName(row.leaderId));
        },
      },
      title: $t("organization.departments.leader"),
      width: 120,
    },
    {
      align: "center",
      field: "status",
      slots: { default: "status" },
      title: $t("organization.departments.status"),
      width: 100,
    },
    {
      field: "description",
      minWidth: 200,
      title: $t("organization.departments.description"),
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
            text: $t("common.create"),
          },
          "edit",
          {
            code: "delete",
            disabled: (row: OrganizationApi.Organization) => {
              return !!(row.children && row.children.length > 0);
            },
          },
        ],
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("organization.departments.operation"),
      width: 220,
    },
  ];
}
