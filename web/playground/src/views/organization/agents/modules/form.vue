<script lang="ts" setup>
import type { OrganizationAgentApi } from "#/api/organization/agents";
import type { ChannelAgentApi } from "#/api/system/channel-agents";
import type { OrganizationRelationshipApi } from "#/api/organization/relationships";

import { computed, ref, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Card, Form, Input, message, Select, Space, Tabs, TreeSelect } from "ant-design-vue";

import MemoryModal from "./memory-modal.vue";

import { useVbenForm } from "#/adapter/form";
import {
  createAgent,
  isAgentNoExists,
  updateAgent,
} from "#/api/organization/agents";
import {
  updateAgentProfile,
} from "#/api/organization/agent-fields";
import {
  createChannelAgent,
  deleteChannelAgent,
  getChannelAgentList,
  updateChannelAgent,
} from "#/api/system/channel-agents";
import { getChannelList } from "#/api/system/channels";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import {
  bindAgentToEmployee,
  getAgentContacts,
  unbindAgentContact,
  getAgentMemoryContacts,
} from "#/api/organization/relationships";
import { getEmployeeList } from "#/api/organization/employees";
import { getOrgTree } from "#/api/organization/departments";
import type { OrganizationApi } from "#/api/organization/departments";
import { getPositionList } from "#/api/organization/positions";
import type { OrganizationPositionApi } from "#/api/organization/positions";
import { $t } from "#/locales";
import { onMounted, nextTick } from "vue";
import { h } from "vue";

import {
  useBasicInfoSchema,
  useProfileSchema,
  useModelConfigSchema,
  useSoulSchema,
  useSkillsSchema,
  useOwnerSchema,
} from "./schema";

const emit = defineEmits<{
  success: [orgId?: string];
}>();

/**
 * 翻译组织架构树中的 title 字段，并处理显示标签（带图标）
 * 与 schema.ts 中的实现保持一致
 */
function translateOrgTree(orgs: OrganizationApi.Organization[]): any[] {
  return orgs.map((org) => ({
    ...org,
    title: org.icon
      ? h("div", { class: "flex items-center gap-2" }, [
          h(IconifyIcon, { icon: org.icon, class: "size-4 flex-shrink-0" }),
          h("span", org.title ? $t(org.title as any) : ""),
        ])
      : org.title
        ? $t(org.title as any)
        : "",
    children: org.children ? translateOrgTree(org.children) : undefined,
  }));
}

/**
 * 获取组织架构树（带翻译）
 * 与 schema.ts 中的实现保持一致
 */
async function getOrgTreeWithTranslation() {
  const data = await getOrgTree();
  return translateOrgTree(data);
}

/**
 * 格式化时间戳为惯用格式
 * @param timestamp 时间戳或日期字符串
 * @returns 格式化后的时间字符串
 */
function formatDateTime(timestamp: string | number | undefined): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const formData = ref<OrganizationAgentApi.Agent>();
const activeTab = ref("basic");
const isNew = computed(() => !formData.value?.id);

// 服务模式选项
const patternOptions = ref<{ label: string; value: string }[]>([]);

// 岗位选项
const positionOptions = ref<{ label: string; value: string }[]>([]);
const positionLoading = ref(false);

// 更新岗位选择器配置
function updatePositionField(
  options: { label: string; value: string }[],
  disabled: boolean,
) {
  basicFormApi.updateSchema([
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        disabled: disabled,
        options: options,
        placeholder: disabled
          ? $t("organization.agents.selectOrgFirst")
          : $t("ui.placeholder.select"),
      },
      fieldName: "positionId",
    },
  ]);
}

// 加载岗位选项（用于组织变更）
async function loadPositionOptionsByOid(oid: string) {
  if (!oid) {
    updatePositionField([], true);
    return;
  }
  positionLoading.value = true;
  try {
    const result = await getPositionList({
      oid,
      type: "agent",
      page: 1,
      pageSize: 100,
    });
    const options = result.items.map((item: OrganizationPositionApi.Position) => ({
      label: item.title ? $t(item.title as any) : item.name,
      value: item.id,
    }));
    updatePositionField(options, false);
  } catch (error) {
    updatePositionField([], true);
  } finally {
    positionLoading.value = false;
  }
}

// 通道Agent关系列表
const channelAgents = ref<ChannelAgentApi.ChannelAgent[]>([]);
const channelAgentsLoading = ref(false);

