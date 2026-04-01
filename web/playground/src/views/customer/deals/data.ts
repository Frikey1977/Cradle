import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { DealApi } from "#/api/customer/deals";
import { z } from "#/adapter/form";
import { $t } from "#/locales";
import { getEmployeeList } from "#/api/organization/employees";
import { getAllCustomers } from "#/api/customer/customers";
import { getAllOpportunities } from "#/api/customer/opportunities";
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
 * 获取成交状态选项
 */
export function getStatusOptions() {
  return [
    { color: "processing", label: $t("customer.deals.statusPending"), value: "pending" },
    { color: "warning", label: $t("customer.deals.statusSigned"), value: "signed" },
    { color: "purple", label: $t("customer.deals.statusPaid"), value: "paid" },
    { color: "success", label: $t("customer.deals.statusCompleted"), value: "completed" },
    { color: "error", label: $t("customer.deals.statusCancelled"), value: "cancelled" },
  ];
}

/**
 * 获取付款方式选项
 */
export function getPaymentMethodOptions() {
  return [
    { label: $t("customer.deals.paymentMethodBank"), value: "bank_transfer" },
    { label: $t("customer.deals.paymentMethodCash"), value: "cash" },
    { label: $t("customer.deals.paymentMethodCheck"), value: "check" },
    { label: $t("customer.deals.paymentMethodCredit"), value: "credit" },
    { label: $t("customer.deals.paymentMethodInstallment"), value: "installment" },
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
 * 获取商机选项
 */
export async function getOpportunityOptions(customerId?: string) {
  try {
    const params: any = {};
    if (customerId) {
      params.customerId = customerId;
    }
    const result = await getAllOpportunities(params);
    return result.map((opp) => ({
      label: `${opp.name} (${opp.opportunityNo})`,
      value: opp.sid,
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
  onActionClick: OnActionClickFn<DealApi.Deal>
): VxeTableGridOptions["columns"] {
  return [
    {
      field: "dealNo",
      title: $t("customer.deals.dealNo"),
      width: 150,
    },
    {
      field: "name",
      title: $t("customer.deals.name"),
      minWidth: 200,
    },
    {
      field: "customerName",
      title: $t("customer.deals.customer"),
      width: 180,
    },
    {
      field: "amount",
      title: $t("customer.deals.amount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "paidAmount",
      title: $t("customer.deals.paidAmount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "unpaidAmount",
      title: $t("customer.deals.unpaidAmount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "paymentMethod",
      title: $t("customer.deals.paymentMethod"),
      width: 100,
      formatter: ({ cellValue }: { cellValue: string }) => {
        const option = getPaymentMethodOptions().find((opt) => opt.value === cellValue);
        return option?.label || cellValue || "-";
      },
    },
    {
      field: "signDate",
      title: $t("customer.deals.signDate"),
      width: 120,
    },
    {
      field: "status",
      title: $t("customer.deals.status"),
      width: 100,
      cellRender: {
        name: "CellTag",
        options: getStatusOptions(),
      },
    },
    {
      field: "ownerName",
      title: $t("customer.deals.owner"),
      width: 120,
    },
    {
      field: "createTime",
      title: $t("customer.deals.createTime"),
      width: 180,
    },
    {
      field: "operation",
      title: $t("customer.deals.operation"),
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
        placeholder: $t("customer.deals.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("common.keyword"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
        placeholder: $t("customer.deals.statusPlaceholder"),
      },
      fieldName: "status",
      label: $t("customer.deals.status"),
    },
  ];
}

/**
 * 获取表单配置
 */
export function useFormSchema(
  customerOptions?: Ref<{ label: string; value: string }[]>,
  opportunityOptions?: Ref<{ label: string; value: string }[]>,
  employeeOptions?: Ref<{ label: string; value: string }[]>
): VbenFormSchema[] {
  return [
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: customerOptions?.value || [],
        placeholder: $t("customer.deals.customerPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) => {
          return option.label.toLowerCase().includes(input.toLowerCase());
        },
      },
      fieldName: "customerId",
      label: $t("customer.deals.customer"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("customer.deals.customer")])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: opportunityOptions?.value || [],
        placeholder: $t("customer.deals.opportunityPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) => {
          return option.label.toLowerCase().includes(input.toLowerCase());
        },
      },
      fieldName: "opportunityId",
      label: $t("customer.deals.opportunity"),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("customer.deals.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("customer.deals.name")]))
        .max(200, $t("ui.formRules.maxLength", [$t("customer.deals.name"), 200])),
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        precision: 2,
        formatter: (value: number) => (value ? `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""),
        parser: (value: string) => value.replace(/[¥\s,]/g, ""),
      },
      fieldName: "amount",
      label: $t("customer.deals.amount"),
      rules: z.number().min(0.01, $t("ui.formRules.required", [$t("customer.deals.amount")])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getPaymentMethodOptions(),
        placeholder: $t("customer.deals.paymentMethodPlaceholder"),
      },
      fieldName: "paymentMethod",
      label: $t("customer.deals.paymentMethod"),
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD",
        placeholder: $t("customer.deals.signDatePlaceholder"),
      },
      fieldName: "signDate",
      label: $t("customer.deals.signDate"),
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD",
        placeholder: $t("customer.deals.expectedDeliveryDatePlaceholder"),
      },
      fieldName: "expectedDeliveryDate",
      label: $t("customer.deals.expectedDeliveryDate"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: getStatusOptions(),
      },
      defaultValue: "pending",
      fieldName: "status",
      label: $t("customer.deals.status"),
      rules: "required",
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: employeeOptions?.value || [],
        placeholder: $t("customer.deals.ownerPlaceholder"),
      },
      fieldName: "ownerId",
      label: $t("customer.deals.owner"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 4,
      },
      fieldName: "remark",
      label: $t("customer.deals.remark"),
    },
  ];
}
