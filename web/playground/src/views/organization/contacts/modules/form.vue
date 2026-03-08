<script lang="ts" setup>
import type { OrganizationContactApi } from "#/api/organization/contacts";
import type { ChannelContactApi } from "#/api/system/channel-contacts";

import { computed, ref, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Card, Form, Input, message, Select, Space, Tabs } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import {
  createContact,
  updateContact,
} from "#/api/organization/contacts";
import {
  updateContactProfile,
} from "#/api/organization/contact-fields";
import {
  getChannelContactList,
  createChannelContact,
  updateChannelContact,
  deleteChannelContact,
} from "#/api/system/channel-contacts";
import { getChannelList } from "#/api/system/channels";
import { $t } from "#/locales";

import {
  useBasicInfoSchema,
  useProfileSchema,
} from "./schema";

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<OrganizationContactApi.Contact>();
const activeTab = ref("basic");
const isNew = computed(() => !formData.value?.sid);

// 通道联系人关系列表
const channelContacts = ref<ChannelContactApi.ChannelContact[]>([]);
const channelContactsLoading = ref(false);

// 通道选项（来自通道管理 API）
const channelOptions = ref<{ label: string; value: string }[]>([]);

// 新增/编辑关系表单
const editingRecord = ref<ChannelContactApi.ChannelContact | null>(null);
const newChannelId = ref("");
const newSender = ref("");
const senderError = ref("");
const channelError = ref("");
const formRef = ref();

// 验证通道是否已绑定
function validateChannel(): boolean {
  channelError.value = "";

  if (!newChannelId.value || editingRecord.value) {
    return true;
  }

  // 检查当前Contact是否已绑定该通道
  const exists = channelContacts.value.some(
    (item) => item.channelId === newChannelId.value
  );

  if (exists) {
    channelError.value = $t("organization.contacts.channels.channelBound");
    return false;
  }

  return true;
}

// 验证 sender 是否重复
function validateSender(): boolean {
  senderError.value = "";

  if (!newChannelId.value || !newSender.value) {
    return true;
  }

  // 检查是否在当前列表中已存在（排除正在编辑的记录）
  const exists = channelContacts.value.some(
    (item) =>
      item.channelId === newChannelId.value &&
      item.sender === newSender.value &&
      (!editingRecord.value ||
        !(item.channelId === editingRecord.value.channelId &&
          item.contactId === editingRecord.value.contactId))
  );

  if (exists) {
    senderError.value = $t("organization.contacts.channels.senderExists");
    return false;
  }

  return true;
}

// 监听通道变化，验证通道和 sender
watch(newChannelId, () => {
  validateChannel();
  if (newSender.value) {
    validateSender();
  }
});

// 监听 sender 变化，实时验证
watch(newSender, () => {
  if (newSender.value) {
    validateSender();
  }
});

// 加载通道选项（从通道管理 API 获取）
async function loadChannelOptions() {
  try {
    const channels = await getChannelList();
    channelOptions.value = channels
      .filter(channel => channel.sid)
      .map((channel) => ({
        label: channel.name,
        value: channel.sid,
      }));
  } catch (error) {
    console.error('Failed to load channel options:', error);
  }
}

// 加载通道联系人关系列表
async function loadChannelContacts() {
  if (!formData.value?.sid) return;

  channelContactsLoading.value = true;
  try {
    const list = await getChannelContactList({ contactId: formData.value.sid });
    channelContacts.value = list;
  } catch (error) {
    console.error('Failed to load channel contacts:', error);
  } finally {
    channelContactsLoading.value = false;
  }
}

const getModalTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit", [$t("organization.contacts.name")])
    : $t("ui.actionTitle.create", [$t("organization.contacts.name")]),
);

// 基本信息表单
const [BasicForm, basicFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-2 md:col-span-1",
  },
  schema: useBasicInfoSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmitBasic,
});

// 偏好管理表单（使用 profile 字段）
const [ProfileForm, profileFormApi] = useVbenForm({
  commonConfig: {
    colon: false,
    hideLabel: true,
    formItemClass: "col-span-1",
  },
  schema: useProfileSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1",
  handleSubmit: onSubmitProfile,
});

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    // 根据当前激活的 Tab 提交对应的表单
    switch (activeTab.value) {
      case "basic":
        await basicFormApi.validateAndSubmitForm();
        break;
      case "preferences":
        await profileFormApi.validateAndSubmitForm();
        break;
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<OrganizationContactApi.Contact>();
      if (data) {
        formData.value = data;
        loadFormData(data);
        loadChannelContacts();
      } else {
        formData.value = undefined;
        activeTab.value = "basic";
        resetAllForms();
        channelContacts.value = [];
      }
      // 加载通道选项
      loadChannelOptions();
    }
  },
});

function loadFormData(data: OrganizationContactApi.Contact) {
  // 基本信息
  basicFormApi.setValues({
    type: data.type,
    sourceId: data.sourceId,
    status: data.status,
    description: data.description,
  });

  // 偏好管理 - 使用 profile 字段，转换为 JSON 字符串
  profileFormApi.setValues({
    profile: data.profile ? JSON.stringify(data.profile, null, 2) : "",
  });
}

function resetAllForms() {
  basicFormApi.resetForm();
  profileFormApi.resetForm();
}