// 通道选项（来自通道管理 API）
const channelOptions = ref<{ label: string; value: string }[]>([]);

// 新增/编辑关系表单
const editingRecord = ref<ChannelAgentApi.ChannelAgent | null>(null);
const newChannelId = ref("");
const newIdentity = ref("");
const identityError = ref("");
const channelError = ref("");
const formRef = ref();

// ===== Owner标签页 - 联系人绑定相关 =====
// 部门树数据
const departmentTreeData = ref<any[]>([]);
// 员工选项
const employeeOptions = ref<{ label: string; value: string }[]>([]);
// Agent绑定的联系人列表
const agentContacts = ref<OrganizationRelationshipApi.AgentContactBinding[]>([]);
const agentContactsLoading = ref(false);
// 当前Agent的服务模式
const agentMode = computed(() => formData.value?.mode || 'exclusive');
// 新增/编辑联系人绑定表单
const editingContactRecord = ref<OrganizationRelationshipApi.AgentContactBinding | null>(null);
const newDepartmentId = ref("");
const newEmployeeId = ref("");
const departmentError = ref("");
const employeeError = ref("");
const contactFormRef = ref();

// ===== Memory标签页 - 记忆管理相关 =====
// Agent的记忆联系人列表
const memoryContacts = ref<OrganizationRelationshipApi.MemoryContactInfo[]>([]);
const memoryContactsLoading = ref(false);
// 搜索关键词
const memorySearchKeyword = ref("");
// 过滤后的记忆联系人列表
const filteredMemoryContacts = computed(() => {
  if (!memorySearchKeyword.value) {
    return memoryContacts.value;
  }
  const keyword = memorySearchKeyword.value.toLowerCase();
  return memoryContacts.value.filter(
    (item) =>
      item.contactName?.toLowerCase().includes(keyword) ||
      item.departmentName?.toLowerCase().includes(keyword)
  );
});

// 短期记忆弹窗
const [MemoryModalComponent, memoryModalApi] = useVbenModal({
  connectedComponent: MemoryModal,
});

// 打开短期记忆弹窗
function openShortTermMemoryModal(contact: OrganizationRelationshipApi.MemoryContactInfo) {
  if (!formData.value?.id) return;
  memoryModalApi.setData({
    agentId: formData.value.id,
    contactId: contact.contactId,
    contactName: contact.contactName,
  }).open();
}

// 验证通道是否已绑定
function validateChannel(): boolean {
  channelError.value = "";

  if (!newChannelId.value || editingRecord.value) {
    return true;
  }

  // 检查当前Agent是否已绑定该通道
  const exists = channelAgents.value.some(
    (item) => item.channelId === newChannelId.value
  );

  if (exists) {
    channelError.value = $t("organization.agents.channels.channelBound");
    return false;
  }

  return true;
}

// 验证 identity 是否重复
function validateIdentity(): boolean {
  identityError.value = "";

  if (!newChannelId.value || !newIdentity.value) {
    return true;
  }

  // 检查是否在当前列表中已存在（排除正在编辑的记录）
  const exists = channelAgents.value.some(
    (item) =>
      item.channelId === newChannelId.value &&
      item.identity === newIdentity.value &&
      (!editingRecord.value ||
        !(item.channelId === editingRecord.value.channelId &&
          item.agentId === editingRecord.value.agentId))
  );

  if (exists) {
    identityError.value = $t("organization.agents.channels.identityExists");
    return false;
  }

  return true;
}

// 监听通道变化，验证通道和 identity
watch(newChannelId, () => {
  validateChannel();
  if (newIdentity.value) {
    validateIdentity();
  }
});

// 监听 identity 变化，实时验证
watch(newIdentity, () => {
  if (newIdentity.value) {
    validateIdentity();
  }
});

// ===== Owner标签页 - 联系人绑定验证 =====
// 验证部门是否已选择
function validateDepartment(): boolean {
  departmentError.value = "";
  if (!newDepartmentId.value) {
    departmentError.value = $t("organization.agents.owner.departmentRequired");
    return false;
  }
  return true;
}

