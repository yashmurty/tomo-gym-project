import { User } from '../../user/entities/user.entity';
import { GROUP_ROLE } from '../constants/group.constant';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import {
  toGroupMemberOutput,
  toGroupOutput,
  toInvitePreviewOutput,
} from './group-output.dto';

describe('group output mappers', () => {
  const group = (inviteEnabled: boolean) =>
    ({
      id: 3,
      name: 'Morning Lifters',
      ownerUserId: 7,
      inviteToken: 'abcdefghijklmnopqrstuv',
      inviteEnabled,
      createdAt: new Date(),
    }) as Group;

  const membership = (role: GROUP_ROLE, user?: Partial<User>) =>
    ({
      id: 1,
      groupId: 3,
      userId: 7,
      role,
      joinedAt: new Date('2026-11-21T00:00:00Z'),
      user,
    }) as GroupMembership;

  it('shares the invite token only while the link is on', () => {
    const member = membership(GROUP_ROLE.MEMBER);
    expect(toGroupOutput(group(true), member, 4).inviteToken).toBe(
      'abcdefghijklmnopqrstuv',
    );
    expect(toGroupOutput(group(false), member, 4)).toEqual({
      id: 3,
      name: 'Morning Lifters',
      role: GROUP_ROLE.MEMBER,
      memberCount: 4,
      inviteEnabled: false,
      inviteToken: null,
    });
  });

  it("gives members each other's name and nothing else from the user row", () => {
    const output = toGroupMemberOutput(
      membership(GROUP_ROLE.OWNER, {
        id: 7,
        name: 'Ken',
        email: 'ken@example.com',
        weightKg: 80,
        timezone: 'Asia/Tokyo',
        password: 'hash',
      }),
    );
    expect(output).toEqual({
      userId: 7,
      name: 'Ken',
      role: GROUP_ROLE.OWNER,
      joinedAt: new Date('2026-11-21T00:00:00Z'),
    });
  });

  it('previews an invite without the token or any member', () => {
    expect(toInvitePreviewOutput(group(true), 6, false)).toEqual({
      groupId: 3,
      name: 'Morning Lifters',
      memberCount: 6,
      alreadyMember: false,
    });
  });
});
