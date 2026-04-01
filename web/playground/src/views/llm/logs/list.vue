<script lang="ts" setup>
import type { LlmLogsApi } from "#/api/llm/logs";

import { Page, useVbenModal } from "@vben/common-ui";

import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message, Tag, Select, Table, Input, Button, Popconfirm } from "ant-design-vue";
import { getLogsList, getLogDates, deleteLogFile } from "#/api/llm/logs";
import { $t } from "#/locales";
import { h } from "vue";

import LogDetailModal from "./modules/log-detail.vue";

const route = useRoute();
const router = useRouter();

const [LogDetailModalComponent, logDetailModalApi] = useVbenModal({
  connectedComponent: LogDetailModal,
  destroyOnClose: true,
});

interface LogRow {
  key: string;
  timestamp: string;
  type: "request" | "response" | "error";
  hasToolCalls?: boolean;
  toolCallCount?: number;
  model?: string;
  provider?: string;
  source?: LlmLogsApi.LLMCallSource;
  duration?: number;
  content?: string;
  children?: LogRow[];
  isChild?: boolean;
  childType?: "message" | "toolCall";
  role?: string;
  toolName?: string;
  rawData?: LlmLogsApi.LogEntry;
}

const availableDates = ref<string[]>([]);
const currentDate = ref<string>("");
const isLoading = ref(false);
const logData = ref<LogRow[]>([]);
const expandedRowKeys = ref<string[]>([]);
const pagination = ref({
  current: Number(route.query.page) || 1,
  pageSize: Number(route.query.pageSize) || 20,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100', '200'],
  showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} / ${total}`,
});
const filterType = ref<string | undefined>(route.query.type as string || undefined);
const keyword = ref(route.query.keyword as string || "");

function handleExpand(record: LogRow) {
  const key = record.key;
  const index = expandedRowKeys.value.indexOf(key);
  if (index > -1) {
    expandedRowKeys.value.splice(index, 1);
  } else {
    expandedRowKeys.value.push(key);
  }
}

function isExpanded(record: LogRow): boolean {
  return expandedRowKeys.value.includes(record.key);
}

const columns = [
  {
    title: $t("llm.logs.type"),
    dataIndex: "type",
    key: "type",
    width: 100,
  },
  {
    title: $t("llm.logs.source"),
    dataIndex: "source",
    key: "source",
    width: 110,
  },
  {
    title: $t("llm.logs.contentPreview"),
    dataIndex: "content",
    key: "content",
    minWidth: 400,
    // 使用 scoped slot 实现自适应截断，见下方 template
  },
  {
    title: $t("llm.logs.timestamp"),
    dataIndex: "timestamp",
    key: "timestamp",
    width: 170,
  },
  {
    title: $t("llm.logs.model"),
    dataIndex: "model",
    key: "model",
    width: 130,
  },
  {
    title: $t("llm.logs.provider"),
    dataIndex: "provider",
    key: "provider",
    width: 100,
  },
  {
    title: $t("llm.logs.duration"),
    dataIndex: "duration",
    key: "duration",
    width: 90,
  },
  {
    title: $t("llm.logs.operation"),
    key: "operation",
    width: 80,
    fixed: "right" as const,
  },
];

function transformLogToTreeRow(log: LlmLogsApi.LogEntry, index: number): LogRow {
  const toolCallCount = log.responseData?.toolCalls?.length || 0;
  const row: LogRow = {
    key: `${log.timestamp}-${index}`,
    timestamp: new Date(log.timestamp).toLocaleString(),
    type: log.type,
    hasToolCalls: log.hasToolCalls,
    toolCallCount,
    model: log.model,
    provider: log.provider,
    source: log.source,
    duration: log.duration,
    content: getContentPreview(log),
    rawData: log,
    children: [],
  };

  if (log.type === "request" && log.requestBody?.messages) {
    const messages = log.requestBody.messages;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      const content = lastMsg.content;
      if (Array.isArray(content)) {
        row.children = content.map((item, itemIndex) => ({
          key: `${log.timestamp}-${index}-msg-last-${itemIndex}`,
          timestamp: "",
          type: "request" as const,
          childType: "message" as const,
          role: lastMsg.role,
          content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
          isChild: true,
          rawData: log,
        }));
      } else {
        row.children = [{
          key: `${log.timestamp}-${index}-msg-last`,
          timestamp: "",
          type: "request" as const,
          childType: "message" as const,
          role: lastMsg.role,
          content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
          isChild: true,
          rawData: log,
        }];
      }
    }
  } else if (log.type === "response" && log.responseData?.toolCalls?.length) {
    row.children = log.responseData.toolCalls.map((tool, toolIndex) => ({
      key: `${log.timestamp}-${index}-tool-${toolIndex}`,
      timestamp: "",
      type: "response" as const,
      childType: "toolCall" as const,
      toolName: tool.function?.name,
      content: JSON.stringify(tool, null, 2),
      isChild: true,
    }));
  } else if (log.type === "error" && log.error) {
    row.children = [{
      key: `${log.timestamp}-${index}-error`,
      timestamp: "",
      type: "error" as const,
      childType: "message" as const,
      role: "error",
      content: log.error,
      isChild: true,
      rawData: log,
    }];
  }

  return row;
}

function getContentPreview(log: LlmLogsApi.LogEntry): string {
  const MAX_PREVIEW_LENGTH = 500; // 增加最大长度，让 CSS 控制实际显示
  
  if (log.type === "request" && log.requestBody?.messages) {
    const lastMsg = log.requestBody.messages[log.requestBody.messages.length - 1];
    const content = lastMsg?.content;
    if (typeof content === 'string') {
      return content.length > MAX_PREVIEW_LENGTH 
        ? content.substring(0, MAX_PREVIEW_LENGTH) + '...'
        : content || "-";
    }
    if (content && typeof content === 'object') {
      const jsonStr = JSON.stringify(content);
      return jsonStr.length > MAX_PREVIEW_LENGTH
        ? jsonStr.substring(0, MAX_PREVIEW_LENGTH) + '...'
        : jsonStr;
    }
    return "-";
  }
  if (log.type === "response") {
    const content = log.responseData?.fullContent || log.responseData?.text || log.responseData?.reasoningContent;
    if (content) {
      return content.length > MAX_PREVIEW_LENGTH
        ? content.substring(0, MAX_PREVIEW_LENGTH) + '...'
        : content;
    }
    // 如果有 toolCalls，显示工具调用信息
    if (log.responseData?.toolCalls?.length) {
      const toolNames = log.responseData.toolCalls.map((t: any) => t.function?.name || t.name).join(', ');
      return `调用工具: ${toolNames}`;
    }
  }
  if (log.error) {
    return log.error.length > MAX_PREVIEW_LENGTH
      ? log.error.substring(0, MAX_PREVIEW_LENGTH) + '...'
      : log.error;
  }
  return "-";
}

async function fetchLogDates() {
  try {
    const result = await getLogDates();
    availableDates.value = result.dates || [];
    if (result.dates && result.dates.length > 0) {
      const dateFromQuery = route.query.date as string;
      if (dateFromQuery && result.dates.includes(dateFromQuery)) {
        currentDate.value = dateFromQuery;
      } else if (!currentDate.value) {
        currentDate.value = result.dates[0];
      }
      fetchLogs();
    }
  } catch (error) {
    console.error("[LlmLogs] Failed to fetch dates:", error);
    message.error($t("llm.logs.fetchDatesFailed"));
  }
}

async function fetchLogs() {
  if (!currentDate.value) return;
  
  isLoading.value = true;
  try {
    const result = await getLogsList({
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      date: currentDate.value,
      type: filterType.value as any,
      keyword: keyword.value,
    });
    
    logData.value = result.list.map((log, index) => transformLogToTreeRow(log, index));
    pagination.value.total = result.total;
  } catch (error) {
    console.error("[LlmLogs] Failed to fetch logs:", error);
    message.error("获取日志失败");
  } finally {
    isLoading.value = false;
  }
}

function handleTableChange(pag: any) {
  pagination.value.current = pag.current;
  pagination.value.pageSize = pag.pageSize;
  router.push({
    query: {
      ...route.query,
      page: String(pag.current),
      pageSize: String(pag.pageSize),
    },
  });
  fetchLogs();
}

function handleDateChange(value: string) {
  currentDate.value = value;
  pagination.value.current = 1;
  router.push({
    query: {
      ...route.query,
      date: value,
      page: '1',
    },
  });
  fetchLogs();
}

function handleTypeChange(value: string | undefined) {
  filterType.value = value;
  pagination.value.current = 1;
  router.push({
    query: {
      ...route.query,
      type: value || '',
      page: '1',
    },
  });
  fetchLogs();
}

function handleSearch() {
  pagination.value.current = 1;
  router.push({
    query: {
      ...route.query,
      keyword: keyword.value,
      page: '1',
    },
  });
  fetchLogs();
}

function customRow(record: LogRow) {
  return {
    ondblclick: () => {
      if (record.rawData) {
        onViewDetail(record);
      }
    },
    style: {
      cursor: record.rawData ? 'pointer' : 'default',
    },
  };
}

function onViewDetail(record: LogRow) {
  if (record.rawData) {
    logDetailModalApi.setData({ log: record.rawData });
    logDetailModalApi.open();
  }
}

async function handleDeleteLog() {
  if (!currentDate.value) return;
  
  try {
    const result = await deleteLogFile(currentDate.value);
    // requestClient 的 defaultResponseInterceptor 已经处理了 code 检查
    // 成功时返回的是 data 字段内容: { deleted: number }
    if (result && typeof result.deleted === 'number') {
      message.success(`成功删除 ${result.deleted} 条日志`);
      // 保存当前日期，刷新日期列表
      const deletedDate = currentDate.value;
      await fetchLogDates();
      // 如果删除的日期不在列表中了，切换到第一个可用日期或清空
      if (!availableDates.value.includes(deletedDate)) {
        if (availableDates.value.length > 0) {
          currentDate.value = availableDates.value[0];
          await fetchLogs();
        } else {
          currentDate.value = "";
          logData.value = [];
          pagination.value.total = 0;
        }
      } else {
        // 日期还在（可能删除的是部分日志），刷新当前日期的日志
        await fetchLogs();
      }
    }
  } catch (error) {
    console.error("[LlmLogs] Failed to delete log:", error);
    message.error("删除日志失败");
  }
}

onMounted(() => {
  fetchLogDates();
});
</script>

<template>
  <Page auto-content-height>
    <div class="h-full flex flex-col">
      <div class="flex items-center gap-4 p-4 border-b border-border bg-card">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">{{ $t("llm.logs.date") }}:</span>
          <Select
            :value="currentDate"
            :options="availableDates.map(d => ({ label: d, value: d }))"
            style="width: 150px"
            @change="handleDateChange"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">{{ $t("llm.logs.type") }}:</span>
          <Select
            :value="filterType"
            :options="[
              { label: $t('llm.logs.typeRequest'), value: 'request' },
              { label: $t('llm.logs.typeResponse'), value: 'response' },
              { label: $t('llm.logs.typeError'), value: 'error' },
            ]"
            :placeholder="$t('llm.logs.selectType')"
            allow-clear
            style="width: 120px"
            @change="handleTypeChange"
          />
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model:value="keyword"
            :placeholder="$t('llm.logs.searchPlaceholder')"
            allow-clear
            style="width: 200px"
            @press-enter="handleSearch"
          />
        </div>
        <span v-if="isLoading" class="text-sm text-blue-500">
          {{ $t("common.loading") }}
        </span>
        <div class="flex-1"></div>
        <Popconfirm
          :title="$t('llm.logs.deleteConfirm')"
          :ok-text="$t('common.confirm')"
          :cancel-text="$t('common.cancel')"
          @confirm="handleDeleteLog"
        >
          <Button danger size="small">
            {{ $t("llm.logs.deleteCurrentDay") }}
          </Button>
        </Popconfirm>
      </div>
      
      <div class="flex-1 overflow-auto p-4">
        <Table
          :columns="columns"
          :data-source="logData"
          :loading="isLoading"
          :pagination="pagination"
          :expanded-row-keys="expandedRowKeys"
          :show-expand-column="false"
          :scroll="{ x: 1200 }"
          row-key="key"
          size="small"
          :custom-row="customRow"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'type'">
              <template v-if="record.isChild">
                <Tag v-if="record.role === 'error'" color="red" class="text-xs">
                  error
                </Tag>
                <Tag v-else-if="record.childType === 'message'" color="blue" class="text-xs">
                  {{ record.role }}
                </Tag>
                <Tag v-else-if="record.childType === 'toolCall'" color="orange" class="text-xs">
                  Tool
                </Tag>
              </template>
              <template v-else>
                <div class="flex flex-nowrap items-center gap-1">
                  <span
                    v-if="record.children && record.children.length > 0"
                    class="cursor-pointer inline-flex items-center justify-center w-4 h-4 flex-shrink-0"
                    @click="handleExpand(record)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      :class="{ 'rotate-90': isExpanded(record) }"
                      class="transition-transform duration-200"
                    >
                      <path fill="currentColor" d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span v-else class="w-4 h-4 inline-block"></span>
                  <Tag :color="record.type === 'request' ? 'blue' : record.type === 'response' ? 'green' : 'red'" class="text-xs font-bold">
                    {{ record.type === 'request' ? 'S' : record.type === 'response' ? 'R' : 'E' }}
                  </Tag>
                  <Tag v-if="record.toolCallCount" color="orange" class="text-xs">
                    {{ record.toolCallCount }}T
                  </Tag>
                </div>
              </template>
            </template>
            <template v-else-if="column.dataIndex === 'source'">
              <template v-if="!record.isChild">
                <Tag v-if="record.source === 'agent'" color="cyan">{{ record.source }}</Tag>
                <Tag v-else-if="record.source === 'orchestrator'" color="geekblue">{{ record.source }}</Tag>
                <Tag v-else-if="record.source === 'executor'" color="volcano">{{ record.source }}</Tag>
                <Tag v-else-if="record.source === 'handler'" color="magenta">{{ record.source }}</Tag>
                <span v-else>{{ record.source || '-' }}</span>
              </template>
            </template>
            <template v-else-if="column.dataIndex === 'model'">
              <template v-if="record.isChild && record.childType === 'toolCall'">
                <span class="font-mono text-sm text-orange-600">{{ record.toolName }}</span>
              </template>
              <template v-else-if="!record.isChild">
                <span class="text-sm">{{ record.model || '-' }}</span>
              </template>
            </template>
            <template v-else-if="column.dataIndex === 'provider'">
              <Tag v-if="record.provider && !record.isChild" color="purple">{{ record.provider }}</Tag>
              <span v-else-if="!record.isChild">-</span>
            </template>
            <template v-else-if="column.dataIndex === 'duration'">
              <span v-if="record.duration && !record.isChild" class="text-sm">{{ record.duration }}ms</span>
              <span v-else-if="!record.isChild">-</span>
            </template>
            <template v-else-if="column.dataIndex === 'content'">
              <div 
                v-if="record.isChild && record.childType === 'message' && record.role === 'error'"
                class="border border-red-200 dark:border-red-800 p-2 rounded bg-red-50 dark:bg-red-900/20"
              >
                <pre class="text-sm whitespace-pre-wrap break-all font-mono m-0">{{ record.content || '-' }}</pre>
              </div>
              <div 
                v-else-if="record.isChild && record.childType === 'message'"
                class="border border-blue-200 dark:border-blue-800 p-2 rounded bg-blue-50 dark:bg-blue-900/20"
              >
                <span class="text-sm whitespace-pre-wrap">{{ record.content || '-' }}</span>
              </div>
              <pre 
                v-else-if="record.isChild && record.childType === 'toolCall'"
                class="border border-orange-200 dark:border-orange-800 p-2 rounded bg-orange-50 dark:bg-orange-900/20 font-mono text-xs whitespace-pre-wrap break-all m-0"
              >{{ record.content || '-' }}</pre>
              <div 
                v-else
                class="content-preview-wrapper"
                :title="record.content"
              >
                <span 
                  class="content-preview-text" 
                  :class="{ 
                    'font-bold': record.type === 'response',
                    'font-bold text-rose-700 dark:text-rose-400': record.type === 'request' && record.source === 'agent'
                  }"
                >{{ record.content || '-' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'operation'">
              <Button
                v-if="!record.isChild"
                type="link"
                size="small"
                @click="onViewDetail(record)"
              >
                {{ $t("llm.logs.viewDetail") }}
              </Button>
            </template>
          </template>
        </Table>
      </div>
    </div>
    
    <LogDetailModalComponent />
  </Page>
</template>

<style scoped>
/* 内容预览单元格样式 - 自适应截断 */
.content-preview-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 内容预览包装器 */
.content-preview-wrapper {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  cursor: help;
}

/* 内容预览文本 */
.content-preview-text {
  font-size: 13px;
  line-height: 1.5;
}

/* 表格行样式优化 */
:deep(.ant-table-cell) {
  padding: 8px 12px !important;
}

/* 确保内容列可以自适应 */
:deep(.ant-table-cell-content) {
  overflow: hidden;
}
</style>