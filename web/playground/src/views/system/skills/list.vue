<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from "#/adapter/vxe-table";
import type { SkillApi } from "#/api/system/skills";

import { Page, useVbenModal } from "@vben/common-ui";
import { Plus } from "@vben/icons";

import { Button, message } from "ant-design-vue";
import { onMounted, ref, computed } from "vue";

import { useVbenVxeGrid } from "#/adapter/vxe-table";
import { skillApi } from "#/api/system/skills";
import { $t } from "#/locales";

import { getSourceTypeOptions, getSourceTypeRadioOptions, getStatusOptions, getStatusSelectOptions, getNodeTypeOptions, getNodeTypeSelectOptions, useColumns, useSearchSchema } from "./data";
import type { VbenFormSchema } from "#/adapter/form";
import Form from "./modules/form.vue";

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 来源类型选项
const sourceTypeOptions = ref<{ color: string; label: string; value: string }[]>([]);
const sourceTypeRadioOptions = ref<{ label: string; value: string }[]>([]);
// 状态选项
const statusOptions = ref<{ color: string; label: string; value: string }[]>([]);
const statusSelectOptions = ref<{ label: string; value: string }[]>([]);
// 节点类型选项
const nodeTypeOptions = ref<{ color: string; label: string; value: string }[]>([]);
const nodeTypeSelectOptions = ref<{ label: string; value: string }[]>([]);
// 技能树数据（用于父节点选择）
const skillTreeData = ref<SkillApi.Skill[]>([]);
const searchSchema = ref<VbenFormSchema[]>(useSearchSchema());

// 缓存父节点选项计算结果
let cachedParentIdOptions: { label: string; value: string }[] | null = null;
let cachedSkillTreeDataHash = "";

// 计算父节点选项（只包含 catalog 类型）
const parentIdOptions = computed(() => {
  // 使用简单哈希判断数据是否变化
  const currentHash = skillTreeData.value.map(s => s.sid).join(",");
  if (cachedParentIdOptions && cachedSkillTreeDataHash === currentHash) {
    return cachedParentIdOptions;
  }

  const options: { label: string; value: string }[] = [];
  const traverse = (items: SkillApi.Skill[], prefix = "") => {
    items.forEach((item) => {
      if (item.type === "catalog") {
        options.push({
          label: prefix + item.name,
          value: item.sid,
        });
        if (item.children && item.children.length > 0) {
          traverse(item.children, prefix + "  ");
        }
      }
    });
  };
  traverse(skillTreeData.value);

  // 缓存结果
  cachedParentIdOptions = options;
  cachedSkillTreeDataHash = currentHash;
  return options;
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick, sourceTypeOptions.value, statusOptions.value, nodeTypeOptions.value),
    height: "auto",
    keepSource: false,
    // 启用虚拟滚动，提高大数据量性能
    scrollY: {
      enabled: true,
      gt: 20, // 超过20行启用虚拟滚动
    },
    treeConfig: {
      parentField: "parentId",
      rowField: "sid",
      transform: false,
      expandAll: true,
      // 优化树形展开性能
      lazy: false,
    },
    pagerConfig: {
      enabled: false, // 树形表格不分页
    },
    proxyConfig: {
      ajax: {
        query: async ({ form }) => {
          const result = await skillApi.getSkillTree({
            ...form,
          });
          skillTreeData.value = result;
          // 清空缓存，下次计算时会重新生成
          cachedParentIdOptions = null;
          // 树形表格直接返回数据数组
          return result;
        },
      },
    },
    rowConfig: {
      keyField: "sid",
      isHover: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    onCellDblclick: ({ row }: { row: SkillApi.Skill }) => {
      onEdit(row);
    },
  } as VxeTableGridOptions,
  formOptions: {
    schema: searchSchema.value,
  },
});

// 加载来源类型选项和状态选项
async function loadOptions() {
  const [sourceOptions, sourceRadioOptions, statOptions, statSelectOptions, nodeOptions, nodeSelectOptions] = await Promise.all([
    getSourceTypeOptions(),
    getSourceTypeRadioOptions(),
    getStatusOptions(),
    getStatusSelectOptions(),
    getNodeTypeOptions(),
    getNodeTypeSelectOptions(),
  ]);
  sourceTypeOptions.value = sourceOptions;
  sourceTypeRadioOptions.value = sourceRadioOptions;
  statusOptions.value = statOptions;
  statusSelectOptions.value = statSelectOptions;
  nodeTypeOptions.value = nodeOptions;
  nodeTypeSelectOptions.value = nodeSelectOptions;

  // 使用 requestAnimationFrame 延迟更新，避免阻塞主线程
  requestAnimationFrame(() => {
    // 更新表格列
    gridApi.setGridOptions({
      columns: useColumns(onActionClick, sourceTypeOptions.value, statusOptions.value, nodeTypeOptions.value),
    });

    // 更新搜索表单
    searchSchema.value = useSearchSchema(sourceTypeRadioOptions.value, statusSelectOptions.value);
  });
}

onMounted(() => {
  loadOptions();
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SkillApi.Skill>) {
  switch (code) {
    case "delete": {
      onDelete(row);
      break;
    }
    case "edit": {
      onEdit(row);
      break;
    }
    default: {
      break;
    }
  }
}

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SkillApi.Skill) {
  formModalApi.setData({
    row,
    sourceTypeOptions: sourceTypeRadioOptions.value,
    statusOptions: statusSelectOptions.value,
    parentIdOptions: parentIdOptions.value,
    nodeTypeOptions: nodeTypeSelectOptions.value,
  }).open();
}

function onCreate() {
  formModalApi.setData({
    sourceTypeOptions: sourceTypeRadioOptions.value,
    statusOptions: statusSelectOptions.value,
    parentIdOptions: parentIdOptions.value,
    nodeTypeOptions: nodeTypeSelectOptions.value,
  }).open();
}

function onDelete(row: SkillApi.Skill) {
  const hideLoading = message.loading({
    content: $t("ui.actionMessage.deleting", [row.name]),
    duration: 0,
    key: "action_process_msg",
  });
  skillApi.deleteSkill(row.sid)
    .then(() => {
      message.success({
        content: $t("ui.actionMessage.deleteSuccess", [row.name]),
        key: "action_process_msg",
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <div class="h-full rounded-lg border border-border overflow-hidden bg-background">
      <Grid class="h-full">
        <template #toolbar-tools>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t("common.create") }}
          </Button>
        </template>
      </Grid>
    </div>
  </Page>
</template>
