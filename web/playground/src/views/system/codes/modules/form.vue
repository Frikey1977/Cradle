<script lang="ts" setup>
import type { SystemCodeApi } from "#/api/system/codes";
import type { ChangeEvent } from "ant-design-vue/es/_util/EventInterface";

import { computed, ref, onMounted, watch } from "vue";

import { useVbenModal } from "@vben/common-ui";
import { message } from "ant-design-vue";

import { useVbenForm, z } from "#/adapter/form";
import {
  createCode,
  updateCode,
  isCodeValueExists,
  getCodeOptionsByParentValue,
} from "#/api/system/codes";
import { $t } from "#/locales";

import { useSchema } from "../data";

// 代码类型选项
const typeOptions = ref<{ label: string; value: string }[]>([]);

// 状态选项
const statusOptions = ref<{ label: string; value: string }[]>([]);

// title 字段翻译后缀
const titleSuffix = ref<string>();

// 当前选中的父级节点 value 链
const parentValueChain = ref<string>("");

// 加载代码类型选项
async function loadTypeOptions() {
  const options = await getCodeOptionsByParentValue("system.codes.type");
  typeOptions.value = options.map((opt) => ({
    // 使用 title 字段作为翻译键，如果没有则使用默认值
    label: opt.title ? $t(opt.title) : opt.label,
    value: opt.value,
  }));
}

// 加载状态选项
async function loadStatusOptions() {
  const options = await getCodeOptionsByParentValue("system.codes.status");
  statusOptions.value = options.map((opt) => ({
    // 使用 title 字段作为翻译键，如果没有则使用默认值
    label: opt.title ? $t(opt.title) : opt.label,
    value: opt.value,
  }));
}

/**
 * 根据上级类型确定默认类型
 * module -> function
 * function -> code
 * code -> value
 * 无上级 -> module
 */
function getDefaultTypeByParentType(parentType?: string): string {
  switch (parentType) {
    case 'module':
      return 'function';
    case 'function':
      return 'code';
    case 'code':
      return 'value';
    default:
      return 'module';
  }
}

/**
 * 在树中查找节点
 */
