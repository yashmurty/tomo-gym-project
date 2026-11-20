import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';

// Entries and sessions both carry userId; a user owns their training data.
export interface OwnedResource {
  userId: number;
}

@Injectable()
export class WorkoutAclService extends BaseAclService<OwnedResource> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.Manage]);
    // Resource-less checks: logging and listing your own days.
    this.canDo(ROLE.USER, [Action.Create, Action.List]);
    // Anything on a specific entry / session: owner only. Friends' access
    // (Step 12) will get its own rule and summary DTO.
    this.canDo(
      ROLE.USER,
      [Action.Read, Action.Update, Action.Delete],
      this.isOwner,
    );
  }

  isOwner(resource: OwnedResource, actor: Actor): boolean {
    return resource.userId === actor.id;
  }
}
