<script setup lang="ts">
/**
 * 语音播放组件
 * 支持播放语音消息，显示播放进度
 */

import { ref, computed, onMounted } from "vue";
import { Button, Slider } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import { useVoicePlayer } from "../composables/useVoicePlayer";

interface Props {
  /** 音频 URL (Base64 或 HTTP URL) */
  audioUrl: string;
  /** 音频时长(秒) */
  duration?: number;
  /** 是否自动播放 */
  autoPlay?: boolean;
}

const props = defineProps<Props>();

// 使用语音播放器 composable
const { isPlaying, setAudioElement, setPlaying } = useVoicePlayer();

// 播放进度
const currentTime = ref(0);
const audioDuration = ref(props.duration || 0);

// 音频元素
let audioElement: HTMLAudioElement | null = null;

/**
 * 格式化时间
 * 处理 NaN 和 Infinity 的情况
 */
function formatTime(seconds: number): string {
  // 处理无效值：NaN、Infinity、负数
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return "--:--";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 初始化音频
 */
function initAudio() {
  if (audioElement) return;

  audioElement = new Audio(props.audioUrl);

  audioElement.addEventListener("loadedmetadata", () => {
    const duration = audioElement?.duration;
    // 确保 duration 是有效值
    if (isFinite(duration) && !isNaN(duration) && duration > 0) {
      audioDuration.value = duration;
    } else if (props.duration && props.duration > 0) {
      audioDuration.value = props.duration;
    } else {
      audioDuration.value = 0;
    }
  });

  // 备选：通过 canplaythrough 获取时长
  audioElement.addEventListener("canplaythrough", () => {
    if (audioDuration.value === 0) {
      const duration = audioElement?.duration;
      if (isFinite(duration) && !isNaN(duration) && duration > 0) {
        audioDuration.value = duration;
      }
    }
  });

  audioElement.addEventListener("timeupdate", () => {
    const time = audioElement?.currentTime;
    currentTime.value = isFinite(time) && !isNaN(time) ? time : 0;
  });

  audioElement.addEventListener("ended", () => {
    setPlaying(false);
    currentTime.value = 0;
  });

  audioElement.addEventListener("error", (e) => {
    console.error("[VoicePlayer] Audio error:", e);
    setPlaying(false);
  });
}

/**
 * 切换播放/暂停
 */
function togglePlay() {
  if (!audioElement) {
    initAudio();
    setAudioElement(audioElement);
  }

  if (isPlaying.value) {
    audioElement?.pause();
    setPlaying(false);
  } else {
    audioElement?.play().catch((error) => {
      console.error("[VoicePlayer] Failed to play:", error);
    });
    setPlaying(true);
  }
}

/**
 * 处理进度条变化
 */
function handleSliderChange(value: number) {
  if (audioElement) {
    audioElement.currentTime = value;
    currentTime.value = value;
  }
}

/**
 * 计算进度百分比
 */
const progress = computed(() => {
  if (audioDuration.value === 0) return 0;
  return (currentTime.value / audioDuration.value) * 100;
});

// 自动播放
onMounted(() => {
  if (props.autoPlay) {
    initAudio();
    setAudioElement(audioElement);
    audioElement?.play().catch((error) => {
      console.error("[VoicePlayer] Auto play failed:", error);
    });
    setPlaying(true);
  }
});
</script>

<template>
  <div class="voice-player flex items-center gap-3 rounded-lg px-3 py-2 min-w-[200px]">
    <!-- 播放按钮 -->
    <Button
      type="primary"
      shape="circle"
      size="small"
      class="flex-shrink-0"
      @click="togglePlay"
    >
      <template #icon>
        <IconifyIcon
          :icon="isPlaying ? 'mdi:pause' : 'mdi:play'"
          class="text-sm"
        />
      </template>
    </Button>

    <!-- 波形动画 -->
    <div class="voice-wave flex items-center gap-0.5 h-6">
      <div
        v-for="i in 12"
        :key="i"
        class="w-0.5 bg-primary rounded-full transition-all duration-200"
        :style="{
          height: isPlaying
            ? `${20 + Math.random() * 60}%`
            : `${15 + (i % 3) * 10}%`,
          opacity: isPlaying ? 1 : 0.6,
        }"
      />
    </div>

    <!-- 时长显示 -->
    <span class="text-xs font-mono flex-shrink-0 opacity-80">
      {{ formatTime(currentTime) }} / {{ formatTime(audioDuration) }}
    </span>

    <!-- 进度条 (悬停显示) -->
    <Slider
      v-if="audioDuration > 0"
      :value="currentTime"
      :min="0"
      :max="audioDuration"
      :step="0.1"
      class="flex-1 mx-2"
      @change="handleSliderChange"
    />
  </div>
</template>

<style scoped>
.voice-player {
  transition: all 0.2s ease;
}

.voice-wave {
  min-width: 40px;
}

:deep(.ant-slider) {
  margin: 0;
}

:deep(.ant-slider-rail) {
  background-color: currentColor;
  opacity: 0.2;
}

:deep(.ant-slider-track) {
  background-color: currentColor;
}

:deep(.ant-slider-handle) {
  border-color: currentColor;
}
</style>
