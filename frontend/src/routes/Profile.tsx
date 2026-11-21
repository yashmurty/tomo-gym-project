import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../i18n/i18n-context';
import { useAuth } from '../lib/auth-context';

// Language and logout work now; the rest of the profile (timezone, body
// weight, units, MCP access tokens) arrives with the Step 8 screens.
export default function Profile() {
  const { t } = useI18n();
  const { profile, logout } = useAuth();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
        {profile && (
          <p className="text-muted">
            {t('profile.signedInAs', { name: profile.name })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium">{t('language.label')}</span>
        <LanguageToggle />
      </div>

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
