<script lang="ts" setup>
import type { VbenFormSchema } from "#/adapter/form";
import type { LlmProviderApi } from "#/api/llm/providers";

import { computed, onMounted, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { $t } from "#/locales";
import { message } from "ant-design-vue";

import { useVbenForm, z } from "#/adapter/form";
import {
  createProvider,
  isProviderNameExists,
  updateProvider,
} from "#/api/llm/providers";
import { getCodeOptionsByParentValue } from "#/api/system/codes";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<LlmProviderApi.LlmProvider>();

// 代码配置选项
const codeOptions = ref<{
  name: { label: string; value: string }[];
  status: { label: string; value: string }[];
}>({
  name: [],
  status: [],
});

// 加载代码配置选项
async function loadCodeOptions() {
  try {
    // 加载提供商目录选项
    const nameOptions = await getCodeOptionsByParentValue("llm.providers.directory");
    const mappedNameOptions = nameOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.name = mappedNameOptions;

    // 加载状态选项
    const statusOptions = await getCodeOptionsByParentValue("llm.providers.status");
    const mappedStatusOptions = statusOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.status = mappedStatusOptions;

    // 更新表单字段的选项
    await formApi.updateSchema([
      {
        fieldName: 'name',
        componentProps: {
          options: mappedNameOptions,
        },
      },
      {
        fieldName: 'status',
        componentProps: {
          options: mappedStatusOptions,
        },
      },
    ]);
  } catch (error) {
    console.error('加载代码配置选项失败:', error);
  }
}

onMounted(() => {
  loadCodeOptions();
});

const schema: VbenFormSchema[] = [
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: 'solid',
      optionType: 'button',
      options: [],
    },
    fieldName: "name",
    formItemClass: 'col-span-2',
    controlClass: 'w-full',
    label: $t("llm.providers.name"),
    rules: z
      .string()
      .min(1, $t("ui.formRules.required", [$t("llm.providers.name")]))
      .refine(
        async (value: string) => {
          return !(await isProviderNameExists(value, formData.value?.sid));
        },
        (value) => ({
          message: $t("ui.formRules.alreadyExists", [
            $t("llm.providers.name"),
            value,
          ]),
        }),
      ),
  },
  {
    component: "Input",
    fieldName: "ename",
    label: $t("llm.providers.ename"),
    rules: z
      .string()
      .min(2, $t("ui.formRules.minLength", [$t("llm.providers.ename"), 2]))
      .max(100, $t("ui.formRules.maxLength", [$t("llm.providers.ename"), 100])),
  },
  {
    component: "Input",
    fieldName: "title",
    label: $t("llm.providers.title"),
    rules: z
      .string()
      .max(100, $t("ui.formRules.maxLength", [$t("llm.providers.title"), 100]))
      .optional(),
  },
  {
    component: "IconPicker",
    componentProps: {
      prefix: "carbon",
    },
    fieldName: "icon",
    label: $t("llm.providers.icon"),
  },
  {
    component: "ColorPicker",
    fieldName: "color",
    label: $t("llm.providers.color"),
  },
  {
    component: "Textarea",
    componentProps: {
      rows: 4,
      showCount: true,
      maxlength: 500,
    },
    fieldName: "description",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("llm.providers.description"),
    rules: z
      .string()
      .max(500, $t("ui.formRules.maxLength", [$t("llm.providers.description"), 500]))
      .optional(),
  },
  {
    component: "InputNumber",
    componentProps: {
      min: 0,
      max: 9999,
    },
    fieldName: "sort",
    label: $t("llm.providers.sort"),
    rules: z.number().default(0),
  },
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: 'solid',
      optionType: 'button',
      options: [],
    },
    fieldName: "status",
    label: $t("llm.providers.status"),
    rules: z.string().default("enabled"),
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema,
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmit,
});

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    await formApi.validateAndSubmitForm();
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<LlmProviderApi.LlmProvider>();
      formData.value = data;
      if (data) {
        formApi.setValues({
          name: data.name,
          ename: data.ename,
          title: data.title,
          icon: data.icon,
          color: data.color,
          description: data.description,
          sort: data.sort,
          status: data.status,
        });
      } else {
        formApi.resetForm();
      }
    }
  },
});

async function onSubmit(values: Record<string, any>) {
  try {
    modalApi.lock();
    if (formData.value?.sid) {
      await updateProvider(formData.value.sid, values);
      message.success($t("ui.actionMessage.updateSuccess"));
    } else {
      await createProvider(values);
      message.success($t("ui.actionMessage.createSuccess"));
    }
    modalApi.close();
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}

const getModalTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);
</script>
<template>
  <Modal class="w-full max-w-[1080px]" :title="getModalTitle">
    <Form />
  </Modal>
</template>
