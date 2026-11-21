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

vi.mock('./lib/generated/chat/chat', () => ({
  chatControllerHistory: vi
    .fn()
    .mockResolvedValue({ data: { data: { turns: [], hasMore: false } } }),
  chatControllerUndo: vi.fn(),
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

  test('sign-up is public', () => {
    renderWithProviders(<App />, { route: '/register' });
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument();
  });

  test('a signed-in user visiting sign-in goes to the app', async () => {
    signIn();
    renderWithProviders(<App />, { route: '/login' });
    expect(
      screen.getByRole('heading', { name: 'Log a workout' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(getMyProfile).toHaveBeenCalled());
  });

  test('unknown paths show the 404 page', () => {
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });
});
