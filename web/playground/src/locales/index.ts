import type { LocaleSetupOptions, SupportedLanguagesType } from "@vben/locales";
import type { Locale } from "ant-design-vue/es/locale";
import type { App } from "vue";
import { $t, $te, setupI18n as coreSetup } from "@vben/locales";
import { preferences } from "@vben/preferences";
import antdEnLocale from "ant-design-vue/es/locale/en_US";
import antdDefaultLocale from "ant-design-vue/es/locale/zh_CN";
import antdEsLocale from "ant-design-vue/es/locale/es_ES";
import antdJaLocale from "ant-design-vue/es/locale/ja_JP";
import dayjs from "dayjs";
import { ref } from "vue";

// 生产环境：静态导入翻译文件
import enAuthentication from "./langs/en-US/authentication.json";
import enCodes from "./langs/en-US/codes.json";
import enCommon from "./langs/en-US/common.json";
import enDemos from "./langs/en-US/demos.json";
import enExamples from "./langs/en-US/examples.json";
import enLlm from "./langs/en-US/llm.json";
import enOrganization from "./langs/en-US/organization.json";
import enPage from "./langs/en-US/page.json";
import enPreferences from "./langs/en-US/preferences.json";
import enSystem from "./langs/en-US/system.json";
import enUi from "./langs/en-US/ui.json";
import enWorkspace from "./langs/en-US/workspace.json";

import zhAuthentication from "./langs/zh-CN/authentication.json";
import zhCodes from "./langs/zh-CN/codes.json";
import zhCommon from "./langs/zh-CN/common.json";
import zhDemos from "./langs/zh-CN/demos.json";
import zhExamples from "./langs/zh-CN/examples.json";
import zhLlm from "./langs/zh-CN/llm.json";
import zhOrganization from "./langs/zh-CN/organization.json";
import zhPage from "./langs/zh-CN/page.json";
import zhPreferences from "./langs/zh-CN/preferences.json";
import zhSystem from "./langs/zh-CN/system.json";
import zhUi from "./langs/zh-CN/ui.json";
import zhWorkspace from "./langs/zh-CN/workspace.json";

import jaAuthentication from "./langs/ja-JP/authentication.json";
import jaCodes from "./langs/ja-JP/codes.json";
import jaCommon from "./langs/ja-JP/common.json";
import jaDemos from "./langs/ja-JP/demos.json";
import jaExamples from "./langs/ja-JP/examples.json";
import jaLlm from "./langs/ja-JP/llm.json";
import jaOrganization from "./langs/ja-JP/organization.json";
import jaPage from "./langs/ja-JP/page.json";
import jaPreferences from "./langs/ja-JP/preferences.json";
import jaSystem from "./langs/ja-JP/system.json";
import jaUi from "./langs/ja-JP/ui.json";
import jaWorkspace from "./langs/ja-JP/workspace.json";

import esAuthentication from "./langs/es-ES/authentication.json";
import esCodes from "./langs/es-ES/codes.json";
import esCommon from "./langs/es-ES/common.json";
import esDemos from "./langs/es-ES/demos.json";
import esExamples from "./langs/es-ES/examples.json";
import esLlm from "./langs/es-ES/llm.json";
import esOrganization from "./langs/es-ES/organization.json";
import esPage from "./langs/es-ES/page.json";
import esPreferences from "./langs/es-ES/preferences.json";
import esSystem from "./langs/es-ES/system.json";
import esUi from "./langs/es-ES/ui.json";
import esWorkspace from "./langs/es-ES/workspace.json";

const antdLocale = ref<Locale>(antdDefaultLocale);

