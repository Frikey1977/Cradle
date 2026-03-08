<script lang="ts" setup>
import type { OrganizationApi } from "#/api/organization/departments";

import { computed, h, nextTick, onMounted, ref, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Card, Form, Input, message, Select, Space, Tabs } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { createOrg, updateOrg } from "#/api/organization/departments";
import { getEmployeeList } from "#/api/organization/employees";
import { useAiAssist } from "#/components/smart-form";
import { $t } from "#/locales";

import { generateTitle, setCurrentOrgSid, useBasicInfoSchema, useCultureSchema } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<OrganizationApi.Organization>();
const activeTab = ref("basic");
const isNew = computed(() => !formData.value?.sid);

// 当前表单值缓存，用于生成 title
const currentType = ref<string>("departments");
const currentCode = ref<string>("");

// title 字段翻译后缀
const titleSuffix = ref<string>();

// 当前部门ID（用于加载负责人选项）
const currentOrgId = ref<string | undefined>();

// 员工选项列表
const employeeOptions = ref<{ label: string; value: string }[]>([]);

// 加载部门下的员工列表
async function loadEmployeeOptions(orgId?: string) {
  if (!orgId) {
    employeeOptions.value = [];
    return;
  }
  try {
    const result = await getEmployeeList({
      oid: orgId,
      pageSize: 1000,
    });
    employeeOptions.value = result.items.map((emp) => ({
      label: emp.name,
      value: emp.id,
    }));
  } catch {
    employeeOptions.value = [];
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

/**
 * 处理 title 生成
 * 当 type 或 code 变化时触发
 */
async function handleTitleChange(type: string, code: string) {
  // 更新缓存值
  if (type) currentType.value = type;
  if (code) currentCode.value = code;

  // 生成 title
  const title = generateTitle(currentType.value, currentCode.value);
  if (title) {
    await basicFormApi.setFieldValue("title", title);
  }
}

// 基本信息表单
const [BasicForm, basicFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useBasicInfoSchema(handleTitleChange, titleSuffix, currentOrgId, employeeOptions),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmitBasic,
});

// 企业文化描述表单（使用 culture 字段）
const [CultureForm, cultureFormApi] = useVbenForm({
  commonConfig: {
    colon: false,
    hideLabel: true,
    formItemClass: "col-span-1",
  },
  schema: useCultureSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1",
  handleSubmit: onSubmitCulture,
});

// AI 辅助功能
let aiAssistUnmount: (() => void) | null = null;

/**
 * 初始化 AI 辅助功能
 * 动态挂载到 description 字段
 */
function initAiAssist() {
  // 使用 nextTick 等待 DOM 更新完成
  nextTick(() => {
    // 查找 description 文本域
    const textarea = document.querySelector(
      'textarea[name="description"]'
    ) as HTMLTextAreaElement;

    if (!textarea) {
      console.warn("未找到 description 字段");
      return;
    }

    // 创建 AI 辅助实例
    const aiAssist = useAiAssist({
      module: "organization",
      formType: "department",
      fieldName: "description",
      prompt:
        "根据部门名称、类型和上级组织，生成一段专业、简洁的部门描述（100-300字）。描述应体现部门职责、定位和价值。",
      maxLength: 300,
      getFormData: async () => {
        return (await basicFormApi.getValues()) || {};
      },
      buttonOffset: 48, // 向上偏移，避开字数统计
    });

    // 挂载到文本域
    const result = aiAssist.mount(textarea);
    aiAssistUnmount = result.unmount;
  });
}

const [Modal, modalApi] = useVbenModal({
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    // 根据当前激活的 Tab 提交对应的表单
    switch (activeTab.value) {
      case "basic":
        await basicFormApi.validateAndSubmitForm();
        break;
      case "culture":
        await cultureFormApi.validateAndSubmitForm();
        break;
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<OrganizationApi.Organization>();
      if (data) {
        formData.value = data;
        setCurrentOrgSid(data.sid);
        // 设置当前部门ID并加载员工列表
        currentOrgId.value = data.sid;
        await loadEmployeeOptions(data.sid);
        loadFormData(data);
        // 如果有 title，设置翻译后缀
        titleSuffix.value = formData.value.title
          ? $t(formData.value.title)
          : undefined;
      } else {
        formData.value = undefined;
        setCurrentOrgSid(undefined);
        currentOrgId.value = undefined;
        employeeOptions.value = [];
        activeTab.value = "basic";
        resetAllForms();
        titleSuffix.value = undefined;
      }
      // 打开时初始化 AI 辅助
      initAiAssist();
    } else {
      // 关闭时卸载
      if (aiAssistUnmount) {
        aiAssistUnmount();
        aiAssistUnmount = null;
      }
    }
  },
});

// 加载表单数据
function loadFormData(data: OrganizationApi.Organization) {
  // 基本信息
  basicFormApi.setValues({
    ...data,
  });

  // 企业文化描述 - 纯文本字段（使用 culture 字段）
  cultureFormApi.setValues({
    culture: data.culture || "",
  });
}

function resetAllForms() {
  basicFormApi.resetForm();
  cultureFormApi.resetForm();
}

// 提交基本信息（创建或更新）
async function onSubmitBasic(values: Record<string, any>) {
  // 如果是新建，需要创建部门
  if (isNew.value) {
    modalApi.lock();
    try {
      const data = values as Omit<OrganizationApi.Organization, "sid" | "children" | "path" | "createTime">;
      await createOrg(data);
      message.success($t("ui.actionMessage.operationSuccess"));
      modalApi.close();
      emit("success");
    } catch (error) {
      message.error($t("ui.actionMessage.operationFailed"));
    } finally {
      modalApi.unlock();
    }
  } else {
    // 更新基本信息
    modalApi.lock();
    try {
      const { sid, children, path, createTime, culture, ...updateData } = values as any;
      await updateOrg(formData.value!.sid, updateData);
      message.success($t("ui.actionMessage.operationSuccess"));
      // 更新本地数据
      formData.value = { ...formData.value!, ...updateData };
    } catch (error) {
      message.error($t("ui.actionMessage.operationFailed"));
    } finally {
      modalApi.unlock();
    }
  }
}

// 提交企业文化描述（使用 culture 字段）
async function onSubmitCulture(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.departments.saveBasicFirst"));
    return;
  }

  try {
    const culture = values.culture || "";
    await updateOrg(formData.value!.sid, { culture });
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.culture = culture;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <Tabs.TabPane key="basic" :tab="$t('organization.departments.tabs.basic')">
        <BasicForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="culture" :tab="$t('organization.departments.tabs.culture')" :disabled="isNew">
        <CultureForm />
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>
