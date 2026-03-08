<script lang="ts" setup>
import type { LlmConfigApi, ModelParameters } from "#/api/llm/configs";

import { ref, onMounted, computed } from "vue";

import { preferences } from '@vben/preferences';

import { useVbenModal } from "@vben/common-ui";
import { $t } from "#/locales";
import { useVbenForm, z } from "#/adapter/form";

import { message } from "ant-design-vue";

import {
  createConfig,
  updateConfig,
  DefaultConfigTemplates,
} from "#/api/llm/configs";
import { getCodeOptionsByParentValue } from "#/api/system/codes";

const emit = defineEmits<{
  success: [];
}>();

const providerId = ref<string>("");
const providerName = ref<string>("");
const editingConfigId = ref<string | null>(null);

// 代码配置选项
const codeOptions = ref<{
  subscribeType: { label: string; value: string }[];
  configType: { label: string; value: string }[];
  authMethod: { label: string; value: string }[];
  modelType: { label: string; value: string }[];
  enableThinking: { label: string; value: string }[];
  stream: { label: string; value: string }[];
  providerDirectory: { label: string; value: string }[];
  modelAbility: { label: string; value: string }[];
}>({
  subscribeType: [],
  configType: [],
  authMethod: [],
  modelType: [],
  enableThinking: [],
  stream: [],
  providerDirectory: [],
  modelAbility: [],
});

// 加载所有代码配置选项
async function loadCodeOptions() {
  try {
    // 加载订阅类型选项
    const subscribeOptions = await getCodeOptionsByParentValue("llm.providers.subscribe");
    const mappedSubscribeOptions = subscribeOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.subscribeType = mappedSubscribeOptions;

    // 加载配置类型选项 (状态)
    const configTypeOptions = await getCodeOptionsByParentValue("llm.config.status");
    const mappedConfigTypeOptions = configTypeOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.configType = mappedConfigTypeOptions;

    // 加载认证方式选项
    const authMethodOptions = await getCodeOptionsByParentValue("llm.providers.auth");
    const mappedAuthMethodOptions = authMethodOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.authMethod = mappedAuthMethodOptions;

    // 加载模型类别选项
    const modelTypeOptions = await getCodeOptionsByParentValue("llm.models.type");
    const mappedModelTypeOptions = modelTypeOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.modelType = mappedModelTypeOptions;

    // 加载思考模式选项
    const thinkingOptions = await getCodeOptionsByParentValue("llm.models.thinking");
    const mappedThinkingOptions = thinkingOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.enableThinking = mappedThinkingOptions;

    // 加载流式输出选项
    const streamOptions = await getCodeOptionsByParentValue("llm.models.stream");
    const mappedStreamOptions = streamOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.stream = mappedStreamOptions;

    // 加载提供商目录选项
    const providerDirectoryOptions = await getCodeOptionsByParentValue("llm.providers.directory");
    const mappedProviderDirectoryOptions = providerDirectoryOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.providerDirectory = mappedProviderDirectoryOptions;

    // 加载模型能力选项
    const modelAbilityOptions = await getCodeOptionsByParentValue("llm.models.ability");
    const mappedModelAbilityOptions = modelAbilityOptions.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    codeOptions.value.modelAbility = mappedModelAbilityOptions;

    // 更新表单字段的选项
    await formApi.updateSchema([
      {
        fieldName: 'subscribeType',
        componentProps: {
          options: mappedSubscribeOptions,
        },
      },
      {
        fieldName: 'status',
        componentProps: {
          options: mappedConfigTypeOptions,
        },
      },
      {
        fieldName: 'authMethod',
        componentProps: {
          options: mappedAuthMethodOptions,
        },
      },
      {
        fieldName: 'modelType',
        componentProps: {
          options: mappedModelTypeOptions,
        },
      },
      {
        fieldName: 'enableThinking',
        componentProps: {
          options: mappedThinkingOptions,
        },
      },
      {
        fieldName: 'stream',
        componentProps: {
          options: mappedStreamOptions,
        },
      },
      {
        fieldName: 'providerName',
        componentProps: {
          options: mappedProviderDirectoryOptions,
        },
      },
      {
        fieldName: 'modelAbility',
        componentProps: {
          options: mappedModelAbilityOptions,
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



// 根据语言动态计算 label 宽度
const labelWidth = computed(() => {
  // 中文需要更宽的 label
  return preferences.app.locale === 'zh-CN' ? 120 : 200;
});

const [Form, formApi] = useVbenForm({
  handleSubmit: onSubmit,
  layout: 'horizontal',
  wrapperClass: 'grid-cols-2',
  commonConfig: {
    labelWidth: labelWidth.value,
  },
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('llm.configs.namePlaceholder'),
      },
      fieldName: 'name',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('llm.configs.descriptionPlaceholder'),
        rows: 2,
      },
      fieldName: 'description',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.description'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'providerName',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('llm.configs.providerName'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'modelType',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('llm.configs.modelType'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'subscribeType',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('llm.configs.subscribeType'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'https://api.example.com/v1',
      },
      fieldName: 'baseUrl',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.baseUrl'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'authMethod',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('llm.configs.authMethod'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'gpt-4o, qwen-max, claude-3-sonnet...',
      },
      fieldName: 'modelName',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.modelName'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1024,
        max: 2000000,
        placeholder: '8192',
        style: { width: '100%' },
      },
      fieldName: 'contextSize',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.contextSize'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'enableThinking',
      label: $t('llm.configs.enableThinking'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'stream',
      label: $t('llm.configs.stream'),
    },
    {
      component: 'CheckboxGroup',
      componentProps: {
        options: [],
      },
      fieldName: 'modelAbility',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('llm.configs.modelAbility'),
    },
    // 模型参数
    {
      component: 'Divider',
      componentProps: {
        orientation: 'left',
      },
      fieldName: 'paramsDivider',
      formItemClass: 'col-span-2',
      label: '',
      renderComponentContent: () => ({ default: () => $t('llm.configs.parameters') }),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: "{'maxTokens': 4096, 'temperature': 0.7}",
        rows: 4,
      },
      fieldName: 'parametersJson',
      formItemClass: 'col-span-2',
      label: $t('llm.configs.parameters'),
      rules: z.string().refine((val) => {
        if (!val || val.trim() === '') return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      }, $t('llm.configs.parametersInvalidJson')),
    },
    // 高级设置
    {
      component: 'Divider',
      componentProps: {
        orientation: 'left',
      },
      fieldName: 'advancedDivider',
      formItemClass: 'col-span-2',
      label: '',
      renderComponentContent: () => ({ default: () => $t('llm.configs.advancedSettings') }),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 1000,
        max: 300000,
        placeholder: '30000',
        style: { width: '100%' },
      },
      fieldName: 'timeout',
      label: $t('llm.configs.timeout'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        max: 10,
        placeholder: '3',
        style: { width: '100%' },
      },
      fieldName: 'retries',
      label: $t('llm.configs.retries'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: '0',
        style: { width: '100%' },
      },
      fieldName: 'sort',
      label: $t('common.sort'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [],
      },
      fieldName: 'status',
      formItemClass: 'col-span-2',
      controlClass: 'w-full',
      label: $t('common.status'),
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  class: 'w-[1080px]',
  fullscreenButton: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    await formApi.validateAndSubmitForm();
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      // 每次打开 Modal 时重新加载代码选项
      loadCodeOptions();
      
      const data = modalApi.getData<{
        providerId: string;
        providerName: string;
        config?: LlmConfigApi.LlmConfig;
      }>();
      if (data) {
        providerId.value = data.providerId;
        providerName.value = data.providerName;
        
        if (data.config) {
          // 编辑模式
          editingConfigId.value = data.config.sid;
          modalApi.setState({ title: $t('llm.configs.edit') });
          formApi.setValues({
            name: data.config.name,
            description: data.config.description || '',
            baseUrl: data.config.baseUrl,
            modelName: data.config.modelName,
            modelType: data.config.modelType || 'text',
            subscribeType: data.config.subscribeType || 'usage',
            status: data.config.status,
            contextSize: data.config.contextSize,
            enableThinking: data.config.enableThinking,
            stream: data.config.stream,
            authMethod: data.config.authMethod,
            providerName: data.config.providerName || '',
            modelAbility: data.config.modelAbility || [],
            parametersJson: data.config.parameters ? JSON.stringify(data.config.parameters, null, 2) : '',
            timeout: data.config.timeout,
            retries: data.config.retries,
            sort: data.config.sort,
          });
        } else {
          // 创建模式
          editingConfigId.value = null;
          modalApi.setState({ title: $t('llm.configs.create') });
          const template = DefaultConfigTemplates[data.providerName] || {};
          formApi.setValues({
            name: '',
            description: '',
            baseUrl: template.baseUrl || '',
            modelName: '',
            modelType: 'text',
            enableThinking: 'disabled',
            stream: 'enabled',
            subscribeType: 'usage',
            status: 'enabled',
            contextSize: 8192,
            authMethod: 'api_key',
            providerName: data.providerName || '',
            modelAbility: [],
            parametersJson: '',
            timeout: 30000,
            retries: 3,
            sort: 0,
          });
        }
      }
    }
  },
});

