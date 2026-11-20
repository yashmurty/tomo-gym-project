import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { MAX_EXERCISE_NAME_LENGTH } from '../constants/exercise.constant';

export class ExerciseListQuery {
  @ApiPropertyOptional({ description: 'Matches any alias, EN or JP.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  search?: string;
}
