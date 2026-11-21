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

  'common.loading': '読み込み中…',

  'form.email': 'メールアドレス',
  'form.password': 'パスワード',
  'form.required': '入力してください',
  'form.emailInvalid': '有効なメールアドレスを入力してください',
  'form.passwordLength': '6文字以上で入力してください',
  'form.tooLong': '長すぎます',

  'errors.network': 'サーバーに接続できません。通信環境を確認してください。',
  'errors.server': 'サーバーでエラーが発生しました。もう一度お試しください。',
  'errors.generic': 'エラーが発生しました。もう一度お試しください。',
  'errors.rateLimited':
    'リクエストが多すぎます。少し待ってからもう一度お試しください。',
  'errors.dailyBudget': '本日の利用上限に達しました。また明日どうぞ。',
  'errors.monthlyBudget': '今月の利用上限に達しました。',
  'errors.servicePaused':
    '記録機能を一時停止しています。しばらくしてからお試しください。',

  'login.submit': 'ログイン',
  'login.submitting': 'ログイン中…',
  'login.invalid': 'メールアドレスまたはパスワードが違います。',
  'login.sessionExpired':
    'セッションの有効期限が切れました。もう一度ログインしてください。',
  'login.noAccount': 'Tomo Gym は初めてですか？',
  'login.registerLink': 'アカウントを作成',

  'register.title': 'アカウント作成',
  'register.name': '名前',
  'register.weightUnit': '重さの単位',
  'register.weight': '体重（任意）',
  'register.weightHint':
    'カロリーの推定にのみ使います。他の人に表示されることはありません。',
  'register.weightInvalid': '数値を入力してください',
  'register.age': '16歳以上です',
  'register.ageRequired': 'Tomo Gym は16歳以上の方のみご利用いただけます。',
  'register.timezone': 'タイムゾーン: {timezone}（この端末の設定）',
  'register.submit': 'アカウントを作成',
  'register.submitting': '作成中…',
  'register.emailTaken':
    'このメールアドレスはすでに登録されています。ログインしてください。',
  'register.closed': '現在、新規登録を受け付けていません。',
  'register.invalid': '入力内容を確認して、もう一度お試しください。',
  'register.haveAccount': 'すでにアカウントをお持ちですか？',
  'register.loginLink': 'ログイン',

  'chat.inputLabel': 'トレーニング内容',
  'chat.placeholder': 'スクワット 3x10 60kg',
  'chat.send': '送信',
  'chat.emptyTitle': '今やったトレーニングは？',
  'chat.emptyHint':
    'メモに書くように入力してください。例:「ラットプルダウン 2x10 47kg」「ウォーキング 10分 速度6 傾斜2」',
  'chat.thinking': '記録中…',
  'chat.failed': 'エラーが発生しました。これ以上は保存されていません。',
  'chat.interrupted': '返信の途中で接続が切れました。',
  'chat.retry': '再試行',
  'chat.stillWorking': '処理中です。',
  'chat.undo': '取り消す',
  'chat.undoing': '取り消し中…',
  'chat.undone': '取り消しました',
  'chat.undoSkipped': '取り消しました（その後編集された{n}件を除く）',
  'chat.undoFailed': '取り消せませんでした。もう一度お試しください。',
  'chat.nothingToUndo': '取り消すものはありません',
  'chat.loadEarlier': '以前のメッセージを表示',
  'chat.loadFailed': 'メッセージを読み込めませんでした。',

  'entry.updated': '更新',
  'entry.day': '{n}日目',
  'entry.minutes': '{n}分',
  'entry.distance': '{n}km',
  'entry.speed': '時速{n}km',
  'entry.incline': '傾斜{n}%',
  'entry.kcal': '{n}kcal',
  'entry.kcalRough': '約{n}kcal',

  'tool.moved': '{date}に移動しました',
  'tool.noteSaved': '{date}のメモを保存しました',
  'tool.deleted': '記録を削除しました',

  'login.title': 'ログイン',

  'log.title': 'トレーニングを記録',

  'history.title': '履歴',

  'profile.title': 'プロフィール',
  'profile.signedInAs': '{name} でログイン中',
  'profile.logout': 'ログアウト',

  'notFound.title': 'ページが見つかりません',
  'notFound.home': 'ホームに戻る',
};
