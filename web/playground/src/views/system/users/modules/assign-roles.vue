<script lang="ts" setup>
import { useVbenModal } from "@vben/common-ui";
import { message, Checkbox, Spin } from "ant-design-vue";
import { ref } from "vue";

import { assignUserRoles, getUserRoles, getAllRoles } from "#/api/system/users";
import { $t } from "#/locales";
import type { SystemUserApi } from "#/api/system/users";

const emit = defineEmits<{
  success: [];
}>();

const [Modal, modalApi] = useVbenModal({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<{ userId: string; username: string }>();
      if (data) {
        loadData(data.userId);
      }
    }
  },
});

const loading = ref(false);
const allRoles = ref<SystemUserApi.UserRole[]>([]);
const selectedRoleIds = ref<string[]>([]);
const currentUserId = ref<string>("");

async function loadData(userId: string) {
  loading.value = true;
  currentUserId.value = userId;
  selectedRoleIds.value = [];

  try {
    // 并行加载所有角色和当前用户角色
    const [rolesResult, userRolesResult] = await Promise.all([
      getAllRoles(),
      getUserRoles(userId),
    ]);

    allRoles.value = rolesResult;
    selectedRoleIds.value = userRolesResult.roles.map((role) => role.id);
  } catch (error: any) {
    message.error(error.message || $t("ui.actionMessage.loadFailed"));
  } finally {
    loading.value = false;
  }
}

function handleRoleChange(roleId: string, checked: boolean) {
  if (checked) {
    if (!selectedRoleIds.value.includes(roleId)) {
      selectedRoleIds.value.push(roleId);
    }
  } else {
    selectedRoleIds.value = selectedRoleIds.value.filter((id) => id !== roleId);
  }
}

async function onSubmit() {
  modalApi.lock();

  try {
    await assignUserRoles(currentUserId.value, {
      roleIds: selectedRoleIds.value,
    });
    message.success($t("system.users.assignRolesSuccess"));
    modalApi.close();
    emit("success");
  } catch (error: any) {
    message.error(error.message || $t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}
</script>

<template>
  <Modal class="w-full max-w-[600px]" :title="$t('system.users.assignRolesTitle')">
    <Spin :spinning="loading">
      <div class="max-h-[400px] overflow-y-auto">
        <div v-if="allRoles.length === 0" class="py-8 text-center text-gray-500">
          {{ $t("system.users.noRolesAvailable") }}
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="role in allRoles"
            :key="role.id"
            class="flex items-center justify-between rounded border p-3 hover:bg-gray-50"
          >
            <div class="flex items-center gap-3">
              <Checkbox
                :checked="selectedRoleIds.includes(role.id)"
                @change="(e) => handleRoleChange(role.id, e.target.checked)"
              />
              <div>
                <div class="font-medium">{{ role.name }}</div>
                <div v-if="role.permissions && role.permissions.length > 0" class="mt-1 text-xs text-gray-500">
                  {{ $t("system.users.permissionsCount", [role.permissions.length]) }}
                </div>
              </div>
            </div>
            <span
              :class="role.status === 1 ? 'text-green-500' : 'text-red-500'"
              class="text-xs"
            >
              {{ role.status === 1 ? $t("common.enabled") : $t("common.disabled") }}
            </span>
          </div>
        </div>
      </div>
    </Spin>
  </Modal>
</template>
