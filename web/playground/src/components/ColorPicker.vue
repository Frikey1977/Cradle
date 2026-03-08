<template>
  <div class="flex items-center gap-2">
    <input
      type="color"
      :value="modelValue || '#000000'"
      @input="handleInput"
      class="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
    />
    <Input
      :value="modelValue"
      @update:value="handleUpdate"
      @change="handleChange"
      placeholder="#10A37F"
      class="w-32"
      allow-clear
    />
  </div>
</template>

<script setup lang="ts">
import { Input } from "ant-design-vue";

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}

function handleUpdate(value: string) {
  // 如果用户输入了有效的颜色值，更新
  if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    emit("update:modelValue", value);
  }
}

function handleChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const value = target.value;
  // 如果值为空，说明是清空操作
  if (!value) {
    emit("update:modelValue", undefined);
  }
}
</script>
