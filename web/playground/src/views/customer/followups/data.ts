import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { FollowupApi } from "#/api/customer/followups";
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
 * 获取跟进人名称
 */
export function getCreateByName(createBy: string | undefined): string {
  if (!createBy) return "-";
  return employeeMap.value.get(createBy) || createBy;
}

/**
 * 获取跟进方式选项
 */
export function getMethodOptions() {
  return [
    { color: "blue", label: $t("customer.followups.methodPhone"), value: "phone" },
    { color: "cyan", label: $t("customer.followups.methodEmail"), value: "email" },
    { color: "green", label: $t("customer.followups.methodMeeting"), value: "meeting" },
    { color: "purple", label: $t("customer.followups.methodVisit"), value: "visit" },
    { color: "orange", label: $t("customer.followups.methodWechat"), value: "wechat" },
    { color: "default", label: $t("customer.followups.methodOther"), value: "other" },
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
  onActionClick: OnActionClickFn<FollowupApi.Followup>
): VxeTableGridOptions["columns"] {
  return [
    {
      field: "followupNo",
      title: $t("customer.followups.followupNo"),
      width: 150,
    },
    {
      field: "customerName",
      title: $t("customer.followups.customer"),
      width: 180,
    },
    {
      field: "opportunityName",
      title: $t("customer.followups.opportunity"),
      width: 180,
    },
    {
      field: "method",
      title: $t("customer.followups.method"),
      width: 100,
      cellRender: {
        name: "CellTag",
        options: getMethodOptions(),
      },
    },
    {
      field: "followTime",
      title: $t("customer.followups.followTime"),
      width: 160,
    },
    {
      field: "content",
      title: $t("customer.followups.content"),
      minWidth: 300,
      showOverflow: "tooltip",
    },
    {
      field: "feedback",
      title: $t("customer.followups.feedback"),
      minWidth: 200,
      showOverflow: "tooltip",
    },
    {
      field: "nextFollowDate",
      title: $t("customer.followups.nextFollowDate"),
      width: 120,
    },
    {
      field: "createByName",
      title: $t("customer.followups.createBy"),
      width: 120,
    },
    {
      field: "createTime",
      title: $t("customer.followups.createTime"),
      width: 180,
    },
    {
      field: "operation",
      title: $t("customer.followups.operation"),
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
        placeholder: $t("customer.followups.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("common.keyword"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: getMethodOptions(),
        placeholder: $t("customer.followups.methodPlaceholder"),
      },
      fieldName: "method",
      label: $t("customer.followups.method"),
    },
    {
      component: "RangePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD",
      },
      fieldName: "dateRange",
      label: $t("customer.followups.dateRange"),
    },
  ];
}

/**
 * 获取表单配置
 */
export function useFormSchema(
  customerOptions?: Ref<{ label: string; value: string }[]>,
  opportunityOptions?: Ref<{ label: string; value: string }[]>
): VbenFormSchema[] {
  return [
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: customerOptions?.value || [],
        placeholder: $t("customer.followups.customerPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) => {
          return option.label.toLowerCase().includes(input.toLowerCase());
        },
      },
      fieldName: "customerId",
      label: $t("customer.followups.customer"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("customer.followups.customer")])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: opportunityOptions?.value || [],
        placeholder: $t("customer.followups.opportunityPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) => {
          return option.label.toLowerCase().includes(input.toLowerCase());
        },
      },
      fieldName: "opportunityId",
      label: $t("customer.followups.opportunity"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: false,
        options: getMethodOptions(),
      },
      defaultValue: "phone",
      fieldName: "method",
      label: $t("customer.followups.method"),
      rules: "required",
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD HH:mm:ss",
        showTime: true,
        placeholder: $t("customer.followups.followTimePlaceholder"),
      },
      fieldName: "followTime",
      label: $t("customer.followups.followTime"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 4,
      },
      fieldName: "content",
      label: $t("customer.followups.content"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("customer.followups.content")])),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 3,
      },
      fieldName: "feedback",
      label: $t("customer.followups.feedback"),
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD",
        placeholder: $t("customer.followups.nextFollowDatePlaceholder"),
      },
      fieldName: "nextFollowDate",
      label: $t("customer.followups.nextFollowDate"),
    },
    {
      component: "Textarea",
      componentProps: {
        rows: 2,
      },
      fieldName: "nextFollowContent",
      label: $t("customer.followups.nextFollowContent"),
    },
    {
      component: "Switch",
      defaultValue: false,
      fieldName: "reminder",
      label: $t("customer.followups.reminder"),
    },
    {
      component: "DatePicker",
      componentProps: {
        valueFormat: "YYYY-MM-DD HH:mm:ss",
        showTime: true,
        placeholder: $t("customer.followups.reminderTimePlaceholder"),
      },
      fieldName: "reminderTime",
      label: $t("customer.followups.reminderTime"),
      dependencies: {
        triggerFields: ["reminder"],
        show: (values: { reminder: boolean }) => values.reminder,
      },
    },
  ];
}
