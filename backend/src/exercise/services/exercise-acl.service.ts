import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { Exercise } from '../entities/exercise.entity';

@Injectable()
export class ExerciseAclService extends BaseAclService<Exercise> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.Manage]);
    this.canDo(ROLE.USER, [Action.List, Action.Create]);
    // The shared catalog is readable by everyone; custom exercises by their owner.
    this.canDo(ROLE.USER, [Action.Read], this.isVisible);
  }

  isVisible(exercise: Exercise, actor: Actor): boolean {
    return exercise.userId === null || exercise.userId === actor.id;
  }
}
