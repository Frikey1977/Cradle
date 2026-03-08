<script lang="ts" setup>
import type { OrganizationPositionApi } from "#/api/organization/positions";
import type { SkillApi } from "#/api/system/skills";

import { computed, onMounted, ref } from "vue";

import { Tree, useVbenModal } from "@vben/common-ui";
import { message, Spin, Tabs } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import {
  createPosition,
  updatePosition,
  getPositionSkills,
  savePositionSkills,
} from "#/api/organization/positions";
import { getOrgDetail } from "#/api/organization/departments";
import { getCodeOptionsByParentValue } from "#/api/system/codes";
import { skillApi } from "#/api/system/skills";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";

import { useBasicSchema, useDescriptionSchema } from "../data";

const props = defineProps<{
  levelOptions?: { label: string; value: string }[];
  dataScopeOptions?: { label: string; value: string; color?: string }[];
  typeOptions?: { label: string; value: string }[];
}>();

const emit = defineEmits<{
  success: [orgId?: string];
}>();

// 当前激活的 Tab
const activeTab = ref("basic");

// 是否为新建模式
const isNew = computed(() => !formData.value?.id);

// 岗位类型是否为 agent
const isAgentType = computed(() => formData.value?.type === "agent");

const formData = ref<OrganizationPositionApi.Position>();
const statusOptions = ref<{ label: string; value: string }[]>();
const dataScopeOptions = ref<{ label: string; value: string }[]>();
const levelOptions = ref<{ label: string; value: string }[]>();
const typeOptions = ref<{ label: string; value: string }[]>();
const orgCode = ref<string>("");

// title 字段翻译后缀
const titleSuffix = ref<string>();

async function loadStatusOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.positions.status");
    statusOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.positions.status.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load status options:', error);
  }
}

async function loadDataScopeOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.positions.scope");
    dataScopeOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.positions.scope.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load data scope options:', error);
  }
}

async function loadLevelOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.positions.level");
    levelOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.positions.level.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load level options:', error);
  }
}

async function loadTypeOptions() {
  try {
    const options = await getCodeOptionsByParentValue("organization.positions.type");
    typeOptions.value = options
      .filter(opt => opt.value)
      .map((opt) => ({
        label: opt.title ? $t(opt.title) : $t(`organization.positions.type.${opt.value}`),
        value: opt.value,
      }));
  } catch (error) {
    console.error('Failed to load type options:', error);
  }
}

async function loadOrgCode(oid: string) {
  if (!oid) {
    orgCode.value = "";
    return;
  }
  try {
    const org = await getOrgDetail(oid);
    orgCode.value = org.code || "";
  } catch (error) {
    console.error('Failed to load org code:', error);
    orgCode.value = "";
  }
}

async function generateTitle(eName: string) {
  if (!eName || !orgCode.value) {
    await basicFormApi.setFieldValue("title", "");
    return;
  }
  const title = `organization.positions.${orgCode.value.toLowerCase().replace(/\s+/g, '')}.${eName.toLowerCase().replace(/\s+/g, '')}`;
  await basicFormApi.setFieldValue("title", title);
}

onMounted(() => {
  loadStatusOptions();
  if (props.dataScopeOptions && props.dataScopeOptions.length > 0) {
    dataScopeOptions.value = props.dataScopeOptions;
  } else {
    loadDataScopeOptions();
  }
  if (props.levelOptions && props.levelOptions.length > 0) {
    levelOptions.value = props.levelOptions;
  } else {
    loadLevelOptions();
  }
  if (props.typeOptions && props.typeOptions.length > 0) {
    typeOptions.value = props.typeOptions;
  } else {
    loadTypeOptions();
  }
});

// ===== 技能选择相关 =====
// 技能树数据
const skillTreeData = ref<SkillApi.Skill[]>([]);
const skillTreeLoading = ref(false);
// 选中的技能ID列表
const selectedSkillIds = ref<string[]>([]);
// 岗位已关联的技能列表
const positionSkills = ref<OrganizationPositionApi.PositionSkill[]>([]);

// 加载技能树数据
async function loadSkillTree() {
  skillTreeLoading.value = true;
  try {
    const res = await skillApi.getSkillTree();
    skillTreeData.value = convertSkillsToTreeNodes(res);
  } finally {
    skillTreeLoading.value = false;
  }
}

// 加载岗位关联的技能
async function loadPositionSkills(positionId: string) {
  try {
    const skills = await getPositionSkills(positionId);
    positionSkills.value = skills;
    // 设置选中的技能ID
    selectedSkillIds.value = skills.map(s => s.skillId);
  } catch (error) {
    console.error('Failed to load position skills:', error);
    positionSkills.value = [];
    selectedSkillIds.value = [];
  }
}

