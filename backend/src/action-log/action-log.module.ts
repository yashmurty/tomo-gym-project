import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../shared/shared.module';
import { AgentAction } from './entities/agent-action.entity';
import { ActionLogAclService } from './services/action-log-acl.service';
import { UndoService } from './services/undo.service';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([AgentAction])],
  providers: [UndoService, ActionLogAclService],
  exports: [UndoService],
})
export class ActionLogModule {}
