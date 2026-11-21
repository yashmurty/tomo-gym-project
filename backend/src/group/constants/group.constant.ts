// A member's role in one group. Group roles are per group, so they live on
// the membership, not in the global ROLE enum.
export enum GROUP_ROLE {
  OWNER = 'owner',
  MEMBER = 'member',
}

export const GROUP_LIMITS = {
  nameLength: 60,
  membersPerGroup: 50,
  // Every group the user is in, owned or joined.
  groupsPerUser: 20,
} as const;

// Machine-readable codes on 409s, so the app can say which limit was hit.
export type GroupErrorCode = 'group_full' | 'group_limit';
