import { ROLE } from './../../auth/constants/role.constant';

// The actor performing an action — typically `ctx.user!`. Roles are typed
// as ROLE[] (not string[]) so callsites can switch on the enum without
// stringly-typed assumptions; producers (auth-token claims, JWT payload)
// already supply ROLE[] upstream.
export interface Actor {
  id: number;
  roles: ROLE[];
}
