import { useI18n } from '../i18n/i18n-context';

// Placeholder: the day list and editor (Step 8) replace this.
export default function History() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('history.title')}</h1>
      <p className="text-muted">{t('common.comingSoon')}</p>
    </section>
  );
}
