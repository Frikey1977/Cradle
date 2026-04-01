<script lang="ts" setup>
import type { DealApi } from "#/api/customer/deals";

import { computed, ref, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";

import { message } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { createDeal, updateDeal } from "#/api/customer/deals";
import { $t } from "#/locales";

import { useFormSchema, getCustomerOptions, getOpportunityOptions, getEmployeeOptions } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<DealApi.Deal>();
const isNew = computed(() => !formData.value?.sid);
const customerOptions = ref<{ label: string; value: string }[]>([]);
const opportunityOptions = ref<{ label: string; value: string }[]>([]);
const employeeOptions = ref<{ label: string; value: string }[]>([]);
const selectedCustomerId = ref<string>("");

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

// 根据客户加载商机
async function loadOpportunities(customerId?: string) {
  if (!customerId) {
    opportunityOptions.value = [];
    return;
  }
  try {
    const options = await getOpportunityOptions(customerId);
    opportunityOptions.value = options;
  } catch {
    opportunityOptions.value = [];
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useFormSchema(customerOptions, opportunityOptions, employeeOptions),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmit,
});

async function onSubmit(values: Record<string, any>) {
  try {
    if (isNew.value) {
      await createDeal(values as DealApi.CreateDealDto);
      message.success($t("ui.actionMessage.createSuccess"));
    } else {
      await updateDeal(formData.value!.sid, values as DealApi.UpdateDealDto);
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
      const data = modalApi.getData<DealApi.Deal>();
      if (data) {
        formData.value = data;
        selectedCustomerId.value = data.customerId;
        await loadOpportunities(data.customerId);
        formApi.setValues(data);
      } else {
        formData.value = undefined;
        selectedCustomerId.value = "";
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

// 监听客户变化，加载对应的商机
watch(selectedCustomerId, async (newVal) => {
  if (newVal) {
    await loadOpportunities(newVal);
  } else {
    opportunityOptions.value = [];
  }
});
</script>

<template>
  <Modal :title="getModalTitle" class="w-[1080px]">
    <Form />
  </Modal>
</template>
