import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { ChannelApi } from "#/api/system/channels";
import type { Ref } from "vue";
import { z } from "#/adapter/form";
import { isChannelNameExists } from "#/api/system/channels";
import { $t } from "#/locales";

/**
 * 获取编辑表单的字段配置
 */
export function useSchema(
  formData?: Ref<ChannelApi.Channel | undefined>,
  getFormValues?: () => { channelName?: string },
  formApi?: any,
): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        placeholder: $t("system.channels.namePlaceholder"),
      },
      fieldName: "name",
      label: $t("system.channels.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.minLength", [$t("system.channels.name"), 1]))
        .max(100, $t("ui.formRules.maxLength", [$t("system.channels.name"), 100]))
        .refine(
          async (value: string) => {
            if (!value) return true;
            const excludeId = formData?.value?.sid;
            return !(await isChannelNameExists(value, excludeId));
          },
          (value) => ({
            message: $t("ui.formRules.alreadyExists", [$t("system.channels.name"), value]),
          }),
        ),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options: [
          { label: $t("system.channels.status.active"), value: "active" },
          { label: $t("system.channels.status.error"), value: "error" },
          { label: $t("system.channels.status.disabled"), value: "disabled" },
        ],
      },
      defaultValue: "disabled",
      fieldName: "status",
      label: $t("system.channels.status.title"),
    },
    {
      component: "Textarea",
      componentProps: {
        placeholder: "请输入JSON格式的配置",
        rows: 10,
      },
      fieldName: "config",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("system.channels.config"),
      rules: z
        .string()
        .refine((val) => {
          if (!val) return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        }, "请输入有效的JSON格式")
        .transform((val) => {
          if (!val) return {};
          try {
            return JSON.parse(val);
          } catch {
            return {};
          }
        }),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<ChannelApi.Channel>,
): VxeTableGridOptions<ChannelApi.Channel>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      minWidth: 200,
      title: $t("system.channels.name"),
    },
    {
      field: "status",
      minWidth: 120,
      slots: { default: "status" },
      title: $t("system.channels.status.title"),
    },
    {
      field: "lastError",
      minWidth: 200,
      showOverflow: "tooltip",
      title: $t("system.channels.lastError"),
    },
    {
      field: "lastConnectedAt",
      minWidth: 180,
      title: $t("system.channels.lastConnectedAt"),
    },
    {
      field: "createTime",
      minWidth: 180,
      title: $t("system.channels.createTime"),
    },
    {
      field: "updateTime",
      minWidth: 180,
      title: $t("system.channels.updateTime"),
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
      title: $t("system.channels.operation"),
    },
  ];
}
