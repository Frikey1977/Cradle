<script lang="ts" setup>
import type { OrganizationEmployeeApi } from "#/api/organization/employees";
import type { OrganizationContactApi } from "#/api/organization/contacts";
import type { ChannelContactApi } from "#/api/system/channel-contacts";
import type { OrganizationPositionApi } from "#/api/organization/positions";

import { computed, onMounted, ref, nextTick, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Card, Form, Input, message, Select, Space, Tabs } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import {
  createEmployee,
  updateEmployee,
} from "#/api/organization/employees";
import {
  getContactList,
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
import { getPositionList } from "#/api/organization/positions";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import { $t } from "#/locales";

import {
  useBasicInfoSchema,
  useProfileSchema,
} from "./schema";

const emit = defineEmits<{
  success: [oid?: string];
}>();

const formData = ref<OrganizationEmployeeApi.Employee>();
const activeTab = ref("basic");
const isNew = computed(() => !formData.value?.id);

// 关联的联系人数据
const contactData = ref<OrganizationContactApi.Contact | null>(null);
const contactLoading = ref(false);

// 类型、地点、状态选项
const typeOptions = ref<{ label: string; value: string }[]>([]);
const locationOptions = ref<{ label: string; value: string }[]>([]);
const statusOptions = ref<{ label: string; value: string }[]>([]);

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

async function loadTypeOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.employees.type");
    typeOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.type.${opt.value}`),
        value: opt.value,
      }));
    // 更新表单中的选项
    basicFormApi.updateSchema([
      {
        fieldName: "type",
        componentProps: {
          buttonStyle: "solid",
          options: typeOptions.value,
          optionType: "button",
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to load type options:', error);
  }
}

async function loadLocationOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.departments.location");
    locationOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.location.${opt.value}`),
        value: opt.value,
      }));
    // 更新表单中的选项
    basicFormApi.updateSchema([
      {
        fieldName: "location",
        componentProps: {
          buttonStyle: "solid",
          options: locationOptions.value,
          optionType: "button",
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to load location options:', error);
  }
}

async function loadStatusOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.employees.status");
    statusOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.employees.status.${opt.value}`),
        value: opt.value,
      }));
    // 更新表单中的选项
    basicFormApi.updateSchema([
      {
        fieldName: "status",
        componentProps: {
          buttonStyle: "solid",
          options: statusOptions.value,
          optionType: "button",
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to load status options:', error);
  }
}

onMounted(() => {
  loadTypeOptions();
  loadLocationOptions();
  loadStatusOptions();
});

// 加载关联的联系人数据
async function loadContactData(employeeId: string) {
  contactLoading.value = true;
  try {
    // 查询 type=employee 且 sourceId=employeeId 的联系人
    const result = await getContactList({
      type: "employee",
      page: 1,
      pageSize: 1000,
    });
    // 在结果中查找匹配的 sourceId
    const contact = result.items.find(c => c.sourceId === employeeId);
    if (contact) {
      contactData.value = contact;
      // 加载通道联系人关系
      await loadChannelContacts(contact.sid);
    } else {
      contactData.value = null;
      channelContacts.value = [];
    }
  } catch (error) {
    console.error('Failed to load contact data:', error);
    contactData.value = null;
  } finally {
    contactLoading.value = false;
  }
}

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
async function loadChannelContacts(contactSid: string) {
  channelContactsLoading.value = true;
  try {
    const list = await getChannelContactList({ contactId: contactSid });
    channelContacts.value = list;
  } catch (error) {
    console.error('Failed to load channel contacts:', error);
  } finally {
    channelContactsLoading.value = false;
  }
}

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

const getModalTitle = computed(() =>
  formData.value?.id
    ? $t("ui.actionTitle.edit", [$t("organization.employees.name")])
    : $t("ui.actionTitle.create", [$t("organization.employees.name")]),
);

// 加载职位选项（用于部门变化时的联动）
function loadPositionOptionsByOid(oid: string): Promise<void> {
  if (!oid) {
    updatePositionField([], true);
    return Promise.resolve();
  }

  return getPositionList({ oid, type: "human", pageSize: 1000 })
    .then((res) => {
      const options = res.items || [];
      updatePositionField(options, false);
      return nextTick();
    })
    .catch(() => {
      updatePositionField([], true);
    });
}

// 更新职位下拉框配置
function updatePositionField(
  options: OrganizationPositionApi.Position[],
  disabled: boolean,
) {
  basicFormApi.updateSchema([
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        disabled: disabled,
        options: options.map((item) => ({
          label: item.title ? $t(item.title as any) : "",
          value: item.id,
        })),
        placeholder: disabled
          ? $t("organization.employees.selectOrgFirst")
          : $t("ui.placeholder.select"),
      },
      fieldName: "positionId",
    },
  ]);
}

// 加载职位选项并设置表单值（Promise 链式调用风格）
function loadPositionOptionsAndSetValues(
  oid: string,
  data: OrganizationEmployeeApi.Employee,
) {
  if (!oid) {
    updatePositionField([], true);
    basicFormApi.setValues({ ...data, positionId: undefined });
    return Promise.resolve();
  }

  return getPositionList({ oid, type: "human", pageSize: 1000 })
    .then((res) => {
      const options = res.items || [];

      // 如果当前职位值不在选项中，将其添加到选项列表
      if (data.positionId && data.positionName) {
        const exists = options.some((item) => item.id === data.positionId);
        if (!exists) {
          options.push({
            id: data.positionId,
            name: data.positionName,
            code: "",
            oid: oid,
            dataScope: "self",
            status: "enabled",
            createTime: "",
          });
        }
      }

      updatePositionField(options, false);
      return { options, data };
    })
    .then(({ data }) => {
      return nextTick().then(() => ({ data }));
    })
    .then(({ data }) => {
      const { positionId, ...otherData } = data;
      return basicFormApi.setValues(otherData).then(() => ({ positionId, data }));
    })
    .then(({ positionId }) => {
      return basicFormApi.setFieldValue("positionId", positionId);
    })
    .catch(() => {
      updatePositionField([], true);
      basicFormApi.setValues({ ...data, positionId: undefined });
    });
}

// 基本信息表单
const [BasicForm, basicFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-2 md:col-span-1",
  },
  schema: useBasicInfoSchema(loadPositionOptionsByOid, typeOptions, locationOptions, statusOptions),
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
      const data = modalApi.getData<OrganizationEmployeeApi.Employee>();
      if (data) {
        formData.value = data;
        loadPositionOptionsAndSetValues(data.oid || "", data);
        // 加载关联的联系人数据
        loadContactData(data.id);
      } else {
        formData.value = undefined;
        contactData.value = null;
        activeTab.value = "basic";
        resetAllForms();
        channelContacts.value = [];
        updatePositionField([], true);
        basicFormApi.resetForm();
      }
      // 加载通道选项
      loadChannelOptions();
    }
  },
});

function resetAllForms() {
  basicFormApi.resetForm();
  profileFormApi.resetForm();
}

function loadFormData() {
  // 基本信息已在 loadPositionOptionsAndSetValues 中设置

  // 偏好管理 - 使用 profile 字段，转换为 JSON 字符串
  profileFormApi.setValues({
    profile: contactData.value?.profile ? JSON.stringify(contactData.value.profile, null, 2) : "",
  });
}

// 提交基本信息（创建或更新）
async function onSubmitBasic(values: Record<string, any>) {
  try {
    if (isNew.value) {
      // 创建新员工
      const result = await createEmployee(values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      // 更新本地数据
      formData.value = result as any;
      // 创建关联的联系人
      await createContact({
        type: "employee",
        sourceId: result.id,
        status: "enabled",
        description: values.description,
      });
      emit("success", values.oid);
    } else {
      // 更新现有员工
      await updateEmployee(formData.value!.id, values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      emit("success", values.oid);
    }
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交偏好管理（使用 profile 字段）
async function onSubmitProfile(values: Record<string, any>) {
  if (!contactData.value?.sid) {
    message.warning($t("organization.contacts.saveBasicFirst"));
    return;
  }

  try {
    // 将 JSON 字符串解析为对象
    const profile = values.profile ? JSON.parse(values.profile) : {};
    await updateContactProfile(contactData.value.sid, profile);
    message.success($t("ui.actionMessage.operationSuccess"));
    contactData.value.profile = profile;
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

  if (!contactData.value?.sid) return;

  try {
    if (editingRecord.value) {
      // 更新现有记录
      await updateChannelContact(
        editingRecord.value.channelId,
        contactData.value.sid,
        { sender: newSender.value }
      );
      message.success($t("ui.actionMessage.updateSuccess"));
    } else {
      // 创建新记录
      await createChannelContact(contactData.value.sid, {
        channelId: newChannelId.value,
        sender: newSender.value,
      });
      message.success($t("ui.actionMessage.createSuccess"));
    }

    // 重置表单并刷新列表
    editingRecord.value = null;
    newChannelId.value = "";
    newSender.value = "";
    await loadChannelContacts(contactData.value.sid);
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
  if (!contactData.value?.sid) return;

  try {
    await deleteChannelContact(record.channelId, contactData.value.sid);
    message.success($t("ui.actionMessage.deleteSuccess"));
    await loadChannelContacts(contactData.value.sid);
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 监听 contactData 变化，加载表单数据
watch(contactData, (newVal) => {
  if (newVal) {
    loadFormData();
  }
}, { immediate: true });
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getModalTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <Tabs.TabPane key="basic" :tab="$t('organization.contacts.tabs.basic')">
        <BasicForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="preferences" :tab="$t('organization.contacts.tabs.preferences')" :disabled="isNew || !contactData?.sid">
        <ProfileForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="channels" :tab="$t('organization.contacts.tabs.channels')" :disabled="isNew || !contactData?.sid">
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
                    <span class="text-muted-foreground text-sm">{{ $t('organization.contacts.channels.name') }}:</span>
                    <span class="ml-2 font-medium">{{ item.channelName }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground text-sm">{{ $t('organization.contacts.channels.sender') }}:</span>
                    <span class="ml-2 font-medium">{{ item.sender }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground text-sm">{{ $t('organization.contacts.channels.createTime') }}:</span>
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
            <div v-if="channelContacts.length === 0 && !channelContactsLoading" class="text-center text-muted-foreground py-8">
              {{ $t('ui.actionMessage.noData') }}
            </div>
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>
