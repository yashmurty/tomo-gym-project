import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  apiResponse,
  PROFILE,
  renderWithProviders,
  signIn,
} from '../test/render';
import Profile from './Profile';

const getMyProfile = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: getMyProfile,
  userControllerUpdateUser: vi.fn(),
}));

describe('Profile', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn();
    getMyProfile.mockResolvedValue(apiResponse(PROFILE));
  });

  test("shows who's signed in, with the language toggle", async () => {
    renderWithProviders(<Profile />);
    expect(await screen.findByText('Signed in as Aiko')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
  });

  test('log out clears the stored tokens', async () => {
    renderWithProviders(<Profile />);
    await screen.findByText('Signed in as Aiko');

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