// 提交基本信息（创建或更新）
async function onSubmitBasic(values: Record<string, any>) {
  try {
    if (isNew.value) {
      // 创建新联系人
      const result = await createContact(values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      // 更新本地数据
      formData.value = result as any;
      emit("success");
    } else {
      // 更新现有联系人
      await updateContact(formData.value!.sid, values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      emit("success");
    }
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交偏好管理（使用 profile 字段）
async function onSubmitProfile(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.contacts.saveBasicFirst"));
    return;
  }

  try {
    // 将 JSON 字符串解析为对象
    const profile = values.profile ? JSON.parse(values.profile) : {};
    await updateContactProfile(formData.value!.sid, profile);
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.profile = profile;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 添加通道联系人关系
async function onAddChannelContact() {
  if (!newChannelId.value || !newSender.value) {
    message.warning($t("organization.contacts.channels.pleaseFillAllFields"));
    return;
  }

  // 验证通道是否已绑定
  if (!validateChannel()) {
    return;
  }

  // 验证 sender 是否重复
  if (!validateSender()) {
    return;
  }

  if (!formData.value?.sid) return;

  try {
    if (editingRecord.value) {
      // 更新现有记录
      await updateChannelContact(
        editingRecord.value.channelId,
        formData.value.sid,
        { sender: newSender.value }
      );
      message.success($t("ui.actionMessage.updateSuccess"));
    } else {
      // 创建新记录
      await createChannelContact(formData.value.sid, {
        channelId: newChannelId.value,
        sender: newSender.value,
      });
      message.success($t("ui.actionMessage.createSuccess"));
    }

    // 重置表单并刷新列表
    editingRecord.value = null;
    newChannelId.value = "";
    newSender.value = "";
    await loadChannelContacts();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 编辑通道联系人关系
function onEditChannelContact(record: ChannelContactApi.ChannelContact) {
  editingRecord.value = record;
  newChannelId.value = record.channelId;
  newSender.value = record.sender;
}

// 取消编辑
function onCancelEdit() {
  editingRecord.value = null;
  newChannelId.value = "";
  newSender.value = "";
  senderError.value = "";
  channelError.value = "";
}

// 删除通道联系人关系
async function onDeleteChannelContact(record: ChannelContactApi.ChannelContact) {
  if (!formData.value?.sid) return;

  try {
    await deleteChannelContact(record.channelId, formData.value.sid);
    message.success($t("ui.actionMessage.deleteSuccess"));
    await loadChannelContacts();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getModalTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <Tabs.TabPane key="basic" :tab="$t('organization.contacts.tabs.basic')">
        <BasicForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="preferences" :tab="$t('organization.contacts.tabs.preferences')" :disabled="isNew">
        <ProfileForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="channels" :tab="$t('organization.contacts.tabs.channels')" :disabled="isNew">
        <div class="p-4">
          <!-- 添加/编辑表单 -->
          <Form
            ref="formRef"
            layout="inline"
            class="mb-4"
          >
            <Form.Item
              :label="$t('organization.contacts.channels.channel')"
              required
              :validate-status="channelError ? 'error' : ''"
              :help="channelError"
            >
              <Select
                v-model:value="newChannelId"
                :options="channelOptions"
                :placeholder="$t('organization.contacts.channels.selectChannel')"
                style="width: 200px"
                :disabled="!!editingRecord"
                @change="validateChannel"
              />
            </Form.Item>
            <Form.Item
              :label="$t('organization.contacts.channels.sender')"
              required
              :validate-status="senderError ? 'error' : ''"
              :help="senderError"
            >
              <Input
                v-model:value="newSender"
                :placeholder="$t('organization.contacts.channels.senderPlaceholder')"
                style="width: 250px"
                @blur="validateSender"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" @click="onAddChannelContact">
                  <IconifyIcon icon="mdi:plus" class="mr-1" />
                  {{ editingRecord ? $t('ui.actionTitle.update') : $t('ui.actionTitle.add') }}
                </Button>
                <Button v-if="editingRecord" @click="onCancelEdit">
                  {{ $t('ui.actionTitle.cancel') }}
                </Button>
              </Space>
            </Form.Item>
          </Form>
          
          <!-- 关系列表 - Card 布局 -->
          <div class="space-y-3">
            <Card
              v-for="item in channelContacts"
              :key="`${item.channelId}-${item.contactId}`"
              size="small"
              class="w-full"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.contacts.channels.name') }}:</span>
                    <span class="ml-2 font-medium">{{ item.channelName }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.contacts.channels.sender') }}:</span>
                    <span class="ml-2 font-medium">{{ item.sender }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.contacts.channels.createTime') }}:</span>
                    <span class="ml-2">{{ item.createTime }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 ml-4">
                  <Button type="link" size="small" @click="onEditChannelContact(item)">
                    {{ $t('ui.actionTitle.edit') }}
                  </Button>
                  <Button type="link" danger size="small" @click="onDeleteChannelContact(item)">
                    {{ $t('ui.actionTitle.delete') }}
                  </Button>
                </div>
              </div>
            </Card>
            <div v-if="channelContacts.length === 0 && !channelContactsLoading" class="text-center text-gray-400 py-8">
              {{ $t('ui.actionMessage.noData') }}
            </div>
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>
