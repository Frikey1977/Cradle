<script setup lang="ts">
import type { SupportedLanguagesType } from '@vben/locales';

import { Languages } from '@vben/icons';
import { loadLocaleMessages } from '@vben/locales';
import { preferences, updatePreferences } from '@vben/preferences';
import { ref, watch, onMounted } from 'vue';

import { VbenDropdownRadioMenu, VbenIconButton } from '@vben-core/shadcn-ui';

import { updateContactLanguage, updateContactProfileLanguage } from '#/api/organization/language';
import { getMyContact } from '#/api/organization/contacts';

defineOptions({
  name: 'CustomLanguageToggle',
});

const currentLocale = ref(preferences.app.locale);

onMounted(() => {
  console.log("[LanguageToggle] Component mounted, currentLocale:", currentLocale.value);
});

watch(currentLocale, async (newLocale, oldLocale) => {
  console.log("[LanguageToggle] currentLocale changed from", oldLocale, "to", newLocale);
  
  if (newLocale && newLocale !== oldLocale) {
    localStorage.setItem("pendingLanguageChange", newLocale);
    
    await loadLocaleMessages(newLocale as SupportedLanguagesType);
    updatePreferences({
      app: {
        locale: newLocale,
      },
    });
    
    const event = new CustomEvent("language-changed", {
      detail: { locale: newLocale },
    });
    window.dispatchEvent(event);
    console.log("[LanguageToggle] Dispatched language-changed event:", newLocale);
    
    await updateBackendLanguage(newLocale);
  }
});

async function updateBackendLanguage(locale: string) {
  try {
    const contactResponse = await getMyContact();
    const contactId = contactResponse?.sid;
    
    if (!contactId) {
      console.log("[LanguageToggle] No contact found, skipping backend update");
      return;
    }
    
    console.log("[LanguageToggle] Updating database for contact:", contactId);
    await updateContactProfileLanguage(contactId, locale);
    console.log("[LanguageToggle] Database updated successfully");
    
    const agentId = localStorage.getItem("selectedAgentId");
    if (agentId) {
      console.log("[LanguageToggle] Notifying Gateway Master for agent:", agentId);
      const result = await updateContactLanguage(contactId, agentId, locale);
      console.log("[LanguageToggle] Gateway Master response:", result);
    }
  } catch (error) {
    console.error("[LanguageToggle] Failed to update backend language:", error);
  }
}

async function handleUpdate(value: string) {
  console.log("[LanguageToggle] handleUpdate called with:", value);
  currentLocale.value = value;
}

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
</script>

<template>
  <VbenDropdownRadioMenu
    :menus="SUPPORT_LANGUAGES"
    :model-value="currentLocale"
    @update:model-value="handleUpdate"
  >
    <VbenIconButton>
      <Languages class="size-4" />
    </VbenIconButton>
  </VbenDropdownRadioMenu>
</template>