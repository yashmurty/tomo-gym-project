import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '../test/render';
import AppLayout from './AppLayout';

vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn(),
  userControllerUpdateUser: vi.fn(),
}));

function renderShell(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="*" element={<p>page</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('AppLayout', () => {
  beforeEach(() => localStorage.clear());

  test('has a bottom tab bar with Log, History and Profile', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Log', '/'],
      ['History', '/history'],
      ['Profile', '/profile'],
    ]);
    expect(screen.getByText('page')).toBeInTheDocument();
  });

  test('marks the current tab', () => {
    renderShell('/history');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Log' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  test('labels the tabs in Japanese', () => {
    localStorage.setItem('tomo.locale', 'ja');
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'メイン' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['記録', '履歴', 'プロフィール']);
  });
});
