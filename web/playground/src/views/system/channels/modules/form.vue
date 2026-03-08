<script lang="ts" setup>
import type { VbenFormSchema } from "#/adapter/form";
import type { ChannelApi } from "#/api/system/channels";

import { computed, onMounted, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { $t } from "#/locales";
import { message } from "ant-design-vue";

import { useVbenForm, z } from "#/adapter/form";
import {
  createChannel,
  isChannelNameExists,
  updateChannel,
} from "#/api/system/channels";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import type { SystemCodeApi } from "#/api/system/codes";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<ChannelApi.Channel>();
const channelNameOptions = ref<{ label: string; value: string; metadata?: any }[]>([]);
const statusOptions = ref<{ label: string; value: string }[]>([]);
const rawCodeOptions = ref<SystemCodeApi.Code[]>([]);
const isOptionsLoaded = ref(false);

// 根据通道名称获取默认配置
function getDefaultConfig(channelName: string): Record<string, any> {
  const option = rawCodeOptions.value.find(opt => opt.value === channelName);
  if (option?.metadata) {
    try {
      return typeof option.metadata === 'string' 
        ? JSON.parse(option.metadata) 
        : option.metadata;
    } catch {
      return {};
    }
  }
  return {};
}

// 加载通道名称选项
async function loadChannelNameOptions() {
  try {
    const options = await getCodeOptionsByParentValue("system.channels.client");
    rawCodeOptions.value = options as unknown as SystemCodeApi.Code[];
    const mappedOptions = options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
      metadata: opt.metadata,
    }));
    channelNameOptions.value = mappedOptions;

    // 更新表单字段的选项
    await formApi.updateSchema([
      {
        fieldName: "name",
        componentProps: {
          options: mappedOptions,
          async onChange(e: any) {
            const newName = e?.target?.value;
            if (newName) {
              const defaultConfig = getDefaultConfig(newName);
              await formApi.setFieldValue("config", JSON.stringify(defaultConfig, null, 2));
            }
          },
        },
      },
    ]);

    return mappedOptions;
  } catch (error) {
    console.error("加载通道名称选项失败:", error);
    return [];
  }
}

// 加载状态选项
async function loadStatusOptions() {
  try {
    const options = await getCodeOptionsByParentValue("system.channels.status");
    const mappedOptions = options.map((opt) => ({
      label: opt.title ? $t(opt.title) : opt.label,
      value: opt.value,
    }));
    statusOptions.value = mappedOptions;

    // 更新表单字段的选项
    await formApi.updateSchema([
      {
        fieldName: "status",
        componentProps: {
          options: mappedOptions,
        },
      },
    ]);

    return mappedOptions;
  } catch (error) {
    console.error("加载状态选项失败:", error);
    return [];
  }
}

// 加载所有选项
async function loadAllOptions() {
  if (isOptionsLoaded.value) return;
  
  await Promise.all([
    loadChannelNameOptions(),
    loadStatusOptions(),
  ]);
  
  isOptionsLoaded.value = true;
}

onMounted(async () => {
  await loadAllOptions();
});

// 存储当前编辑的通道ID（用于验证时排除自己）
let currentEditingChannelId: string | undefined = undefined;

