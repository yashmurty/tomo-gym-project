import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { AgentAction } from '../entities/agent-action.entity';

@Injectable()
export class ActionLogAclService extends BaseAclService<AgentAction> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.Manage]);
    // Undo is an update of the actor's own logged changes.
    this.canDo(ROLE.USER, [Action.Update], this.isOwner);
  }

  isOwner(action: AgentAction, actor: Actor): boolean {
    return action.userId === actor.id;
  }
}
