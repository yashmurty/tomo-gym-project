import { ROLE } from '../../auth/constants/role.constant';
import { Action } from '../../shared/acl/action.constant';
import { WorkoutAclService } from './workout-acl.service';

describe('WorkoutAclService', () => {
  const service = new WorkoutAclService();
  const user = { id: 7, roles: [ROLE.USER] };
  const admin = { id: 1, roles: [ROLE.ADMIN] };

  it('lets a user log and list their own days', () => {
    const acl = service.forActor(user);
    expect(acl.canDoAction(Action.Create)).toBe(true);
    expect(acl.canDoAction(Action.List)).toBe(true);
  });

  it('allows read / update / delete on own entries only', () => {
    const acl = service.forActor(user);
    for (const action of [Action.Read, Action.Update, Action.Delete]) {
      expect(acl.canDoAction(action, { userId: 7 })).toBe(true);
      expect(acl.canDoAction(action, { userId: 8 })).toBe(false);
    }
  });

  it('lets an admin manage anything', () => {
    expect(
      service.forActor(admin).canDoAction(Action.Delete, { userId: 8 }),
    ).toBe(true);
  });
});
