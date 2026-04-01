<script setup lang="ts">
import { computed } from "vue";
import { Card, Descriptions, DescriptionsItem, Tag } from "ant-design-vue";

interface RequestBodyData {
  messages: Array<{ role: string; content: string }>;
  totalChars: number;
}

const props = defineProps<{
  requestBody: RequestBodyData;
}>();

const formattedJson = computed(() => {
  return JSON.stringify(props.requestBody.messages, null, 2);
});

const estimatedTokens = computed(() => {
  return Math.ceil(props.requestBody.totalChars / 4);
});

const roleColors: Record<string, string> = {
  system: "blue",
  user: "green",
  assistant: "orange",
};
</script>

<template>
  <div class="request-body-tab">
    <Card class="stats-card">
      <Descriptions :column="3" size="small">
        <DescriptionsItem label="消息数量">
          <Tag color="blue">{{ requestBody.messages.length }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="总字符数">
          <Tag color="green">{{ requestBody.totalChars.toLocaleString() }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="预估Token数">
          <Tag color="orange">{{ estimatedTokens.toLocaleString() }}</Tag>
        </DescriptionsItem>
      </Descriptions>
    </Card>

    <Card class="json-card" title="请求体 JSON">
      <div class="message-list">
        <div
          v-for="(msg, index) in requestBody.messages"
          :key="index"
          class="message-item"
        >
          <div class="message-header">
            <Tag :color="roleColors[msg.role] || 'default'">
              {{ msg.role }}
            </Tag>
            <span class="char-count">{{ msg.content.length }} 字符</span>
          </div>
          <pre class="message-content">{{ msg.content }}</pre>
        </div>
      </div>

      <div v-if="requestBody.messages.length === 0" class="empty-state">
        <p>暂无启用的上下文块</p>
      </div>
    </Card>

    <Card class="raw-json-card" title="原始 JSON">
      <pre class="raw-json">{{ formattedJson }}</pre>
    </Card>
  </div>
</template>

<style scoped>
.request-body-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.stats-card {
  flex-shrink: 0;
}

.json-card,
.raw-json-card {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.json-card :deep(.ant-card-body),
.raw-json-card :deep(.ant-card-body) {
  flex: 1;
  overflow: auto;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.char-count {
  color: #999;
  font-size: 12px;
}

.message-content {
  margin: 0;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.raw-json {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #999;
}
</style>
