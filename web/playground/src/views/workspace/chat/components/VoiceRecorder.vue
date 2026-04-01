<script setup lang="ts">
/**
 * 语音录制组件
 * 支持录音、实时音频可视化、发送语音消息
 */

import { ref, onUnmounted } from "vue";
import { Button } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";

interface Props {
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 录音完成，发送音频数据 */
  send: [audioBlob: Blob, duration: number];
  /** 取消录音 */
  cancel: [];
}>();

// 录音状态
const isRecording = ref(false);
const isPaused = ref(false);
const recordingTime = ref(0);
const audioLevel = ref(0);

// 录音相关
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let microphone: MediaStreamAudioSourceNode | null = null;
let animationFrame: number | null = null;
let recordingTimer: NodeJS.Timeout | null = null;
let audioChunks: Blob[] = [];
let startTime = 0;

/**
 * 开始录音
 */
async function startRecording() {
  if (props.disabled) return;

  try {
    // 请求麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // 创建音频上下文用于可视化
    audioContext = new AudioContext({ sampleRate: 16000 });
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    // 创建 MediaRecorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4",
    });

    audioChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const duration = Date.now() - startTime;
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      emit("send", audioBlob, duration);
      cleanup();
    };

    // 开始录音
    mediaRecorder.start(100); // 每100ms收集一次数据
    startTime = Date.now();
    isRecording.value = true;
    isPaused.value = false;

    // 开始计时
    recordingTimer = setInterval(() => {
      recordingTime.value = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);

    // 开始音频可视化
    visualizeAudio();

    console.log("[VoiceRecorder] Recording started");
  } catch (error) {
    console.error("[VoiceRecorder] Failed to start recording:", error);
    alert("无法访问麦克风，请检查权限设置");
  }
}

/**
 * 暂停/继续录音
 */
function togglePause() {
  if (!mediaRecorder || !isRecording.value) return;

  if (isPaused.value) {
    mediaRecorder.resume();
    isPaused.value = false;
    // 恢复计时
    const pausedDuration = recordingTime.value * 1000;
    startTime = Date.now() - pausedDuration;
    recordingTimer = setInterval(() => {
      recordingTime.value = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);
    visualizeAudio();
  } else {
    mediaRecorder.pause();
    isPaused.value = true;
    // 暂停计时
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }
}

/**
 * 停止录音并发送
 */
function stopRecording() {
  if (!mediaRecorder || !isRecording.value) return;

  mediaRecorder.stop();
  isRecording.value = false;

  // 停止所有轨道
  mediaRecorder.stream.getTracks().forEach((track) => track.stop());
}

/**
 * 取消录音
 */
function cancelRecording() {
  if (!mediaRecorder || !isRecording.value) return;

  mediaRecorder.stop();
  isRecording.value = false;

  // 停止所有轨道
  mediaRecorder.stream.getTracks().forEach((track) => track.stop());

  cleanup();
  emit("cancel");
}

/**
 * 音频可视化
 */
function visualizeAudio() {
  if (!analyser || !isRecording.value || isPaused.value) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // 计算平均音量
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  audioLevel.value = Math.min(100, (average / 128) * 100);

  animationFrame = requestAnimationFrame(visualizeAudio);
}

/**
 * 清理资源
 */
function cleanup() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  analyser = null;
  microphone = null;
  mediaRecorder = null;
  audioChunks = [];
  recordingTime.value = 0;
  audioLevel.value = 0;
}

/**
 * 格式化时间
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

onUnmounted(() => {
  if (isRecording.value) {
    cancelRecording();
  }
  cleanup();
});
</script>

<template>
  <div class="voice-recorder">
    <!-- 未录音状态 - 显示录音按钮 -->
    <div v-if="!isRecording" class="flex items-center">
      <Button
        type="text"
        shape="circle"
        :disabled="disabled"
        class="voice-btn"
        @click="startRecording"
      >
        <template #icon>
          <IconifyIcon icon="mdi:microphone" class="text-lg" />
        </template>
      </Button>
    </div>

    <!-- 录音中状态 -->
    <div v-else class="recording-panel flex items-center gap-4 bg-muted/50 rounded-lg px-4 py-2">
      <!-- 录音动画 -->
      <div class="recording-indicator flex items-center gap-2">
        <div
          class="w-3 h-3 rounded-full bg-red-500 animate-pulse"
          :class="{ 'opacity-50': isPaused }"
        />
        <span class="text-sm font-mono" :class="{ 'text-muted-foreground': isPaused }">
          {{ formatTime(recordingTime) }}
        </span>
      </div>

      <!-- 音频可视化 -->
      <div class="audio-visualizer flex-1 h-8 flex items-center gap-0.5">
        <div
          v-for="i in 20"
          :key="i"
          class="w-1 bg-primary rounded-full transition-all duration-75"
          :style="{
            height: `${Math.max(20, Math.min(100, audioLevel * (0.5 + Math.random() * 0.5)))}%`,
            opacity: isPaused ? 0.3 : 1,
          }"
        />
      </div>

      <!-- 控制按钮 -->
      <div class="controls flex items-center gap-2">
        <Button
          type="text"
          shape="circle"
          size="small"
          @click="togglePause"
        >
          <template #icon>
            <IconifyIcon
              :icon="isPaused ? 'mdi:play' : 'mdi:pause'"
              class="text-lg"
            />
          </template>
        </Button>

        <Button
          type="text"
          shape="circle"
          size="small"
          danger
          @click="cancelRecording"
        >
          <template #icon>
            <IconifyIcon icon="mdi:close" class="text-lg" />
          </template>
        </Button>

        <Button
          type="primary"
          shape="circle"
          size="small"
          @click="stopRecording"
        >
          <template #icon>
            <IconifyIcon icon="mdi:send" class="text-lg" />
          </template>
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-recorder {
  display: flex;
  align-items: center;
}

.voice-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-btn:hover {
  background-color: hsl(var(--muted));
}

.recording-panel {
  min-width: 300px;
}

.audio-visualizer {
  min-width: 100px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
