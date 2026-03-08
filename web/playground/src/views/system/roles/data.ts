import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.roles.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'e_name',
      label: $t('system.roles.eName'),
    },
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('system.roles.title'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 'enabled' },
          { label: $t('common.disabled'), value: 'disabled' },
        ],
        optionType: 'button',
      },
      defaultValue: 'enabled',
      fieldName: 'status',
      label: $t('system.roles.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('system.roles.description'),
    },
    {
      component: 'Input',
      fieldName: 'permission',
      formItemClass: 'col-span-2 items-start',
      controlClass: 'w-full',
      label: $t('system.roles.permissions'),
      modelPropName: 'modelValue',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.roles.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 'enabled' },
          { label: $t('common.disabled'), value: 'disabled' },
        ],
      },
      fieldName: 'status',
      label: $t('system.roles.status'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.roles.createTime'),
    },
  ];
}

export function useColumns<T = SystemRoleApi.SystemRole>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'name',
      title: $t('system.roles.name'),
      width: 200,
    },
    {
      field: 'e_name',
      title: $t('system.roles.eName'),
      width: 150,
    },
    {
      field: 'title',
      title: $t('system.roles.title'),
      width: 200,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.roles.status'),
      width: 100,
    },
    {
      field: 'description',
      minWidth: 200,
      title: $t('system.roles.description'),
    },
    {
      field: 'sort',
      title: $t('system.roles.sort'),
      width: 100,
    },
    {
      field: 'createTime',
      title: $t('system.roles.createTime'),
      width: 200,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.roles.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.roles.operation'),
      width: 130,
    },
  ];
}