const schema: VbenFormSchema[] = [
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: "solid",
      optionType: "button",
      options: [],
    },
    fieldName: "name",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("system.channels.name"),
    rules: z
      .string()
      .min(1, $t("ui.formRules.minLength", [$t("system.channels.name"), 1]))
      .max(100, $t("ui.formRules.maxLength", [$t("system.channels.name"), 100]))
      .refine(
        async (value: string) => {
          if (!value) return true;
          return !(await isChannelNameExists(value, currentEditingChannelId));
        },
        (value) => ({
          message: $t("ui.formRules.alreadyExists", [$t("system.channels.name"), value]),
        }),
      ),
  },
  {
    component: "Textarea",
    componentProps: {
      placeholder: $t("system.channels.descriptionPlaceholder"),
      rows: 3,
    },
    fieldName: "description",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("system.channels.description"),
    rules: z.string().max(500, $t("ui.formRules.maxLength", [$t("system.channels.description"), 500])).optional(),
  },
  {
    component: "Textarea",
    componentProps: {
      placeholder: '请输入JSON格式的配置，例如：\n{\n  "appKey": "xxx",\n  "appSecret": "xxx"\n}',
      rows: 10,
    },
    fieldName: "config",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("system.channels.config"),
  },
  {
    component: "Textarea",
    componentProps: {
      placeholder: '请输入JSON格式的客户端配置，用于Cradle连接Gateway时握手，例如：\n{\n  "endpoint": "ws://gateway:8080",\n  "token": "xxx"\n}',
      rows: 6,
    },
    fieldName: "clientConfig",
    formItemClass: "col-span-2",
    controlClass: "w-full",
    label: $t("system.channels.clientConfig"),
  },
  {
    component: "RadioGroup",
    componentProps: {
      buttonStyle: "solid",
      optionType: "button",
      options: [],
    },
    defaultValue: "disabled",
    fieldName: "status",
    label: $t("system.channels.status.title"),
  },
];

const getDrawerTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema,
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

const [Drawer, drawerApi] = useVbenModal({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      // 确保选项已加载
      await loadAllOptions();
      
      const data = drawerApi.getData<ChannelApi.Channel>();
      if (data) {
        // 设置当前编辑的通道ID，用于验证时排除自己
        currentEditingChannelId = data.sid;
        formData.value = data;
        // 将 config 和 clientConfig 对象转换为 JSON 字符串显示
        const values = { ...data };
        if (values.config && typeof values.config === "object") {
          values.config = JSON.stringify(values.config, null, 2);
        }
        if (values.clientConfig && typeof values.clientConfig === "object") {
          values.clientConfig = JSON.stringify(values.clientConfig, null, 2);
        }
        await formApi.setValues(values);
      } else {
        // 新建时清空编辑ID
        currentEditingChannelId = undefined;
        formData.value = undefined;
        await formApi.resetForm();
        // 新建时默认选择第一个通道名称
        if (channelNameOptions.value.length > 0) {
          const firstOption = channelNameOptions.value[0];
          await formApi.setFieldValue("name", firstOption.value);
          const defaultConfig = getDefaultConfig(firstOption.value);
          await formApi.setFieldValue("config", JSON.stringify(defaultConfig, null, 2));
        }
        // 新建时默认选择第一个状态
        if (statusOptions.value.length > 0) {
          await formApi.setFieldValue("status", statusOptions.value[0].value);
        }
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    try {
      const formValues = await formApi.getValues();

      // 确保 config 是对象
      let configValue: Record<string, any> = {};
      if (formValues.config) {
        if (typeof formValues.config === "string") {
          try {
            configValue = JSON.parse(formValues.config);
          } catch {
            configValue = {};
          }
        } else if (typeof formValues.config === "object") {
          configValue = formValues.config as Record<string, any>;
        }
      }

      // 确保 clientConfig 是对象
      let clientConfigValue: Record<string, any> | undefined = undefined;
      if (formValues.clientConfig) {
        if (typeof formValues.clientConfig === "string") {
          try {
            clientConfigValue = JSON.parse(formValues.clientConfig);
          } catch {
            clientConfigValue = undefined;
          }
        } else if (typeof formValues.clientConfig === "object") {
          clientConfigValue = formValues.clientConfig as Record<string, any>;
        }
      }

      // 构建提交数据
      const submitData: ChannelApi.CreateChannelDto = {
        name: formValues.name,
        description: formValues.description,
        status: formValues.status,
        config: configValue,
        clientConfig: clientConfigValue,
      };

      await (formData.value?.sid
        ? updateChannel(formData.value.sid, submitData)
        : createChannel(submitData));
      message.success($t("ui.actionMessage.operationSuccess"));
      drawerApi.close();
      emit("success");
    } catch (error: any) {
      message.error(error.message || $t("ui.actionMessage.operationFailed"));
    } finally {
      drawerApi.unlock();
    }
  }
}
</script>

<template>
  <Drawer class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
