import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { SystemCodeApi } from "#/api/system/codes";
import type { ChangeEvent } from "ant-design-vue/es/_util/EventInterface";
import type { Ref } from "vue";
import { z } from "#/adapter/form";
import { getCodeTree, getCodeOptionsByParentValue, isCodeValueExists } from "#/api/system/codes";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";
import { h } from "vue";

// 类型图标映射缓存
let typeIconMap: Map<string, string> = new Map();

// 加载类型图标映射
async function loadTypeIconMap() {
  const options = await getCodeOptionsByParentValue('system.codes.type');
  const map = new Map<string, string>();
  for (const opt of options) {
    if (opt.value && opt.icon) {
      map.set(opt.value, opt.icon);
    }
  }
  typeIconMap = map;
}

// 获取节点要显示的图标（优先使用类型配置的图标，其次使用节点自身的图标）
function getNodeIcon(code: SystemCodeApi.Code): string {
  // 优先根据类型获取图标
  const typeIcon = typeIconMap.get(code.type || '');
  if (typeIcon) return typeIcon;
  // 如果类型没有配置图标，使用节点自身的图标
  if (code.icon) return code.icon;
  // 默认图标
  return 'carbon:folder';
}

// 转换代码数据为树形数据格式（带翻译和图标）
function convertToTreeDataWithTranslation(codes: SystemCodeApi.Code[]): any[] {
  return codes
    .filter((code) => code.type !== 'value') // 过滤掉 value 类型的节点
    .map((code) => ({
      ...code,
      // 使用 title 字段（翻译键）进行翻译显示，并添加图标
      title: h('div', { class: 'flex items-center gap-2' }, [
        h(IconifyIcon, { icon: getNodeIcon(code), class: 'size-4 flex-shrink-0' }),
        h('span', code.title ? $t(code.title) : ''),
      ]),
      children: code.children && code.children.length > 0 
        ? convertToTreeDataWithTranslation(code.children) 
        : undefined,
    }));
}

// 获取代码树（带翻译和图标）
async function getCodeTreeWithTranslation() {
  // 先加载类型图标映射
  await loadTypeIconMap();
  const data = await getCodeTree();
  return convertToTreeDataWithTranslation(data);
}

/**
 * 获取代码类型选项
 * 从 system.codes.type 节点下获取子代码作为类型选项
 */
export async function getCodeTypeOptions() {
  return getCodeOptionsByParentValue("system.codes.type");
}

/**
 * 获取代码类型 RadioGroup 选项
 * 返回静态选项配置，用于 RadioGroup 组件
 * 使用 title 字段作为 label 显示
 */
export async function getCodeTypeRadioOptions() {
  const options = await getCodeOptionsByParentValue("system.codes.type");
  return options.map((opt) => ({
    label: opt.title || opt.label, // 优先使用 title 字段，如果没有则使用 label（name）
    value: opt.value,
  }));
}

/**
 * 获取编辑表单的字段配置
 */
