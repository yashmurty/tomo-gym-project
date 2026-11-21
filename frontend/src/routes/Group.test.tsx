import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { groupOutput } from '../test/fixtures';
import {
  apiResponse,
  PROFILE,
  renderWithProviders,
  signIn,
} from '../test/render';
import GroupPage from './Group';

const getGroup = vi.hoisted(() => vi.fn());
const listMembers = vi.hoisted(() => vi.fn());
const renameGroup = vi.hoisted(() => vi.fn());
const deleteGroup = vi.hoisted(() => vi.fn());
const resetInvite = vi.hoisted(() => vi.fn());
const setInvite = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/groups/groups', () => ({
  groupControllerGet: getGroup,
  groupControllerMembers: listMembers,
  groupControllerRename: renameGroup,
  groupControllerDelete: deleteGroup,
  groupControllerResetInvite: resetInvite,
  groupControllerSetInvite: setInvite,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn().mockReturnValue(new Promise(() => {})),
  userControllerUpdateUser: vi.fn(),
}));

const INVITE_URL = `${window.location.origin}/join/abcdefghijklmnopqrstuv`;
const MEMBERS = [
  { userId: 2, name: 'Ken', role: 'owner', joinedAt: '2026-11-01T00:00:00Z' },
  {
    userId: PROFILE.id,
    name: 'Aiko',
    role: 'member',
    joinedAt: '2026-11-02T00:00:00Z',
  },
];

function renderGroup(route = '/groups/3') {
  return renderWithProviders(
    <Routes>
      <Route path="/groups/:id" element={<GroupPage />} />
      <Route path="/groups" element={<p>groups page</p>} />
    </Routes>,
    { route },
  );
}

describe('Group page', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn();
    [
      getGroup,
      listMembers,
      renameGroup,
      deleteGroup,
      resetInvite,
      setInvite,
    ].forEach((m) => m.mockReset());
    listMembers.mockResolvedValue(apiResponse(MEMBERS));
  });

  describe('as a member', () => {
    beforeEach(() => getGroup.mockResolvedValue(apiResponse(groupOutput())));

    test('shows the name, the invite link to share, and the members', async () => {
      renderGroup();

      expect(
        await screen.findByRole('heading', { name: 'Morning Lifters' }),
      ).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Invite link' })).toHaveValue(
        INVITE_URL,
      );

      const members = await screen.findAllByRole('listitem');
      expect(members.map((m) => m.textContent)).toEqual([
        'KenOwner',
        'Aiko (You)',
      ]);
    });

    test('has no owner controls', async () => {
      renderGroup();
      await screen.findByRole('heading', { name: 'Morning Lifters' });
      for (const name of [
        'Rename',
        'Reset link',
        'Turn off link',
        'Delete group',
      ]) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    test('says when the owner has turned the link off', async () => {
      getGroup.mockResolvedValue(
        apiResponse(groupOutput({ inviteEnabled: false, inviteToken: null })),
      );
      renderGroup();
      expect(
        await screen.findByText(
          'The invite link is off, so nobody can join with it.',
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole('textbox', { name: 'Invite link' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('as the owner', () => {
    beforeEach(() =>
      getGroup.mockResolvedValue(apiResponse(groupOutput({ role: 'owner' }))),
    );

    test('renames the group', async () => {
      renameGroup.mockResolvedValue(
        apiResponse(groupOutput({ role: 'owner', name: 'Evening Lifters' })),
      );
      renderGroup();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Rename' }),
      );
      const input = screen.getByRole('textbox', { name: 'Group name' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Evening Lifters');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(renameGroup).toHaveBeenCalledWith(3, { name: 'Evening Lifters' });
      expect(
        await screen.findByRole('heading', { name: 'Evening Lifters' }),
      ).toBeVisible();
    });

    test('resets the link only after confirming', async () => {
      resetInvite.mockResolvedValue(
        apiResponse(
          groupOutput({ role: 'owner', inviteToken: 'ZYXWVUTSRQPONMLKJIHGFE' }),
        ),
      );
      renderGroup();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Reset link' }),
      );
      expect(resetInvite).not.toHaveBeenCalled();
      expect(
        screen.getByText('Make a new link? The current one will stop working.'),
      ).toBeVisible();

      await userEvent.click(screen.getByRole('button', { name: 'Reset link' }));
      expect(resetInvite).toHaveBeenCalledWith(3);
      expect(
        await screen.findByDisplayValue(
          `${window.location.origin}/join/ZYXWVUTSRQPONMLKJIHGFE`,
        ),
      ).toBeVisible();
    });

    test('turns the link off and on', async () => {
      setInvite.mockResolvedValue(
        apiResponse(
          groupOutput({
            role: 'owner',
            inviteEnabled: false,
            inviteToken: null,
          }),
        ),
      );
      renderGroup();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Turn off link' }),
      );
      expect(setInvite).toHaveBeenCalledWith(3, { enabled: false });
      expect(
        await screen.findByRole('button', { name: 'Turn on link' }),
      ).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Reset link' }),
      ).not.toBeInTheDocument();
    });

    test('deletes the group after confirming, then goes back to the list', async () => {
      deleteGroup.mockResolvedValue({ data: undefined, status: 204 });
      renderGroup();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete group' }),
      );
      expect(deleteGroup).not.toHaveBeenCalled();
      const confirm = screen.getByText(
        "Delete “Morning Lifters” for everyone? This can't be undone.",
      ).parentElement!;
      await userEvent.click(
        within(confirm).getByRole('button', { name: 'Delete group' }),
      );

      expect(deleteGroup).toHaveBeenCalledWith(3);
      expect(await screen.findByText('groups page')).toBeVisible();
    });
  });

  test('says so when the group is missing or you are not in it', async () => {
    getGroup.mockRejectedValue(new ApiError('Group not found', 404));
    renderGroup();
    expect(
      await screen.findByText("This group doesn't exist, or you're not in it."),
    ).toBeVisible();
    expect(listMembers).not.toHaveBeenCalled();
  });

  test("doesn't ask the server about an id that isn't a number", () => {
    renderGroup('/groups/abc');
    expect(
      screen.getByText("This group doesn't exist, or you're not in it."),
    ).toBeVisible();
    expect(getGroup).not.toHaveBeenCalled();
  });

  test('labels the page in Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    getGroup.mockResolvedValue(apiResponse(groupOutput()));
    renderGroup();
    expect(
      await screen.findByRole('heading', { name: '招待リンク' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'メンバー' })).toBeVisible();
    expect(await screen.findByText('オーナー')).toBeVisible();
  });
});
