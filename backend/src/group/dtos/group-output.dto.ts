import { ApiProperty } from '@nestjs/swagger';

import { GROUP_ROLE } from '../constants/group.constant';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';

// All outputs are built by the explicit mappers below, never by serialising
// entities: group members see each other's display name and nothing else
// from the user row (constitution rule 16).

export class GroupOutput {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: GROUP_ROLE, description: 'Your role in this group.' })
  role: GROUP_ROLE;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  inviteEnabled: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The invite token, for the link /join/{token}. Any member can share it. Null while the link is off.',
  })
  inviteToken: string | null;
}

export class GroupMemberOutput {
  @ApiProperty()
  userId: number;

  @ApiProperty({ description: 'Display name. Never the email address.' })
  name: string;

  @ApiProperty({ enum: GROUP_ROLE })
  role: GROUP_ROLE;

  @ApiProperty()
  joinedAt: Date;
}

// What the join page shows before you join: enough to recognise the group,
// nothing about its members.
export class InvitePreviewOutput {
  @ApiProperty()
  groupId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  alreadyMember: boolean;
}

export function toGroupOutput(
  group: Group,
  membership: GroupMembership,
  memberCount: number,
): GroupOutput {
  return {
    id: group.id,
    name: group.name,
    role: membership.role,
    memberCount,
    inviteEnabled: group.inviteEnabled,
    inviteToken: group.inviteEnabled ? group.inviteToken : null,
  };
}

export function toGroupMemberOutput(
  membership: GroupMembership,
): GroupMemberOutput {
  return {
    userId: membership.userId,
    name: membership.user!.name,
    role: membership.role,
    joinedAt: membership.joinedAt,
  };
}

export function toInvitePreviewOutput(
  group: Group,
  memberCount: number,
  alreadyMember: boolean,
): InvitePreviewOutput {
  return { groupId: group.id, name: group.name, memberCount, alreadyMember };
}
