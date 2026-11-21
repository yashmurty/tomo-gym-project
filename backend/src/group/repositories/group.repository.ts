import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { Group } from '../entities/group.entity';

@Injectable()
export class GroupRepository extends Repository<Group> {
  constructor(private dataSource: DataSource) {
    super(Group, dataSource.createEntityManager());
  }

  // Null when the token is unknown or the owner turned the link off.
  async findByActiveInvite(token: string): Promise<Group | null> {
    return this.findOneBy({ inviteToken: token, inviteEnabled: true });
  }
}
