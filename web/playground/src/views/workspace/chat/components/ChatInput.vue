<script setup lang="ts">
/**
 * 消息输入组件
 * 支持文本、图片和语音输入
 */

import { ref, computed } from "vue";
import { Button, Input, Upload, message } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import VoiceRecorder from "./VoiceRecorder.vue";
import { stopAllVoicePlayers } from "../composables/useVoicePlayer";

const { TextArea } = Input;

interface Props {
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 发送文本消息 */
  send: [content: string];
  /** 发送语音消息 */
  sendVoice: [audioBlob: Blob, duration: number];
  /** 发送图文消息 */
  sendWithImages: [content: string, images: { base64: string; name: string }[]];
}>();

// 输入内容
const inputValue = ref("");

// 是否正在录音
const isRecording = ref(false);

// 待发送的图片列表
interface PendingImage {
  uid: string;
  base64: string;
  name: string;
}
const pendingImages = ref<PendingImage[]>([]);

// 生成唯一ID
function generateUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 添加待发送图片
function addPendingImage(base64: string, name: string) {
  pendingImages.value.push({
    uid: generateUid(),
    base64,
    name,
  });
}

// 移除待发送图片
function removePendingImage(uid: string) {
  const index = pendingImages.value.findIndex((img) => img.uid === uid);
  if (index > -1) {
    pendingImages.value.splice(index, 1);
  }
}

// 图片上传前检查
function beforeUpload(file: File): boolean {
  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    message.error("只能上传图片文件！");
    return false;
  }
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    message.error("图片大小不能超过 5MB！");
    return false;
  }
  return true;
}

// 处理图片选择
function handleImageChange(info: any) {
  const file = info.file;
  if (!file) return;

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    const base64 = reader.result as string;
    addPendingImage(base64, file.name);
    message.success(`图片 "${file.name}" 已添加`);
  };
  reader.onerror = () => {
    message.error(`图片 ${file.name} 读取失败`);
  };
}

// 发送消息
function handleSend() {
  const content = inputValue.value.trim();
  if (props.disabled) return;

  // 停止正在播放的语音
  stopAllVoicePlayers();

  // 如果有图片，发送图文消息
  if (pendingImages.value.length > 0) {
    emit("sendWithImages", content, [...pendingImages.value]);
    inputValue.value = "";
    pendingImages.value = [];
    return;
  }

  // 纯文本消息
  if (!content) return;
  emit("send", content);
  inputValue.value = "";
}

// 处理键盘事件
function handleKeyDown(e: KeyboardEvent) {
  // Ctrl + Enter 发送消息
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    handleSend();
  }
}

// 处理语音发送
function handleVoiceSend(audioBlob: Blob, duration: number) {
  emit("sendVoice", audioBlob, duration);
  isRecording.value = false;
}

// 处理取消录音
function handleVoiceCancel() {
  isRecording.value = false;
}

// 开始录音
function startRecording() {
  if (props.disabled) return;
  // 停止正在播放的语音
  stopAllVoicePlayers();
  isRecording.value = true;
}

// 拖拽相关状态
const isDragging = ref(false);
let dragCounter = 0;

// 处理拖拽进入
function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  if (!props.disabled && !isRecording.value) {
    isDragging.value = true;
  }
}

// 处理拖拽离开
function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) {
    isDragging.value = false;
  }
}

// 处理拖拽悬停
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// 处理文件拖放
function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  isDragging.value = false;

  if (props.disabled || isRecording.value) return;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const fileArray = Array.from(files);

    // 过滤出图片文件
    const imageFiles = fileArray.filter(file => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      message.warning("请拖拽图片文件（JPG、PNG、GIF）");
      return;
    }

    // 检查文件大小并添加到待发送列表
    imageFiles.forEach(file => {
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.warning(`图片 ${file.name} 超过 5MB，已跳过`);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        addPendingImage(base64, file.name);
        message.success(`图片 "${file.name}" 已添加`);
      };
      reader.onerror = () => {
        message.error(`图片 ${file.name} 读取失败`);
      };
    });
  }
}
</script>

