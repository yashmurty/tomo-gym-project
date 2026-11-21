import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiResponse, PROFILE, signIn } from '../test/render';
import { AuthProvider, useAuth } from './auth-context';

const getMyProfileMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());

vi.mock('./generated/users/users', () => ({
  userControllerGetMyProfile: getMyProfileMock,
  userControllerUpdateUser: updateUserMock,
}));

function makeJwt(payload: object): string {
  return `header.${btoa(JSON.stringify(payload))}.sig`;
}

function UserDisplay() {
  const { user } = useAuth();
  return <div data-testid="user">{user ? user.email : 'no user'}</div>;
}

describe('AuthProvider initialization from localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    getMyProfileMock.mockReset();
    // Default: succeed so the mount-effect resolves cleanly. Individual
    // tests can override before render if they need to.
    getMyProfileMock.mockResolvedValue(
      apiResponse({ ...PROFILE, name: 'Alice', email: 'alice@example.com' }),
    );
  });

  test('starts with null user when no token is stored', () => {
    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );
    expect(screen.getByTestId('user')).toHaveTextContent('no user');
  });

  test('hydrates user from a valid token', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({
      sub: 1,
      email: 'alice@example.com',
      roles: ['USER'],
      iat: 0,
      exp: future,
    });
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'rt');

    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );

    expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com');
  });

  test('treats an expired token as logged out and clears tokens', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = makeJwt({
      sub: 1,
      email: 'alice@example.com',
      roles: ['USER'],
      iat: 0,
      exp: past,
    });
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'rt');

    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );

    expect(screen.getByTestId('user')).toHaveTextContent('no user');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

function ProfileDisplay() {
  const { profile, updateProfile } = useAuth();
  return (
    <>
      <div data-testid="weight">
        {profile ? String(profile.weightKg) : 'none'}
      </div>
      <button type="button" onClick={() => void updateProfile({ weight: 65 })}>
        save
      </button>
    </>
  );
}

describe('AuthProvider profile', () => {
  beforeEach(() => {
    localStorage.clear();
    getMyProfileMock.mockReset();
    updateUserMock.mockReset();
  });

  test('loads the signed-in user from GET /users/me', async () => {
    signIn();
    getMyProfileMock.mockResolvedValue(apiResponse(PROFILE));
    render(
      <AuthProvider>
        <ProfileDisplay />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('weight')).toHaveTextContent('60'),
    );
  });

  test('updateProfile PATCHes the user and keeps the returned record', async () => {
    signIn();
    getMyProfileMock.mockResolvedValue(apiResponse(PROFILE));
    updateUserMock.mockResolvedValue(apiResponse({ ...PROFILE, weightKg: 65 }));
    render(
      <AuthProvider>
        <ProfileDisplay />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('weight')).toHaveTextContent('60'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updateUserMock).toHaveBeenCalledWith(PROFILE.id, { weight: 65 });
    expect(screen.getByTestId('weight')).toHaveTextContent('65');
  });
});