async function onSubmit(values: Record<string, any>) {
  try {
    // 解析 parameters JSON
    let parameters: ModelParameters | undefined;
    if (values.parametersJson && values.parametersJson.trim() !== '') {
      try {
        parameters = JSON.parse(values.parametersJson) as ModelParameters;
      } catch {
        message.error($t('llm.configs.parametersJsonError'));
        return;
      }
    }

    const submitData: LlmConfigApi.CreateConfigDto = {
      name: values.name,
      description: values.description,
      providerId: providerId.value,
      baseUrl: values.baseUrl,
      modelName: values.modelName,
      modelType: values.modelType,
      subscribeType: values.subscribeType,
      icon: values.icon,
      contextSize: values.contextSize,
      enableThinking: values.enableThinking,
      stream: values.stream,
      authMethod: values.authMethod,
      providerName: values.providerName,
      modelAbility: values.modelAbility,
      parameters,
      timeout: values.timeout,
      retries: values.retries,
      sort: values.sort,
      status: values.status,
    };

    if (editingConfigId.value) {
      await updateConfig(editingConfigId.value, submitData);
      message.success($t('ui.actionMessage.updateSuccess'));
    } else {
      await createConfig(submitData);
      message.success($t('ui.actionMessage.createSuccess'));
    }

    modalApi.close();
    emit('success');
  } catch (error) {
    message.error(editingConfigId.value ? $t('ui.actionMessage.updateFailed') : $t('ui.actionMessage.createFailed'));
  }
}
</script>

<template>
  <Modal>
    <Form />
  </Modal>
</template>
