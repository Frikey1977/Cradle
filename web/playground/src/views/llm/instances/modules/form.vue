<script lang="ts" setup>
import type { VbenFormSchema } from "#/adapter/form";
import type { LlmInstanceApi } from "#/api/llm/instances";
import type { LlmConfigApi } from "#/api/llm/configs";

import { computed, h, onMounted, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { $t } from "#/locales";
import { message } from "ant-design-vue";

import { useVbenForm, z } from "#/adapter/form";
import {
  createInstance,
  isInstanceNameExists,
  isApiKeyExists,
  updateInstance,
  BillingTypeOptions,
} from "#/api/llm/instances";
import { getAllConfigs } from "#/api/llm/configs";
import { getCodeOptionsByParentValue } from "#/api/system/codes";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<LlmInstanceApi.LlmInstance>();
const configList = ref<LlmConfigApi.LlmConfig[]>([]);
const providerNameOptions = ref<{ label: string; value: string }[]>([]);
const currentConfig = ref<LlmConfigApi.LlmConfig | null>(null);

// API Key 显示/隐藏状态
const showApiKey = ref(false);
const showApiToken = ref(false);

// 根据配置ID获取配置信息
function getConfigById(configId: string): LlmConfigApi.LlmConfig | undefined {
  return configList.value.find((c) => c.sid === configId);
}

// 更新当前配置信息
async function updateCurrentConfig(configId: string | undefined) {
  if (!configId) {
    currentConfig.value = null;
    return;
  }
  const config = getConfigById(configId);
  currentConfig.value = config || null;
}

// 加载配置列表
async function loadConfigs(defaultProviderName?: string) {
  try {
    const configs = await getAllConfigs();
    configList.value = configs;

    // 获取当前提供商（优先使用传入的默认值，其次使用表单中的值，最后使用 alibaba）
    const values = await formApi.getValues();
    const providerName = defaultProviderName || values?.providerName || "alibaba";
    await updateConfigOptions(providerName);
  } catch (error) {
    console.error("加载配置列表失败:", error);
  }
}

// 加载提供商选项
async function loadProviderNameOptions() {
  try {
    const options = await getCodeOptionsByParentValue("llm.providers.directory");
    const mappedOptions = options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    providerNameOptions.value = mappedOptions;

    // 更新表单字段的选项
    await formApi.updateSchema([
      {
        fieldName: "providerName",
        componentProps: {
          options: mappedOptions,
        },
      },
    ]);
  } catch (error) {
    console.error("加载提供商选项失败:", error);
  }
}

onMounted(async () => {
  // 先加载提供商选项，确保提供商数据准备好后再加载配置
  await loadProviderNameOptions();
  // 再加载配置列表，默认使用 alibaba
  await loadConfigs("alibaba");
});

const billingTypeOptions = BillingTypeOptions.map((opt) => ({
  label: $t(opt.label),
  value: opt.value,
}));

// 根据提供商筛选配置选项
function getFilteredConfigs(providerName: string | undefined) {
  if (!providerName) return [];
  return configList.value.filter((config) => config.providerName === providerName);
}

// 更新配置选项
async function updateConfigOptions(providerName: string | undefined, resetValue: boolean = false) {
  const filteredConfigs = getFilteredConfigs(providerName);
  const configOptions = filteredConfigs.map((config) => ({
    label: config.name,
    value: config.sid,
  }));

  await formApi.updateSchema([
    {
      fieldName: "configId",
      componentProps: {
        options: configOptions,
      },
    },
  ]);

  console.log("[调试] updateSchema 已调用");

  // 如果当前选中的配置不在筛选后的列表中，重置配置选择
  if (resetValue) {
    await formApi.setFieldValue("configId", undefined);
  }
}

const schema: VbenFormSchema[] = [
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: "solid",
      optionType: "button",
      options: [],
      async onChange(e: any) {
        const newProviderName = e?.target?.value;
        // 提供商变化时，重置配置选择并更新配置选项
        await updateConfigOptions(newProviderName, true);
      },
    },
    defaultValue: "alibaba",
    fieldName: "providerName",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("llm.instances.providerName"),
    rules: z.string().min(1, $t("ui.formRules.required", [$t("llm.instances.providerName")])),
  },
  {
    component: "Select",
    componentProps: {
      placeholder: $t("llm.instances.selectConfig"),
      showSearch: true,
      optionFilterProp: "label",
      style: { minWidth: "200px" },
      async onChange(value: string) {
        // 配置变化时，更新当前配置信息
        await updateCurrentConfig(value);
      },
    },
    fieldName: "configId",
    label: $t("llm.instances.config"),
    rules: z.string().min(1, $t("ui.formRules.required", [$t("llm.instances.config")])),
  },
  {
    component: "Input",
    componentProps: {
      placeholder: $t("llm.instances.namePlaceholder"),
      style: { maxWidth: "350px" },
    },
    fieldName: "name",
    formItemClass: "col-start-1",
    label: $t("llm.instances.name"),
    rules: z
      .string()
      .min(1, $t("ui.formRules.required", [$t("llm.instances.name")]))
      .max(200, $t("ui.formRules.maxLength", [$t("llm.instances.name"), 200]))
      .refine(
        async (value: string) => {
          const values = await formApi.getValues();
          const configId = values?.configId;
          if (!configId) return true;
          return !(await isInstanceNameExists(value, configId, formData.value?.sid));
        },
        (val) => ({
          message: $t("ui.formRules.alreadyExists", [$t("llm.instances.name"), val]),
        }),
      ),
  },
  {
    component: "Input",
    componentProps: {
      placeholder: $t("llm.instances.descriptionPlaceholder"),
      showCount: true,
      maxlength: 160,
    },
    fieldName: "description",
    formItemClass: "col-span-2",
    label: $t("llm.instances.description"),
    rules: z
      .string()
      .max(160, $t("ui.formRules.maxLength", [$t("llm.instances.description"), 160]))
      .optional(),
  },
  {
    component: "Input",
    componentProps: {
      placeholder: $t("llm.instances.apiKeyPlaceholder"),
      type: computed(() => (showApiKey.value ? "text" : "password")),
      suffix: computed(() =>
        h("span", {
          class: "cursor-pointer text-gray-400 hover:text-gray-600",
          onClick: () => (showApiKey.value = !showApiKey.value),
        }, showApiKey.value ? "🙈" : "👁️")
      ),
    },
    fieldName: "apiKey",
    label: $t("llm.instances.apiKey"),
    rules: z
      .string()
      .min(1, $t("ui.formRules.required", [$t("llm.instances.apiKey")]))
      .max(500, $t("ui.formRules.maxLength", [$t("llm.instances.apiKey"), 500]))
      .refine(
        async (value: string) => {
          if (!value) return true;
          const values = await formApi.getValues();
          const configId = values?.configId;
          if (!configId) return true;
          return !(await isApiKeyExists(value, configId, formData.value?.sid));
        },
        () => ({
          message: $t("llm.instances.apiKeyExists"),
        }),
      ),
    // 根据认证方式动态显示/隐藏
    formItemClass: computed(() => {
      const authMethod = currentConfig.value?.authMethod;
      return authMethod === "api_token" ? "hidden" : "col-span-1";
    }),
  },
  {
    component: "Input",
    componentProps: {
      placeholder: "请输入API Token",
      type: computed(() => (showApiToken.value ? "text" : "password")),
      suffix: computed(() =>
        h("span", {
          class: "cursor-pointer text-gray-400 hover:text-gray-600",
          onClick: () => (showApiToken.value = !showApiToken.value),
        }, showApiToken.value ? "🙈" : "👁️")
      ),
    },
    fieldName: "apiToken",
    label: "API Token",
    rules: z.union([
      z.string().length(0),
      z.string().min(1, $t("ui.formRules.required", ["API Token"])).max(500, $t("ui.formRules.maxLength", ["API Token", 500])),
    ]).optional(),
    // 根据认证方式动态显示/隐藏
    formItemClass: computed(() => {
      const authMethod = currentConfig.value?.authMethod;
      return authMethod === "api_token" ? "col-span-1" : "hidden";
    }),
  },
  {
    component: "Select",
    componentProps: {
      options: billingTypeOptions,
      placeholder: $t("llm.instances.selectBillingType"),
    },
    fieldName: "billingType",
    label: $t("llm.instances.billingType"),
    rules: z.string().default("usage"),
  },
  {
    component: "InputNumber",
    componentProps: {
      min: 0,
      max: 9999,
      placeholder: $t("llm.instances.weightPlaceholder"),
    },
    fieldName: "weight",
    label: $t("llm.instances.weight"),
    rules: z.number().min(0).max(9999).default(1),
  },
  {
    component: "InputNumber",
    componentProps: {
      min: 1,
      max: 999999999999,
      placeholder: $t("llm.instances.dailyQuotaPlaceholder"),
    },
    fieldName: "dailyQuota",
    label: $t("llm.instances.dailyQuota"),
    rules: z.number().min(1).max(999999999999).optional().or(z.literal("")),
  },
  {
    component: "InputNumber",
    componentProps: {
      min: 0,
      max: 9999,
    },
    fieldName: "sort",
    label: $t("llm.instances.sort"),
    rules: z.number().min(0).max(9999).default(0),
  },
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: "solid",
      optionType: "button",
      options: [
        { label: $t("common.enabled"), value: "enabled" },
        { label: $t("common.disabled"), value: "disabled" },
      ],
    },
    fieldName: "status",
    label: $t("llm.instances.status"),
    rules: z.string().default("enabled"),
  },
];

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    try {
      const valid = await formApi.validate();
      if (valid) {
        const values = await formApi.getValues();
        await onSubmit(values);
      }
    } catch (error) {
      console.error("表单提交错误:", error);
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      // 重置显示状态
      showApiKey.value = false;
      showApiToken.value = false;

      const data = modalApi.getData<LlmInstanceApi.LlmInstance>();
      formData.value = data;

      // 确保配置列表已加载
      if (configList.value.length === 0) {
        await loadConfigs();
      }

      if (data) {
        // 如果 providerName 为空，使用默认值 alibaba
        const providerName = data.providerName || "alibaba";
        // 更新当前配置信息以获取认证方式
        await updateCurrentConfig(data.configId);
        const authMethod = currentConfig.value?.authMethod;
        // 先设置所有值
        await formApi.setValues({
          providerName: providerName,
          configId: data.configId,
          name: data.name,
          description: data.description,
          // 根据认证方式设置 apiKey 或 apiToken
          apiKey: authMethod === "api_token" ? "" : data.apiKey,
          apiToken: authMethod === "api_token" ? data.apiKey : "",
          billingType: data.billingType,
          weight: data.weight,
          dailyQuota: data.dailyQuota,
          sort: data.sort,
          status: data.status,
        });
        // 根据提供商筛选配置选项
        await updateConfigOptions(providerName);
      } else {
        // 新建模式：先重置表单，然后设置默认值
        await formApi.resetForm();

        // 设置默认提供商
        await formApi.setValues({
          providerName: "alibaba",
          billingType: "usage",
          weight: 1,
          sort: 0,
          status: "enabled",
        });

        // 更新配置选项
        await updateConfigOptions("alibaba");
      }
    }
  },
});

