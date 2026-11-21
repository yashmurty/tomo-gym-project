import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { SharedModule } from '../shared/shared.module';
import { GroupController } from './controllers/group.controller';
import { InviteController } from './controllers/invite.controller';
import { Group } from './entities/group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { GroupRepository } from './repositories/group.repository';
import { GroupMembershipRepository } from './repositories/group-membership.repository';
import { GroupService } from './services/group.service';
import { GroupAclService } from './services/group-acl.service';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([Group, GroupMembership])],
  providers: [
    GroupService,
    GroupAclService,
    GroupRepository,
    GroupMembershipRepository,
    JwtAuthStrategy,
  ],
  controllers: [GroupController, InviteController],
  exports: [GroupService],
})
export class GroupModule {}
