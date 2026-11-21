// English catalog: the source of truth for message keys. Every user-facing
// string in the app comes from here or ja.ts; never hardcode copy in a
// component (constitution rule 23). `{name}` placeholders are filled by t().
export const en = {
  'app.name': 'Tomo Gym',

  'nav.label': 'Main',
  'nav.log': 'Log',
  'nav.history': 'History',
  'nav.profile': 'Profile',

  'language.label': 'Language',
  'language.saveFailed': "Couldn't save your language. Try again.",

  'common.comingSoon': 'Coming soon.',

  'login.title': 'Sign in',

  'log.title': 'Log a workout',

  'history.title': 'History',

  'profile.title': 'Profile',
  'profile.signedInAs': 'Signed in as {name}',
  'profile.logout': 'Log out',

  'notFound.title': 'Page not found',
  'notFound.home': 'Go home',
} as const;

export type MessageKey = keyof typeof en;