// 提交表单
async function onSubmit(values: Record<string, any>) {
  try {
    modalApi.lock();

    // 根据认证方式确定使用 apiKey 还是 apiToken
    const authMethod = currentConfig.value?.authMethod;
    const apiKey = authMethod === "api_token" ? values.apiToken : values.apiKey;

    // 处理空字符串为 undefined
    const processedValues: LlmInstanceApi.CreateInstanceDto = {
      name: values.name,
      description: values.description,
      providerName: values.providerName,
      configId: values.configId,
      apiKey: apiKey,
      billingType: values.billingType,
      weight: values.weight,
      sort: values.sort,
      status: values.status,
      dailyQuota: values.dailyQuota || undefined,
    };

    if (formData.value?.sid) {
      await updateInstance(formData.value.sid, processedValues);
      message.success($t("ui.actionMessage.updateSuccess"));
    } else {
      await createInstance(processedValues);
      message.success($t("ui.actionMessage.createSuccess"));
    }
    modalApi.close();
    emit("success");
  } catch (error) {
    console.error("提交表单错误:", error);
    message.error($t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema,
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmit,
  handleFailed: (errors) => {
    console.error("表单验证失败:", errors);
  },
});

const getModalTitle = computed(() =>
  formData.value?.sid ? $t("ui.actionTitle.edit") : $t("ui.actionTitle.create"),
);
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getModalTitle">
    <Form />
  </Modal>
</template>
