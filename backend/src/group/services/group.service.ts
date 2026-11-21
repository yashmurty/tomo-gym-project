import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Action } from '../../shared/acl/action.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  GROUP_LIMITS,
  GROUP_ROLE,
  GroupErrorCode,
} from '../constants/group.constant';
import { GroupNameInput } from '../dtos/group-input.dto';
import {
  GroupMemberOutput,
  GroupOutput,
  InvitePreviewOutput,
  toGroupMemberOutput,
  toGroupOutput,
  toInvitePreviewOutput,
} from '../dtos/group-output.dto';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { GroupRepository } from '../repositories/group.repository';
import { GroupMembershipRepository } from '../repositories/group-membership.repository';
import { isInviteToken, newInviteToken } from '../utils/invite-token';
import { GroupAclService } from './group-acl.service';

interface MemberAccess {
  group: Group;
  membership: GroupMembership;
}

// Groups, their invite links and their member lists (roadmap Step 12a).
//
// Access, adapted from denwa-alert's OrgScopedGuard / OrgAdminGuard but
// checked here in the service (tomo's convention):
// - an unknown group and a group you're not in both answer 404, so
//   non-members can't tell whether a group exists;
// - a member asking for an owner-only action gets 403. Not 401: the app
//   treats a 401 as an expired token and would refresh and retry.
@Injectable()
export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly membershipRepository: GroupMembershipRepository,
    private readonly aclService: GroupAclService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(GroupService.name);
  }

  async create(
    ctx: RequestContext,
    input: GroupNameInput,
  ): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.create.name} was called`);
    this.assertAllowed(ctx, Action.Create);
    const userId = ctx.user!.id;

    const { group, membership } = await this.dataSource.transaction(
      async (manager) => {
        await this.lockUser(manager, userId);
        await this.assertUnderGroupLimit(manager, userId);

        const group = await manager.save(
          manager.create(Group, {
            name: input.name,
            ownerUserId: userId,
            inviteToken: newInviteToken(),
            inviteEnabled: true,
          }),
        );
        const membership = await manager.save(
          manager.create(GroupMembership, {
            groupId: group.id,
            userId,
            role: GROUP_ROLE.OWNER,
          }),
        );
        return { group, membership };
      },
    );

    return toGroupOutput(group, membership, 1);
  }

  // The groups you're in, by name.
  async listMine(ctx: RequestContext): Promise<GroupOutput[]> {
    this.logger.log(ctx, `${this.listMine.name} was called`);
    this.assertAllowed(ctx, Action.List);

    const memberships = await this.membershipRepository.findForUser(
      ctx.user!.id,
    );
    const counts = await this.membershipRepository.countForGroups(
      memberships.map((m) => m.groupId),
    );
    return memberships.map((m) =>
      toGroupOutput(m.group!, m, counts.get(m.groupId) ?? 0),
    );
  }

  async get(ctx: RequestContext, groupId: number): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.get.name} was called`);
    const { group, membership } = await this.access(ctx, groupId, Action.Read);
    return this.output(group, membership);
  }

  async rename(
    ctx: RequestContext,
    groupId: number,
    input: GroupNameInput,
  ): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.rename.name} was called`);
    const { group, membership } = await this.access(
      ctx,
      groupId,
      Action.Update,
    );

    group.name = input.name;
    await this.groupRepository.update(group.id, { name: group.name });
    return this.output(group, membership);
  }

  // Memberships go with the group (ON DELETE CASCADE).
  async delete(ctx: RequestContext, groupId: number): Promise<void> {
    this.logger.log(ctx, `${this.delete.name} was called`);
    await this.access(ctx, groupId, Action.Delete);
    await this.groupRepository.delete(groupId);
  }

  // A new link; the old one stops working at once.
  async resetInvite(
    ctx: RequestContext,
    groupId: number,
  ): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.resetInvite.name} was called`);
    const { group, membership } = await this.access(
      ctx,
      groupId,
      Action.Update,
    );

    group.inviteToken = newInviteToken();
    await this.groupRepository.update(group.id, {
      inviteToken: group.inviteToken,
    });
    return this.output(group, membership);
  }

  // Off and on again keeps the same link: only resetting replaces it.
  async setInviteEnabled(
    ctx: RequestContext,
    groupId: number,
    enabled: boolean,
  ): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.setInviteEnabled.name} was called`);
    const { group, membership } = await this.access(
      ctx,
      groupId,
      Action.Update,
    );

    group.inviteEnabled = enabled;
    await this.groupRepository.update(group.id, { inviteEnabled: enabled });
    return this.output(group, membership);
  }

  // Owner first, then in the order people joined.
  async listMembers(
    ctx: RequestContext,
    groupId: number,
  ): Promise<GroupMemberOutput[]> {
    this.logger.log(ctx, `${this.listMembers.name} was called`);
    await this.access(ctx, groupId, Action.Read);

    const members =
      await this.membershipRepository.findForGroupWithNames(groupId);
    const rank = (m: GroupMembership) => (m.role === GROUP_ROLE.OWNER ? 0 : 1);
    return [...members]
      .sort((a, b) => rank(a) - rank(b))
      .map(toGroupMemberOutput);
  }

  // The join page, before joining. A link that's unknown, reset or off is
  // a 404 that names nothing, so it can't reveal the group.
  async previewInvite(
    ctx: RequestContext,
    token: string,
  ): Promise<InvitePreviewOutput> {
    this.logger.log(ctx, `${this.previewInvite.name} was called`);
    this.assertAllowed(ctx, Action.Create);

    const group = isInviteToken(token)
      ? await this.groupRepository.findByActiveInvite(token)
      : null;
    if (!group) throw this.inactiveInvite();

    const [counts, membership] = await Promise.all([
      this.membershipRepository.countForGroups([group.id]),
      this.membershipRepository.findForUserAndGroup(ctx.user!.id, group.id),
    ]);
    return toInvitePreviewOutput(
      group,
      counts.get(group.id) ?? 0,
      membership !== null,
    );
  }

  // Joining twice is harmless: an existing member just gets the group back.
  async join(ctx: RequestContext, token: string): Promise<GroupOutput> {
    this.logger.log(ctx, `${this.join.name} was called`);
    this.assertAllowed(ctx, Action.Create);
    if (!isInviteToken(token)) throw this.inactiveInvite();
    const userId = ctx.user!.id;

    return this.dataSource.transaction(async (manager) => {
      // Locking the group row makes concurrent joins take turns, so the
      // member cap holds.
      const group = await manager.findOne(Group, {
        where: { inviteToken: token, inviteEnabled: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw this.inactiveInvite();

      const existing = await manager.findOneBy(GroupMembership, {
        groupId: group.id,
        userId,
      });
      const members = await manager.countBy(GroupMembership, {
        groupId: group.id,
      });
      if (existing) return toGroupOutput(group, existing, members);

      await this.lockUser(manager, userId);
      await this.assertUnderGroupLimit(manager, userId);
      if (members >= GROUP_LIMITS.membersPerGroup) {
        throw this.limitReached(
          'group_full',
          `This group is full (${GROUP_LIMITS.membersPerGroup} members)`,
        );
      }

      const membership = await manager.save(
        manager.create(GroupMembership, {
          groupId: group.id,
          userId,
          role: GROUP_ROLE.MEMBER,
        }),
      );
      return toGroupOutput(group, membership, members + 1);
    });
  }

  // The group and your membership of it, or 404; then the ACL check for
  // `action` on that membership, or 403.
  private async access(
    ctx: RequestContext,
    groupId: number,
    action: Action,
  ): Promise<MemberAccess> {
    const [group, membership] = await Promise.all([
      this.groupRepository.findOneBy({ id: groupId }),
      this.membershipRepository.findForUserAndGroup(ctx.user!.id, groupId),
    ]);
    if (!group || !membership) {
      throw new NotFoundException('Group not found');
    }
    this.assertAllowed(ctx, action, membership);
    return { group, membership };
  }

  private async output(
    group: Group,
    membership: GroupMembership,
  ): Promise<GroupOutput> {
    const counts = await this.membershipRepository.countForGroups([group.id]);
    return toGroupOutput(group, membership, counts.get(group.id) ?? 0);
  }

  private assertAllowed(
    ctx: RequestContext,
    action: Action,
    membership?: GroupMembership,
  ): void {
    if (!this.aclService.forActor(ctx.user!).canDoAction(action, membership)) {
      throw new ForbiddenException(
        membership ? 'Only the group owner can do that' : undefined,
      );
    }
  }

  // Serialises a user's own group creations and joins, so two at once
  // can't both slip under the per-user cap.
  private async lockUser(
    manager: EntityManager,
    userId: number,
  ): Promise<void> {
    await manager.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [
      userId,
    ]);
  }

  private async assertUnderGroupLimit(
    manager: EntityManager,
    userId: number,
  ): Promise<void> {
    const count = await manager.countBy(GroupMembership, { userId });
    if (count >= GROUP_LIMITS.groupsPerUser) {
      throw this.limitReached(
        'group_limit',
        `You can be in at most ${GROUP_LIMITS.groupsPerUser} groups; leave one first`,
      );
    }
  }

  private limitReached(code: GroupErrorCode, message: string) {
    return new ConflictException({ message, code });
  }

  private inactiveInvite() {
    return new NotFoundException('This invite link is not active');
  }
}
