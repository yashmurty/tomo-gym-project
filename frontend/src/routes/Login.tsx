import { useI18n } from '../i18n/i18n-context';

// Placeholder: the sign-in and sign-up forms arrive with the Step 8 screens.
export default function Login() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
      <p className="text-muted">{t('common.comingSoon')}</p>
    </section>
  );
}