function findNodeInTree(tree: any[], sid: string): any | null {
  for (const node of tree) {
    if (node.sid === sid) {
      return node;
    }
    if (node.children?.length) {
      const found = findNodeInTree(node.children, sid);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 从树节点构建 value 链
 * 递归获取所有上级节点的 value，用点号连接
 */
function buildValueChainFromNode(node: any): string {
  if (!node) return "";

  const chain: string[] = [];
  const treeData = (window as any).codeTreeData || [];

  // 添加当前节点的 value
  if (node.value) {
    chain.unshift(node.value);
  }

  // 通过 parentId 查找父节点
  let currentNode = node;
  while (currentNode.parentId) {
    const parent = findNodeInTree(treeData, currentNode.parentId);
    if (!parent) break;
    if (parent.value) {
      chain.unshift(parent.value);
    }
    currentNode = parent;
  }

  return chain.join(".");
}

/**
 * 根据 parentId 更新 value 链
 */
function updateParentValueChain(parentId: string | null | undefined) {
  if (!parentId) {
    parentValueChain.value = "";
    return;
  }

  const treeData = (window as any).codeTreeData || [];
  const selectedNode = findNodeInTree(treeData, parentId);
  parentValueChain.value = buildValueChainFromNode(selectedNode);
}

/**
 * 自动生成标题
 * 格式: codes.{上级value链}.{码值}
 * 对于 module、function、code 类型（有下级的节点），标题格式为: codes.{链}.{值}.title
 * 对于 value 类型（叶子节点），标题格式为: codes.{链}.{值}
 */
async function generateTitle(value: string, type: string = 'function') {
  if (!value) {
    titleSuffix.value = undefined;
    await formApi.setFieldValue("title", "");
    return;
  }

  // 获取当前表单的 parentId，确保 parentValueChain 是最新的
  const values = await formApi.getValues();
  const currentParentId = values?.parentId;
  
  // 如果有 parentId，重新计算 value chain（确保是最新的）
  let currentValueChain = parentValueChain.value;
  if (currentParentId) {
    const treeData = (window as any).codeTreeData || [];
    const selectedNode = findNodeInTree(treeData, currentParentId);
    currentValueChain = buildValueChainFromNode(selectedNode);
    // 更新全局的 parentValueChain
    parentValueChain.value = currentValueChain;
  }

  // 构建基础标题: codes.{链}.{值}
  const baseTitle = currentValueChain
    ? `codes.${currentValueChain}.${value}`
    : `codes.${value}`;

  // 对于 module、function、code 类型（有下级的节点），添加 .title 后缀
  const hasChildrenTypes = ['module', 'function', 'code'];
  const title = hasChildrenTypes.includes(type) ? `${baseTitle}.title` : baseTitle;

  await formApi.setFieldValue("title", title);

  // 更新翻译后缀
  try {
    titleSuffix.value = $t(title);
  } catch {
    titleSuffix.value = undefined;
  }
}

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemCodeApi.Code>();

const getDrawerTitle = computed(() =>
  formData.value?.sid
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: computed(() =>
    useSchema(
      formData,
      () => {
        const values = formApi.getValues();
        return { parentId: values?.parentId, value: values?.value, type: values?.type };
      },
      titleSuffix,
      generateTitle,
      typeOptions.value,
      formApi,
      statusOptions.value,
      updateParentValueChain,
    ),
  ),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

// 监听 parentId 变化
let unwatchParentId: (() => void) | null = null;

const [Modal, modalApi] = useVbenModal({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<SystemCodeApi.Code>();
      if (data) {
        formData.value = data;
        const values = { ...data };
        if (values.metadata && typeof values.metadata === 'object') {
          values.metadata = JSON.stringify(values.metadata, null, 2);
        }
        await formApi.setValues(values);
        // 如果有 title，设置翻译后缀
        titleSuffix.value = data.title ? $t(data.title) : undefined;
        // 编辑模式：初始化 value 链
        if (data.parentId) {
          setTimeout(() => {
            updateParentValueChain(data.parentId);
          }, 100);
        }
      } else {
        // 新建模式
        formData.value = undefined;
        await formApi.resetForm();
        titleSuffix.value = undefined;
        parentValueChain.value = "";
      }
      
      // 获取 modal 数据中的 parentId（从树节点选择传递过来的）
      const modalData = modalApi.getData<SystemCodeApi.Code>();
      const initialParentId = modalData?.parentId;
      
      // 确定默认类型
      let defaultType = "module";
      
      // 等待树数据加载完成的函数
      const waitForTreeData = async (): Promise<any[]> => {
        let attempts = 0;
        while (attempts < 50) { // 最多等待 5 秒
          const treeData = (window as any).codeTreeData;
          if (treeData && treeData.length > 0) {
            return treeData;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        return [];
      };
      
      if (initialParentId) {
        // 等待树数据加载完成
        const treeData = await waitForTreeData();
        const parentNode = findNodeInTree(treeData, initialParentId);
        // 根据上级类型设置默认类型
        defaultType = getDefaultTypeByParentType(parentNode?.type);
      }
      
      // 使用 watch 监听 parentId 变化（用户在表单中修改时）
      unwatchParentId = watch(
        () => formApi.getValues?.()?.parentId,
        async (newParentId) => {
          if (newParentId) {
            updateParentValueChain(newParentId as string);
            // 查找上级节点，获取其类型
            const treeData = (window as any).codeTreeData || [];
            const parentNode = findNodeInTree(treeData, newParentId as string);
            // 根据上级类型设置默认类型
            const defaultType = getDefaultTypeByParentType(parentNode?.type);
            await formApi.setFieldValue("type", defaultType);
            // 重新生成标题
            const values = await formApi.getValues();
            const currentValue = values?.value;
            if (currentValue) {
              await generateTitle(currentValue, defaultType);
            }
          } else {
            // 无上级时，默认类型为 module
            await formApi.setFieldValue("type", "module");
          }
        },
      );

      // 设置表单默认值的函数
      const setFormDefaults = async () => {
        // 延迟执行，确保 formApi 完全初始化
        await new Promise((resolve) => setTimeout(resolve, 100));
        // 设置类型
        await formApi.setFieldValue("type", defaultType);
        // 如果有初始 parentId，设置它
        if (initialParentId) {
          await formApi.setFieldValue("parentId", initialParentId);
          updateParentValueChain(initialParentId);
        }
      };
      
      // 设置表单默认值
      await setFormDefaults();
    }
  },
  onClosed() {
    // 取消监听
    if (unwatchParentId) {
      unwatchParentId();
      unwatchParentId = null;
    }
  },
});

// 组件挂载时加载类型选项和状态选项
onMounted(() => {
  loadTypeOptions();
  loadStatusOptions();
});

// 监听 typeOptions 变化，在抽屉打开时更新表单
watch(typeOptions, (newOptions) => {
  // 只更新本地状态，实际更新在 onOpenChange 中处理
});



async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    modalApi.lock();
    try {
      const formValues = await formApi.getValues();

      // 处理 metadata 字段
      let metadataValue: Record<string, any> | undefined = undefined;
      if (formValues.metadata) {
        if (typeof formValues.metadata === "string") {
          try {
            metadataValue = JSON.parse(formValues.metadata);
          } catch {
            metadataValue = undefined;
          }
        } else if (typeof formValues.metadata === "object") {
          metadataValue = formValues.metadata as Record<string, any>;
        }
      }

      const data = {
        ...formValues,
        sort: formValues.sort ? Number(formValues.sort) : 0,
        color: !formValues.color ? null : formValues.color,
        metadata: metadataValue,
      };

      await (formData.value?.sid
        ? updateCode(formData.value.sid, data)
        : createCode(data));
      message.success($t("ui.actionMessage.operationSuccess"));
      modalApi.close();
      emit("success");
      // 如果创建了新的翻译键，提示用户刷新页面以查看最新翻译
      if (data.title) {
        message.info("翻译已更新，刷新页面后生效", 3);
      }
    } catch (error: any) {
      message.error(error.message || $t("ui.actionMessage.operationFailed"));
    } finally {
      modalApi.unlock();
    }
  }
}
</script>

<template>
  <Modal class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Form />
  </Modal>
</template>
