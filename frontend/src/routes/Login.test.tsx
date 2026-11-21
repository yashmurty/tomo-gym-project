import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { makeJwt, renderWithProviders } from '../test/render';
import Login from './Login';

const login = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/auth/auth', () => ({
  authControllerLogin: login,
  authControllerRegisterLocal: vi.fn(),
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn().mockReturnValue(new Promise(() => {})),
  userControllerUpdateUser: vi.fn(),
}));

function tokens() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    data: {
      data: {
        accessToken: makeJwt({
          sub: 1,
          email: 'aiko@example.com',
          roles: ['USER'],
          exp,
        }),
        refreshToken: 'rt',
      },
    },
  };
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/history" element={<p>history page</p>} />
      <Route path="/" element={<p>log page</p>} />
    </Routes>,
    { route },
  );
}

async function submit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    login.mockReset();
  });

  test('signs in with a normalised email and goes where the visitor was headed', async () => {
    login.mockResolvedValue(tokens());
    renderAt('/login?from=%2Fhistory');

    await submit(' Aiko@Example.com ', 'secret-pass');

    expect(login).toHaveBeenCalledWith({
      email: 'aiko@example.com',
      password: 'secret-pass',
    });
    expect(await screen.findByText('history page')).toBeVisible();
  });

  test('keeps the destination on the link to sign up, so an invite survives', () => {
    renderAt('/login?from=%2Fjoin%2Fabc');
    expect(
      screen.getByRole('link', { name: 'Create an account' }),
    ).toHaveAttribute('href', '/register?from=%2Fjoin%2Fabc');
  });

  test('never redirects off-site', async () => {
    login.mockResolvedValue(tokens());
    renderAt('/login?from=%2F%2Fevil.example');
    await submit('aiko@example.com', 'secret-pass');
    expect(await screen.findByText('log page')).toBeVisible();
  });

  test('says when the email or password is wrong', async () => {
    login.mockRejectedValue(new ApiError('Unauthorized', 401));
    renderAt('/login');
    await submit('aiko@example.com', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong email or password.',
    );
  });

  test('says when the server is unreachable', async () => {
    login.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt('/login');
    await submit('aiko@example.com', 'secret-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Can't reach the server.",
    );
  });

  test('checks the email before calling the server', async () => {
    renderAt('/login');
    await submit('not-an-email', 'secret-pass');
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeVisible();
    expect(login).not.toHaveBeenCalled();
  });

  test('explains an expired session', () => {
    renderAt('/login?session=expired');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your session expired.',
    );
  });

  test('speaks Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    login.mockRejectedValue(new ApiError('Unauthorized', 401));
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'a@b.jp');
    await userEvent.type(screen.getByLabelText('パスワード'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'メールアドレスまたはパスワードが違います。',
    );
  });
});
