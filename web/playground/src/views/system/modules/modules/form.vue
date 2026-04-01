<script lang="ts" setup>
import type { ChangeEvent } from 'ant-design-vue/es/_util/EventInterface';

import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, h, ref, onMounted } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $te, $t } from '#/locales';
import { getPopupContainer } from '@vben/utils';
import { message } from 'ant-design-vue';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import { useVbenForm, z } from '#/adapter/form';
import { getCodeOptionsByParentValue } from '#/api/system/codes';
import {
  createModule,
  getModuleList,
  isModuleNameExists,
  isModulePathExists,
  SystemModuleApi,
  updateModule,
} from '#/api/system/modules';
import { componentKeys } from '#/router/routes';

const emit = defineEmits<{
  success: [];
}>();
const formData = ref<SystemModuleApi.SystemModule>();
const titleSuffix = ref<string>();

// 模块类型选项
const typeOptions = ref<{ label: string; value: string }[]>([]);
// 状态选项
const statusOptions = ref<{ label: string; value: string }[]>([]);

// 加载模块类型选项
async function loadTypeOptions() {
  const options = await getCodeOptionsByParentValue("system.modules.type");
  typeOptions.value = options.map((opt) => ({
    label: opt.title ? $t(opt.title) : opt.label,
    value: opt.value,
  }));
}

// 加载状态选项
async function loadStatusOptions() {
  const options = await getCodeOptionsByParentValue("system.modules.status");
  statusOptions.value = options.map((opt) => ({
    label: opt.title ? $t(opt.title) : opt.label,
    value: opt.value,
  }));
}