// 验证员工是否重复绑定
function validateEmployee(): boolean {
  employeeError.value = "";
  if (!newEmployeeId.value) {
    employeeError.value = $t("organization.agents.owner.employeeRequired");
    return false;
  }

  // 检查是否已绑定（排除正在编辑的记录）
  const exists = agentContacts.value.some(
    (item) =>
      item.employeeId === newEmployeeId.value &&
      (!editingContactRecord.value || item.sid !== editingContactRecord.value.sid)
  );

  if (exists) {
    employeeError.value = $t("organization.agents.owner.employeeAlreadyBound");
    return false;
  }

  // 根据服务模式检查数量限制
  if (!editingContactRecord.value) {
    const currentCount = agentContacts.value.length;
    if (agentMode.value === 'exclusive' && currentCount >= 1) {
      employeeError.value = $t("organization.agents.owner.exclusiveModeLimit");
      return false;
    }
  }

  return true;
}

// 监听部门变化
watch(newDepartmentId, () => {
  validateDepartment();
  // 部门变化时，重新加载员工列表
  loadEmployeeOptions();
  // 清空已选员工
  newEmployeeId.value = "";
});

// 监听员工变化
watch(newEmployeeId, () => {
  if (newEmployeeId.value) {
    validateEmployee();
  }
});

// 加载部门树数据
async function loadDepartmentTreeData() {
  try {
    const data = await getOrgTreeWithTranslation();
    departmentTreeData.value = data;
  } catch (error) {
    console.error('Failed to load department tree:', error);
  }
}

// 加载员工选项
async function loadEmployeeOptions() {
  if (!newDepartmentId.value) {
    employeeOptions.value = [];
    return;
  }
  try {
    const result = await getEmployeeList({
      oid: newDepartmentId.value,
      status: 'active',
      pageSize: 1000,
    });
    employeeOptions.value = result.items
      .filter((emp: OrganizationEmployeeApi.Employee) => emp.id)
      .map((emp: OrganizationEmployeeApi.Employee) => ({
        label: `${emp.name} (${emp.employeeNo || '-'})`,
        value: emp.id,
      }));
  } catch (error) {
    console.error('Failed to load employee options:', error);
    employeeOptions.value = [];
  }
}

// 加载Agent绑定的联系人列表
async function loadAgentContacts() {
  if (!formData.value?.id) return;

  agentContactsLoading.value = true;
  try {
    const list = await getAgentContacts(formData.value.id);
    agentContacts.value = list;
  } catch (error) {
    console.error('Failed to load agent contacts:', error);
  } finally {
    agentContactsLoading.value = false;
  }
}

// 加载Agent的记忆联系人列表
async function loadAgentMemoryContacts() {
  if (!formData.value?.id) return;

  memoryContactsLoading.value = true;
  try {
    const list = await getAgentMemoryContacts(formData.value.id);
    memoryContacts.value = list;
  } catch (error) {
    console.error('Failed to load agent memory contacts:', error);
  } finally {
    memoryContactsLoading.value = false;
  }
}

// 加载服务模式选项
async function loadPatternOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.agents.pattern");
    patternOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : opt.label,
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load pattern options:', error);
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

// 加载通道Agent关系列表
async function loadChannelAgents() {
  if (!formData.value?.id) return;

  channelAgentsLoading.value = true;
  try {
    const list = await getChannelAgentList({ agentId: formData.value.id });
    channelAgents.value = list;
  } catch (error) {
    console.error('Failed to load channel agents:', error);
  } finally {
    channelAgentsLoading.value = false;
  }
}

const getModalTitle = computed(() =>
  formData.value?.id
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

// 基本信息表单
const [BasicForm, basicFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useBasicInfoSchema(patternOptions.value, loadPositionOptionsByOid),
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

// 模型配置表单（使用 config 字段）
const [ModelConfigForm, modelConfigFormApi] = useVbenForm({
  commonConfig: {
    colon: false,
    hideLabel: true,
    formItemClass: "col-span-1",
  },
  schema: useModelConfigSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1",
  handleSubmit: onSubmitModelConfig,
});

// 灵魂/人格描述表单（使用 soul 字段）
const [SoulForm, soulFormApi] = useVbenForm({
  commonConfig: {
    colon: false,
    hideLabel: true,
    formItemClass: "col-span-1",
  },
  schema: useSoulSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1",
  handleSubmit: onSubmitSoul,
});

// 技能配置表单
const [SkillsForm, skillsFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useSkillsSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1 gap-x-4",
  handleSubmit: onSubmitSkills,
});

// Owner表单
const [OwnerForm, ownerFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-2 md:col-span-1",
  },
  schema: useOwnerSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
  handleSubmit: onSubmitOwner,
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
      case "modelConfig":
        await modelConfigFormApi.validateAndSubmitForm();
        break;
      case "soul":
        await soulFormApi.validateAndSubmitForm();
        break;
      case "skills":
        await skillsFormApi.validateAndSubmitForm();
        break;
      case "owner":
        await ownerFormApi.validateAndSubmitForm();
        break;
      case "channels":
        // 通道配置 Tab 直接关闭，因为操作是实时的
        modalApi.close();
        break;
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<OrganizationAgentApi.Agent>();
      if (data) {
        formData.value = data;
        loadFormData(data);
        loadChannelAgents();
        loadAgentContacts();
        loadAgentMemoryContacts();
      } else {
        formData.value = undefined;
        activeTab.value = "basic";
        resetAllForms();
        channelAgents.value = [];
        agentContacts.value = [];
        memoryContacts.value = [];
      }
    }
  },
});