// 生产环境：预加载的翻译文件映射
const prodLocaleMessages: Record<string, Record<string, any>> = {
  "en-US": {
    authentication: enAuthentication,
    codes: enCodes,
    common: enCommon,
    demos: enDemos,
    examples: enExamples,
    llm: enLlm,
    organization: enOrganization,
    page: enPage,
    preferences: enPreferences,
    system: enSystem,
    ui: enUi,
    workspace: enWorkspace,
  },
  "zh-CN": {
    authentication: zhAuthentication,
    codes: zhCodes,
    common: zhCommon,
    demos: zhDemos,
    examples: zhExamples,
    llm: zhLlm,
    organization: zhOrganization,
    page: zhPage,
    preferences: zhPreferences,
    system: zhSystem,
    ui: zhUi,
    workspace: zhWorkspace,
  },
  "ja-JP": {
    authentication: jaAuthentication,
    codes: jaCodes,
    common: jaCommon,
    demos: jaDemos,
    examples: jaExamples,
    llm: jaLlm,
    organization: jaOrganization,
    page: jaPage,
    preferences: jaPreferences,
    system: jaSystem,
    ui: jaUi,
    workspace: jaWorkspace,
  },
  "es-ES": {
    authentication: esAuthentication,
    codes: esCodes,
    common: esCommon,
    demos: esDemos,
    examples: esExamples,
    llm: esLlm,
    organization: esOrganization,
    page: esPage,
    preferences: esPreferences,
    system: esSystem,
    ui: esUi,
    workspace: esWorkspace,
  },
};

// 定义翻译文件列表（用于开发环境 fetch）
const localeFiles = [
  "authentication",
  "codes",
  "common",
  "demos",
  "examples",
  "llm",
  "organization",
  "page",
  "preferences",
  "system",
  "ui",
  "workspace",
];

/**
 * 开发环境：使用 fetch 动态加载翻译文件
 * 这样可以完全绕过 Vite 的模块缓存，每次都能获取最新内容
 */
async function fetchLocaleFile(lang: string, fileName: string): Promise<any> {
  try {
    // 添加时间戳参数，防止浏览器缓存
    const timestamp = Date.now();
    const response = await fetch(`/src/locales/langs/${lang}/${fileName}.json?t=${timestamp}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fileName}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to load locale file ${lang}/${fileName}:`, error);
    return {};
  }
}

/**
 * 开发环境：从路径加载翻译文件
 */
async function loadLocaleMessagesDev(lang: SupportedLanguagesType): Promise<Record<string, any>> {
  const messages: Record<string, any> = {};
  
  // 并行加载所有翻译文件
  const results = await Promise.all(
    localeFiles.map(async (fileName) => {
      const content = await fetchLocaleFile(lang, fileName);
      return { fileName, content };
    })
  );
  
  // 组装消息对象
  for (const { fileName, content } of results) {
    messages[fileName] = content;
  }
  
  return messages;
}

/**
 * 加载应用特有的语言包
 * @param lang
 */
async function loadMessages(lang: SupportedLanguagesType) {
  // 生产环境使用静态导入，开发环境使用 fetch
  const messages = import.meta.env.PROD 
    ? (prodLocaleMessages[lang] || prodLocaleMessages["en-US"])
    : await loadLocaleMessagesDev(lang);
  
  await loadThirdPartyMessage(lang);
  
  return messages;
}

/**
 * 加载第三方组件库的语言包
 * @param lang
 */
async function loadThirdPartyMessage(lang: SupportedLanguagesType) {
  await Promise.all([loadAntdLocale(lang), loadDayjsLocale(lang)]);
}

/**
 * 加载dayjs的语言包
 * @param lang
 */
async function loadDayjsLocale(lang: SupportedLanguagesType) {
  let locale;
  switch (lang) {
    case "en-US": {
      locale = await import("dayjs/locale/en");
      break;
    }
    case "zh-CN": {
      locale = await import("dayjs/locale/zh-cn");
      break;
    }
    case "ja-JP": {
      locale = await import("dayjs/locale/ja");
      break;
    }
    case "es-ES": {
      locale = await import("dayjs/locale/es");
      break;
    }
    // 默认使用英语
    default: {
      locale = await import("dayjs/locale/en");
    }
  }
  if (locale) {
    dayjs.locale(locale);
  } else {
    console.error(`Failed to load dayjs locale for ${lang}`);
  }
}

/**
 * 加载antd的语言包
 * @param lang
 */
async function loadAntdLocale(lang: SupportedLanguagesType) {
  switch (lang) {
    case "en-US": {
      antdLocale.value = antdEnLocale;
      break;
    }
    case "zh-CN": {
      antdLocale.value = antdDefaultLocale;
      break;
    }
    case "ja-JP": {
      antdLocale.value = antdJaLocale;
      break;
    }
    case "es-ES": {
      antdLocale.value = antdEsLocale;
      break;
    }
  }
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  await coreSetup(app, {
    defaultLocale: preferences.app.locale,
    loadMessages,
    missingWarn: !import.meta.env.PROD,
    ...options,
  });
}

export { $t, $te, antdLocale, setupI18n };
