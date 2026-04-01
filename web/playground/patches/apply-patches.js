#!/usr/bin/env node
/**
 * Apply patches to node_modules after npm install
 * Run this script after npm install to apply custom patches
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const patchesDir = __dirname;
const rootDir = path.resolve(patchesDir, '..');

// Patch for @vben/locales use-simple-locale
const useSimpleLocalePatch = {
  targetFile: 'node_modules/@vben/locales/node_modules/@vben-core/composables/src/use-simple-locale/messages.ts',
  content: `export type Locale = 'en-US' | 'zh-CN' | 'ja-JP' | 'de-DE' | 'es-ES';

export const messages: Record<Locale, Record<string, string>> = {
  'en-US': {
    cancel: 'Cancel',
    collapse: 'Collapse',
    confirm: 'Confirm',
    expand: 'Expand',
    prompt: 'Prompt',
    reset: 'Reset',
    submit: 'Submit',
  },
  'zh-CN': {
    cancel: '取消',
    collapse: '收起',
    confirm: '确认',
    expand: '展开',
    prompt: '提示',
    reset: '重置',
    submit: '提交',
  },
  'ja-JP': {
    cancel: 'キャンセル',
    collapse: '折りたたむ',
    confirm: '確認',
    expand: '展開',
    prompt: 'プロンプト',
    reset: 'リセット',
    submit: '送信',
  },
  'de-DE': {
    cancel: 'Abbrechen',
    collapse: 'Einklappen',
    confirm: 'Bestätigen',
    expand: 'Erweitern',
    prompt: 'Eingabeaufforderung',
    reset: 'Zurücksetzen',
    submit: 'Absenden',
  },
  'es-ES': {
    cancel: 'Cancelar',
    collapse: 'Colapsar',
    confirm: 'Confirmar',
    expand: 'Expandir',
    prompt: 'Indicación',
    reset: 'Restablecer',
    submit: 'Enviar',
  },
};

export const getMessages = (locale: Locale) => messages[locale] || messages['en-US'];
`
};

// Patch for @vben/constants SUPPORT_LANGUAGES
const supportLanguagesPatch = {
  targetFile: 'node_modules/@vben/constants/src/core.ts',
  content: `/**
 * @zh_CN 登录页面 url 地址
 */
export const LOGIN_PATH = '/auth/login';

export interface LanguageOption {
  label: string;
  value: 'en-US' | 'zh-CN' | 'ja-JP' | 'es-ES';
}

/**
 * Supported languages
 */
export const SUPPORT_LANGUAGES: LanguageOption[] = [
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
`
};

// Patch for @vben/locales typing
const typingPatch = {
  targetFile: 'node_modules/@vben/locales/src/typing.ts',
  content: `export type SupportedLanguagesType = 'en-US' | 'zh-CN' | 'ja-JP' | 'es-ES';

export type ImportLocaleFn = () => Promise<{ default: Record<string, string> }>;

export type LoadMessageFn = (
  lang: SupportedLanguagesType,
) => Promise<Record<string, string> | undefined>;

export interface LocaleSetupOptions {
  /**
   * Default language
   * @default zh-CN
   */
  defaultLocale?: SupportedLanguagesType;
  /**
   * Load message function
   * @param lang
   * @returns
   */
  loadMessages?: LoadMessageFn;
  /**
   * Whether to warn when the key is not found
   */
  missingWarn?: boolean;
}
`
};

function applyPatch(name, patch) {
  const targetPath = path.join(rootDir, patch.targetFile);
  
  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Patch "${name}" failed: Target file not found: ${patch.targetFile}`);
    return false;
  }
  
  try {
    fs.writeFileSync(targetPath, patch.content, 'utf-8');
    console.log(`✅ Patch "${name}" applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Patch "${name}" failed: ${error.message}`);
    return false;
  }
}

console.log('Applying patches...\n');

const results = [
  applyPatch('@vben/locales use-simple-locale', useSimpleLocalePatch),
  applyPatch('@vben/locales typing', typingPatch),
  applyPatch('@vben/constants SUPPORT_LANGUAGES', supportLanguagesPatch)
];

const successCount = results.filter(r => r).length;
const totalCount = results.length;

console.log(`\n${successCount}/${totalCount} patches applied successfully`);

if (successCount < totalCount) {
  process.exit(1);
}
