<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system/roles';
import type { Recordable } from '@vben/types';

import { computed, nextTick, ref, h, watch } from 'vue';

import { Tree, useVbenModal } from '@vben/common-ui';

import { Spin, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getModuleList } from '#/api/system/modules';
import { createRole, updateRole } from '#/api/system/roles';
import { $t } from "#/locales";

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemRoleApi.SystemRole>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: "col-span-1",
  },
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: "grid-cols-2 gap-x-4",
});

const permissions = ref<any[]>([]);
const loadingPermissions = ref(false);

const id = ref<string | undefined>();
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    
    const values = await formApi.getValues();
    
    // 检查权限数据中是否存在缺失 auth_code 的节点
    const missingAuthCodeModules = findModulesWithoutAuthCode(permissions.value);
    if (missingAuthCodeModules.length > 0) {
      const moduleNames = missingAuthCodeModules.map(m => m.label || m.title).join('、');
      message.error($t('system.roles.missingAuthCodeError', { modules: moduleNames }));
      return;
    }
    
    modalApi.lock();
    (id.value ? updateRole(id.value, values) : createRole(values))
      .then(() => {
        emits('success');
        modalApi.close();
      })
      .catch(() => {
        modalApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<SystemRoleApi.SystemRole>();
      formApi.resetForm();

      if (data) {
        formData.value = data;
        id.value = data.id;
      } else {
        id.value = undefined;
      }

      if (permissions.value.length === 0) {
        await loadPermissions();
      }
      
      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    const res = await getModuleList();
    // 将模块数据转换为 Tree 组件期望的格式
    permissions.value = convertModulesToTreeNodes(res);
  } finally {
    loadingPermissions.value = false;
  }
}

// 将模块数据转换为 Tree 组件期望的格式
// 所有节点统一使用 auth_code 作为 value，title 作为显示文本（带翻译）
function convertModulesToTreeNodes(modules: any[]): any[] {
  return modules.map((module) => {
    // 统一使用 auth_code 作为节点标识
    const nodeValue = module.auth_code || module.sid;
    
    // 直接使用 module.title 作为多语言 key
    const titleKey = module.title || module.name || '';
    
    // 翻译 title，显示 key 或翻译后的文本
    let displayTitle = titleKey;
    if (titleKey && titleKey.includes('.')) {
      const translated = $t(titleKey);
      // 如果翻译结果与 key 不同，说明翻译成功，使用翻译后的文本
      if (translated !== titleKey) {
        displayTitle = translated;
      }
      // 如果翻译失败（返回 key 本身），仍然显示 key，不使用 name 作为备选
    }

    const node: any = {
      value: nodeValue,
      label: displayTitle, // 使用翻译后的文本或原始 key
      title: titleKey, // 保存原始 key
      type: module.type,
      // 标记是否缺失 auth_code
      missingAuthCode: !module.auth_code,
      rawData: module, // 保存原始数据用于错误提示
    };
    
    if (module.children && module.children.length > 0) {
      node.children = convertModulesToTreeNodes(module.children);
    }
    return node;
  });
}

// 查找所有缺失 auth_code 的模块节点
function findModulesWithoutAuthCode(nodes: any[]): any[] {
  const result: any[] = [];
  
  function traverse(nodeList: any[]) {
    for (const node of nodeList) {
      if (node.missingAuthCode) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return result;
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t("ui.actionTitle.edit")
    : $t("ui.actionTitle.create"),
);

// 获取节点类名，action 类型节点横向排列，module 类型节点添加主题背景
function getNodeClass(item: Recordable<any>) {
  const classes: string[] = [];
  // item 是 FlattenedItem，实际的节点数据在 item.value 中
  const node = item.value || item;
  if (node.type === 'action') {
    classes.push('inline-flex');
  }
  if (node.type === 'module') {
    classes.push('module-node');
  }
  return classes.join(' ');
}

// 处理权限变化，将选中的权限转换为 permission JSON
function handlePermissionChange(value: string[]) {
  const permissionJson: SystemRoleApi.PermissionJson = {
    actions: value || [],
  };
  formApi.setFieldValue('permission', permissionJson);
}
</script>
<template>
  <Modal class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Form>
      <template #permission="slotProps">
        <Spin :spinning="loadingPermissions" wrapper-class-name="w-full">
          <Tree
            :model-value="slotProps.value?.actions || []"
            :tree-data="permissions"
            multiple
            bordered
            :default-expanded-level="2"
            checkable
            :selectable="false"
            :get-node-class="getNodeClass"
            @update:model-value="handlePermissionChange"
          >
            <template #title="{ label }">
              {{ label }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Modal>
</template>
<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    display: none;
    margin-left: 20px;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    display: flex;
    flex: auto;
    justify-content: flex-end;
    margin-left: 20px;
  }
}

/* action 类型节点横向排列 */
:deep(.inline-flex) {
  display: inline-flex;
  margin-right: 16px;
}

/* 包含 action 子节点的父节点，其子节点列表横向排列 */
:deep(.ant-tree-child-tree:has(.inline-flex)) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* module 类型节点添加主题背景色 */
:deep(.module-node) {
  background-color: hsl(var(--primary) / 0.1);
  border-radius: 0.375rem;
  font-weight: 600;
}

:deep(.module-node:hover) {
  background-color: hsl(var(--primary) / 0.15);
}
</style>
