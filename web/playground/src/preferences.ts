import { defineOverridesPreferences } from "@vben/preferences";

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效 (2025-02-21 update 33 - reorder agent form fields)
 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    name: import.meta.env.VITE_APP_TITLE,
    defaultHomePath: '/workspace/chat',
  },
  logo: {
    source: '/logo.png',
  },
  theme: {
    mode: 'light',
  },
  widget: {
    languageToggle: true,
  },
});


