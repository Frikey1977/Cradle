<template>
  <div
    class="smart-form-field relative"
    @mouseenter="showAiButton = true"
    @mouseleave="showAiButton = false"
  >
    <!-- 输入控件插槽 -->
    <slot />

    <!-- AI 辅助按钮 -->
    <Transition name="fade">
      <div
        v-if="showAiButton && !loading"
        class="absolute -bottom-6 right-0 z-10"
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
      class="absolute -bottom-6 right-0 z-10 flex items-center gap-1 text-primary"
    >
      <IconifyIcon icon="mdi:loading" class="text-sm animate-spin" />
      <span class="text-xs">生成中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button, message } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import {
  getSmartFormSuggestion,
  type SmartFormRequest,
} from "#/api/ai/smart-form";

interface Props {
  /** 模块标识 */
  module: string;
  /** 表单类型 */
  formType: string;
  /** 当前表单数据 */
  formData: Record<string, any>;
  /** 目标字段名 */
  fieldName: string;
  /** 提示词 */
  prompt?: string;
  /** 验证规则 */
  validation?: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 建议值更新 */
  update: [value: string];
}>();

const showAiButton = ref(false);
const loading = ref(false);

async function handleAiAssist() {
  if (loading.value) return;

  loading.value = true;
  try {
    const request: SmartFormRequest = {
      module: props.module,
      formType: props.formType,
      formData: props.formData,
      targetField: props.fieldName,
      prompt: props.prompt,
      validation: props.validation,
    };

    const response = await getSmartFormSuggestion(request);

    if (response.suggestion) {
      emit("update", response.suggestion);
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
.smart-form-field {
  position: relative;
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