export function useSchema(
  formData?: Ref<SystemCodeApi.Code | undefined>,
  getFormValues?: () => { parentId?: string; value?: string; type?: string },
  titleSuffix?: Ref<string | undefined>,
  onTitleChange?: (value: string, type: string) => void,
  typeOptions?: { label: string; value: string }[],
  formApi?: any,
  statusOptions?: { label: string; value: string }[],
  onParentChange?: (parentId: string | null | undefined) => void,
): VbenFormSchema[] {
  return [
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options:
          typeOptions && typeOptions.length > 0
            ? typeOptions
            : [
                { label: "模块", value: "module" },
                { label: "功能", value: "function" },
                { label: "代码", value: "code" },
                { label: "码值", value: "value" },
              ],
        async onChange(e: any) {
          // 当类型变化时，重新生成标题
          const newType = e?.target?.value;
          // 使用 formApi 获取最新的值
          const values = await formApi?.getValues?.();
          const currentValue = values?.value;
          if (onTitleChange && currentValue) {
            onTitleChange(currentValue, newType);
          }
        },
      },
      defaultValue: "function",
      fieldName: "type",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("system.codes.type"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.minLength", [$t("system.codes.type"), 1]))
        .max(50, $t("ui.formRules.maxLength", [$t("system.codes.type"), 50])),
    },
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: async () => {
          const data = await getCodeTreeWithTranslation();
          // 缓存树数据到 window，供后续查找使用
          (window as any).codeTreeData = data;
          return data;
        },
        class: "w-full",
        childrenField: "children",
        labelField: "title",
        treeDefaultExpandAll: true,
        treeLine: true,
        showSearch: true,
        treeNodeFilterProp: "name",
        valueField: "sid",
        placeholder: $t("system.codes.parentPlaceholder"),
        async onChange(value: any) {
          // 当父级变化时，更新 parentValueChain
          if (onParentChange) {
            onParentChange(value);
          }
          // 重新生成标题
          if (onTitleChange) {
            const values = await formApi?.getValues?.();
            const currentValue = values?.value;
            const type = values?.type || "function";
            if (currentValue) {
              onTitleChange(currentValue, type);
            }
          }
        },
      },
      fieldName: "parentId",
      label: $t("system.codes.parent"),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("system.codes.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.minLength", [$t("system.codes.name"), 1]))
        .max(200, $t("ui.formRules.maxLength", [$t("system.codes.name"), 200])),
    },
    {
      component: "Input",
      componentProps: {
        async onChange({ target: { value } }: ChangeEvent) {
          // 当码值变化时，自动生成标题
          if (onTitleChange && value) {
            // 使用 formApi 获取最新的类型值
            const values = await formApi?.getValues?.();
            const type = values?.type || "function";
            onTitleChange(value, type);
          }
        },
      },
      fieldName: "value",
      label: $t("system.codes.value"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.minLength", [$t("system.codes.value"), 1]))
        .max(100, $t("ui.formRules.maxLength", [$t("system.codes.value"), 100]))
        .refine(
          async (value: string) => {
            if (!value) return true;
            
            const currentFormValues = await formApi?.getValues?.();
            const parentId = currentFormValues?.parentId || formData?.value?.parentId;
            const excludeId = formData?.value?.sid;
            
            return !(await isCodeValueExists(value, parentId, excludeId));
          },
          (value) => ({
            message: $t("ui.formRules.alreadyExists", [$t("system.codes.value"), value]),
          }),
        ),
    },
    {
      component: "Input",
      componentProps() {
        return {
          ...(titleSuffix?.value && { addonAfter: titleSuffix.value }),
          onChange({ target: { value } }: ChangeEvent) {
            // 手动修改标题时，更新翻译后缀
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
      label: $t("system.codes.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("system.codes.title"), 200]))
        .optional(),
    },
    {
      component: "InputNumber",
      componentProps: {
        class: "w-full",
        min: 0,
      },
      fieldName: "sort",
      label: $t("system.codes.sort"),
      rules: z.number().default(0),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options:
          statusOptions && statusOptions.length > 0
            ? statusOptions
            : [
                { label: $t("common.enabled"), value: "enabled" },
                { label: $t("common.disabled"), value: "disabled" },
              ],
        optionType: "button",
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("system.codes.status"),
    },
    {
      component: "IconPicker",
      componentProps: {
        prefix: "carbon",
      },
      fieldName: "icon",
      label: $t("system.codes.icon"),
    },
    {
      component: "ColorPicker",
      fieldName: "color",
      label: $t("system.codes.color"),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 500,
        rows: 4,
        showCount: true,
      },
      fieldName: "description",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("system.codes.description"),
      rules: z
        .string()
        .max(500, $t("ui.formRules.maxLength", [$t("system.codes.description"), 500]))
        .optional(),
    },
    {
      component: "Textarea",
      componentProps: {
        placeholder: "JSON格式，例如: {\"key1\": \"value1\", \"key2\": \"value2\"}",
        rows: 6,
      },
      fieldName: "metadata",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("system.codes.metadata"),
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
        .optional()
        .transform((val) => {
          if (!val) return undefined;
          try {
            return JSON.parse(val);
          } catch {
            return undefined;
          }
        }),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<SystemCodeApi.Code>,
): VxeTableGridOptions<SystemCodeApi.Code>["columns"] {
  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      minWidth: 200,
      slots: { default: "name" },
      title: $t("system.codes.name"),
    },
    {
      field: "title",
      minWidth: 150,
      slots: { default: "title" },
      title: $t("system.codes.title"),
    },
    {
      field: "type",
      minWidth: 120,
      title: $t("system.codes.type"),
    },
    {
      field: "value",
      minWidth: 120,
      title: $t("system.codes.value"),
    },
    {
      field: "sort",
      minWidth: 80,
      title: $t("system.codes.sort"),
    },
    {
      field: "color",
      minWidth: 100,
      slots: { default: "color" },
      title: $t("system.codes.color"),
    },
    {
      field: "status",
      minWidth: 100,
      slots: { default: "status" },
      title: $t("system.codes.status"),
    },
    {
      field: "description",
      minWidth: 200,
      showOverflow: "tooltip",
      title: $t("system.codes.description"),
    },
    {
      field: "createTime",
      minWidth: 180,
      title: $t("system.codes.createTime"),
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
      title: $t("system.codes.operation"),
    },
  ];
}
