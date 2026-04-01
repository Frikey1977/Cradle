import type { VbenFormSchema } from "#/adapter/form";

import { z } from "#/adapter/form";
import { $t } from "#/locales";

/**
 * 获取联系人类型选项
 */
export function getContactTypeOptions() {
  return [
    { label: $t("organization.contacts.typeEmployee"), value: "employee" },
    { label: $t("organization.contacts.typeCustomer"), value: "customer" },
    { label: $t("organization.contacts.typePartner"), value: "partner" },
    { label: $t("organization.contacts.typeVisitor"), value: "visitor" },
  ];
}

/**
 * 获取联系人状态选项
 */
export function getContactStatusOptions() {
  return [
    { label: $t("common.enabled"), value: "enabled" },
    { label: $t("common.disabled"), value: "disabled" },
  ];
}

/**
 * 基本信息表单配置
 */
export function useBasicInfoSchema(): VbenFormSchema[] {
  return [
    {
      component: "Select",
      componentProps: {
        class: "w-full",
        options: getContactTypeOptions(),
        placeholder: $t("ui.placeholder.select"),
      },
      fieldName: "type",
      label: $t("organization.contacts.type"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.contacts.type")])),
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.contacts.sourceIdPlaceholder"),
      },
      dependencies: {
        disabled: (values) => values.type === "visitor",
        triggerFields: ["type"],
      },
      fieldName: "sourceId",
      label: $t("organization.contacts.sourceId"),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: getContactStatusOptions(),
        optionType: "button",
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("organization.contacts.status"),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 500,
        placeholder: $t("organization.contacts.descriptionPlaceholder"),
        rows: 3,
        showCount: true,
      },
      fieldName: "description",
      label: $t("organization.contacts.description"),
    },
  ];
}

/**
 * 偏好管理表单配置（使用 profile 字段）
 */
export function useProfileSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        placeholder: $t("organization.contacts.profilePlaceholder"),
        rows: 20,
        class: "w-full font-mono",
      },
      fieldName: "profile",
      label: "",
      rules: z.string().optional().refine(
        (val) => {
          if (!val) return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        },
        { message: $t("organization.contacts.invalidJson") }
      ),
    },
  ];
}
