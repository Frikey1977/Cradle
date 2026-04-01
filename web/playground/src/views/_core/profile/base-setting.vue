<script setup lang="ts">
import type { BasicOption } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';
import { preferences, updatePreferences } from '@vben/preferences';
import { loadLocaleMessages } from '@vben/locales';
import type { SupportedLanguagesType } from '@vben/locales';

import { getUserInfoApi } from '#/api';
import { updateContactLanguage, updateContactProfileLanguage } from '#/api/organization/language';
import { getMyContact } from '#/api/organization/contacts';

const profileBaseSettingRef = ref();
let lastLanguage = preferences.app.locale;

const MOCK_ROLES_OPTIONS: BasicOption[] = [
  {
    label: '管理员',
    value: 'super',
  },
  {
    label: '用户',
    value: 'user',
  },
  {
    label: '测试',
    value: 'test',
  },
];

const LANGUAGE_OPTIONS: BasicOption[] = [
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

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'realName',
      component: 'Input',
      label: '姓名',
    },
    {
      fieldName: 'username',
      component: 'Input',
      label: '用户名',
    },
    {
      fieldName: 'roles',
      component: 'Select',
      componentProps: {
        mode: 'tags',
        options: MOCK_ROLES_OPTIONS,
      },
      label: '角色',
    },
    {
      fieldName: 'preferredLanguage',
      component: 'Select',
      componentProps: {
        options: LANGUAGE_OPTIONS,
        onChange: handleLanguageSelect,
      },
      label: '首选语言',
      help: '设置与 Agent 对话时的默认语言',
    },
    {
      fieldName: 'introduction',
      component: 'Textarea',
      label: '个人简介',
    },
  ];
});

function handleLanguageSelect(value: string) {
  if (value && value !== lastLanguage) {
    lastLanguage = value;
    handleLanguageChange(value);
  }
}

onMounted(async () => {
  const data = await getUserInfoApi();
  data.preferredLanguage = preferences.app.locale;
  lastLanguage = preferences.app.locale;
  profileBaseSettingRef.value.getFormApi().setValues(data);
});

async function handleLanguageChange(locale: string) {
  console.log("[Profile] Language changed to:", locale);
  
  localStorage.setItem("pendingLanguageChange", locale);
  
  await loadLocaleMessages(locale as SupportedLanguagesType);
  updatePreferences({
    app: {
      locale,
    },
  });
  
  try {
    const contactResponse = await getMyContact();
    const contactId = contactResponse?.sid;
    
    if (contactId) {
      console.log("[Profile] Updating database for contact:", contactId);
      await updateContactProfileLanguage(contactId, locale);
      console.log("[Profile] Database updated successfully");
      
      const agentId = localStorage.getItem("selectedAgentId");
      if (agentId) {
        console.log("[Profile] Notifying Gateway Master for agent:", agentId);
        await updateContactLanguage(contactId, agentId, locale);
      }
    }
  } catch (error) {
    console.error("[Profile] Failed to update backend language:", error);
  }
}
</script>
<template>
  <ProfileBaseSetting ref="profileBaseSettingRef" :form-schema="formSchema" />
</template>