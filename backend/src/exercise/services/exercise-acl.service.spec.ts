import { ROLE } from '../../auth/constants/role.constant';
import { Action } from '../../shared/acl/action.constant';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseAclService } from './exercise-acl.service';

describe('ExerciseAclService', () => {
  const service = new ExerciseAclService();
  const acl = service.forActor({ id: 7, roles: [ROLE.USER] });
  const exercise = (userId: number | null) => ({ userId }) as Exercise;

  it('lets everyone read the shared catalog', () => {
    expect(acl.canDoAction(Action.Read, exercise(null))).toBe(true);
  });

  it('restricts custom exercises to their owner', () => {
    expect(acl.canDoAction(Action.Read, exercise(7))).toBe(true);
    expect(acl.canDoAction(Action.Read, exercise(8))).toBe(false);
  });

  it('lets users list and create', () => {
    expect(acl.canDoAction(Action.List)).toBe(true);
    expect(acl.canDoAction(Action.Create)).toBe(true);
  });
});
