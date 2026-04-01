<script lang="ts" setup>
import type { LlmLogsApi } from "#/api/llm/logs";

import { useVbenModal } from "@vben/common-ui";
import { ref, computed } from "vue";
import { Tabs, TabPane, Descriptions, DescriptionsItem, Tag, Alert } from "ant-design-vue";
import { $t } from "#/locales";

const logData = ref<LlmLogsApi.LogEntry | null>(null);

const isRequest = computed(() => logData.value?.type === "request");
const isResponse = computed(() => logData.value?.type === "response");
const isError = computed(() => logData.value?.type === "error");

const responseMessages = computed(() => {
  if (!logData.value?.responseData) return [];
  
  const messages: Array<{ role: string; content: string; name?: string }> = [];
  const responseData = logData.value.responseData;
  
  if (responseData.choices && Array.isArray(responseData.choices)) {
    for (const choice of responseData.choices) {
      if (choice.message) {
        messages.push({
          role: choice.message.role || 'assistant',
          content: choice.message.content || '',
          name: choice.message.name,
        });
      }
    }
  }
  
  if (responseData.text && messages.length === 0) {
    messages.push({
      role: 'assistant',
      content: responseData.text,
    });
  }
  
  if (responseData.fullContent && messages.length === 0) {
    messages.push({
      role: 'assistant',
      content: responseData.fullContent,
    });
  }
  
  return messages;
});

const hasResponseMessages = computed(() => responseMessages.value.length > 0);

function formatJson(obj: any): string {
  try {
    const rootOrder = ['type', 'timestamp', 'duration', 'model', 'provider', 'instanceId', 'source', 'agentName', 'worktaskId', 'contactName'];
    const requestBodyOrder = ['system', 'messages', 'tools', 'temperature', 'maxTokens', 'stream'];
    
    return JSON.stringify(obj, (key, value) => {
      if (key === '') {
        const ordered: any = {};
        for (const k of rootOrder) {
          if (k in value) {
            ordered[k] = value[k];
          }
        }
        for (const k of Object.keys(value)) {
          if (!rootOrder.includes(k)) {
            ordered[k] = value[k];
          }
        }
        return ordered;
      }
      if (key === 'requestBody' && value && typeof value === 'object') {
        const ordered: any = {};
        for (const k of requestBodyOrder) {
          if (k in value) {
            ordered[k] = value[k];
          }
        }
        for (const k of Object.keys(value)) {
          if (!requestBodyOrder.includes(k)) {
            ordered[k] = value[k];
          }
        }
        return ordered;
      }
      return value;
    }, 2);
  } catch {
    return String(obj);
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case "request":
      return "blue";
    case "response":
      return "green";
    case "error":
      return "red";
    default:
      return "default";
  }
}

function getTypeText(type: string): string {
  switch (type) {
    case "request":
      return $t("llm.logs.typeRequest");
    case "response":
      return $t("llm.logs.typeResponse");
    case "error":
      return $t("llm.logs.typeError");
    default:
      return type;
  }
}

function formatContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") {
    return content
      .replace(/\\r\\n/g, "<br>")
      .replace(/\\n/g, "<br>")
      .replace(/\\r/g, "<br>")
      .replace(/\\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
      .replace(/\r\n/g, "<br>")
      .replace(/\n/g, "<br>")
      .replace(/\r/g, "<br>")
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
  }
  if (Array.isArray(content)) {
    return content.map(c => formatContent(c)).join("<br>");
  }
  if (typeof content === "object") {
    return formatContent(JSON.stringify(content, null, 2));
  }
  return String(content);
}

function formatToolArguments(args: string | undefined): string {
  if (!args) return "";
  try {
    const parsed = JSON.parse(args);
    const formatted = JSON.stringify(parsed, null, 2);
    return formatContent(formatted);
  } catch {
    return formatContent(args);
  }
}

const [Modal, modalApi] = useVbenModal({
  onOpenChange: (isOpen) => {
    if (isOpen) {
      const data = modalApi.getData();
      logData.value = data?.log || null;
    }
  },
});

defineExpose({
  modalApi,
});
</script>

