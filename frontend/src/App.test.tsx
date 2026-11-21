import { screen, waitFor } from '@testing-library/react';

import App from './App';
import {
  apiResponse,
  PROFILE,
  renderWithProviders,
  signIn,
} from './test/render';

const getMyProfile = vi.hoisted(() => vi.fn());
vi.mock('./lib/generated/users/users', () => ({
  userControllerGetMyProfile: getMyProfile,
  userControllerUpdateUser: vi.fn(),
}));

describe('App routes', () => {
  beforeEach(() => {
    localStorage.clear();
    getMyProfile.mockResolvedValue(apiResponse(PROFILE));
  });

  test('sends a signed-out visitor to sign-in', () => {
    renderWithProviders(<App />, { route: '/history' });
    expect(
      screen.getByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test.each([
    ['/', 'Log a workout'],
    ['/history', 'History'],
    ['/profile', 'Profile'],
  ])('signed in, %s shows "%s" inside the tab shell', async (route, title) => {
    signIn();
    renderWithProviders(<App />, { route });
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(getMyProfile).toHaveBeenCalled());
  });

  test('unknown paths show the 404 page', () => {
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });
});
