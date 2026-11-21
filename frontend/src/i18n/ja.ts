import type { MessageKey } from './en';

// Japanese catalog. Typed against en.ts, so a missing or extra key fails the
// build; i18n.test.ts checks placeholders and untranslated copy.
export const ja: Record<MessageKey, string> = {
  'app.name': 'Tomo Gym',

  'nav.label': 'メイン',
  'nav.log': '記録',
  'nav.history': '履歴',
  'nav.profile': 'プロフィール',

  'language.label': '言語',
  'language.saveFailed': '言語を保存できませんでした。もう一度お試しください。',

  'common.comingSoon': '準備中です。',

  'login.title': 'ログイン',

  'log.title': 'トレーニングを記録',

  'history.title': '履歴',

  'profile.title': 'プロフィール',
  'profile.signedInAs': '{name} でログイン中',
  'profile.logout': 'ログアウト',

  'notFound.title': 'ページが見つかりません',
  'notFound.home': 'ホームに戻る',
};
