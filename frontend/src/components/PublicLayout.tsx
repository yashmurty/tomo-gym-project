import { Link, Outlet } from 'react-router-dom';

import { useI18n } from '../i18n/i18n-context';
import LanguageToggle from './LanguageToggle';

// Signed-out screens (sign-in, 404): app name and the language toggle.
export default function PublicLayout() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="text-lg font-semibold">
            {t('app.name')}
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  );
}