// 加载岗位选项
async function loadPositionOptions(oid: string, currentPositionId?: string, currentPositionTitle?: string) {
  if (!oid) {
    positionOptions.value = [];
    return;
  }
  positionLoading.value = true;
  try {
    const result = await getPositionList({
      oid,
      type: "agent",
      page: 1,
      pageSize: 100,
    });
    const options = result.items.map((item: OrganizationPositionApi.Position) => ({
      label: item.title ? $t(item.title as any) : item.name,
      value: item.id,
    }));
    // 如果当前岗位不在选项中，添加它
    if (currentPositionId && currentPositionTitle) {
      const exists = options.some((opt: { value: string }) => opt.value === currentPositionId);
      if (!exists) {
        options.push({
          label: $t(currentPositionTitle as any),
          value: currentPositionId,
        });
      }
    }
    positionOptions.value = options;
    updatePositionField(options, false);
  } catch (error) {
    positionOptions.value = [];
    updatePositionField([], true);
  } finally {
    positionLoading.value = false;
  }
}

function loadFormData(data: OrganizationAgentApi.Agent) {
  if (!data.oid) {
    updatePositionField([], true);
    basicFormApi.setValues({
      name: data.name,
      eName: data.eName,
      title: data.title,
      agentNo: data.agentNo,
      oid: data.oid,
      positionId: undefined,
      mode: data.mode,
      avatar: data.avatar,
      description: data.description,
      status: data.status,
    });
    return;
  }

  // 使用 Promise 链式调用，与 employees 保持一致
  loadPositionOptions(data.oid, data.positionId, data.positionTitle)
    .then(() => {
      // 先设置其他字段
      const { positionId, ...otherData } = data;
      return basicFormApi.setValues(otherData).then(() => ({ positionId }));
    })
    .then(({ positionId }) => {
      // 使用 nextTick 确保 DOM 更新后再设置 positionId
      return nextTick().then(() => ({ positionId }));
    })
    .then(({ positionId }) => {
      // 单独设置 positionId
      return basicFormApi.setFieldValue("positionId", positionId);
    })
    .catch((error) => {
      console.error("Failed to load position options:", error);
      updatePositionField([], true);
      basicFormApi.setValues({
        name: data.name,
        eName: data.eName,
        title: data.title,
        agentNo: data.agentNo,
        oid: data.oid,
        positionId: undefined,
        mode: data.mode,
        avatar: data.avatar,
        description: data.description,
        status: data.status,
      });
    });
  
  // 偏好管理 - 转换为 JSON 字符串（使用 profile 字段）
  profileFormApi.setValues({
    profile: data.profile ? JSON.stringify(data.profile, null, 2) : "",
  });

  // 模型配置 - 转换为 JSON 字符串（使用 config 字段）
  modelConfigFormApi.setValues({
    config: data.config ? JSON.stringify(data.config, null, 2) : "",
  });

  // 灵魂/人格描述 - 纯文本字段（使用 soul 字段）
  soulFormApi.setValues({
    soul: data.soul || "",
  });

  // 技能配置
  skillsFormApi.setValues({ skills: data.config?.skills || [] });

  // Owner
  ownerFormApi.setValues({ owner: data.config?.owner });
}

function resetAllForms() {
  updatePositionField([], true);
  basicFormApi.resetForm();
  profileFormApi.resetForm();
  modelConfigFormApi.resetForm();
  soulFormApi.resetForm();
  skillsFormApi.resetForm();
  ownerFormApi.resetForm();
  editingRecord.value = null;
  newChannelId.value = "";
  newIdentity.value = "";
}

