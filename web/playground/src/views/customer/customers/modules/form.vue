<script lang="ts" setup>
import type { CustomerApi } from "#/api/customer/customers";

import { computed, ref } from "vue";

import { useVbenModal } from "@vben/common-ui";

import { message } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { createCustomer, updateCustomer } from "#/api/customer/customers";
import { $t } from "#/locales";

import { useFormSchema, getEmployeeOptions } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<CustomerApi.Customer>();
const isNew = computed(() => !formData.value?.sid);
const employeeOptions = ref<{ label: string; value: string }[]>([]);

// 加载员工选项
async function loadEmployeeOptions() {
  try {
    const options = await getEmployeeOptions();
    employeeOptions.value = options;
  } catch {
    employeeOptions.value = [];
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useFormSchema(employeeOptions),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmit,
});

async function onSubmit(values: Record<string, any>) {
  try {
    if (isNew.value) {
      await createCustomer(values as CustomerApi.CreateCustomerDto);
      message.success($t("ui.actionMessage.createSuccess"));
    } else {
      await updateCustomer(formData.value!.sid, values as CustomerApi.UpdateCustomerDto);
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
      await loadEmployeeOptions();
      const data = modalApi.getData<CustomerApi.Customer>();
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
