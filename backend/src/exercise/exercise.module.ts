import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { SharedModule } from '../shared/shared.module';
import { ExerciseController } from './controllers/exercise.controller';
import { Exercise } from './entities/exercise.entity';
import { ExerciseAlias } from './entities/exercise-alias.entity';
import { ExerciseRepository } from './repositories/exercise.repository';
import { ExerciseService } from './services/exercise.service';
import { ExerciseAclService } from './services/exercise-acl.service';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([Exercise, ExerciseAlias])],
  providers: [
    ExerciseService,
    ExerciseAclService,
    ExerciseRepository,
    JwtAuthStrategy,
  ],
  controllers: [ExerciseController],
  exports: [ExerciseService],
})
export class ExerciseModule {}
