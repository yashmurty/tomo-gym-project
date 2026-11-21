import type { ReactNode } from 'react';

import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../i18n/i18n-context';
import { useAuth } from '../lib/auth-context';
import AccessTokens from '../profile/AccessTokens';
import TimezoneSetting from '../profile/TimezoneSetting';
import WeightSettings from '../profile/WeightSettings';

// The user's own settings. Everything here is self-only (rule 16).
export default function Profile() {
  const { t } = useI18n();
  const { profile, logout } = useAuth();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
        {profile && (
          <>
            <p className="text-muted">
              {t('profile.signedInAs', { name: profile.name })}
            </p>
            <p className="text-muted text-sm break-all">{profile.email}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium">{t('language.label')}</span>
        <LanguageToggle />
      </div>

      {profile && (
        <>
          <Section title={t('profile.body')}>
            <WeightSettings profile={profile} />
          </Section>
          <Section title={t('profile.timezone')}>
            <TimezoneSetting profile={profile} />
          </Section>
          <Section title={t('tokens.title')}>
            <AccessTokens />
          </Section>
        </>
      )}

      <button
        type="button"
        onClick={logout}
        className="border-border min-h-11 cursor-pointer self-start rounded-lg border px-4"
      >
        {t('profile.logout')}
      </button>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-3 border-t pt-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
