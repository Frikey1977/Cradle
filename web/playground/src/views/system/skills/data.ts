import type { VbenFormSchema } from "#/adapter/form";
import type { OnActionClickFn, VxeTableGridOptions } from "#/adapter/vxe-table";
import type { SkillApi } from "#/api/system/skills";
import { z } from "#/adapter/form";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import { skillApi } from "#/api/system/skills";
import { $t } from "#/locales";
import { h, type Ref } from "vue";
import { IconifyIcon } from "@vben/icons";
import { Tag } from "ant-design-vue";

// 用于存储当前编辑的技能ID
let currentSkillSid: string | undefined;

export function setCurrentSkillSid(sid: string | undefined) {
  currentSkillSid = sid;
}

// 技能来源类型选项缓存
let sourceTypeOptionsCache: { color: string; label: string; value: string }[] | null = null;

// 技能状态选项缓存
let statusOptionsCache: { color: string; label: string; value: string }[] | null = null;

/**
 * 获取技能来源类型选项（用于表格标签显示）
 * 从代码管理模块 system.skills.source 节点获取
 */
export async function getSourceTypeOptions() {
  if (sourceTypeOptionsCache) {
    return sourceTypeOptionsCache;
  }

  try {
    const options = await getCodeOptionsByParentValue("system.skills.source");
    sourceTypeOptionsCache = options.map((opt) => ({
      color: opt.metadata?.color || "blue",
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    return sourceTypeOptionsCache;
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { color: "blue", label: $t("system.skills.sourceBuiltin"), value: "builtin" },
      { color: "green", label: $t("system.skills.sourceLocal"), value: "local" },
      { color: "orange", label: $t("system.skills.sourceOpenclaw"), value: "openclaw" },
    ];
  }
}

/**
 * 获取技能来源类型 RadioGroup 选项
 * 返回静态选项配置，用于 RadioGroup 组件
 * 使用 title 字段作为 label 显示
 */
export async function getSourceTypeRadioOptions() {
  try {
    const options = await getCodeOptionsByParentValue("system.skills.source");
    return options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { label: $t("system.skills.sourceBuiltin"), value: "builtin" },
      { label: $t("system.skills.sourceLocal"), value: "local" },
      { label: $t("system.skills.sourceOpenclaw"), value: "openclaw" },
    ];
  }
}

/**
 * 清除来源类型选项缓存
 */
export function clearSourceTypeOptionsCache() {
  sourceTypeOptionsCache = null;
}

/**
 * 获取技能状态选项（用于表格标签显示）
 * 从代码管理模块 system.skills.status 节点获取
 */
export async function getStatusOptions() {
  if (statusOptionsCache) {
    return statusOptionsCache;
  }

  try {
    const options = await getCodeOptionsByParentValue("system.skills.status");
    statusOptionsCache = options.map((opt) => ({
      color: opt.metadata?.color || "blue",
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    return statusOptionsCache;
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { color: "success", label: $t("common.enabled"), value: "enabled" },
      { color: "error", label: $t("common.disabled"), value: "disabled" },
      { color: "warning", label: $t("common.deprecated"), value: "deprecated" },
    ];
  }
}

/**
 * 获取技能状态 Select 选项
 * 返回静态选项配置，用于 Select 组件
 * 使用 title 字段作为 label 显示
 */
export async function getStatusSelectOptions() {
  try {
    const options = await getCodeOptionsByParentValue("system.skills.status");
    return options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { label: $t("common.enabled"), value: "enabled" },
      { label: $t("common.disabled"), value: "disabled" },
      { label: $t("common.deprecated"), value: "deprecated" },
    ];
  }
}

/**
 * 清除状态选项缓存
 */
export function clearStatusOptionsCache() {
  statusOptionsCache = null;
}

// 技能类型选项缓存
let nodeTypeOptionsCache: { color: string; label: string; value: string }[] | null = null;

/**
 * 获取节点类型选项（用于表格标签显示）
 * 从代码管理模块 system.skills.type 节点获取
 */
export async function getNodeTypeOptions() {
  if (nodeTypeOptionsCache) {
    return nodeTypeOptionsCache;
  }

  try {
    const options = await getCodeOptionsByParentValue("system.skills.type");
    nodeTypeOptionsCache = options.map((opt) => ({
      color: opt.metadata?.color || "blue",
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    return nodeTypeOptionsCache;
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { color: "blue", label: $t("system.skills.typeCatalog"), value: "catalog" },
      { color: "green", label: $t("system.skills.typeSkill"), value: "skill" },
    ];
  }
}

/**
 * 获取节点类型 Select 选项
 * 返回静态选项配置，用于 RadioGroup 组件
 * 使用 title 字段作为 label 显示
 */
export async function getNodeTypeSelectOptions() {
  try {
    const options = await getCodeOptionsByParentValue("system.skills.type");
    return options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
  } catch (error) {
    // 如果获取失败，返回默认选项
    return [
      { label: $t("system.skills.typeCatalog"), value: "catalog" },
      { label: $t("system.skills.typeSkill"), value: "skill" },
    ];
  }
}

/**
 * 清除节点类型选项缓存
 */
export function clearNodeTypeOptionsCache() {
  nodeTypeOptionsCache = null;
}

/**
 * 生成翻译键
 * 格式：system.skill.{slug}
 * 处理规则：全小写、去空格
 */
export function generateTitle(slug: string): string {
  if (!slug) return "";
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, "");
  return `system.skill.${normalizedSlug}`;
}

/**
 * 获取编辑表单的字段配置
 * @param onTitleChange - 当 slug 变化时触发的回调
 * @param titleSuffix - 标题翻译后缀
 * @param sourceTypeOptions - 来源类型选项
 * @param statusOptions - 状态选项
 * @param getSkillSid - 获取当前编辑技能ID的函数
 * @param parentIdOptions - 父节点选项
 * @param nodeTypeOptions - 节点类型选项
 * @param getType - 获取当前类型值的函数
 * @param onTypeChange - 类型变化时的回调
 */
export function useSchema(
  onTitleChange?: (slug: string) => void,
  titleSuffix?: Ref<string | undefined>,
  sourceTypeOptions?: { label: string; value: string }[],
  statusOptions?: { label: string; value: string }[],
  getSkillSid?: () => string | undefined,
  parentIdOptions?: { label: string; value: string }[],
  nodeTypeOptions?: { label: string; value: string }[],
  getType?: () => string | undefined,
  onTypeChange?: (type: string) => void,
): VbenFormSchema[] {
  // 获取当前类型
  const currentType = getType?.();
  const isCatalog = currentType === "catalog";
  const isSkill = currentType === "skill";

  return [
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options: nodeTypeOptions,
        onChange(e: any) {
          const newType = e?.target?.value;
          if (onTypeChange && newType) {
            onTypeChange(newType);
          }
        },
      },
      fieldName: "type",
      label: $t("system.skills.type"),
      rules: "required",
    },
    {
      component: "Select",
      componentProps: {
        allowClear: !isSkill,
        disabled: isCatalog,
        options: parentIdOptions || [],
        placeholder: $t("system.skills.parentPlaceholder"),
        showSearch: true,
        filterOption: (input: string, option: { label: string }) =>
          option.label.toLowerCase().includes(input.toLowerCase()),
      },
      fieldName: "parentId",
      label: $t("system.skills.parent"),
      rules: isSkill
        ? z.string({ required_error: $t("ui.formRules.required", [$t("system.skills.parent")]) }).min(1, $t("ui.formRules.required", [$t("system.skills.parent")]))
        : z.union([z.string(), z.null()]).optional(),
    },
    {
      component: "Input",
      componentProps: {
        async onChange({ target: { value } }: { target: { value: string } }) {
          if (onTitleChange && value) {
            onTitleChange(value);
          }
        },
      },
      fieldName: "slug",
      label: $t("system.skills.slug"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("system.skills.slug"), 2]))
        .max(100, $t("ui.formRules.maxLength", [$t("system.skills.slug"), 100]))
        .regex(/^[a-z0-9_-]+$/, $t("system.skills.slugFormatError"))
        .refine(
          async (value: string) => {
            const skillSid = getSkillSid ? getSkillSid() : undefined;
            return !(await skillApi.checkSlugExists(value, skillSid));
          },
          (value: string) => ({
            message: $t("ui.formRules.alreadyExists", [$t("system.skills.slug"), value]),
          }),
        ),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("system.skills.name"),
      rules: z
        .string()
        .min(2, $t("ui.formRules.minLength", [$t("system.skills.name"), 2]))
        .max(200, $t("ui.formRules.maxLength", [$t("system.skills.name"), 200])),
    },
    {
      component: "Input",
      componentProps() {
        return {
          ...(titleSuffix?.value && { addonAfter: titleSuffix.value }),
          onChange({ target: { value } }: { target: { value: string } }) {
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
      label: $t("system.skills.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("system.skills.title"), 200]))
        .optional(),
    },
    {
      component: "Input",
      componentProps: {
        disabled: isCatalog,
      },
      fieldName: "version",
      label: $t("system.skills.version"),
      rules: z
        .string()
        .max(20, $t("ui.formRules.maxLength", [$t("system.skills.version"), 20])),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options: sourceTypeOptions || [],
        disabled: isCatalog,
      },
      fieldName: "sourceType",
      formItemClass: "col-span-2",
      label: $t("system.skills.sourceType"),
      rules: "required",
    },
    {
      component: "Input",
      componentProps: {
        disabled: isCatalog,
      },
      fieldName: "sourceUrl",
      label: $t("system.skills.sourceUrl"),
      rules: z
        .string()
        .max(500, $t("ui.formRules.maxLength", [$t("system.skills.sourceUrl"), 500]))
        .optional(),
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        max: 100,
        placeholder: $t("system.skills.scorePlaceholder"),
        disabled: isCatalog,
      },
      fieldName: "score",
      label: $t("system.skills.score"),
      rules: z.number().min(0).max(100).optional(),
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        max: 5,
        placeholder: $t("system.skills.starPlaceholder"),
        disabled: isCatalog,
      },
      fieldName: "star",
      label: $t("system.skills.star"),
      rules: z.number().min(0).max(5).optional(),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 500,
        rows: 3,
        showCount: true,
      },
      fieldName: "description",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("system.skills.description"),
      rules: z
        .string()
        .max(500, $t("ui.formRules.maxLength", [$t("system.skills.description"), 500]))
        .optional(),
    },
    {
      component: "InputNumber",
      componentProps: {
        min: 0,
        placeholder: $t("system.skills.sortPlaceholder"),
        style: { width: "100%" },
      },
      fieldName: "sort",
      label: $t("system.skills.sort"),
      rules: z.number().int().min(0).optional(),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        optionType: "button",
        options: statusOptions || [],
      },
      fieldName: "status",
      label: $t("system.skills.status"),
      rules: "required",
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn<SkillApi.Skill>,
  sourceTypeOptions?: { color: string; label: string; value: string }[],
  statusOptions?: { color: string; label: string; value: string }[],
  nodeTypeOptions?: { color: string; label: string; value: string }[],
): VxeTableGridOptions<SkillApi.Skill>["columns"] {
  // 构建类型选项映射，避免每次渲染都遍历查找
  const nodeTypeMap = new Map(nodeTypeOptions?.map(opt => [opt.value, opt]) ?? []);

  return [
    {
      align: "left",
      field: "name",
      fixed: "left",
      treeNode: true,
      slots: {
        default: ({ row }: { row: SkillApi.Skill }) => {
          const isCatalog = row.type === "catalog";
          const typeOption = nodeTypeMap.get(row.type);
          return h("div", { class: "flex items-center gap-2" }, [
            h(IconifyIcon, {
              icon: isCatalog ? "lucide:folder" : "lucide:file-code",
              style: { color: isCatalog ? "#1890ff" : "#52c41a", fontSize: "16px" },
            }),
            h("span", row.name),
            h(Tag, { color: typeOption?.color || "default" },
              () => typeOption?.label || row.type,
            ),
          ]);
        },
      },
      title: $t("system.skills.name"),
      width: 300,
    },
    {
      align: "left",
      field: "title",
      slots: {
        default: ({ row }: { row: SkillApi.Skill }) => {
          if (!row.title) {
            return h("span", { class: "text-gray-400" }, "-");
          }
          return h("span", $t(row.title));
        },
      },
      title: $t("system.skills.title"),
      width: 200,
    },
    {
      align: "center",
      field: "slug",
      title: $t("system.skills.slug"),
      width: 150,
    },
    {
      align: "center",
      field: "version",
      title: $t("system.skills.version"),
      width: 100,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: sourceTypeOptions || [] },
      field: "sourceType",
      title: $t("system.skills.sourceType"),
      width: 120,
    },
    {
      align: "center",
      cellRender: { name: "CellTag", options: statusOptions || [] },
      field: "status",
      title: $t("system.skills.status"),
      width: 120,
    },
    {
      align: "center",
      field: "sort",
      title: $t("system.skills.sort"),
      width: 80,
    },
    {
      align: "center",
      field: "score",
      title: $t("system.skills.score"),
      width: 100,
    },
    {
      align: "center",
      field: "star",
      title: $t("system.skills.star"),
      width: 100,
    },
    {
      align: "left",
      field: "description",
      minWidth: 200,
      title: $t("system.skills.description"),
    },
    {
      align: "center",
      field: "createTime",
      title: $t("common.createTime"),
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
      },
      field: "operation",
      fixed: "right",
      headerAlign: "center",
      showOverflow: false,
      title: $t("system.skills.operation"),
      width: 150,
    },
  ];
}

/**
 * 获取搜索表单配置
 */
export function useSearchSchema(
  sourceTypeOptions?: { label: string; value: string }[],
  statusOptions?: { label: string; value: string }[],
): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        placeholder: $t("system.skills.searchPlaceholder"),
      },
      fieldName: "keyword",
      label: $t("common.keyword"),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        options: statusOptions || [],
        placeholder: $t("common.all"),
      },
      fieldName: "status",
      label: $t("system.skills.status"),
    },
  ];
}
