import {
  CATALOGS,
  detectBrowserLocale,
  LOCALES,
  readStoredLocale,
  storeLocale,
  translate,
} from './i18n';

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Keys whose copy is the same in both languages on purpose.
const SAME_IN_BOTH = new Set(['app.name']);

describe('message catalogs', () => {
  const enKeys = Object.keys(CATALOGS.en).sort();

  test.each(LOCALES)('%s has exactly the English keys', (locale) => {
    expect(Object.keys(CATALOGS[locale]).sort()).toEqual(enKeys);
  });

  test.each(LOCALES)('%s has no empty messages', (locale) => {
    for (const [key, message] of Object.entries(CATALOGS[locale])) {
      expect(message.trim(), key).not.toBe('');
    }
  });

  test('every Japanese message uses the same placeholders as the English one', () => {
    for (const key of enKeys) {
      const k = key as keyof typeof CATALOGS.en;
      expect(placeholders(CATALOGS.ja[k]), key).toEqual(
        placeholders(CATALOGS.en[k]),
      );
    }
  });

  test('Japanese copy is translated, not copied from English', () => {
    const untranslated = enKeys.filter((key) => {
      const k = key as keyof typeof CATALOGS.en;
      return !SAME_IN_BOTH.has(key) && CATALOGS.ja[k] === CATALOGS.en[k];
    });
    expect(untranslated).toEqual([]);
  });
});

describe('translate', () => {
  test('looks the key up in the given locale', () => {
    expect(translate('en', 'nav.history')).toBe('History');
    expect(translate('ja', 'nav.history')).toBe('履歴');
  });

  test('fills placeholders', () => {
    expect(translate('en', 'profile.signedInAs', { name: 'Aiko' })).toBe(
      'Signed in as Aiko',
    );
    expect(translate('ja', 'profile.signedInAs', { name: 'Aiko' })).toBe(
      'Aiko でログイン中',
    );
  });

  test('leaves a placeholder without a value as written', () => {
    expect(translate('en', 'profile.signedInAs', {})).toBe(
      'Signed in as {name}',
    );
  });
});

describe('detectBrowserLocale', () => {
  test.each([
    [['ja-JP', 'en-US'], 'ja'],
    [['en-GB'], 'en'],
    [['fr-FR', 'ja'], 'ja'],
    [['fr-FR', 'de'], 'en'],
    [[], 'en'],
  ])('%j → %s', (languages, expected) => {
    expect(detectBrowserLocale(languages)).toBe(expected);
  });
});

describe('stored locale', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  test('round-trips a supported locale', () => {
    storeLocale('ja');
    expect(readStoredLocale()).toBe('ja');
  });

  test('ignores an unsupported stored value', () => {
    localStorage.setItem('tomo.locale', 'fr');
    expect(readStoredLocale()).toBeNull();
  });

  test('survives storage that throws (Safari private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeLocale('ja')).not.toThrow();
    expect(readStoredLocale()).toBeNull();
  });
});