<template>
  <Modal
    :title="$t('llm.logs.detailTitle')"
    class="w-[90vw] max-w-6xl"
    :fullscreen-button="true"
  >
    <div v-if="logData" class="space-y-4">
      <Descriptions bordered size="small" :column="3">
        <DescriptionsItem :label="$t('llm.logs.type')">
          <Tag :color="getTypeColor(logData.type)">
            {{ getTypeText(logData.type) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem :label="$t('llm.logs.timestamp')">
          {{ new Date(logData.timestamp).toLocaleString() }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('llm.logs.duration')">
          {{ logData.duration ? `${logData.duration}ms` : '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('llm.logs.model')">
          {{ logData.model || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('llm.logs.provider')">
          {{ logData.provider || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="$t('llm.logs.instanceId')">
          {{ logData.instanceId || '-' }}
        </DescriptionsItem>
      </Descriptions>

      <Alert
        v-if="isError && logData.error"
        type="error"
        :message="$t('llm.logs.errorMessage')"
        show-icon
      >
        <template #description>
          <div class="text-sm whitespace-pre-wrap" v-html="formatContent(logData.error)"></div>
        </template>
      </Alert>

      <Tabs type="card">
        <TabPane key="raw" :tab="$t('llm.logs.rawData')">
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
            <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ formatJson(logData) }}</pre>
          </div>
        </TabPane>

        <TabPane
          v-if="isRequest && logData.requestBody"
          key="requestBody"
          :tab="$t('llm.logs.requestBody')"
        >
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
            <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ formatJson(logData.requestBody) }}</pre>
          </div>
        </TabPane>

        <TabPane
          v-if="isRequest && logData.requestBody?.messages"
          key="messages"
          :tab="$t('llm.logs.messages')"
        >
          <div class="space-y-3 max-h-[60vh] overflow-auto">
            <div
              v-for="(msg, index) in logData.requestBody.messages"
              :key="index"
              class="border rounded-lg p-3"
              :class="{
                'bg-blue-50 dark:bg-blue-900/20 border-blue-200': msg.role === 'user',
                'bg-green-50 dark:bg-green-900/20 border-green-200': msg.role === 'assistant',
                'bg-gray-50 dark:bg-gray-800 border-gray-200': msg.role === 'system',
              }"
            >
              <div class="flex items-center gap-2 mb-2">
                <Tag :color="msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'default'">
                  {{ msg.role }}
                </Tag>
                <span v-if="msg.name" class="text-sm text-gray-500">({{ msg.name }})</span>
              </div>
              <div class="text-sm whitespace-pre-wrap" v-html="formatContent(msg.content)"></div>
            </div>
          </div>
        </TabPane>

        <TabPane
          v-if="isResponse && logData.responseData"
          key="responseData"
          :tab="$t('llm.logs.responseData')"
        >
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
            <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ formatJson(logData.responseData) }}</pre>
          </div>
        </TabPane>

        <TabPane
          v-if="isResponse && hasResponseMessages"
          key="responseMessages"
          :tab="$t('llm.logs.messages')"
        >
          <div class="space-y-3 max-h-[60vh] overflow-auto">
            <div
              v-for="(msg, index) in responseMessages"
              :key="index"
              class="border rounded-lg p-3"
              :class="{
                'bg-blue-50 dark:bg-blue-900/20 border-blue-200': msg.role === 'user',
                'bg-green-50 dark:bg-green-900/20 border-green-200': msg.role === 'assistant',
                'bg-gray-50 dark:bg-gray-800 border-gray-200': msg.role === 'system',
              }"
            >
              <div class="flex items-center gap-2 mb-2">
                <Tag :color="msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'default'">
                  {{ msg.role }}
                </Tag>
                <span v-if="msg.name" class="text-sm text-gray-500">({{ msg.name }})</span>
              </div>
              <div class="text-sm whitespace-pre-wrap" v-html="formatContent(msg.content)"></div>
            </div>
          </div>
        </TabPane>

        <TabPane
          v-if="isResponse && logData.responseData?.fullContent"
          key="fullContent"
          :tab="$t('llm.logs.fullContent')"
        >
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
            <div class="text-sm whitespace-pre-wrap" v-html="formatContent(logData.responseData.fullContent)"></div>
          </div>
        </TabPane>

        <TabPane
          v-if="isResponse && logData.responseData?.toolCalls?.length"
          key="toolCalls"
          :tab="$t('llm.logs.toolCalls')"
        >
          <div class="space-y-3 max-h-[60vh] overflow-auto">
            <div
              v-for="(tool, index) in logData.responseData.toolCalls"
              :key="index"
              class="border border-orange-200 rounded-lg p-3 bg-orange-50 dark:bg-orange-900/20"
            >
              <div class="flex items-center gap-2 mb-2">
                <Tag color="orange">Tool {{ tool.index ?? index }}</Tag>
                <span class="font-mono text-sm">{{ tool.function?.name }}</span>
              </div>
              <div class="bg-white dark:bg-gray-800 rounded p-2">
                <pre class="text-sm font-mono whitespace-pre-wrap break-all">{{ formatJson(tool) }}</pre>
              </div>
            </div>
          </div>
        </TabPane>

        <TabPane
          v-if="logData.tokenUsage"
          key="tokenUsage"
          :tab="$t('llm.logs.tokenUsage')"
        >
          <Descriptions bordered size="small">
            <DescriptionsItem :label="$t('llm.logs.promptTokens')">
              {{ logData.tokenUsage.prompt }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('llm.logs.completionTokens')">
              {{ logData.tokenUsage.completion }}
            </DescriptionsItem>
            <DescriptionsItem :label="$t('llm.logs.totalTokens')">
              {{ logData.tokenUsage.total }}
            </DescriptionsItem>
          </Descriptions>
        </TabPane>
      </Tabs>
    </div>
  </Modal>
</template>