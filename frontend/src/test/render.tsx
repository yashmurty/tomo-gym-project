import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '../i18n/i18n-context';
import { AuthProvider } from '../lib/auth-context';
import type { UserOutput } from '../lib/generated/models';

/** Renders `ui` inside the app's providers, at `route`. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <I18nProvider>{ui}</I18nProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

export function makeJwt(payload: object): string {
  return `header.${btoa(JSON.stringify(payload))}.sig`;
}

/** Stores an unexpired access token so AuthProvider starts signed in. */
export function signIn(user: { id: number; email: string } = PROFILE): void {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  localStorage.setItem(
    'accessToken',
    makeJwt({ sub: user.id, email: user.email, roles: ['USER'], iat: 0, exp }),
  );
  localStorage.setItem('refreshToken', 'rt');
}

export const PROFILE: UserOutput = {
  id: 1,
  name: 'Aiko',
  email: 'aiko@example.com',
  roles: ['USER'],
  timezone: 'Asia/Tokyo',
  locale: 'en',
  weightKg: 60,
  weightUnit: 'kg',
  isAccountDisabled: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

/** The generated client's resolved value for an endpoint returning `data`. */
export function apiResponse<T>(data: T) {
  return { data: { data, meta: {} }, status: 200, headers: new Headers() };
}
