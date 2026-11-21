import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError } from '../lib/api-error';
import { mcpServerUrl } from '../lib/config';
import {
  apiResponse,
  PROFILE,
  renderWithProviders,
  signIn,
} from '../test/render';
import Profile from './Profile';

const getMyProfile = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: getMyProfile,
  userControllerUpdateUser: updateUser,
}));
const listTokens = vi.hoisted(() => vi.fn());
const createToken = vi.hoisted(() => vi.fn());
const revokeToken = vi.hoisted(() => vi.fn());
vi.mock(
  '../lib/generated/personal-access-tokens/personal-access-tokens',
  () => ({
    accessTokenControllerList: listTokens,
    accessTokenControllerCreate: createToken,
    accessTokenControllerRevoke: revokeToken,
  }),
);

const TOKEN = {
  id: 4,
  name: 'Claude Code',
  tokenPrefix: 'tomo_pat_ab12',
  lastUsedAt: null,
  createdAt: '2026-11-19T03:00:00.000Z',
};

async function renderProfile() {
  renderWithProviders(<Profile />);
  await screen.findByText('Signed in as Aiko');
}

describe('Profile', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn();
    [getMyProfile, updateUser, listTokens, createToken, revokeToken].forEach(
      (m) => m.mockReset(),
    );
    getMyProfile.mockResolvedValue(apiResponse(PROFILE));
    listTokens.mockResolvedValue(apiResponse([]));
  });

  test("shows who's signed in", async () => {
    await renderProfile();
    expect(screen.getByText('aiko@example.com')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Language' })).toBeVisible();
  });

  test('switching the unit saves it; the weight then shows in the new unit', async () => {
    updateUser.mockResolvedValue(
      apiResponse({ ...PROFILE, weightUnit: 'lb', weight: 132.3 }),
    );
    await renderProfile();
    expect(screen.getByRole('textbox', { name: /Body weight/ })).toHaveValue(
      '60',
    );

    await userEvent.click(screen.getByRole('button', { name: 'lb' }));

    expect(updateUser).toHaveBeenCalledWith(PROFILE.id, { weightUnit: 'lb' });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Body weight/ })).toHaveValue(
        '132.3',
      ),
    );
  });

  test('saves a body weight, and clears it when left blank', async () => {
    updateUser.mockResolvedValue(apiResponse({ ...PROFILE, weight: 61 }));
    await renderProfile();
    const box = screen.getByRole('textbox', { name: /Body weight/ });

    await userEvent.clear(box);
    await userEvent.type(box, '61');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateUser).toHaveBeenLastCalledWith(PROFILE.id, { weight: 61 });

    updateUser.mockResolvedValue(apiResponse({ ...PROFILE, weight: null }));
    await userEvent.clear(screen.getByRole('textbox', { name: /Body weight/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateUser).toHaveBeenLastCalledWith(PROFILE.id, { weight: null });
  });

  test('explains a body weight the server refuses', async () => {
    updateUser.mockRejectedValue(new ApiError('weight must be…', 400));
    await renderProfile();
    const box = screen.getByRole('textbox', { name: /Body weight/ });
    await userEvent.clear(box);
    await userEvent.type(box, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a realistic body weight',
    );
  });

  test('changes the time zone, and offers the device’s when they differ', async () => {
    updateUser.mockResolvedValue(
      apiResponse({ ...PROFILE, timezone: 'Europe/London' }),
    );
    await renderProfile();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Time zone' }),
      'Europe/London',
    );
    expect(updateUser).toHaveBeenCalledWith(PROFILE.id, {
      timezone: 'Europe/London',
    });

    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device !== 'Europe/London') {
      await userEvent.click(
        await screen.findByRole('button', {
          name: `Use this device's (${device})`,
        }),
      );
      expect(updateUser).toHaveBeenLastCalledWith(PROFILE.id, {
        timezone: device,
      });
    }
  });

  test('keeps a saved time zone the browser lists under another name', async () => {
    // ICU lists India as Asia/Calcutta; the server keeps what was sent.
    expect(Intl.supportedValuesOf('timeZone')).not.toContain('Asia/Kolkata');
    getMyProfile.mockResolvedValue(
      apiResponse({ ...PROFILE, timezone: 'Asia/Kolkata' }),
    );
    await renderProfile();
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveValue(
      'Asia/Kolkata',
    );
  });

  describe('access tokens', () => {
    test('shows the MCP server URL and existing tokens (prefix only)', async () => {
      listTokens.mockResolvedValue(apiResponse([TOKEN]));
      await renderProfile();
      expect(screen.getByRole('textbox', { name: 'Server URL' })).toHaveValue(
        mcpServerUrl(),
      );
      const item = (await screen.findByText('Claude Code')).closest('li')!;
      expect(within(item).getByText(/tomo_pat_ab12…/)).toBeVisible();
      expect(within(item).getByText(/Never used/)).toBeVisible();
    });

    test('creates a token and shows it once, with an example command', async () => {
      createToken.mockResolvedValue(
        apiResponse({ ...TOKEN, token: 'tomo_pat_ab12secret' }),
      );
      await renderProfile();
      await userEvent.type(screen.getByLabelText('Token name'), 'Claude Code');
      await userEvent.click(
        screen.getByRole('button', { name: 'Create token' }),
      );

      expect(createToken).toHaveBeenCalledWith({ name: 'Claude Code' });
      expect(
        await screen.findByRole('textbox', { name: 'Your new token' }),
      ).toHaveValue('tomo_pat_ab12secret');
      expect(
        screen.getByText(/Authorization: Bearer tomo_pat_ab12secret/),
      ).toBeVisible();
      expect(listTokens).toHaveBeenCalledTimes(2);
    });

    test('needs a name', async () => {
      await renderProfile();
      await userEvent.click(
        screen.getByRole('button', { name: 'Create token' }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Required');
      expect(createToken).not.toHaveBeenCalled();
    });

    test('revokes a token after confirming', async () => {
      listTokens.mockResolvedValueOnce(apiResponse([TOKEN]));
      revokeToken.mockResolvedValue({ data: undefined, status: 204 });
      await renderProfile();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Revoke' }),
      );
      expect(
        screen.getByText('Revoke “Claude Code”? Apps using it stop working.'),
      ).toBeVisible();

      await userEvent.click(
        screen.getAllByRole('button', { name: 'Revoke' })[0],
      );

      expect(revokeToken).toHaveBeenCalledWith(4);
      expect(await screen.findByText('No tokens yet.')).toBeVisible();
    });
  });

  test('log out clears the stored tokens', async () => {
    await renderProfile();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
