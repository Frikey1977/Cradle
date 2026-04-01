import { ref, onMounted, onUnmounted } from "vue";

// 全局语音播放管理器
const voicePlayerRegistry = new Set<(stop: boolean) => void>();

/**
 * 停止所有正在播放的语音
 */
export function stopAllVoicePlayers() {
  voicePlayerRegistry.forEach((stopFn) => stopFn(true));
}

/**
 * 使用语音播放器
 * @returns 播放控制函数
 */
export function useVoicePlayer() {
  const isPlaying = ref(false);
  let audioElement: HTMLAudioElement | null = null;

  // 停止函数
  const stopFn = (stop: boolean) => {
    if (stop && isPlaying.value && audioElement) {
      audioElement.pause();
      isPlaying.value = false;
    }
  };

  onMounted(() => {
    voicePlayerRegistry.add(stopFn);
  });

  onUnmounted(() => {
    voicePlayerRegistry.delete(stopFn);
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
  });

  return {
    isPlaying,
    setAudioElement: (el: HTMLAudioElement | null) => {
      audioElement = el;
    },
    setPlaying: (playing: boolean) => {
      isPlaying.value = playing;
    },
  };
}