// 组件挂载时加载选项
onMounted(() => {
  loadTypeOptions();
  loadStatusOptions();
});
const schema: VbenFormSchema[] = [
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: typeOptions,
      optionType: 'button',
    },
    defaultValue: 'function',
    fieldName: 'type',
    formItemClass: 'col-span-2 md:col-span-2',
    label: $t('system.modules.type'),
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('system.modules.name'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.modules.name'), 2]))
      .max(50, $t('ui.formRules.maxLength', [$t('system.modules.name'), 50]))
      .refine(
        async (value: string) => {
          return !(await isModuleNameExists(value, formData.value?.sid));
        },
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.modules.name'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: getModuleList,
      class: 'w-full',
      filterTreeNode(input: string, node: Recordable<any>) {
        if (!input || input.length === 0) {
          return true;
        }
        const title: string = node.title ?? '';
        if (!title) return false;
        return title.includes(input) || $t(title).includes(input);
      },
      getPopupContainer,
      labelField: 'title',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'sid',
      childrenField: 'children',
    },
    fieldName: 'pid',
    label: $t('system.modules.parent'),
    renderComponentContent() {
      return {
        title({ label, icon }: { label: string; icon: string }) {
          const coms = [];
          if (!label) return '';
          if (icon) {
            coms.push(h(IconifyIcon, { class: 'size-4', icon }));
          }
          coms.push(h('span', { class: '' }, $t(label)));
          return h('div', { class: 'flex items-center gap-1' }, coms);
        },
      };
    },
  },
  {
    component: 'Input',
    componentProps() {
      // 不需要处理多语言时就无需这么做
      return {
        ...(titleSuffix.value && { addonAfter: titleSuffix.value }),
        onChange({ target: { value } }: ChangeEvent) {
          titleSuffix.value = value ? $t(value) : undefined;
        },
      };
    },
    fieldName: 'title',
    formItemClass: 'col-span-2',
    label: $t('system.modules.menuTitle'),
    rules: 'required',
  },
  {
    component: 'InputNumber',
    fieldName: 'sort',
    label: $t('system.modules.sort'),
    componentProps: {
      min: 0,
      style: { width: '100%' },
    },
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['module', 'embedded', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'path',
    label: $t('system.modules.path'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.modules.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.modules.path'), 100]))
      .refine(
        (value: string) => {
          return value.startsWith('/');
        },
        $t('ui.formRules.startWith', [$t('system.modules.path'), '/']),
      )
      .refine(
        async (value: string) => {
          return !(await isModulePathExists(value, formData.value?.sid));
        },
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.modules.path'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'activePath',
    help: $t('system.modules.activePathHelp'),
    label: $t('system.modules.activePath'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.modules.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.modules.path'), 100]))
      .refine(
        (value: string) => {
          return value.startsWith('/');
        },
        $t('ui.formRules.startWith', [$t('system.modules.path'), '/']),
      )
      .refine(async (value: string) => {
        return await isModulePathExists(value, formData.value?.sid);
      }, $t('system.modules.activePathMustExist'))
      .optional(),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['module', 'embedded', 'link', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'icon',
    label: $t('system.modules.icon'),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['module', 'embedded', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.activeIcon',
    label: $t('system.modules.activeIcon'),
  },
  {
    component: 'AutoComplete',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      filterOption(input: string, option: { value: string }) {
        return option.value.toLowerCase().includes(input.toLowerCase());
      },
      options: componentKeys.map((v) => ({ value: v })),
    },
    dependencies: {
      show: (values) => {
        return values.type === 'function';
      },
      triggerFields: ['type'],
    },
    fieldName: 'component',
    label: $t('system.modules.component'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'linkSrc',
    label: $t('system.modules.linkSrc'),
    rules: z.string().url($t('ui.formRules.invalidURL')),
  },
  {
    component: 'Input',
    dependencies: {
      rules: (values) => {
        return values.type === 'action' ? 'required' : null;
      },
      show: (values) => {
        return ['action', 'module', 'embedded', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'auth_code',
    label: $t('system.modules.authCode'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: statusOptions,
      optionType: 'button',
    },
    defaultValue: 'enabled',
    fieldName: 'status',
    label: $t('system.modules.status'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: [
        { label: $t('system.modules.badgeType.dot'), value: 'dot' },
        { label: $t('system.modules.badgeType.normal'), value: 'normal' },
      ],
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'action';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badgeType',
    label: $t('system.modules.badgeType.title'),
  },
  {
    component: 'Input',
    componentProps: (values) => {
      return {
        allowClear: true,
        class: 'w-full',
        disabled: values.meta?.badgeType !== 'normal',
      };
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'action';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badge',
    label: $t('system.modules.badge'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: SystemModuleApi.BadgeVariants.map((v) => ({
        label: v,
        value: v,
      })),
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'action';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badgeVariants',
    label: $t('system.modules.badgeVariants'),
  },
  {
    component: 'Divider',
    dependencies: {
      show: (values) => {
        return !['action', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'divider1',
    formItemClass: 'col-span-2 md:col-span-2 pb-0',
    hideLabel: true,
    renderComponentContent() {
      return {
        default: () => $t('system.modules.advancedSettings'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.keepAlive',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.keepAlive'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['embedded', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.affixTab',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.affixTab'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['action'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.hideInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['module', 'function'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideChildrenInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.hideChildrenInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['action', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInBreadcrumb',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.hideInBreadcrumb'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['action', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInTab',
    renderComponentContent() {
      return {
        default: () => $t('system.modules.hideInTab'),
      };
    },
  },
];

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Modal, modalApi] = useVbenModal({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<SystemModuleApi.SystemModule>();
      // 确保 meta 对象存在
      if (!data.meta) {
        data.meta = {};
      }
      if (data?.type === 'link') {
        data.linkSrc = data.meta?.link || '';
      } else if (data?.type === 'embedded') {
        data.linkSrc = data.meta?.iframeSrc || '';
      }
      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
        titleSuffix.value = formData.value.title
          ? $t(formData.value.title)
          : "";
      } else {
        formApi.resetForm();
        titleSuffix.value = '';
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    modalApi.lock();
    const data =
      await formApi.getValues<
        Omit<SystemModuleApi.SystemModule, 'children' | 'sid'>
      >();
    // 确保 meta 对象存在
    if (!data.meta) {
      data.meta = {};
    }
    if (data.type === 'link') {
      data.meta = { ...data.meta, link: data.linkSrc };
    } else if (data.type === 'embedded') {
      data.meta = { ...data.meta, iframeSrc: data.linkSrc };
    }
    delete data.linkSrc;
    try {
      await (formData.value?.sid
        ? updateModule(formData.value.sid, data)
        : createModule(data));
      message.success(
        formData.value?.sid
          ? $t('ui.actionMessage.operationSuccess')
          : $t('ui.actionMessage.operationSuccess'),
      );
      modalApi.close();
      emit('success');
    } catch (error) {
      message.error($t('ui.actionMessage.operationFailed'));
    } finally {
      modalApi.unlock();
    }
  }
}
const getDrawerTitle = computed(() =>
  formData.value?.sid
    ? $t('ui.actionTitle.edit')
    : $t('ui.actionTitle.create'),
);
</script>
<template>
  <Modal class="w-full max-w-[1080px]" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Modal>
</template>
