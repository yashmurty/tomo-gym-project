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

  'common.loading': 'Loading…',

  'form.email': 'Email',
  'form.password': 'Password',
  'form.required': 'Required',
  'form.emailInvalid': 'Enter a valid email address',
  'form.passwordLength': 'At least 6 characters',
  'form.tooLong': 'Too long',

  'errors.network': "Can't reach the server. Check your connection.",
  'errors.server': 'Something went wrong on our side. Try again.',
  'errors.generic': 'Something went wrong. Try again.',
  'errors.rateLimited': 'Too many requests. Wait a minute and try again.',
  'errors.dailyBudget': "You've reached today's limit. Back tomorrow.",
  'errors.monthlyBudget': "You've reached this month's limit.",
  'errors.servicePaused': 'Logging is paused for now. Try again later.',

  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.invalid': 'Wrong email or password.',
  'login.sessionExpired': 'Your session expired. Please sign in again.',
  'login.noAccount': 'New to Tomo Gym?',
  'login.registerLink': 'Create an account',

  'register.title': 'Create your account',
  'register.name': 'Name',
  'register.weightUnit': 'Weight unit',
  'register.weight': 'Body weight (optional)',
  'register.weightHint':
    'Only used to estimate calories. Never shown to anyone else.',
  'register.weightInvalid': 'Enter a number',
  'register.age': "I'm 16 or older",
  'register.ageRequired': 'You must be 16 or older to use Tomo Gym.',
  'register.timezone': 'Time zone: {timezone} (from this device)',
  'register.submit': 'Create account',
  'register.submitting': 'Creating account…',
  'register.emailTaken': 'That email is already registered. Try signing in.',
  'register.closed': 'Sign-up is closed for now.',
  'register.invalid':
    "Some details weren't accepted. Check them and try again.",
  'register.haveAccount': 'Already have an account?',
  'register.loginLink': 'Sign in',

  'chat.inputLabel': 'Workout',
  'chat.placeholder': '3x10 @ 60kg squat',
  'chat.send': 'Send',
  'chat.emptyTitle': 'What did you just do?',
  'chat.emptyHint':
    'Type it the way you would in your notes, like "2x10 @ 47kg lat pulldown" or "10 min walk speed 6 incline 2".',
  'chat.thinking': 'Logging…',
  'chat.failed': 'Something went wrong; nothing more was saved.',
  'chat.interrupted': 'The connection dropped before the reply finished.',
  'chat.retry': 'Retry',
  'chat.stillWorking': 'Still being processed.',
  'chat.undo': 'Undo',
  'chat.undoing': 'Undoing…',
  'chat.undone': 'Undone',
  'chat.undoSkipped': 'Undone, except {n} edited since',
  'chat.undoFailed': "Couldn't undo. Try again.",
  'chat.nothingToUndo': 'Nothing left to undo',
  'chat.loadEarlier': 'Show earlier messages',
  'chat.loadFailed': "Couldn't load your messages.",

  'entry.updated': 'Updated',
  'entry.day': 'Day {n}',
  'entry.minutes': '{n} min',
  'entry.distance': '{n} km',
  'entry.speed': '{n} km/h',
  'entry.incline': 'incline {n}%',
  'entry.kcal': '{n} kcal',
  'entry.kcalRough': '≈ {n} kcal',

  'tool.moved': 'Moved to {date}',
  'tool.noteSaved': 'Note saved for {date}',
  'tool.deleted': 'Deleted an entry',

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
