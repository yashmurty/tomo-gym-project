import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../lib/auth-context';
import {
  detectBrowserLocale,
  readStoredLocale,
  storeLocale,
  translate,
  type Locale,
  type MessageKey,
  type TranslateParams,
} from './i18n';

type I18nContextValue = {
  locale: Locale;
  /** Switches the UI now; when signed in, also saves it as `User.locale`. */
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: MessageKey, params?: TranslateParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

// Which language to show:
//   signed in  → the user's saved locale (constitution rule 23)
//   signed out → the last language used on this device, else the browser's
// A change while signed in shows at once and reverts if the save fails.
export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [deviceLocale, setDeviceLocale] = useState<Locale>(
    () => readStoredLocale() ?? detectBrowserLocale(navigator.languages),
  );
  const [pending, setPending] = useState<Locale | null>(null);

  // Adopt the user's saved locale as this device's language when it loads or
  // changes, so the screen doesn't switch back after logout. (Set during
  // render, not in an effect: https://react.dev/learn/you-might-not-need-an-effect)
  const profileLocale = profile?.locale ?? null;
  const [seenProfileLocale, setSeenProfileLocale] = useState(profileLocale);
  if (profileLocale !== seenProfileLocale) {
    setSeenProfileLocale(profileLocale);
    if (profileLocale) setDeviceLocale(profileLocale);
  }

  const locale = pending ?? profileLocale ?? deviceLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (profileLocale) storeLocale(profileLocale);
  }, [profileLocale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      if (!profile) {
        setDeviceLocale(next);
        storeLocale(next);
        return;
      }
      if (next === profile.locale) return;
      setPending(next);
      try {
        await updateProfile({ locale: next });
      } finally {
        setPending(null);
      }
    },
    [profile, updateProfile],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
