<script lang="ts" setup>
import { useVbenModal } from "@vben/common-ui";
import { message } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { resetPassword } from "#/api/system/users";
import { $t } from "#/locales";

import { useResetPasswordSchema } from "../data";

const emit = defineEmits<{
  success: [];
}>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useResetPasswordSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1 gap-x-4",
});

const [Modal, modalApi] = useVbenModal({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<{ userId: string; username: string }>();
      if (data) {
        formApi.resetForm();
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    modalApi.lock();
    const data = await formApi.getValues<{ newPassword: string }>();
    const modalData = modalApi.getData<{ userId: string; username: string }>();

    try {
      await resetPassword(modalData.userId, { newPassword: data.newPassword });
      message.success($t("system.users.resetPasswordSuccess"));
      modalApi.close();
      emit("success");
    } catch (error: any) {
      message.error(error.message || $t("ui.actionMessage.operationFailed"));
    } finally {
      modalApi.unlock();
    }
  }
}
</script>

<template>
  <Modal class="w-full max-w-[500px]" :title="$t('system.users.resetPasswordTitle')">
    <div class="mb-4 text-sm text-gray-500">
      {{ $t("system.users.resetPasswordDesc") }}
    </div>
    <Form />
  </Modal>
</template>
