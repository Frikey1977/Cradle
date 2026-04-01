<template>
  <div class="flex items-center gap-2">
    <input
      type="color"
      :value="colorPickerValue"
      @input="handleColorInput"
      class="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
    />
    <Input
      :value="inputValue"
      @update:value="handleInputChange"
      placeholder="#10A37F"
      class="w-32"
      allow-clear
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Input } from "ant-design-vue";

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

const inputValue = ref<string | undefined>(props.modelValue);

const colorPickerValue = computed(() => {
  const val = inputValue.value;
  if (val && /^#[0-9A-Fa-f]{6}$/.test(val)) {
    return val;
  }
  return "#000000";
});

watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = val;
  }
);

function isValidColor(value: string | undefined): boolean {
  if (!value) return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function handleColorInput(e: Event) {
  const target = e.target as HTMLInputElement;
  inputValue.value = target.value;
  emit("update:modelValue", target.value);
}

function handleInputChange(value: string | undefined) {
  const trimmedValue = value?.trim();
  inputValue.value = trimmedValue || undefined;
  
  if (!trimmedValue) {
    emit("update:modelValue", undefined);
  } else if (isValidColor(trimmedValue)) {
    emit("update:modelValue", trimmedValue);
  }
}
</script>
