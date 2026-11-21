import { ROLE } from '../../auth/constants/role.constant';
import { Action } from '../../shared/acl/action.constant';
import { GROUP_ROLE } from '../constants/group.constant';
import { GroupAclService } from './group-acl.service';

describe('GroupAclService', () => {
  const service = new GroupAclService();
  const user = { id: 7, roles: [ROLE.USER] };
  const admin = { id: 1, roles: [ROLE.ADMIN] };
  const owner = { userId: 7, role: GROUP_ROLE.OWNER };
  const member = { userId: 7, role: GROUP_ROLE.MEMBER };

  it('lets a user create, join and list their groups without a resource', () => {
    const acl = service.forActor(user);
    expect(acl.canDoAction(Action.Create)).toBe(true);
    expect(acl.canDoAction(Action.List)).toBe(true);
  });

  it('lets any member read the group', () => {
    const acl = service.forActor(user);
    expect(acl.canDoAction(Action.Read, member)).toBe(true);
    expect(acl.canDoAction(Action.Read, owner)).toBe(true);
  });

  it('leaves rename, invite settings and delete to the owner', () => {
    const acl = service.forActor(user);
    for (const action of [Action.Update, Action.Delete]) {
      expect(acl.canDoAction(action, owner)).toBe(true);
      expect(acl.canDoAction(action, member)).toBe(false);
    }
  });

  it("never accepts someone else's membership", () => {
    const acl = service.forActor(user);
    const othersOwnership = { userId: 8, role: GROUP_ROLE.OWNER };
    expect(acl.canDoAction(Action.Read, othersOwnership)).toBe(false);
    expect(acl.canDoAction(Action.Update, othersOwnership)).toBe(false);
  });

  it('gives system admins no way into groups (constitution rule 16)', () => {
    const acl = service.forActor(admin);
    expect(acl.canDoAction(Action.List)).toBe(false);
    expect(
      acl.canDoAction(Action.Read, { userId: 1, role: GROUP_ROLE.OWNER }),
    ).toBe(false);
    expect(acl.canDoAction(Action.Delete, owner)).toBe(false);
  });
});
