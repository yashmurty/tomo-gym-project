import { useState } from 'react';

import { useI18n } from '../i18n/i18n-context';
import { LOCALES, LOCALE_NAMES, type Locale } from '../i18n/i18n';

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const [failed, setFailed] = useState(false);

  async function choose(next: Locale) {
    setFailed(false);
    try {
      await setLocale(next);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="group"
        aria-label={t('language.label')}
        className="border-border flex overflow-hidden rounded-full border text-sm"
      >
        {LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            onClick={() => void choose(option)}
            aria-pressed={locale === option}
            className={`min-h-11 cursor-pointer px-3 ${
              locale === option ? 'bg-foreground text-white' : 'text-muted'
            }`}
          >
            {LOCALE_NAMES[option]}
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t('language.saveFailed')}
        </p>
      )}
    </div>
  );
}
