<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Card, Tag, Collapse, CollapsePanel, Empty, Spin, Alert, Button } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import { getAgentRawContext } from "#/api/organization/agents";

const props = defineProps<{
  agentId: string;
  contactId?: string;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const rawContext = ref<any>(null);

// 加载原始上下文
async function loadRawContext() {
  if (!props.agentId) return;

  loading.value = true;
  error.value = null;

  try {
    const context = await getAgentRawContext(props.agentId, props.contactId);
    rawContext.value = context;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载失败";
    console.error("Failed to load raw context:", err);
  } finally {
    loading.value = false;
  }
}

// 监听 agentId 变化
watch(
  () => props.agentId,
  () => {
    if (props.agentId) {
      loadRawContext();
    }
  },
  { immediate: true }
);

// 格式化 JSON 显示
function formatJson(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

// 计算总字符数
const totalChars = computed(() => {
  if (!rawContext.value) return 0;

  let chars = 0;
  if (rawContext.value.systemPrompt) {
    chars += rawContext.value.systemPrompt.length;
  }
  if (rawContext.value.conversationHistory) {
    chars += rawContext.value.conversationHistory.reduce(
      (sum: number, msg: any) => sum + (msg.content?.length || 0),
      0
    );
  }
  return chars;
});

// 计算 system messages 字符数
const systemChars = computed(() => {
  if (!rawContext.value?.systemMessages) return 0;
  return rawContext.value.systemMessages.reduce(
    (sum: number, msg: any) => sum + (msg.content?.length || 0),
    0
  );
});
</script>

<template>
  <div class="raw-context-tab">
    <Spin :spinning="loading">
      <div v-if="error" class="error-container">
        <Alert type="error" :message="error" show-icon />
        <Button class="retry-btn" @click="loadRawContext">
          <IconifyIcon icon="mdi:refresh" class="mr-1" />
          重试
        </Button>
      </div>

      <div v-else-if="rawContext" class="context-content">
        <!-- 概览信息 -->
        <Card size="small" class="overview-card" :bordered="false">
          <div class="overview-header">
            <span class="overview-title">上下文概览</span>
            <Button type="primary" size="small" @click="loadRawContext">
              <IconifyIcon icon="mdi:refresh" class="mr-1" />
              刷新
            </Button>
          </div>
          <div class="overview-stats">
            <div class="stat-item">
              <span class="stat-label">System Messages:</span>
              <Tag color="blue">{{ rawContext.systemMessages?.length || 0 }}</Tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">History Messages:</span>
              <Tag color="green">{{ rawContext.conversationHistory?.length || 0 }}</Tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">Memories:</span>
              <Tag color="orange">{{ rawContext.memories?.length || 0 }}</Tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">Tools:</span>
              <Tag color="purple">{{ rawContext.availableTools?.length || 0 }}</Tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">System Chars:</span>
              <Tag color="cyan">{{ systemChars.toLocaleString() }}</Tag>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Chars:</span>
              <Tag color="red">{{ totalChars.toLocaleString() }}</Tag>
            </div>
          </div>
        </Card>

        <!-- 详细内容 -->
        <Collapse class="context-collapse" :default-active-key="['system']">
          <!-- System Messages -->
          <CollapsePanel key="system" header="System Messages">
            <div v-if="rawContext.systemMessages?.length" class="message-list">
              <div
                v-for="(msg, index) in rawContext.systemMessages"
                :key="index"
                class="message-item"
              >
                <div class="message-header">
                  <Tag size="small" color="blue">{{ msg.role }}</Tag>
                  <Tag v-if="msg.category" size="small" color="purple">{{ msg.category }}</Tag>
                  <span class="char-count">{{ msg.content?.length || 0 }} chars</span>
                </div>
                <pre class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
            <Empty v-else description="No system messages" />
          </CollapsePanel>

          <!-- Conversation History -->
          <CollapsePanel key="history" header="Conversation History">
            <div v-if="rawContext.conversationHistory?.length" class="message-list">
              <div
                v-for="(msg, index) in rawContext.conversationHistory"
                :key="index"
                class="message-item"
              >
                <div class="message-header">
                  <Tag :color="msg.role === 'user' ? 'green' : 'blue'" size="small">
                    {{ msg.role }}
                  </Tag>
                  <span v-if="msg.timestamp" class="timestamp">
                    {{ new Date(msg.timestamp).toLocaleString() }}
                  </span>
                </div>
                <pre class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
            <Empty v-else description="No conversation history" />
          </CollapsePanel>

          <!-- Memories -->
          <CollapsePanel key="memories" header="Memories">
            <div v-if="rawContext.memories?.length" class="memory-list">
              <Card
                v-for="(memory, index) in rawContext.memories"
                :key="index"
                size="small"
                class="memory-card"
              >
                <div class="memory-content">{{ memory.content }}</div>
                <div class="memory-meta">
                  <Tag size="small">{{ memory.type }}</Tag>
                  <span class="relevance">Relevance: {{ (memory.relevance * 100).toFixed(1) }}%</span>
                </div>
              </Card>
            </div>
            <Empty v-else description="No memories" />
          </CollapsePanel>

          <!-- Available Tools -->
          <CollapsePanel key="tools" header="Available Tools">
            <div v-if="rawContext.availableTools?.length" class="tools-list">
              <Card
                v-for="(tool, index) in rawContext.availableTools"
                :key="index"
                size="small"
                class="tool-card"
              >
                <div class="tool-name">{{ tool.name }}</div>
                <div class="tool-description">{{ tool.description }}</div>
                <pre v-if="tool.parameters" class="tool-params">{{ formatJson(tool.parameters) }}</pre>
              </Card>
            </div>
            <Empty v-else description="No tools available" />
          </CollapsePanel>          <!-- LLM Request Body -->
          <CollapsePanel key="llmRequest" header="LLM Request Body (实际请求体)">
            <pre class="json-content">{{ formatJson(rawContext.llmRequestBody) }}</pre>
          </CollapsePanel>

          <!-- Model Config -->
          <CollapsePanel key="model" header="Model Configuration (原始配置)">
            <pre class="json-content">{{ formatJson(rawContext.modelConfig) }}</pre>
          </CollapsePanel>

          <!-- Raw JSON -->
          <CollapsePanel key="raw" header="Raw Context (完整原始数据)">
            <pre class="json-content">{{ formatJson(rawContext) }}</pre>
          </CollapsePanel>
        </Collapse>
      </div>

      <Empty v-else description="No context data" />
    </Spin>
  </div>
</template>

<style scoped>
.raw-context-tab {
  height: 100%;
  overflow: auto;
  padding: 16px;
}

.error-container {
  padding: 20px;
  text-align: center;
}

.retry-btn {
  margin-top: 16px;
}

.context-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview-card {
  background: #f6ffed;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.overview-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.overview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-weight: 500;
  color: #666;
  font-size: 13px;
}

.context-collapse {
  background: transparent;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.char-count {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.timestamp {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.message-content {
  padding: 12px;
  margin: 0;
  background: #fff;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}

.memory-list,
.tools-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-card,
.tool-card {
  background: #fafafa;
}

.memory-content {
  margin-bottom: 8px;
  color: #333;
}

.memory-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.relevance {
  color: #999;
}

.tool-name {
  font-weight: 500;
  color: #1890ff;
  margin-bottom: 4px;
}

.tool-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.tool-params {
  background: #f0f0f0;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  margin: 0;
  overflow: auto;
  max-height: 200px;
}

.json-content {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 400px;
  margin: 0;
}
</style>
