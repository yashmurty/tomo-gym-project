import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  MAX_EXERCISE_NAME_LENGTH,
  MUSCLE_GROUP,
} from '../../exercise/constants/exercise.constant';
import { LOCALE } from '../../shared/constants/locale.constant';
import { IsIanaTimezone } from '../../shared/time/timezone';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { LIMITS } from '../../workout/constants/workout.constant';
import { UpdateEntryInput } from '../../workout/dtos/entry-input.dto';

// Inputs for tools that have no REST twin. Same class-validator rules as
// REST DTOs; ToolRegistry also rejects unknown fields.

export class ExerciseRefInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  exercise?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  exerciseId?: number;
}

export class GetDayInput {
  @IsOptional()
  @IsString()
  date?: string;
}

export class QueryHistoryInput extends ExerciseRefInput {
  @IsOptional()
  @IsEnum(MUSCLE_GROUP)
  muscleGroup?: MUSCLE_GROUP;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class EntryIdInput {
  @IsInt()
  @Min(1)
  entryId: number;
}

export class UpdateEntryToolInput extends UpdateEntryInput {
  @IsInt()
  @Min(1)
  entryId: number;
}

export class SetDayNoteToolInput {
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(LIMITS.noteLength)
  note: string | null;
}

export class AddExerciseAliasInput extends ExerciseRefInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  alias: string;
}

// The profile fields a tool may change. Deliberately excludes name,
// password and email.
export class UpdateProfileToolInput {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  weight?: number | null;

  @IsOptional()
  @IsEnum(WEIGHT_UNIT)
  weightUnit?: WEIGHT_UNIT;

  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;

  @IsOptional()
  @IsEnum(LOCALE)
  locale?: LOCALE;
}
