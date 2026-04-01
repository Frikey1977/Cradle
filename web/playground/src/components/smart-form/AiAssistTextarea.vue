<template>
  <div
    class="ai-assist-textarea relative"
    @mouseenter="showAiButton = true"
    @mouseleave="handleMouseLeave"
  >
    <TextArea
      v-model:value="inputValue"
      :max-length="maxLength"
      :rows="rows"
      :show-count="showCount"
      :placeholder="placeholder"
      class="w-full"
      @change="handleChange"
    />

    <!-- AI 辅助按钮 -->
    <Transition name="fade">
      <div
        v-if="showAiButton && !loading"
        class="ai-button-wrapper"
      >
        <Button
          type="text"
          size="small"
          class="ai-assist-btn flex items-center gap-1 text-primary hover:text-primary/80"
          @click="handleAiAssist"
        >
          <IconifyIcon icon="mdi:sparkles" class="text-sm" />
          <span class="text-xs">AI 生成</span>
        </Button>
      </div>
    </Transition>

    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="ai-button-wrapper flex items-center gap-1 text-primary"
    >
      <IconifyIcon icon="mdi:loading" class="text-sm animate-spin" />
      <span class="text-xs">生成中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, watch } from "vue";
import { Button, Input, message } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import type { FormApi } from "@vben/form";
import {
  getSmartFormSuggestion,
  type SmartFormRequest,
} from "#/api/ai/smart-form";

const { TextArea } = Input;

// 注入表单 API
const formApi = inject<FormApi | null>("formApi", null);

interface Props {
  value?: string;
  maxLength?: number;
  rows?: number;
  showCount?: boolean;
  placeholder?: string;
  /** 模块标识 */
  module: string;
  /** 表单类型 */
  formType: string;
  /** 目标字段名 */
  fieldName: string;
  /** 提示词 */
  prompt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  value: "",
  maxLength: 300,
  rows: 3,
  showCount: true,
  placeholder: "",
});

const emit = defineEmits<{
  "update:value": [value: string];
  change: [value: string];
}>();

const inputValue = ref(props.value);
const showAiButton = ref(false);
const loading = ref(false);

// 同步外部值
watch(
  () => props.value,
  (newVal) => {
    inputValue.value = newVal;
  }
);

function handleChange(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value;
  emit("update:value", value);
  emit("change", value);
}

function handleMouseLeave() {
  // 延迟隐藏，让用户有时间点击按钮
  setTimeout(() => {
    showAiButton.value = false;
  }, 300);
}

async function handleAiAssist() {
  if (loading.value) return;

  loading.value = true;
  try {
    // 从注入的 formApi 获取表单数据
    let formData: Record<string, any> = {};
    
    if (formApi) {
      try {
        formData = (await formApi.getValues()) || {};
      } catch (e) {
        console.warn("获取表单数据失败:", e);
      }
    }

    // 如果注入失败，尝试从 DOM 获取
    if (!formData || Object.keys(formData).length === 0) {
      const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
      const typeRadio = document.querySelector('input[name="type"]:checked') as HTMLInputElement;
      const codeInput = document.querySelector('input[name="code"]') as HTMLInputElement;
      formData = {
        name: nameInput?.value || "",
        type: typeRadio?.value || "",
        code: codeInput?.value || "",
      };
    }

    const request: SmartFormRequest = {
      module: props.module,
      formType: props.formType,
      formData: formData,
      targetField: props.fieldName,
      prompt: props.prompt,
      validation: {
        maxLength: props.maxLength,
      },
    };

    const response = await getSmartFormSuggestion(request);

    if (response.suggestion) {
      inputValue.value = response.suggestion;
      emit("update:value", response.suggestion);
      emit("change", response.suggestion);
      message.success("AI 生成成功");
    } else {
      message.warning("AI 未能生成建议，请手动输入");
    }
  } catch (error) {
    console.error("AI 生成失败:", error);
    message.error("AI 生成失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.ai-assist-textarea {
  position: relative;
  padding-bottom: 24px; /* 为 AI 按钮预留空间 */
}

.ai-button-wrapper {
  position: absolute;
  bottom: 28px; /* 在 textarea 内部底部，避开计数器 */
  right: 8px;
  z-index: 10;
}

.ai-assist-btn {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--primary), 0.1);
  transition: all 0.2s;
}

.ai-assist-btn:hover {
  background: rgba(var(--primary), 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
