import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { OpportunityApi } from "#/api/customer/opportunities";
import { z } from "#/adapter/form";
import { $t } from "#/locales";
import { getEmployeeList } from "#/api/organization/employees";
import { getAllCustomers } from "#/api/customer/customers";
import { type Ref, ref } from "vue";

// 员工列表缓存
const employeeMap = ref<Map<string, string>>(new Map());

/**
 * 加载所有员工数据到缓存
 */
export async function loadEmployeeMap() {
  try {
    const result = await getEmployeeList({
      status: "active",
      pageSize: 10000,
    });
    const map = new Map<string, string>();
    result.items.forEach((emp) => {
      map.set(emp.id, emp.name);
    });
    employeeMap.value = map;
  } catch (error) {
    console.error("加载员工数据失败:", error);
  }
}

/**
 * 获取负责人名称
 */
export function getOwnerName(ownerId: string | undefined): string {
  if (!ownerId) return "-";
  return employeeMap.value.get(ownerId) || ownerId;
}

/**
 * 获取商机阶段选项
 */
export function getStageOptions() {
  return [
    { color: "default", label: $t("customer.opportunities.stageInitial"), value: "initial" },
    { color: "processing", label: $t("customer.opportunities.stageNeeds"), value: "needs" },
    { color: "warning", label: $t("customer.opportunities.stageProposal"), value: "proposal" },
    { color: "purple", label: $t("customer.opportunities.stageNegotiation"), value: "negotiation" },
    { color: "success", label: $t("customer.opportunities.stageWon"), value: "won" },
    { color: "error", label: $t("customer.opportunities.stageLost"), value: "lost" },
  ];
}

/**
 * 获取商机来源选项
 */
export function getSourceOptions() {
  return [
    { label: $t("customer.opportunities.sourcePhone"), value: "phone" },
    { label: $t("customer.opportunities.sourceEmail"), value: "email" },
    { label: $t("customer.opportunities.sourceExhibition"), value: "exhibition" },
    { label: $t("customer.opportunities.sourceReferral"), value: "referral" },
    { label: $t("customer.opportunities.sourceWebsite"), value: "website" },
    { label: $t("customer.opportunities.sourceSocial"), value: "social" },
    { label: $t("customer.opportunities.sourcePartner"), value: "partner" },
    { label: $t("customer.opportunities.sourceOther"), value: "other" },
  ];
}

/**
 * 获取客户选项
 */
export async function getCustomerOptions() {
  try {
    const result = await getAllCustomers({ status: "enabled" });
    return result.map((customer) => ({
      label: `${customer.name} (${customer.customerNo})`,
      value: customer.sid,
    }));
  } catch {
    return [];
  }
}

/**
 * 获取员工选项
 */
export async function getEmployeeOptions() {
  try {
    const result = await getEmployeeList({
      status: "active",
      pageSize: 1000,
    });
    return result.items.map((emp) => ({
      label: emp.name,
      value: emp.id,
    }));
  } catch {
    return [];
  }
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<OpportunityApi.Opportunity>
): VxeTableGridOptions["columns"] {
  return [
    {
      field: "opportunityNo",
      title: $t("customer.opportunities.opportunityNo"),
      width: 150,
    },
    {
      field: "name",
      title: $t("customer.opportunities.name"),
      minWidth: 200,
    },
    {
      field: "customerName",
      title: $t("customer.opportunities.customer"),
      width: 180,
    },
    {
      field: "stage",
      title: $t("customer.opportunities.stage"),
      width: 120,
      cellRender: {
        name: "CellTag",
        options: getStageOptions(),
      },
    },
    {
      field: "probability",
      title: $t("customer.opportunities.probability"),
      width: 100,
      formatter: ({ cellValue }: { cellValue: number }) => `${cellValue}%`,
    },
    {
      field: "amount",
      title: $t("customer.opportunities.amount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "expectedAmount",
      title: $t("customer.opportunities.expectedAmount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "expectedCloseDate",
      title: $t("customer.opportunities.expectedCloseDate"),
      width: 120,
    },
    {
      field: "ownerName",
      title: $t("customer.opportunities.owner"),
      width: 120,
    },
    {
      field: "status",
      title: $t("customer.opportunities.status"),
      width: 100,
      cellRender: {
        name: "CellTag",
        options: [
          { color: "processing", label: $t("customer.opportunities.statusOpen"), value: "open" },
          { color: "default", label: $t("customer.opportunities.statusClosed"), value: "closed" },
        ],
      },
    },
    {
      field: "createTime",
      title: $t("customer.opportunities.createTime"),
      width: 180,
    },
    {
      field: "operation",
      title: $t("customer.opportunities.operation"),
      width: 150,
      fixed: "right",
      cellRender: {
        name: "CellOperation",
        options: ["edit", "delete"],
        onClick: onActionClick,
      },
    },
  ];
}

/**
 * 获取搜索表单配置
 */
export function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        placeholder: $t("customer.opportunities.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("common.keyword"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getStageOptions(),
        placeholder: $t("customer.opportunities.stagePlaceholder"),
      },
      fieldName: "stage",
      label: $t("customer.opportunities.stage"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getSourceOptions(),
        placeholder: $t("customer.opportunities.sourcePlaceholder"),
      },
      fieldName: "source",
      label: $t("customer.opportunities.source"),
    },
  ];
}

/**
 * 获取表单配置
 */
export function useFormSchema(
  customerOptions?: Ref<{ label: string; value: string }[]>,
  employeeOptions?: Ref<{ label: string; value: string }[]>
): VbenFormSchema[] {
  return [
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: customerOptions?.value || [],
        placeholder: $t("customer.opportunities.customerPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) => {
          return option.label.toLowerCase().includes(input.toLowerCase());
        },
      },
      fieldName: "customerId",
      label: $t("customer.opportunities.customer"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("customer.opportunities.customer")])),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("customer.opportunities.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("customer.opportunities.name")]))
        .max(200, $t("ui.formRules.maxLength", [$t("customer.opportunities.name"), 200])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getSourceOptions(),
        placeholder: $t("customer.opportunities.sourcePlaceholder"),
      },
      fieldName: "source",
      label: $t("customer.opportunities.source"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: getStageOptions(),
      },
      defaultValue: "initial",
      fieldName: "stage",
      label: $t("customer.opportunities.stage"),
      rules: "required",
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        max: 100,
        addonAfter: "%",
      },
      defaultValue: 10,
      fieldName: "probability",
      label: $t("customer.opportunities.probability"),
      rules: "required",
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        precision: 2,
        formatter: (value: number) => (value ? `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""),
        parser: (value: string) => value.replace(/[¥\s,]/g, ""),
      },
      defaultValue: 0,
      fieldName: "amount",
      label: $t("customer.opportunities.amount"),
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD",
        placeholder: $t("customer.opportunities.expectedCloseDatePlaceholder"),
      },
      fieldName: "expectedCloseDate",
      label: $t("customer.opportunities.expectedCloseDate"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: employeeOptions?.value || [],
        placeholder: $t("customer.opportunities.ownerPlaceholder"),
      },
      fieldName: "ownerId",
      label: $t("customer.opportunities.owner"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 4,
      },
      fieldName: "description",
      label: $t("customer.opportunities.description"),
    },
  ];
}
