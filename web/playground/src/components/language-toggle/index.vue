<script setup lang="ts">
import type { SupportedLanguagesType } from '@vben/locales';

import { Languages } from '@vben/icons';
import { loadLocaleMessages } from '@vben/locales';
import { preferences, updatePreferences } from '@vben/preferences';

import { VbenDropdownRadioMenu, VbenIconButton } from '@vben-core/shadcn-ui';

defineOptions({
  name: 'CustomLanguageToggle',
});

// 支持的语言列表 - 2025-02-21 添加西班牙语
const SUPPORT_LANGUAGES = [
  {
    label: '简体中文',
    value: 'zh-CN',
  },
  {
    label: 'English',
    value: 'en-US',
  },
  {
    label: '日本語',
    value: 'ja-JP',
  },
  {
    label: 'Español',
    value: 'es-ES',
  },
];

async function handleUpdate(value: SupportedLanguagesType) {
  await loadLocaleMessages(value);
  updatePreferences({
    app: {
      locale: value,
    },
  });
}
</script>

<template>
  <VbenDropdownRadioMenu
    :menus="SUPPORT_LANGUAGES"
    :model-value="preferences.app.locale"
    @update:model-value="handleUpdate"
  >
    <VbenIconButton>
      <Languages class="size-4" />
    </VbenIconButton>
  </VbenDropdownRadioMenu>
</template>
