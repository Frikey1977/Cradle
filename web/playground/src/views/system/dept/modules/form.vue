<script lang="ts" setup>
import type { SystemDeptApi } from "#/api/system/departments";

import { computed, ref } from "vue";

import { useVbenDrawer } from "@vben/common-ui";

import { useVbenForm } from "#/adapter/form";
import { createDept, updateDept } from "#/api/system/departments";
import { $t } from "#/locales";

import { useSchema } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemDeptApi.SystemDept>();

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t("ui.actionTitle.edit", [$t("system.departments.name")])
    : $t("ui.actionTitle.create", [$t("system.departments.name")]),
);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-2 md:col-span-1",
  },
  schema: useSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemDeptApi.SystemDept>();
      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
      } else {
        formData.value = undefined;
        formApi.resetForm();
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    const data = await formApi.getValues<
      Omit<SystemDeptApi.SystemDept, "id" | "children">
    >();
    try {
      await (formData.value?.id
        ? updateDept(formData.value.id, data)
        : createDept(data));
      drawerApi.close();
      emit("success");
    } finally {
      drawerApi.unlock();
    }
  }
}
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
