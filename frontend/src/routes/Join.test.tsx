import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { groupOutput } from '../test/fixtures';
import { apiResponse, renderWithProviders, signIn } from '../test/render';
import Join from './Join';

const preview = vi.hoisted(() => vi.fn());
const join = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/invites/invites', () => ({
  inviteControllerPreview: preview,
  inviteControllerJoin: join,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn().mockReturnValue(new Promise(() => {})),
  userControllerUpdateUser: vi.fn(),
}));

const TOKEN = 'abcdefghijklmnopqrstuv';
const PREVIEW = {
  groupId: 3,
  name: 'Morning Lifters',
  memberCount: 6,
  alreadyMember: false,
};

function renderJoin() {
  return renderWithProviders(
    <Routes>
      <Route path="/join/:token" element={<Join />} />
      <Route path="/groups/:id" element={<p>group page</p>} />
      <Route path="/groups" element={<p>groups page</p>} />
    </Routes>,
    { route: `/join/${TOKEN}` },
  );
}

describe('Join', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn();
    preview.mockReset();
    join.mockReset();
  });

  test('shows the group, joins it and opens it', async () => {
    preview.mockResolvedValue(apiResponse(PREVIEW));
    join.mockResolvedValue(apiResponse(groupOutput({ memberCount: 7 })));
    renderJoin();

    expect(
      await screen.findByRole('heading', { name: 'Join “Morning Lifters”?' }),
    ).toBeVisible();
    expect(screen.getByText('6 members')).toBeVisible();
    expect(preview).toHaveBeenCalledWith(TOKEN);

    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(join).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByText('group page')).toBeVisible();
  });

  test('offers to open the group when you are already in it', async () => {
    preview.mockResolvedValue(apiResponse({ ...PREVIEW, alreadyMember: true }));
    renderJoin();
    expect(
      await screen.findByText("You're already in “Morning Lifters”."),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open group' })).toHaveAttribute(
      'href',
      '/groups/3',
    );
    expect(
      screen.queryByRole('button', { name: 'Join' }),
    ).not.toBeInTheDocument();
  });

  test('says a dead link is not active, without naming any group', async () => {
    preview.mockRejectedValue(new ApiError('not active', 404));
    renderJoin();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This invite link isn't active. Ask for a new one.",
    );
    expect(
      screen.queryByRole('button', { name: 'Join' }),
    ).not.toBeInTheDocument();
  });

  test.each([
    ['group_full', 'This group is full.'],
    ['group_limit', "You're already in the most groups allowed."],
  ])('explains a 409 %s', async (code, message) => {
    preview.mockResolvedValue(apiResponse(PREVIEW));
    join.mockRejectedValue(new ApiError('limit', 409, code));
    renderJoin();
    await userEvent.click(await screen.findByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
  });

  test('switches to "not active" if the link died after the page loaded', async () => {
    preview.mockResolvedValue(apiResponse(PREVIEW));
    join.mockRejectedValue(new ApiError('not active', 404));
    renderJoin();
    await userEvent.click(await screen.findByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This invite link isn't active.",
    );
  });

  test('asks in Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    preview.mockResolvedValue(apiResponse(PREVIEW));
    renderJoin();
    expect(
      await screen.findByRole('heading', {
        name: '「Morning Lifters」に参加しますか？',
      }),
    ).toBeVisible();
    expect(screen.getByText('メンバー6人')).toBeVisible();
    expect(screen.getByRole('button', { name: '参加する' })).toBeVisible();
  });
});
