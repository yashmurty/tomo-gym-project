import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { makeJwt, renderWithProviders } from '../test/render';
import Register from './Register';

const registerLocal = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/auth/auth', () => ({
  authControllerLogin: login,
  authControllerRegisterLocal: registerLocal,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn().mockReturnValue(new Promise(() => {})),
  userControllerUpdateUser: vi.fn(),
}));

const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<p>log page</p>} />
    </Routes>,
    { route: '/register' },
  );
}

async function fillIn({ age = true, weight = '' } = {}) {
  await userEvent.type(screen.getByLabelText('Name'), 'Ken');
  await userEvent.type(screen.getByLabelText('Email'), 'Ken@Example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
  if (weight) {
    await userEvent.click(screen.getByLabelText('lb'));
    await userEvent.type(
      screen.getByLabelText('Body weight (optional)'),
      weight,
    );
  }
  if (age) await userEvent.click(screen.getByLabelText("I'm 16 or older"));
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('Register', () => {
  beforeEach(() => {
    localStorage.clear();
    registerLocal.mockReset();
    login.mockReset();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    login.mockResolvedValue({
      data: {
        data: {
          accessToken: makeJwt({
            sub: 2,
            email: 'ken@example.com',
            roles: ['USER'],
            exp,
          }),
          refreshToken: 'rt',
        },
      },
    });
  });

  test("sends the device's time zone, the current language and the age confirmation, then signs in", async () => {
    registerLocal.mockResolvedValue({ data: {} });
    renderRegister();
    expect(
      screen.getByText(`Time zone: ${DEVICE_TZ} (from this device)`),
    ).toBeVisible();

    await fillIn({ weight: '160' });

    expect(registerLocal).toHaveBeenCalledWith({
      name: 'Ken',
      email: 'ken@example.com',
      password: 'secret-pass',
      timezone: DEVICE_TZ,
      locale: 'en',
      ageConfirmed: true,
      weightUnit: 'lb',
      weight: 160,
    });
    expect(await screen.findByText('log page')).toBeVisible();
  });

  test('leaves the body weight out when it is blank', async () => {
    registerLocal.mockResolvedValue({ data: {} });
    renderRegister();
    await fillIn();
    expect(registerLocal.mock.calls[0][0]).not.toHaveProperty('weight');
    expect(registerLocal.mock.calls[0][0]).toMatchObject({ weightUnit: 'kg' });
  });

  test('goes back to the invite it came from after signing up', async () => {
    registerLocal.mockResolvedValue({ data: {} });
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/join/:token" element={<p>join page</p>} />
      </Routes>,
      { route: '/register?from=%2Fjoin%2Fabc' },
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?from=%2Fjoin%2Fabc',
    );

    await fillIn();

    expect(await screen.findByText('join page')).toBeVisible();
  });

  test('requires the age confirmation', async () => {
    renderRegister();
    await fillIn({ age: false });
    expect(
      await screen.findByText('You must be 16 or older to use Tomo Gym.'),
    ).toBeVisible();
    expect(registerLocal).not.toHaveBeenCalled();
  });

  test.each([
    [409, 'That email is already registered.'],
    [403, 'Sign-up is closed for now.'],
    [429, 'Too many requests.'],
  ])('explains a %i', async (status, message) => {
    registerLocal.mockRejectedValue(new ApiError('nope', status));
    renderRegister();
    await fillIn();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  test('signs up in Japanese with locale ja', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    registerLocal.mockResolvedValue({ data: {} });
    renderRegister();
    await userEvent.type(screen.getByLabelText('名前'), 'ケン');
    await userEvent.type(
      screen.getByLabelText('メールアドレス'),
      'ken@example.jp',
    );
    await userEvent.type(screen.getByLabelText('パスワード'), 'secret-pass');
    await userEvent.click(screen.getByLabelText('16歳以上です'));
    await userEvent.click(
      screen.getByRole('button', { name: 'アカウントを作成' }),
    );
    expect(registerLocal.mock.calls[0][0]).toMatchObject({ locale: 'ja' });
  });
});
