import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { PersonalAccessToken } from '../entities/personal-access-token.entity';

@Injectable()
export class AccessTokenAclService extends BaseAclService<PersonalAccessToken> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.Manage]);
    this.canDo(ROLE.USER, [Action.Create, Action.List]);
    this.canDo(ROLE.USER, [Action.Delete], this.isOwner);
  }

  isOwner(token: PersonalAccessToken, actor: Actor): boolean {
    return token.userId === actor.id;
  }
}
