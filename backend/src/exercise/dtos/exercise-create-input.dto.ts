import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  MAX_EXERCISE_NAME_LENGTH,
  MODALITY,
  MUSCLE_GROUP,
} from '../constants/exercise.constant';

export class CreateExerciseInput {
  @ApiProperty({ example: 'Cable crossover' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ example: 'ケーブルクロスオーバー' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  nameJa?: string;

  @ApiProperty({ enum: MODALITY })
  @IsEnum(MODALITY)
  modality: MODALITY;

  @ApiProperty({ enum: MUSCLE_GROUP })
  @IsEnum(MUSCLE_GROUP)
  muscleGroup: MUSCLE_GROUP;
}