// 提交基本信息（创建或更新）
async function onSubmitBasic(values: Record<string, any>) {
  try {
    // 检查 Agent 编号是否已存在
    const exists = await isAgentNoExists(values.agentNo, formData.value?.id);
    if (exists) {
      message.error($t("organization.agents.agentNoExists"));
      return;
    }

    if (isNew.value) {
      // 创建新 Agent
      const result = await createAgent(values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      // 更新本地数据
      formData.value = result as any;
      modalApi.close();
      emit("success", values.oid);
    } else {
      // 更新现有 Agent
      await updateAgent(formData.value!.id, values as any);
      message.success($t("ui.actionMessage.operationSuccess"));
      modalApi.close();
      emit("success", values.oid);
    }
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交偏好管理（使用 profile 字段）
async function onSubmitProfile(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.agents.saveBasicFirst"));
    return;
  }

  try {
    // 将 JSON 字符串解析为对象
    const profile = values.profile ? JSON.parse(values.profile) : {};
    await updateAgentProfile(formData.value!.id, profile);
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.profile = profile;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交模型配置（使用 config 字段）
async function onSubmitModelConfig(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.agents.saveBasicFirst"));
    return;
  }

  try {
    // 将 JSON 字符串解析为对象
    const config = values.config ? JSON.parse(values.config) : {};
    await updateAgent(formData.value!.id, { config } as any);
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.config = config;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交灵魂/人格描述（使用 soul 字段）
async function onSubmitSoul(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.agents.saveBasicFirst"));
    return;
  }

  try {
    const soul = values.soul || "";
    await updateAgent(formData.value!.id, { soul } as any);
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.soul = soul;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交技能配置
async function onSubmitSkills(values: Record<string, any>) {
  if (isNew.value) {
    message.warning($t("organization.agents.saveBasicFirst"));
    return;
  }
  
  try {
    const config = {
      ...formData.value?.config,
      skills: values.skills || [],
    };
    
    await updateAgent(formData.value!.id, { config } as any);
    message.success($t("ui.actionMessage.operationSuccess"));
    formData.value!.config = config;
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 提交Owner - 新的联系人绑定方式不再通过表单提交
async function onSubmitOwner(_values: Record<string, any>) {
  // 联系人绑定通过单独的添加/删除操作处理，不需要表单提交
  message.success($t("ui.actionMessage.operationSuccess"));
}

// ===== Owner标签页 - 联系人绑定操作 =====
// 添加联系人绑定
async function onAddContactBinding() {
  // 验证部门
  if (!validateDepartment()) {
    return;
  }

  // 验证员工
  if (!validateEmployee()) {
    return;
  }

  if (!formData.value?.id) {
    message.warning($t("organization.agents.saveBasicFirst"));
    return;
  }

  try {
    await bindAgentToEmployee({
      agentId: formData.value.id,
      employeeId: newEmployeeId.value,
      oid: newDepartmentId.value,
    });
    message.success($t("ui.actionMessage.createSuccess"));

    // 重置表单并刷新列表
    editingContactRecord.value = null;
    newDepartmentId.value = "";
    newEmployeeId.value = "";
    departmentError.value = "";
    employeeError.value = "";
    await loadAgentContacts();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 编辑联系人绑定（仅用于查看，实际不支持编辑，只能删除后重新添加）
function onEditContactBinding(record: OrganizationRelationshipApi.AgentContactBinding) {
  // 由于绑定关系涉及多表操作，不支持直接编辑
  // 引导用户删除后重新添加
  message.info($t("organization.agents.owner.pleaseDeleteAndReAdd"));
}

// 取消编辑
function onCancelContactEdit() {
  editingContactRecord.value = null;
  newDepartmentId.value = "";
  newEmployeeId.value = "";
  departmentError.value = "";
  employeeError.value = "";
}

// 删除联系人绑定
async function onDeleteContactBinding(record: OrganizationRelationshipApi.AgentContactBinding) {
  if (!formData.value?.id) return;

  try {
    await unbindAgentContact(formData.value.id, record.contactId);
    message.success($t("ui.actionMessage.deleteSuccess"));
    await loadAgentContacts();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 添加通道Agent关系
async function onAddChannelAgent() {
  if (!newChannelId.value || !newIdentity.value) {
    message.warning($t("organization.agents.channels.pleaseFillAllFields"));
    return;
  }

  // 验证通道是否已绑定
  if (!validateChannel()) {
    return;
  }

  // 验证 identity 是否重复
  if (!validateIdentity()) {
    return;
  }

  if (!formData.value?.id) return;

  try {
    if (editingRecord.value) {
      // 更新现有记录
      await updateChannelAgent(
        editingRecord.value.channelId,
        formData.value.id,
        { identity: newIdentity.value }
      );
      message.success($t("ui.actionMessage.updateSuccess"));
    } else {
      // 创建新记录
      await createChannelAgent(formData.value.id, {
        channelId: newChannelId.value,
        identity: newIdentity.value,
      });
      message.success($t("ui.actionMessage.createSuccess"));
    }

    // 重置表单并刷新列表
    editingRecord.value = null;
    newChannelId.value = "";
    newIdentity.value = "";
    await loadChannelAgents();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// 编辑通道Agent关系
function onEditChannelAgent(record: ChannelAgentApi.ChannelAgent) {
  editingRecord.value = record;
  newChannelId.value = record.channelId;
  newIdentity.value = record.identity;
}

// 取消编辑
function onCancelEdit() {
  editingRecord.value = null;
  newChannelId.value = "";
  newIdentity.value = "";
  identityError.value = "";
  channelError.value = "";
}

// 删除通道Agent关系
async function onDeleteChannelAgent(record: ChannelAgentApi.ChannelAgent) {
  if (!formData.value?.id) return;

  try {
    await deleteChannelAgent(record.channelId, formData.value.id);
    message.success($t("ui.actionMessage.deleteSuccess"));
    await loadChannelAgents();
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  }
}

// ===== 技能管理相关 =====
// 技能列表
const skills = ref<Array<{
  id: string;
  name: string;
  level: string;
  description?: string;
  createTime?: string;
}>>([]);
const skillsLoading = ref(false);

// 新增/编辑技能表单
const newSkillName = ref("");
const newSkillLevel = ref("");
const newSkillDescription = ref("");
const editingSkill = ref<typeof skills.value[0] | null>(null);
const skillNameError = ref("");
const skillLevelError = ref("");

// 验证技能名称
function validateSkillName(): boolean {
  skillNameError.value = "";
  if (!newSkillName.value) {
    skillNameError.value = $t("ui.formRules.required", [$t("organization.positions.skills.name")]);
    return false;
  }
  return true;
}

// 验证技能级别
function validateSkillLevel(): boolean {
  skillLevelError.value = "";
  if (!newSkillLevel.value) {
    skillLevelError.value = $t("ui.formRules.required", [$t("organization.positions.skills.level")]);
    return false;
  }
  return true;
}

// 添加技能
async function onAddSkill() {
  if (!validateSkillName() || !validateSkillLevel()) {
    return;
  }

  // 检查是否已存在同名技能
  const exists = skills.value.some(
    (item) => item.name === newSkillName.value && (!editingSkill.value || item.id !== editingSkill.value.id)
  );
  if (exists) {
    skillNameError.value = $t("organization.positions.skills.nameExists");
    return;
  }

  if (editingSkill.value) {
    // 编辑模式
    const index = skills.value.findIndex((item) => item.id === editingSkill.value!.id);
    if (index !== -1) {
      skills.value[index] = {
        ...editingSkill.value,
        name: newSkillName.value,
        level: newSkillLevel.value,
        description: newSkillDescription.value,
      };
    }
    message.success($t("ui.actionMessage.updateSuccess"));
  } else {
    // 新增模式
    skills.value.push({
      id: Date.now().toString(),
      name: newSkillName.value,
      level: newSkillLevel.value,
      description: newSkillDescription.value,
      createTime: new Date().toISOString(),
    });
    message.success($t("ui.actionMessage.createSuccess"));
  }

  // 重置表单
  onCancelSkillEdit();
}

// 编辑技能
function onEditSkill(record: typeof skills.value[0]) {
  editingSkill.value = record;
  newSkillName.value = record.name;
  newSkillLevel.value = record.level;
  newSkillDescription.value = record.description || "";
}

// 取消编辑
function onCancelSkillEdit() {
  editingSkill.value = null;
  newSkillName.value = "";
  newSkillLevel.value = "";
  newSkillDescription.value = "";
  skillNameError.value = "";
  skillLevelError.value = "";
}

// 删除技能
function onDeleteSkill(record: typeof skills.value[0]) {
  const index = skills.value.findIndex((item) => item.id === record.id);
  if (index !== -1) {
    skills.value.splice(index, 1);
    message.success($t("ui.actionMessage.deleteSuccess"));
  }
}

// 组件挂载时加载选项
onMounted(() => {
  loadPatternOptions();
  loadChannelOptions();
  loadDepartmentTreeData();
});
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getModalTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <Tabs.TabPane key="basic" :tab="$t('organization.agents.tabs.basic')">
        <BasicForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="preferences" :tab="$t('organization.agents.tabs.preferences')" :disabled="isNew">
        <ProfileForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="modelConfig" :tab="$t('organization.agents.tabs.modelConfig')" :disabled="isNew">
        <ModelConfigForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="soul" :tab="$t('organization.agents.tabs.soul')" :disabled="isNew">
        <SoulForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="skills" :tab="$t('organization.agents.tabs.skills')" :disabled="isNew">
        <SkillsForm />
      </Tabs.TabPane>
      <Tabs.TabPane key="owner" :tab="$t('organization.agents.tabs.owner')" :disabled="isNew">
        <div class="p-4">
          <!-- 服务模式提示 -->
          <div class="mb-4 p-3 bg-blue-50 rounded">
            <span class="text-blue-600">
              {{ agentMode === 'exclusive' ? $t('organization.agents.owner.exclusiveModeTip') :
                 agentMode === 'shared' ? $t('organization.agents.owner.sharedModeTip') :
                 agentMode === 'public' ? $t('organization.agents.owner.publicModeTip') :
                 $t('organization.agents.owner.departmentModeTip') }}
            </span>
          </div>

          <!-- 添加/编辑表单 -->
          <Form
            ref="contactFormRef"
            layout="inline"
            class="mb-4"
          >
            <Form.Item
              :label="$t('organization.agents.owner.department')"
              required
              :validate-status="departmentError ? 'error' : ''"
              :help="departmentError"
            >
              <TreeSelect
                v-model:value="newDepartmentId"
                :tree-data="departmentTreeData"
                :placeholder="$t('organization.agents.owner.selectDepartment')"
                style="width: 200px"
                :disabled="agentMode === 'public' || agentMode === 'department'"
                tree-default-expand-all
                allow-clear
                :field-names="{ label: 'title', value: 'sid', children: 'children' }"
                @change="validateDepartment"
              />
            </Form.Item>
            <Form.Item
              :label="$t('organization.agents.owner.employee')"
              required
              :validate-status="employeeError ? 'error' : ''"
              :help="employeeError"
            >
              <Select
                v-model:value="newEmployeeId"
                :options="employeeOptions"
                :placeholder="$t('organization.agents.owner.selectEmployee')"
                style="width: 250px"
                :disabled="!newDepartmentId || agentMode === 'public' || agentMode === 'department'"
                @change="validateEmployee"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  :disabled="agentMode === 'public' || agentMode === 'department'"
                  @click="onAddContactBinding"
                >
                  <IconifyIcon icon="mdi:plus" class="mr-1" />
                  {{ $t('ui.actionTitle.add') }}
                </Button>
                <Button v-if="editingContactRecord" @click="onCancelContactEdit">
                  {{ $t('ui.actionTitle.cancel') }}
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <!-- 联系人绑定列表 - Card 布局 -->
          <div class="space-y-3">
            <Card
              v-for="item in agentContacts"
              :key="item.sid"
              size="small"
              class="w-full"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.owner.employeeName') }}:</span>
                    <span class="ml-2 font-medium">{{ item.employeeName }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.owner.department') }}:</span>
                    <span class="ml-2">{{ item.departmentName ? $t(item.departmentName as any) : '-' }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.owner.bindTime') }}:</span>
                    <span class="ml-2">{{ formatDateTime(item.createTime) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 ml-4">
                  <Button
                    v-if="agentMode !== 'public' && agentMode !== 'department'"
                    type="link"
                    danger
                    size="small"
                    @click="onDeleteContactBinding(item)"
                  >
                    {{ $t('ui.actionTitle.delete') }}
                  </Button>
                </div>
              </div>
            </Card>
            <div v-if="agentContacts.length === 0 && !agentContactsLoading" class="text-center text-gray-400 py-8">
              {{ agentMode === 'public' || agentMode === 'department'
                ? $t('organization.agents.owner.noBindingRequired')
                : $t('ui.actionMessage.noData') }}
            </div>
          </div>
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane key="channels" :tab="$t('organization.agents.tabs.channels')" :disabled="isNew">
        <div class="p-4">
          <!-- 添加/编辑表单 -->
          <Form
            ref="formRef"
            layout="inline"
            class="mb-4"
          >
            <Form.Item
              :label="$t('organization.agents.channels.channel')"
              required
              :validate-status="channelError ? 'error' : ''"
              :help="channelError"
            >
              <Select
                v-model:value="newChannelId"
                :options="channelOptions"
                :placeholder="$t('organization.agents.channels.selectChannel')"
                style="width: 200px"
                :disabled="!!editingRecord"
                @change="validateChannel"
              />
            </Form.Item>
            <Form.Item
              :label="$t('organization.agents.channels.identity')"
              required
              :validate-status="identityError ? 'error' : ''"
              :help="identityError"
            >
              <Input
                v-model:value="newIdentity"
                :placeholder="$t('organization.agents.channels.identityPlaceholder')"
                style="width: 250px"
                @blur="validateIdentity"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" @click="onAddChannelAgent">
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
              v-for="item in channelAgents"
              :key="`${item.channelId}-${item.agentId}`"
              size="small"
              class="w-full"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.channels.name') }}:</span>
                    <span class="ml-2 font-medium">{{ item.channelName }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.channels.identity') }}:</span>
                    <span class="ml-2 font-medium">{{ item.identity }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.channels.createTime') }}:</span>
                    <span class="ml-2">{{ formatDateTime(item.createTime) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 ml-4">
                  <Button type="link" size="small" @click="onEditChannelAgent(item)">
                    {{ $t('ui.actionTitle.edit') }}
                  </Button>
                  <Button type="link" danger size="small" @click="onDeleteChannelAgent(item)">
                    {{ $t('ui.actionTitle.delete') }}
                  </Button>
                </div>
              </div>
            </Card>
            <div v-if="channelAgents.length === 0 && !channelAgentsLoading" class="text-center text-gray-400 py-8">
              {{ $t('ui.actionMessage.noData') }}
            </div>
          </div>
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane key="memory" :tab="$t('organization.agents.tabs.memory')" :disabled="isNew">
        <div class="p-4">
          <!-- 搜索栏 -->
          <div class="mb-4">
            <Input
              v-model:value="memorySearchKeyword"
              :placeholder="$t('organization.agents.memory.searchPlaceholder')"
              allow-clear
              style="width: 300px"
            >
              <template #prefix>
                <IconifyIcon icon="mdi:magnify" />
              </template>
            </Input>
          </div>

          <!-- 记忆联系人列表 - Card 布局 -->
          <div class="space-y-3">
            <Card
              v-for="item in filteredMemoryContacts"
              :key="item.sid"
              size="small"
              class="w-full"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.memory.contactName') }}:</span>
                    <span class="ml-2 font-medium">{{ item.contactName || '-' }}</span>
                    <span v-if="item.contactType" class="ml-2 text-xs text-gray-400">({{ item.contactType }})</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.memory.department') }}:</span>
                    <span class="ml-2">{{ item.departmentName ? $t(item.departmentName as any) : '-' }}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">{{ $t('organization.agents.memory.lastInteraction') }}:</span>
                    <span class="ml-2">{{ formatDateTime(item.lastInteractionTime || item.createTime) }}</span>
                    <span v-if="item.hasShortTermMemory" class="ml-2 text-green-500 text-xs">
                      <IconifyIcon icon="mdi:memory" class="inline" />
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 ml-4">
                  <Button type="link" size="small" @click="openShortTermMemoryModal(item)">
                    <IconifyIcon icon="mdi:memory" class="mr-1" />
                    {{ $t('organization.agents.memory.viewMemory') }}
                  </Button>
                </div>
              </div>
            </Card>
            <div v-if="filteredMemoryContacts.length === 0 && !memoryContactsLoading" class="text-center text-gray-400 py-8">
              {{ memorySearchKeyword ? $t('organization.agents.memory.noSearchResults') : $t('ui.actionMessage.noData') }}
            </div>
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>

    <!-- 短期记忆弹窗 -->
    <MemoryModalComponent @success="loadAgentMemoryContacts" />
  </Modal>
</template>
