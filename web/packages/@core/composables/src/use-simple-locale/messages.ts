export type Locale = 'en-US' | 'zh-CN' | 'ja-JP' | 'de-DE' | 'es-ES';

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
