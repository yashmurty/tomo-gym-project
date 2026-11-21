import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { GROUP_ROLE } from '../constants/group.constant';

// The resource for group checks is the caller's own membership of the
// group: roles are per group, so they can't be static rules on ROLE.
export interface GroupAccess {
  userId: number;
  role: GROUP_ROLE;
}

@Injectable()
export class GroupAclService extends BaseAclService<GroupAccess> {
  constructor() {
    super();
    // Resource-less: create a group, join one by invite, list your own.
    this.canDo(ROLE.USER, [Action.Create, Action.List]);
    // A group you're in: see it and its members.
    this.canDo(ROLE.USER, [Action.Read], this.isMember);
    // Owner only: rename, invite settings, delete.
    this.canDo(ROLE.USER, [Action.Update, Action.Delete], this.isOwner);
    // Deliberately no ADMIN rule. Workout data is visible only to people
    // who share a group with its owner (constitution rule 16), so system
    // admins get no way into groups.
  }

  isMember(access: GroupAccess, actor: Actor): boolean {
    return access.userId === actor.id;
  }

  isOwner(access: GroupAccess, actor: Actor): boolean {
    return access.userId === actor.id && access.role === GROUP_ROLE.OWNER;
  }
}
