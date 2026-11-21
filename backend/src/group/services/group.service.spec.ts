import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GROUP_LIMITS, GROUP_ROLE } from '../constants/group.constant';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { GroupRepository } from '../repositories/group.repository';
import { GroupMembershipRepository } from '../repositories/group-membership.repository';
import { GroupService } from './group.service';
import { GroupAclService } from './group-acl.service';

describe('GroupService', () => {
  const TOKEN = 'abcdefghijklmnopqrstuv';
  const group: Group = {
    id: 3,
    name: 'Morning Lifters',
    ownerUserId: 1,
    inviteToken: TOKEN,
    inviteEnabled: true,
    createdAt: new Date(),
  };
  const membershipOf = (userId: number, role: GROUP_ROLE) =>
    ({
      id: userId,
      groupId: 3,
      userId,
      role,
      joinedAt: new Date(),
    }) as GroupMembership;

  let groupRepository: {
    findOneBy: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findByActiveInvite: jest.Mock;
  };
  let membershipRepository: {
    findForUserAndGroup: jest.Mock;
    countForGroups: jest.Mock;
    findForGroupWithNames: jest.Mock;
  };
  // What the transaction's EntityManager answers.
  let manager: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    countBy: jest.Mock;
    query: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: GroupService;

  const ctxFor = (id: number, roles = [ROLE.USER]) => {
    const ctx = new RequestContext();
    ctx.user = { id, email: `u${id}@example.com`, roles };
    return ctx;
  };

  beforeEach(() => {
    groupRepository = {
      findOneBy: jest.fn(async () => ({ ...group })),
      update: jest.fn(),
      delete: jest.fn(),
      findByActiveInvite: jest.fn(async () => ({ ...group })),
    };
    membershipRepository = {
      findForUserAndGroup: jest.fn().mockResolvedValue(null),
      countForGroups: jest.fn().mockResolvedValue(new Map([[3, 2]])),
      findForGroupWithNames: jest.fn(),
    };
    manager = {
      findOne: jest.fn(async () => ({ ...group })),
      findOneBy: jest.fn().mockResolvedValue(null),
      countBy: jest.fn().mockResolvedValue(0),
      query: jest.fn(),
      create: jest.fn((_entity, values) => values),
      save: jest.fn(async (row) => ({ id: 99, joinedAt: new Date(), ...row })),
    };
    const dataSource = {
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    };
    service = new GroupService(
      groupRepository as unknown as GroupRepository,
      membershipRepository as unknown as GroupMembershipRepository,
      new GroupAclService(),
      dataSource as unknown as DataSource,
      { setContext: jest.fn(), log: jest.fn() } as unknown as AppLogger,
    );
  });

  describe('access to a group', () => {
    it('answers 404 alike for a missing group and a group you are not in', async () => {
      await expect(service.get(ctxFor(5), 3)).rejects.toThrow(
        NotFoundException,
      );

      groupRepository.findOneBy.mockResolvedValue(null);
      await expect(service.get(ctxFor(5), 3)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets a member see the group', async () => {
      membershipRepository.findForUserAndGroup.mockResolvedValue(
        membershipOf(5, GROUP_ROLE.MEMBER),
      );
      await expect(service.get(ctxFor(5), 3)).resolves.toMatchObject({
        id: 3,
        role: GROUP_ROLE.MEMBER,
        memberCount: 2,
        inviteToken: TOKEN,
      });
    });

    it.each([
      [
        'rename',
        (s: GroupService, c: RequestContext) => s.rename(c, 3, { name: 'x' }),
      ],
      ['delete', (s: GroupService, c: RequestContext) => s.delete(c, 3)],
      [
        'reset the invite',
        (s: GroupService, c: RequestContext) => s.resetInvite(c, 3),
      ],
      [
        'turn the invite off',
        (s: GroupService, c: RequestContext) => s.setInviteEnabled(c, 3, false),
      ],
    ])("doesn't let a plain member %s (403)", async (_label, act) => {
      membershipRepository.findForUserAndGroup.mockResolvedValue(
        membershipOf(5, GROUP_ROLE.MEMBER),
      );
      await expect(act(service, ctxFor(5))).rejects.toThrow(ForbiddenException);
      expect(groupRepository.update).not.toHaveBeenCalled();
      expect(groupRepository.delete).not.toHaveBeenCalled();
    });

    it('lets the owner rename', async () => {
      membershipRepository.findForUserAndGroup.mockResolvedValue(
        membershipOf(1, GROUP_ROLE.OWNER),
      );
      const renamed = await service.rename(ctxFor(1), 3, { name: 'Evening' });
      expect(groupRepository.update).toHaveBeenCalledWith(3, {
        name: 'Evening',
      });
      expect(renamed.name).toBe('Evening');
    });

    it('lists members owner first, names only', async () => {
      membershipRepository.findForUserAndGroup.mockResolvedValue(
        membershipOf(5, GROUP_ROLE.MEMBER),
      );
      membershipRepository.findForGroupWithNames.mockResolvedValue([
        { ...membershipOf(5, GROUP_ROLE.MEMBER), user: { name: 'Ami' } },
        { ...membershipOf(1, GROUP_ROLE.OWNER), user: { name: 'Ken' } },
      ]);
      const members = await service.listMembers(ctxFor(5), 3);
      expect(members.map((m) => [m.name, m.role])).toEqual([
        ['Ken', GROUP_ROLE.OWNER],
        ['Ami', GROUP_ROLE.MEMBER],
      ]);
    });
  });

  describe('invites', () => {
    it('answers 404 for a malformed token without looking it up', async () => {
      await expect(service.previewInvite(ctxFor(5), 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(groupRepository.findByActiveInvite).not.toHaveBeenCalled();
    });

    it('answers 404 for a link that is off or reset', async () => {
      groupRepository.findByActiveInvite.mockResolvedValue(null);
      await expect(service.previewInvite(ctxFor(5), TOKEN)).rejects.toThrow(
        'This invite link is not active',
      );
    });

    it('previews the group and whether you are in it', async () => {
      await expect(service.previewInvite(ctxFor(5), TOKEN)).resolves.toEqual({
        groupId: 3,
        name: 'Morning Lifters',
        memberCount: 2,
        alreadyMember: false,
      });
    });

    it('joins as a member', async () => {
      manager.countBy.mockResolvedValue(2);
      const joined = await service.join(ctxFor(5), TOKEN);
      expect(manager.save).toHaveBeenCalledWith({
        groupId: 3,
        userId: 5,
        role: GROUP_ROLE.MEMBER,
      });
      expect(joined).toMatchObject({ role: GROUP_ROLE.MEMBER, memberCount: 3 });
    });

    it('returns the group to an existing member without adding them again', async () => {
      manager.findOneBy.mockResolvedValue(membershipOf(5, GROUP_ROLE.MEMBER));
      await service.join(ctxFor(5), TOKEN);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("refuses a full group with code 'group_full'", async () => {
      // First count: the user's groups; second: the group's members.
      manager.countBy.mockImplementation(async (_entity, where) =>
        'userId' in where ? 1 : GROUP_LIMITS.membersPerGroup,
      );
      await expect(service.join(ctxFor(5), TOKEN)).rejects.toMatchObject({
        response: { code: 'group_full' },
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("refuses a user already in the most groups with code 'group_limit'", async () => {
      manager.countBy.mockImplementation(async (_entity, where) =>
        'userId' in where ? GROUP_LIMITS.groupsPerUser : 2,
      );
      await expect(service.join(ctxFor(5), TOKEN)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.join(ctxFor(5), TOKEN)).rejects.toMatchObject({
        response: { code: 'group_limit' },
      });
    });
  });

  describe('create', () => {
    it('makes you the owner of a group with a fresh invite link', async () => {
      const created = await service.create(ctxFor(5), { name: 'Morning' });
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [5],
      );
      expect(created).toMatchObject({
        name: 'Morning',
        role: GROUP_ROLE.OWNER,
        memberCount: 1,
        inviteEnabled: true,
      });
      expect(created.inviteToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('stops at the per-user group cap', async () => {
      manager.countBy.mockResolvedValue(GROUP_LIMITS.groupsPerUser);
      await expect(
        service.create(ctxFor(5), { name: 'One more' }),
      ).rejects.toThrow(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('is refused to accounts without the user role', async () => {
      await expect(
        service.create(ctxFor(1, [ROLE.ADMIN]), { name: 'Admins' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