<template>
  <div
    class="chat-input border-t border-border bg-card p-4 relative"
    :class="{ 'dragging': isDragging }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- 拖拽提示遮罩 -->
    <div
      v-if="isDragging"
      class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center m-2"
    >
      <div class="text-center">
        <IconifyIcon icon="mdi:cloud-upload" class="text-4xl text-primary mb-2" />
        <div class="text-lg font-medium text-primary">释放以上传图片</div>
        <div class="text-sm text-muted-foreground mt-1">支持 JPG、PNG、GIF 格式</div>
      </div>
    </div>

    <!-- 语音录制模式 -->
    <div v-if="isRecording" class="flex flex-col items-center justify-center py-4 gap-4">
      <VoiceRecorder
        :disabled="disabled"
        @send="handleVoiceSend"
        @cancel="handleVoiceCancel"
      />
      <!-- 返回按钮和提示 -->
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          type="text"
          size="small"
          @click="handleVoiceCancel"
        >
          <template #icon>
            <IconifyIcon icon="mdi:keyboard" />
          </template>
          返回文字输入
        </Button>
      </div>
    </div>

    <!-- 普通输入模式 -->
    <div v-else class="flex flex-col gap-3">
      <!-- 待发送图片预览 - 单独放在上方 -->
      <div v-if="pendingImages.length > 0" class="flex flex-wrap gap-2 px-12">
        <div
          v-for="img in pendingImages"
          :key="img.uid"
          class="relative group"
        >
          <img
            :src="img.base64"
            :alt="img.name"
            class="w-16 h-16 object-cover rounded border border-border"
          />
          <button
            class="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            @click="removePendingImage(img.uid)"
          >
            <IconifyIcon icon="mdi:close" class="text-xs" />
          </button>
        </div>
      </div>

      <!-- 输入行 -->
      <div class="flex gap-3 items-start">
        <!-- 左侧工具栏 - 与输入框顶边对齐 -->
        <div class="flex flex-col gap-2 pt-1">
          <!-- 图片上传按钮 -->
          <Upload
            :disabled="disabled"
            :show-upload-list="false"
            :before-upload="beforeUpload"
            :custom-request="({ file, onSuccess }) => { onSuccess?.(); }"
            accept="image/*"
            @change="handleImageChange"
          >
            <Button
              type="text"
              size="small"
              :disabled="disabled"
              title="添加图片"
            >
              <template #icon>
                <IconifyIcon icon="mdi:image" class="text-lg" />
              </template>
            </Button>
          </Upload>

          <!-- 语音录制按钮 -->
          <Button
            type="text"
            size="small"
            :disabled="disabled"
            title="语音输入"
            @click="startRecording"
          >
            <template #icon>
              <IconifyIcon icon="mdi:microphone" class="text-lg" />
            </template>
          </Button>
        </div>

        <!-- 文本输入框 -->
        <TextArea
          v-model:value="inputValue"
          :disabled="disabled"
          :placeholder="disabled ? '请先选择 Agent 并连接' : pendingImages.length > 0 ? '请输入您想对图片说的话' : '输入消息，支持拖拽图片到此处'"
          :rows="3"
          class="resize-none flex-1"
          @keydown="handleKeyDown"
        />

        <!-- 发送按钮 -->
        <div class="flex flex-col justify-end gap-2">
        <div class="text-xs text-muted-foreground text-center">
          Ctrl + Enter
        </div>
        <Button
          type="primary"
          :disabled="disabled || (!inputValue.trim() && pendingImages.length === 0)"
          class="h-10 px-6"
          @click="handleSend"
        >
          <template #icon>
            <IconifyIcon icon="mdi:send" />
          </template>
          发送
        </Button>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  min-height: 120px;
  flex-shrink: 0;
}
</style>
