import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';

// The usage report spans all users (with emails): admins only.
@Injectable()
export class UsageAclService extends BaseAclService<never> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.Manage]);
  }
}