// 将技能数据转换为 Tree 组件期望的格式
function convertSkillsToTreeNodes(skills: SkillApi.Skill[]): any[] {
  return skills.map((skill) => {
    const node: any = {
      value: skill.sid,
      label: skill.name,
      title: skill.name,
      type: skill.type,
      description: skill.description,
      isLeaf: skill.type === 'skill',
    };

    if (skill.children && skill.children.length > 0) {
      node.children = convertSkillsToTreeNodes(skill.children);
    }
    return node;
  });
}

// 获取节点类名，skill 类型节点横向排列，catalog 类型添加主题背景
function getNodeClass(item: any) {
  const classes: string[] = [];
  const node = item.value || item;
  if (node.type === 'skill') {
    classes.push('inline-flex');
  }
  if (node.type === 'catalog') {
    classes.push('catalog-node');
  }
  return classes.join(' ');
}

// 在树中查找节点
function findNodeInTree(nodes: any[], id: string): any | null {
  for (const node of nodes) {
    if (node.value === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// 保存技能选择
async function onSaveSkills() {
  if (!formData.value?.id) return;

  modalApi.lock();
  try {
    // 过滤掉 catalog 类型的节点，只保留 skill 类型，并去重
    const skillIds = [...new Set(
      selectedSkillIds.value.filter(id => {
        const node = findNodeInTree(skillTreeData.value, id);
        return node?.type === 'skill';
      })
    )];

    // 构建技能列表
    const skills: OrganizationPositionApi.PositionSkill[] = skillIds.map(skillId => {
      // 查找现有技能配置（如果有）
      const existingSkill = positionSkills.value.find(s => s.skillId === skillId);
      return {
        skillId,
        invocation: existingSkill?.invocation || 'auto',
        priority: existingSkill?.priority || 0,
      };
    });

    await savePositionSkills(formData.value.id, skills);
    message.success($t("ui.actionMessage.operationSuccess"));
    // 重新加载技能列表
    await loadPositionSkills(formData.value.id);
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t("ui.actionTitle.edit", [$t("organization.positions.moduleName")])
    : $t("ui.actionTitle.create", [$t("organization.positions.moduleName")]),
);

// 处理岗位类型变化
function handleTypeChange(value: string) {
  // 更新 formData 中的 type，以便技能管理 Tab 的可用状态实时更新
  if (formData.value) {
    formData.value.type = value;
  } else {
    // 新建模式时，创建一个临时对象
    formData.value = { type: value } as OrganizationPositionApi.Position;
  }
  // 如果切换到非 agent 类型，且当前在技能 Tab，则切换回基本信息
  if (value !== "agent" && activeTab.value === "skills") {
    activeTab.value = "basic";
  }
}

// 基本信息表单
const [BasicForm, basicFormApi] = useVbenForm({
  commonConfig: {
    colon: true,
  },
  schema: computed(() => useBasicSchema(
    statusOptions.value || [],
    dataScopeOptions.value || [],
    levelOptions.value || [],
    typeOptions.value || [],
    generateTitle,
    basicFormApi,
    titleSuffix,
    handleTypeChange,
  )),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

// 岗位说明表单
const [DescriptionForm, descriptionFormApi] = useVbenForm({
  commonConfig: {
    colon: false,
    hideLabel: true,
  },
  schema: useDescriptionSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-1",
  handleSubmit: onSubmitDescription,
});

async function onSubmitDescription() {
  if (!formData.value?.id) return;

  modalApi.lock();
  try {
    const formValues = await descriptionFormApi.getValues<{ description?: string }>();
    const data: Record<string, any> = {
      description: formValues.description,
    };
    await updatePosition(formData.value.id, data);
    message.success($t("ui.actionMessage.operationSuccess"));
    // 更新 formData 中的 description
    if (formData.value) {
      formData.value.description = formValues.description;
    }
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}

const [Modal, modalApi] = useVbenModal({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<OrganizationPositionApi.Position>();
      if (data) {
        formData.value = data;
        const values: Record<string, any> = { ...data };
        basicFormApi.setValues(values);
        // 加载组织代码
        if (data.oid) {
          await loadOrgCode(data.oid);
        }
        // 如果有 title，设置翻译后缀
        titleSuffix.value = formData.value.title
          ? $t(formData.value.title)
          : undefined;
        // 重置 Tab
        activeTab.value = "basic";
        // 加载技能树和岗位技能
        if (skillTreeData.value.length === 0) {
          await loadSkillTree();
        }
        if (data.id) {
          await loadPositionSkills(data.id);
        }
        // 加载岗位说明
        descriptionFormApi.setValues({ description: data.description });
      } else {
        formData.value = undefined;
        basicFormApi.resetForm();
        descriptionFormApi.resetForm();
        orgCode.value = "";
        titleSuffix.value = undefined;
        activeTab.value = "basic";
        selectedSkillIds.value = [];
        positionSkills.value = [];
      }
    }
  },
});

async function onSubmit() {
  // 根据当前 Tab 执行不同的提交逻辑
  if (activeTab.value === "basic") {
    const { valid } = await basicFormApi.validate();
    if (valid) {
      modalApi.lock();
      const formValues = await basicFormApi.getValues<
        Omit<OrganizationPositionApi.Position, "id" | "createTime"> & { level?: string }
      >();

      const data: Record<string, any> = {
        ...formValues,
      };

      try {
        const result = await (formData.value?.id
          ? updatePosition(formData.value.id, data)
          : createPosition(data));
        message.success($t("ui.actionMessage.operationSuccess"));
        
        // 如果是新建，关闭窗口；如果是编辑，保持窗口打开
        if (!formData.value?.id) {
          modalApi.close();
          // 传递岗位所属组织ID，让列表页可以自动选中该组织
          emit("success", data.orgId || undefined);
          // 如果创建了新的翻译键，提示用户刷新页面以查看最新翻译
          if (data.title) {
            message.info("翻译已更新，刷新页面后生效", 3);
          }
        } else {
          // 编辑模式，更新 formData
          formData.value = { ...formData.value, ...result };
        }
      } catch (error) {
        message.error($t("ui.actionMessage.operationFailed"));
      } finally {
        modalApi.unlock();
      }
    }
  } else if (activeTab.value === "description") {
    // 岗位说明 Tab 保存
    await onSubmitDescription();
  } else if (activeTab.value === "skills") {
    // 技能 Tab 保存技能选择
    await onSaveSkills();
  }
}
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <!-- 基本信息 Tab -->
      <Tabs.TabPane key="basic" :tab="$t('organization.positions.tabs.basic')">
        <BasicForm class="position-form" />
      </Tabs.TabPane>
      
      <!-- 岗位说明 Tab -->
      <Tabs.TabPane key="description" :tab="$t('organization.positions.tabs.description')">
        <DescriptionForm class="position-form" />
      </Tabs.TabPane>
      
      <!-- 技能选择 Tab - 仅当岗位类型为 agent 时显示 -->
      <Tabs.TabPane 
        key="skills" 
        :tab="$t('organization.positions.tabs.skills')"
        :disabled="isNew || !isAgentType"
      >
        <div class="p-4">
          <Spin :spinning="skillTreeLoading" wrapper-class-name="w-full">
            <Tree
              :model-value="selectedSkillIds"
              :tree-data="skillTreeData"
              multiple
              bordered
              :default-expanded-level="3"
              checkable
              :selectable="false"
              :get-node-class="getNodeClass"
              @update:model-value="(val: string[]) => selectedSkillIds = val || []"
            >
              <template #title="{ label, type, data }">
                <div class="flex flex-col py-1">
                  <span class="flex items-center gap-2">
                    <IconifyIcon 
                      :icon="type === 'catalog' ? 'mdi:folder' : 'mdi:lightning-bolt'" 
                      class="size-4"
                      :class="type === 'catalog' ? 'text-blue-500' : 'text-yellow-500'"
                    />
                    <span>{{ label }}</span>
                  </span>
                  <span v-if="data?.description" class="text-gray-400 text-xs mt-1 ml-6 max-w-[400px] truncate" :title="data.description">{{ data.description }}</span>
                </div>
              </template>
            </Tree>
          </Spin>
          <div v-if="selectedSkillIds.length > 0" class="mt-4 text-sm text-gray-500">
            {{ $t('organization.positions.skills.selectedCount', { count: selectedSkillIds.length }) }}
          </div>
          <div v-else class="mt-4 text-sm text-gray-400">
            {{ $t('organization.positions.skills.noSkillsSelected') }}
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>

<style scoped>
.position-form :deep(.col-span-2) {
  grid-column: span 2 / span 2;
}

.position-form :deep(textarea) {
  min-height: calc(100vh - 500px);
}

/* skill 类型节点横向排列 */
:deep(.inline-flex) {
  display: inline-flex;
  margin-right: 16px;
}

/* 包含 skill 子节点的父节点，其子节点列表横向排列 */
:deep(.ant-tree-child-tree:has(.inline-flex)) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* catalog 类型节点添加主题背景色（10% 主题色） */
:deep(.catalog-node) {
  background-color: hsl(var(--primary) / 0.1);
  border-radius: 0.375rem;
  padding: 4px 8px;
}

:deep(.catalog-node:hover) {
  background-color: hsl(var(--primary) / 0.15);
}
</style>
