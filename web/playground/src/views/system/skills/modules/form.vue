<script lang="ts" setup>
import type { SkillApi } from "#/api/system/skills";

import { computed, ref, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { IconifyIcon } from "@vben/icons";
import { Button, Card, Input, message, Tabs, Tree, Spin, Empty } from "ant-design-vue";
import type { TreeProps } from "ant-design-vue";

import { useVbenForm } from "#/adapter/form";
import { skillApi } from "#/api/system/skills";
import { getSmartFormSuggestion, type SmartFormRequest } from "#/api/ai/smart-form";
import { $t } from "#/locales";

import { generateTitle, setCurrentSkillSid, useSchema } from "../data";

const emit = defineEmits<{
  success: [];
}>();

interface FormModalData {
  row?: SkillApi.Skill;
  sourceTypeOptions?: { label: string; value: string }[];
  statusOptions?: { label: string; value: string }[];
  parentIdOptions?: { label: string; value: string }[];
  nodeTypeOptions?: { label: string; value: string }[];
}

const formData = ref<SkillApi.Skill>();
const sourceTypeOptions = ref<{ label: string; value: string }[]>([]);
const statusOptions = ref<{ label: string; value: string }[]>([]);
const parentIdOptions = ref<{ label: string; value: string }[]>([]);
const nodeTypeOptions = ref<{ label: string; value: string }[]>([]);
const activeTab = ref("basic");

// title 字段翻译后缀
const titleSuffix = ref<string>();

// 文件浏览
const fileTreeData = ref<TreeProps['treeData']>([]);
const fileTreeLoading = ref(false);
const selectedFileContent = ref<string>("");
const selectedFileLoading = ref(false);
const selectedFilePath = ref<string>("");

// AI 聊天相关
const aiChatInput = ref<string>("");
const aiChatLoading = ref(false);
const aiChatMessages = ref<Array<{ role: "user" | "assistant"; content: string }>>([]);

const getDrawerTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

/**
 * 处理 title 生成
 * 当 slug 变化时触发
 */
async function handleTitleChange(slug: string) {
  // 生成 title
  const title = generateTitle(slug);
  if (title) {
    await formApi.setFieldValue("title", title);
  }
}

const getSkillSid = () => formData.value?.sid;
const currentType = ref<string | undefined>(formData.value?.type);
const getType = () => currentType.value;

// 处理类型变化
async function handleTypeChange(type: string) {
  currentType.value = type;
  if (type === "catalog") {
    // 分类目录时清空 parentId
    await formApi.setFieldValue("parentId", null);
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useSchema(handleTitleChange, titleSuffix, sourceTypeOptions.value, statusOptions.value, getSkillSid, parentIdOptions.value, nodeTypeOptions.value, getType, handleTypeChange),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

// 监听 sourceTypeOptions、statusOptions、parentIdOptions、nodeTypeOptions 变化，更新表单 schema
// 使用防抖避免频繁更新
let updateTimeout: ReturnType<typeof setTimeout> | null = null;
watch(
  [() => sourceTypeOptions.value, () => statusOptions.value, () => parentIdOptions.value, () => nodeTypeOptions.value, () => currentType.value],
  ([newSourceOptions, newStatusOptions, newParentIdOptions, newNodeTypeOptions]) => {
    // 清除之前的定时器
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    // 延迟更新，避免频繁渲染
    updateTimeout = setTimeout(() => {
      formApi.setState({
        schema: useSchema(handleTitleChange, titleSuffix, newSourceOptions, newStatusOptions, getSkillSid, newParentIdOptions, newNodeTypeOptions, getType, handleTypeChange),
      });
    }, 50);
  },
  { immediate: true, flush: "post" },
);

// 加载文件树
async function loadFileTree() {
  if (!formData.value?.sid) {
    fileTreeData.value = [];
    return;
  }
  fileTreeLoading.value = true;
  try {
    const tree = await skillApi.getSkillFileTree(formData.value.sid);
    fileTreeData.value = tree;
  } catch (error) {
    fileTreeData.value = [];
    message.error($t("system.skills.loadFileTreeFailed"));
  } finally {
    fileTreeLoading.value = false;
  }
}

// 选择文件
async function onSelectFile(selectedKeys: string[], info: any) {
  const key = selectedKeys[0];
  if (!key) return;

  // 检查是否是文件（没有 children 的是文件）
  const isFile = !info.node.children || info.node.children.length === 0;
  if (!isFile) return;

  selectedFilePath.value = key;
  selectedFileLoading.value = true;
  try {
    const content = await skillApi.getSkillFileContent(key);
    selectedFileContent.value = content;
  } catch (error) {
    selectedFileContent.value = "加载失败: " + (error as Error).message;
  } finally {
    selectedFileLoading.value = false;
  }
}

// 是否为编辑模式
const isEditMode = computed(() => !!formData.value?.sid);

// 是否为分类目录
const isCatalog = computed(() => currentType.value === "catalog");

// Tab 切换监听
watch(activeTab, (newTab) => {
  if (newTab === "files" && isEditMode.value) {
    loadFileTree();
  }
});

const [Modal, modalApi] = useVbenModal({
  onCancel() {
    modalApi.close();
  },
  onConfirm: async () => {
    // 根据当前激活的 Tab 提交对应的数据
    switch (activeTab.value) {
      case "basic":
        await onSubmitBasic();
        break;
      case "files":
        // 文件浏览 Tab 直接关闭
        modalApi.close();
        break;
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<FormModalData>();
      if (data?.sourceTypeOptions) {
        sourceTypeOptions.value = data.sourceTypeOptions;
      }
      if (data?.statusOptions) {
        statusOptions.value = data.statusOptions;
      }
      if (data?.parentIdOptions) {
        parentIdOptions.value = data.parentIdOptions;
      }
      if (data?.nodeTypeOptions) {
        nodeTypeOptions.value = data.nodeTypeOptions;
      }
      if (data?.row) {
        formData.value = data.row;
        currentType.value = data.row.type;
        setCurrentSkillSid(data.row.sid);
        formApi.setValues(formData.value);
        // 如果有 title，设置翻译后缀
        titleSuffix.value = formData.value.title
          ? $t(formData.value.title)
          : undefined;
        // 重置 Tab
        activeTab.value = "basic";
        // 预加载文件树
        loadFileTree();
      } else {
        formData.value = undefined;
        currentType.value = "skill";
        setCurrentSkillSid(undefined);
        formApi.resetForm();
        // 设置默认值
        formApi.setValues({
          type: "skill",
          version: "1.0.0",
          sourceType: "builtin",
          status: "enabled",
          sort: 0,
        });
        titleSuffix.value = undefined;
        activeTab.value = "basic";
        fileTreeData.value = [];
        selectedFileContent.value = "";
        selectedFilePath.value = "";
      }
    }
  },
});

// 获取 modal 状态
const modalState = modalApi.useStore();

// 根据全屏状态动态调整 modal 宽度
const modalClass = computed(() => {
  return modalState.value?.fullscreen ? "w-full" : "w-full max-w-[1080px]";
});

// AI 聊天处理
async function handleAiChat() {
  if (!aiChatInput.value.trim() || aiChatLoading.value) return;

  const userMessage = aiChatInput.value.trim();
  aiChatMessages.value.push({ role: "user", content: userMessage });
  aiChatInput.value = "";
  aiChatLoading.value = true;

  try {
    const formValues = await formApi.getValues();
    const request: SmartFormRequest = {
      module: "system",
      formType: "skill",
      formData: {
        ...formValues,
        currentFile: selectedFilePath.value,
        currentFileContent: selectedFileContent.value,
        chatHistory: aiChatMessages.value.slice(-6),
      },
      targetField: "skillContent",
      prompt: `用户请求: ${userMessage}

请根据用户的请求帮助编写或修改 Skill 文件内容。如果用户想创建新的 Skill 文件，请提供完整的文件内容。如果用户想修改现有文件，请提供修改后的完整内容。

当前技能信息:
- 名称: ${formValues.name || "未设置"}
- 标识符: ${formValues.slug || "未设置"}
- 描述: ${formValues.description || "未设置"}
- 当前文件: ${selectedFilePath.value || "未选择"}

请直接返回文件内容，不需要额外的解释。`,
      validation: {
        maxLength: 10000,
      },
    };

    const response = await getSmartFormSuggestion(request);

    if (response.suggestion) {
      aiChatMessages.value.push({ role: "assistant", content: response.suggestion });
      
      // 如果有选中的文件，自动更新内容
      if (selectedFilePath.value && selectedFileContent.value) {
        selectedFileContent.value = response.suggestion;
      }
    } else {
      aiChatMessages.value.push({ role: "assistant", content: "抱歉，我无法生成内容。请提供更多细节。" });
    }
  } catch (error) {
    console.error("AI 生成失败:", error);
    aiChatMessages.value.push({ role: "assistant", content: "生成失败，请稍后重试。" });
  } finally {
    aiChatLoading.value = false;
  }
}

// 清空聊天记录
function clearAiChat() {
  aiChatMessages.value = [];
}

// 提交基本信息
async function onSubmitBasic() {
  const { valid } = await formApi.validate();
  if (!valid) return;

  modalApi.lock();
  const data = await formApi.getValues<
    Omit<SkillApi.Skill, "sid" | "createTime" | "deleted">
  >();
  try {
    // 创建/更新技能
    await (formData.value?.sid
      ? skillApi.updateSkill(formData.value.sid, data)
      : skillApi.createSkill(data));

    message.success($t("ui.actionMessage.operationSuccess"));
    modalApi.close();
    emit("success");
  } catch (error) {
    message.error($t("ui.actionMessage.operationFailed"));
  } finally {
    modalApi.unlock();
  }
}

</script>

<template>
  <Modal :class="modalClass" :title="getDrawerTitle">
    <Tabs v-model:active-key="activeTab" type="card">
      <!-- Tab 1: 基本信息 -->
      <Tabs.TabPane key="basic" :tab="$t('system.skills.tabs.basic')">
        <Form />
      </Tabs.TabPane>

      <!-- Tab 2: 文件浏览 -->
      <Tabs.TabPane
        key="files"
        :tab="$t('system.skills.tabs.files')"
        :disabled="!isEditMode || isCatalog"
        class="h-full"
      >
        <!-- AI 聊天区域 -->
        <div class="p-3 bg-gray-50 rounded-lg border mb-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium flex items-center gap-1">
              <IconifyIcon icon="mdi:robot-outline" class="text-primary" />
              {{ $t('system.skills.aiAssistant.title') }}
            </span>
            <Button v-if="aiChatMessages.length > 0" type="text" size="small" @click="clearAiChat">
              <IconifyIcon icon="mdi:delete-outline" />
              {{ $t('system.skills.aiAssistant.clear') }}
            </Button>
          </div>
          
          <!-- 聊天消息区域 -->
          <div v-if="aiChatMessages.length > 0" class="max-h-[120px] overflow-y-auto mb-2 space-y-2">
            <div
              v-for="(msg, index) in aiChatMessages"
              :key="index"
              :class="[
                'p-2 rounded text-sm',
                msg.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-white mr-8 border'
              ]"
            >
              <div class="flex items-start gap-1">
                <IconifyIcon
                  :icon="msg.role === 'user' ? 'mdi:account' : 'mdi:robot'"
                  :class="msg.role === 'user' ? 'text-blue-500' : 'text-green-500'"
                  class="mt-0.5 flex-shrink-0"
                />
                <div class="flex-1 whitespace-pre-wrap break-words">{{ msg.content }}</div>
              </div>
            </div>
          </div>
          
          <!-- 输入区域 -->
          <div class="flex gap-2">
            <Input.TextArea
              v-model:value="aiChatInput"
              :placeholder="$t('system.skills.aiAssistant.placeholder')"
              :auto-size="{ minRows: 1, maxRows: 3 }"
              class="flex-1"
              @press-enter="(e: KeyboardEvent) => { if (!e.shiftKey) { e.preventDefault(); handleAiChat(); } }"
            />
            <Button type="primary" :loading="aiChatLoading" @click="handleAiChat">
              <template #icon>
                <IconifyIcon icon="mdi:send" />
              </template>
            </Button>
          </div>
        </div>

        <div class="px-4 pb-4 flex gap-4 h-[420px]">
          <!-- 左侧文件树 -->
          <Card class="w-64 flex-shrink-0 overflow-hidden flex flex-col skill-file-card" :title="$t('system.skills.fileTree')" :body-style="{ flex: 1, overflow: 'auto', padding: '12px' }">
            <Spin :spinning="fileTreeLoading">
              <Tree
                v-if="fileTreeData.length > 0"
                :tree-data="fileTreeData"
                :load-data="undefined"
                :default-expand-all="true"
                @select="onSelectFile"
              />
              <Empty v-else :description="$t('system.skills.noFiles')" />
            </Spin>
          </Card>

          <!-- 右侧文件内容 -->
          <Card class="flex-1 overflow-hidden flex flex-col skill-file-card" :title="selectedFilePath || $t('system.skills.fileContent')" :body-style="{ flex: 1, overflow: 'auto', padding: '12px' }">
            <Spin :spinning="selectedFileLoading">
              <pre v-if="selectedFileContent" class="whitespace-pre-wrap font-mono text-sm m-0">{{ selectedFileContent }}</pre>
              <Empty v-else :description="$t('system.skills.selectFileToView')" />
            </Spin>
          </Card>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>

<style scoped>
.skill-file-card {
  display: flex;
  flex-direction: column;
}

.skill-file-card :deep(.ant-card-body) {
  flex: 1;
  overflow: auto;
}
</style>
