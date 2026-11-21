import { useI18n } from '../i18n/i18n-context';

// Placeholder: the chat logger (Step 8) replaces this.
export default function Log() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('log.title')}</h1>
      <p className="text-muted">{t('common.comingSoon')}</p>
    </section>
  );
}
