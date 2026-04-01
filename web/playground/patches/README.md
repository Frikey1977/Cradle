# Patches

This directory contains patches for node_modules packages.

## @vben/locales - use-simple-locale

**File:** `node_modules/@vben/locales/node_modules/@vben-core/composables/src/use-simple-locale/messages.ts`

**Problem:** The `useSimpleLocale` composable only supports 'en-US' and 'zh-CN' locales, but we added 'ja-JP', 'de-DE', and 'es-ES' locales. When using these locales, `getMessages()` returns `undefined`, causing `$t('cancel')` to throw "Cannot read properties of undefined (reading 'cancel')" error.

**Solution:** Added support for 'ja-JP', 'de-DE', and 'es-ES' locales in the messages object, and added fallback to 'en-US' if locale is not found.

**Changes:**
1. Extended `Locale` type to include 'ja-JP' | 'de-DE' | 'es-ES'
2. Added translation messages for ja-JP, de-DE, es-ES
3. Added fallback logic: `messages[locale] || messages['en-US']`

## @vben/constants - SUPPORT_LANGUAGES

**File:** `node_modules/@vben/constants/src/core.ts`

**Problem:** The `SUPPORT_LANGUAGES` constant only includes 'zh-CN' and 'en-US', but we want to support Japanese (ja-JP) as well.

**Solution:** Added 'ja-JP' to the `SUPPORT_LANGUAGES` array and updated the `LanguageOption` interface.

**Changes:**
1. Extended `LanguageOption` interface value type to include 'ja-JP'
2. Added Japanese language option to `SUPPORT_LANGUAGES` array

## How to apply

Run the following command after `npm install`:
```bash
node patches/apply-patches.js
```

Or manually copy the content from patch files to the target files.

## Automatic application

The `postinstall` script in `package.json` will automatically apply patches after `npm install`.
