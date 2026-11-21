import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { GroupMembership } from '../entities/group-membership.entity';

@Injectable()
export class GroupMembershipRepository extends Repository<GroupMembership> {
  constructor(private dataSource: DataSource) {
    super(GroupMembership, dataSource.createEntityManager());
  }

  async findForUserAndGroup(
    userId: number,
    groupId: number,
  ): Promise<GroupMembership | null> {
    return this.findOneBy({ userId, groupId });
  }

  // The user's memberships with their groups, groups by name.
  async findForUser(userId: number): Promise<GroupMembership[]> {
    return this.find({
      where: { userId },
      relations: { group: true },
      order: { group: { name: 'ASC' }, groupId: 'ASC' },
    });
  }

  // A group's members with only the user columns the member list shows:
  // never email, body metrics or anything else on the user row
  // (constitution rule 16).
  async findForGroupWithNames(groupId: number): Promise<GroupMembership[]> {
    return this.find({
      where: { groupId },
      relations: { user: true },
      select: {
        id: true,
        groupId: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: { id: true, name: true },
      },
      order: { joinedAt: 'ASC', id: 'ASC' },
    });
  }

  async countForGroups(groupIds: number[]): Promise<Map<number, number>> {
    if (groupIds.length === 0) return new Map();
    const rows: { groupId: number; count: number }[] =
      await this.createQueryBuilder('m')
        .select('m.groupId', 'groupId')
        .addSelect('COUNT(*)::int', 'count')
        .where('m.groupId IN (:...groupIds)', { groupIds })
        .groupBy('m.groupId')
        .getRawMany();
    return new Map(rows.map((r) => [r.groupId, r.count]));
  }
}
