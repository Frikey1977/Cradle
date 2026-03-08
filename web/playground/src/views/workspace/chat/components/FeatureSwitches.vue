<script setup lang="ts">
/**
 * 功能开关组件
 * 统一管理所有功能开关配置
 */

import { ref } from "vue";
import { Switch, Tooltip, Select, Button } from "ant-design-vue";
import { IconifyIcon } from "@vben/icons";
import { voiceOptions, getVoiceByCode } from "#/data/voices";

export interface FeatureConfig {
  stream: boolean;
  voiceResponse: boolean;
  thinkingMessage: boolean;
  voice?: string; // 语音合成音色
  autoPlayVoice?: boolean; // 语音自动播放
}

interface Props {
  features: FeatureConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:features": [features: FeatureConfig];
}>();

// 当前播放的音频
const currentAudio = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);

// 功能开关定义
const featureDefinitions = [
  {
    key: "stream" as const,
    label: "流式输出",
    icon: "mdi:lightning-bolt",
    description: "大模型响应以流式方式逐字显示",
    color: "blue",
  },
  {
    key: "voiceResponse" as const,
    label: "语音回复",
    icon: "mdi:microphone",
    description: "语音对话时返回语音回复（需多模型协作配置）",
    color: "green",
  },
  {
    key: "thinkingMessage" as const,
    label: "思考过程",
    icon: "mdi:brain",
    description: "显示 Agent 的思考过程和路由信息",
    color: "purple",
  },
];

// 更新单个开关
function updateFeature(key: keyof FeatureConfig, value: boolean | string) {
  emit("update:features", {
    ...props.features,
    [key]: value,
  });
}

// 播放音色预览
async function playVoicePreview(voiceCode: string) {
  const voice = getVoiceByCode(voiceCode);
  if (!voice) return;

  // 停止当前播放的音频
  if (currentAudio.value) {
    currentAudio.value.pause();
    currentAudio.value.currentTime = 0;
  }

  // 创建新的音频对象
  const audio = new Audio(voice.audioUrl);
  currentAudio.value = audio;
  isPlaying.value = true;

  audio.addEventListener("ended", () => {
    isPlaying.value = false;
  });

  audio.addEventListener("error", () => {
    isPlaying.value = false;
    console.error("音频播放失败:", voice.audioUrl);
  });

  try {
    await audio.play();
  } catch (error) {
    isPlaying.value = false;
    console.error("播放失败:", error);
  }
}

// 停止播放
function stopPlaying() {
  if (currentAudio.value) {
    currentAudio.value.pause();
    currentAudio.value.currentTime = 0;
    isPlaying.value = false;
  }
}
</script>

<template>
  <div class="feature-switches space-y-3">
    <div
      v-for="feature in featureDefinitions"
      :key="feature.key"
      class="feature-item flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center"
          :class="`bg-${feature.color}-100 text-${feature.color}-600`"
        >
          <IconifyIcon :icon="feature.icon" class="text-lg" />
        </div>
        <div>
          <div class="font-medium text-sm">{{ feature.label }}</div>
          <div class="text-muted-foreground text-xs">
            {{ feature.description }}
          </div>
        </div>
      </div>
      
      <Tooltip :title="features[feature.key] ? '点击关闭' : '点击开启'">
        <Switch
          :checked="features[feature.key]"
          @change="(val) => updateFeature(feature.key, val as boolean)"
        />
      </Tooltip>
    </div>
    
    <!-- 音色选择（仅在开启语音回复时显示） -->
    <div
      v-if="features.voiceResponse"
      class="feature-item p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors mt-3"
    >
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-100 text-pink-600"
          >
            <IconifyIcon icon="mdi:voice" class="text-lg" />
          </div>
          <div>
            <div class="font-medium text-sm">合成音色</div>
            <div class="text-muted-foreground text-xs">
              选择语音合成的音色
            </div>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <Select
            :value="features.voice || 'Cherry'"
            :options="voiceOptions.map(v => ({ label: `${v.chineseName} (${v.voiceCode})`, value: v.voiceCode }))"
            style="width: 200px"
            @change="(val) => updateFeature('voice', val as string)"
          />
          <Tooltip :title="isPlaying ? '停止播放' : '播放预览'">
            <Button
              type="primary"
              shape="circle"
              size="small"
              :loading="isPlaying"
              @click="isPlaying ? stopPlaying() : playVoicePreview(features.voice || 'Cherry')"
            >
              <IconifyIcon :icon="isPlaying ? 'mdi:stop' : 'mdi:play'" class="text-sm" />
            </Button>
          </Tooltip>
        </div>
      </div>
      
      <!-- 当前选中音色的描述 -->
      <div class="text-xs text-muted-foreground pl-11">
        {{ getVoiceByCode(features.voice || 'Cherry')?.description }}
      </div>
    </div>
    
    <!-- 自动播放开关（仅在开启语音回复时显示） -->
    <div
      v-if="features.voiceResponse"
      class="feature-item flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors mt-3"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600"
        >
          <IconifyIcon icon="mdi:play-circle" class="text-lg" />
        </div>
        <div>
          <div class="font-medium text-sm">自动播放</div>
          <div class="text-muted-foreground text-xs">
            收到语音消息后自动播放
          </div>
        </div>
      </div>
      
      <Tooltip :title="features.autoPlayVoice ? '点击关闭' : '点击开启'">
        <Switch
          :checked="features.autoPlayVoice !== false"
          @change="(val) => updateFeature('autoPlayVoice', val as boolean)"
        />
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.feature-switches {
  @apply w-full;
}

.feature-item {
  @apply cursor-pointer;
}
</style>
