import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { ExerciseModule } from '../exercise/exercise.module';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { DayController } from './controllers/day.controller';
import { EntryController } from './controllers/entry.controller';
import { AgentAction } from './entities/agent-action.entity';
import { Entry } from './entities/entry.entity';
import { EntrySet } from './entities/entry-set.entity';
import { WorkoutSession } from './entities/workout-session.entity';
import { EntryRepository } from './repositories/entry.repository';
import { WorkoutSessionRepository } from './repositories/workout-session.repository';
import { WorkoutService } from './services/workout.service';
import { WorkoutAclService } from './services/workout-acl.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([WorkoutSession, Entry, EntrySet, AgentAction]),
    UserModule,
    ExerciseModule,
  ],
  providers: [
    WorkoutService,
    WorkoutAclService,
    EntryRepository,
    WorkoutSessionRepository,
    JwtAuthStrategy,
  ],
  controllers: [EntryController, DayController],
  exports: [WorkoutService],
})
export class WorkoutModule {}
