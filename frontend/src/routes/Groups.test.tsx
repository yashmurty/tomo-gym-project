import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { ApiError } from '../lib/api-error';
import { groupOutput } from '../test/fixtures';
import { apiResponse, renderWithProviders, signIn } from '../test/render';
import Groups from './Groups';

const listGroups = vi.hoisted(() => vi.fn());
const createGroup = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/groups/groups', () => ({
  groupControllerList: listGroups,
  groupControllerCreate: createGroup,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn().mockReturnValue(new Promise(() => {})),
  userControllerUpdateUser: vi.fn(),
}));

function renderGroups() {
  return renderWithProviders(
    <Routes>
      <Route path="/groups" element={<Groups />} />
      <Route path="/groups/:id" element={<p>group page</p>} />
    </Routes>,
    { route: '/groups' },
  );
}

describe('Groups', () => {
  beforeEach(() => {
    localStorage.clear();
    signIn();
    listGroups.mockReset();
    createGroup.mockReset();
  });

  test('lists your groups with member counts, marking the ones you own', async () => {
    listGroups.mockResolvedValue(
      apiResponse([
        groupOutput({
          id: 3,
          name: 'Morning Lifters',
          role: 'owner',
          memberCount: 1,
        }),
        groupOutput({ id: 4, name: 'Office gym', memberCount: 6 }),
      ]),
    );
    renderGroups();

    const mine = await screen.findByRole('link', { name: /Morning Lifters/ });
    expect(mine).toHaveAttribute('href', '/groups/3');
    expect(mine).toHaveTextContent('1 member');
    expect(mine).toHaveTextContent('Owner');

    const theirs = screen.getByRole('link', { name: /Office gym/ });
    expect(theirs).toHaveTextContent('6 members');
    expect(theirs).not.toHaveTextContent('Owner');
  });

  test('says how to get started when you have none', async () => {
    listGroups.mockResolvedValue(apiResponse([]));
    renderGroups();
    expect(
      await screen.findByText(
        'No groups yet. Create one, or ask a friend for their invite link.',
      ),
    ).toBeVisible();
  });

  test('creates a group and opens it', async () => {
    listGroups.mockResolvedValue(apiResponse([]));
    createGroup.mockResolvedValue(
      apiResponse(groupOutput({ id: 9, role: 'owner' })),
    );
    renderGroups();

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Group name' }),
      '  Morning Lifters ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(createGroup).toHaveBeenCalledWith({ name: 'Morning Lifters' });
    expect(await screen.findByText('group page')).toBeVisible();
  });

  test('needs a name', async () => {
    listGroups.mockResolvedValue(apiResponse([]));
    renderGroups();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create group' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(createGroup).not.toHaveBeenCalled();
  });

  test('explains the group cap', async () => {
    listGroups.mockResolvedValue(apiResponse([]));
    createGroup.mockRejectedValue(new ApiError('limit', 409, 'group_limit'));
    renderGroups();
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Group name' }),
      'One more',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You're already in the most groups allowed.",
    );
  });

  test('shows member counts in Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    listGroups.mockResolvedValue(
      apiResponse([groupOutput({ memberCount: 6 })]),
    );
    renderGroups();
    expect(
      await screen.findByRole('link', { name: /Morning Lifters/ }),
    ).toHaveTextContent('メンバー6人');
    expect(screen.getByRole('heading', { name: 'グループ' })).toBeVisible();
  });
});
