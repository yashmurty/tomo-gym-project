import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/i18n';
import { CalendarIcon, ChatIcon, GroupIcon, UserIcon } from './icons';

const TABS: {
  to: string;
  label: MessageKey;
  Icon: typeof ChatIcon;
}[] = [
  { to: '/', label: 'nav.log', Icon: ChatIcon },
  { to: '/history', label: 'nav.history', Icon: CalendarIcon },
  { to: '/groups', label: 'nav.groups', Icon: GroupIcon },
  { to: '/profile', label: 'nav.profile', Icon: UserIcon },
];

// The signed-in shell: a slim header, the page, and a bottom tab bar within
// thumb reach. Safe-area insets keep both bars clear of the notch and the
// home indicator (index.html sets viewport-fit=cover).
export default function AppLayout() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-background sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 max-w-[640px] items-center px-4">
          <span className="text-lg font-semibold">{t('app.name')}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.label')}
        className="border-border bg-background fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-[640px]">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                // Log is "/" exactly; History stays lit on /history/<day>
                // and Groups on /groups/<id>.
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    isActive ? 'text-accent font-medium' : 'text-muted'
                  }`
                }
              >
                <Icon />
                <span>{t(label)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
