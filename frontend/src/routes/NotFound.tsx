import { Link } from 'react-router-dom';

import { useI18n } from '../i18n/i18n-context';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-5xl font-medium">404</h1>
      <p className="text-muted">{t('notFound.title')}</p>
      <Link
        to="/"
        className="text-accent inline-flex min-h-11 items-center px-2"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}
