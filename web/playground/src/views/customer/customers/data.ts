import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { CustomerApi } from "#/api/customer/customers";
import { z } from "#/adapter/form";
import { $t } from "#/locales";
import { getEmployeeList } from "#/api/organization/employees";
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
 * 获取客户类型选项
 */
export function getCustomerTypeOptions() {
  return [
    { color: "error", label: $t("customer.customers.typeEnterprise"), value: "enterprise" },
    { color: "success", label: $t("customer.customers.typeIndividual"), value: "individual" },
    { color: "warning", label: $t("customer.customers.typePartner"), value: "partner" },
  ];
}

/**
 * 获取客户等级选项
 */
export function getCustomerLevelOptions() {
  return [
    { color: "error", label: $t("customer.customers.levelA"), value: "A" },
    { color: "warning", label: $t("customer.customers.levelB"), value: "B" },
    { color: "processing", label: $t("customer.customers.levelC"), value: "C" },
    { color: "default", label: $t("customer.customers.levelD"), value: "D" },
  ];
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
  onActionClick: OnActionClickFn<CustomerApi.Customer>
): VxeTableGridOptions["columns"] {
  return [
    {
      field: "customerNo",
      title: $t("customer.customers.customerNo"),
      width: 150,
    },
    {
      field: "name",
      title: $t("customer.customers.name"),
      minWidth: 200,
    },
    {
      field: "type",
      title: $t("customer.customers.type"),
      width: 120,
      cellRender: {
        name: "CellTag",
        options: getCustomerTypeOptions(),
      },
    },
    {
      field: "level",
      title: $t("customer.customers.level"),
      width: 100,
      cellRender: {
        name: "CellTag",
        options: getCustomerLevelOptions(),
      },
    },
    {
      field: "primaryContactName",
      title: $t("customer.customers.primaryContactName"),
      width: 120,
    },
    {
      field: "primaryContactPhone",
      title: $t("customer.customers.primaryContactPhone"),
      width: 140,
    },
    {
      field: "ownerId",
      title: $t("customer.customers.owner"),
      width: 120,
      formatter: ({ cellValue }: { cellValue: string }) => getOwnerName(cellValue),
    },
    {
      field: "opportunityCount",
      title: $t("customer.customers.opportunityCount"),
      width: 100,
      align: "center",
    },
    {
      field: "dealCount",
      title: $t("customer.customers.dealCount"),
      width: 80,
      align: "center",
    },
    {
      field: "totalDealAmount",
      title: $t("customer.customers.totalDealAmount"),
      width: 120,
      align: "right",
      formatter: ({ cellValue }: { cellValue: number }) => {
        if (!cellValue) return "-";
        return `¥${cellValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: "status",
      title: $t("customer.customers.status"),
      width: 100,
      cellRender: {
        name: "CellTag",
        options: [
          { color: "success", label: $t("common.enabled"), value: "enabled" },
          { color: "default", label: $t("common.disabled"), value: "disabled" },
        ],
      },
    },
    {
      field: "createTime",
      title: $t("customer.customers.createTime"),
      width: 180,
    },
    {
      field: "operation",
      title: $t("customer.customers.operation"),
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
        placeholder: $t("customer.customers.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("common.keyword"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getCustomerTypeOptions(),
        placeholder: $t("customer.customers.typePlaceholder"),
      },
      fieldName: "type",
      label: $t("customer.customers.type"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getCustomerLevelOptions(),
        placeholder: $t("customer.customers.levelPlaceholder"),
      },
      fieldName: "level",
      label: $t("customer.customers.level"),
    },
  ];
}

/**
 * 获取表单配置
 */
export function useFormSchema(employeeOptions?: Ref<{ label: string; value: string }[]>): VbenFormSchema[] {
  return [
    {
      component: "Input",
      fieldName: "name",
      label: $t("customer.customers.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("customer.customers.name")]))
        .max(200, $t("ui.formRules.maxLength", [$t("customer.customers.name"), 200])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: getCustomerTypeOptions(),
        optionType: "button",
      },
      defaultValue: "enterprise",
      fieldName: "type",
      label: $t("customer.customers.type"),
      rules: "required",
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: getCustomerLevelOptions(),
        optionType: "button",
      },
      defaultValue: "D",
      fieldName: "level",
      label: $t("customer.customers.level"),
      rules: "required",
    },
    {
      component: "Input",
      fieldName: "industry",
      label: $t("customer.customers.industry"),
    },
    {
      component: "Input",
      fieldName: "scale",
      label: $t("customer.customers.scale"),
    },
    {
      component: "Input",
      fieldName: "region",
      label: $t("customer.customers.region"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 2,
      },
      fieldName: "address",
      label: $t("customer.customers.address"),
    },
    {
      component: "Input",
      fieldName: "primaryContactName",
      label: $t("customer.customers.primaryContactName"),
    },
    {
      component: "Input",
      fieldName: "primaryContactPhone",
      label: $t("customer.customers.primaryContactPhone"),
    },
    {
      component: "Input",
      fieldName: "primaryContactEmail",
      label: $t("customer.customers.primaryContactEmail"),
    },
    {
      component: "Input",
      fieldName: "website",
      label: $t("customer.customers.website"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: employeeOptions?.value || [],
        placeholder: $t("customer.customers.ownerPlaceholder"),
      },
      fieldName: "ownerId",
      label: $t("customer.customers.owner"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 3,
      },
      fieldName: "remark",
      label: $t("customer.customers.remark"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        options: [
          { label: $t("common.enabled"), value: "enabled" },
          { label: $t("common.disabled"), value: "disabled" },
        ],
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("customer.customers.status"),
    },
  ];
}
