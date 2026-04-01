<script lang="ts" setup>
import type { OpportunityApi } from "#/api/customer/opportunities";

import { computed, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";

import { message } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { createOpportunity, updateOpportunity } from "#/api/customer/opportunities";
import { $t } from "#/locales";

import { useFormSchema, getCustomerOptions, getEmployeeOptions } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<OpportunityApi.Opportunity>();
const isNew = computed(() => !formData.value?.sid);
const customerOptions = ref<{ label: string; value: string }[]>([]);
const employeeOptions = ref<{ label: string; value: string }[]>([]);

// 加载选项数据
async function loadOptions() {
  try {
    const [customers, employees] = await Promise.all([
      getCustomerOptions(),
      getEmployeeOptions(),
    ]);
    customerOptions.value = customers;
    employeeOptions.value = employees;
  } catch {
    customerOptions.value = [];
    employeeOptions.value = [];
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useFormSchema(customerOptions, employeeOptions),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmit,
});

async function onSubmit(values: Record<string, any>) {
  try {
    if (isNew.value) {
      await createOpportunity(values as OpportunityApi.CreateOpportunityDto);
      message.success($t("ui.actionMessage.createSuccess"));
    } else {
      await updateOpportunity(formData.value!.sid, values as OpportunityApi.UpdateOpportunityDto);
      message.success($t("ui.actionMessage.updateSuccess"));
    }
    emit("success");
    modalApi.close();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen) {
    if (isOpen) {
      await loadOptions();
      const data = modalApi.getData<OpportunityApi.Opportunity>();
      if (data) {
        formData.value = data;
        formApi.setValues(data);
      } else {
        formData.value = undefined;
        formApi.resetForm();
      }
    }
  },
  onConfirm: async () => {
    await formApi.validateAndSubmitForm();
  },
});

const getModalTitle = computed(() => {
  return isNew.value ? $t("common.create") : $t("common.edit");
});
</script>

<template>
  <Modal :title="getModalTitle" class="w-[1080px]">
    <Form />
  </Modal>
</template>
