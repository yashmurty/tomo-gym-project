import { en, type MessageKey } from './en';
import { ja } from './ja';

export type { MessageKey };

export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language's name in that language: the toggle's labels, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
};

export const CATALOGS: Record<Locale, Record<MessageKey, string>> = { en, ja };

export type TranslateParams = Record<string, string | number>;

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Fills `{name}` placeholders; unknown placeholders are left as written. */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  const template = CATALOGS[locale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** The first of the browser's preferred languages that we support, else English. */
export function detectBrowserLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return 'en';
}

// The language last used on this device (an explicit choice, or the signed-in
// user's saved locale), so signed-out screens match it. localStorage can throw
// (Safari private mode, blocked storage), so failures fall back silently.
const STORAGE_KEY = 'tomo.locale';

export function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not remembered on this device; nothing else depends on it.
  }
}
