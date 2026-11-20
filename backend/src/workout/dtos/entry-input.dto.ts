import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { MAX_EXERCISE_NAME_LENGTH } from '../../exercise/constants/exercise.constant';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { LIMITS } from '../constants/workout.constant';

const DATE_DESCRIPTION =
  "'today' (default), 'yesterday' or 'YYYY-MM-DD'. Resolved on the server in the user's timezone; future dates are rejected.";

export class SetInput {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(LIMITS.reps)
  reps: number;

  @ApiPropertyOptional({
    type: Number,
    example: 47,
    description: 'Load in `unit`. Omit for no load / bodyweight.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  weight?: number;
}

// Fields shared by logging and editing an entry.
class EntryFields {
  @ApiPropertyOptional({
    example: 'lat pulldown',
    description: 'Exercise name as typed; resolved through aliases (EN or JP).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXERCISE_NAME_LENGTH)
  exercise?: string;

  @ApiPropertyOptional({ description: 'Alternative to `exercise`.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  exerciseId?: number;

  @ApiPropertyOptional({ example: 'today', description: DATE_DESCRIPTION })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    enum: WEIGHT_UNIT,
    description: "Unit for set weights. Defaults to the user's display unit.",
  })
  @IsOptional()
  @IsEnum(WEIGHT_UNIT)
  unit?: WEIGHT_UNIT;

  @ApiPropertyOptional({ type: [SetInput] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.setsPerEntry)
  @ValidateNested({ each: true })
  @Type(() => SetInput)
  sets?: SetInput[];
}

export class LogEntryInput extends EntryFields {
  @ApiPropertyOptional({ type: Number, example: 10 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.durationMin)
  durationMin?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.distanceKm)
  distanceKm?: number;

  @ApiPropertyOptional({ type: Number, example: 6 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.speedKmh)
  speedKmh?: number;

  @ApiPropertyOptional({ type: Number, example: 2 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(LIMITS.inclinePctMin)
  @Max(LIMITS.inclinePctMax)
  inclinePct?: number;
}

// Every field optional. `sets` replaces all sets; `date` moves the entry;
// cardio fields accept null to clear them.
export class UpdateEntryInput extends EntryFields {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.durationMin)
  durationMin?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.distanceKm)
  distanceKm?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(LIMITS.speedKmh)
  speedKmh?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(LIMITS.inclinePctMin)
  @Max(LIMITS.inclinePctMax)
  inclinePct?: number | null;
}

export class MoveEntriesInput {
  @ApiProperty({ type: [Number], example: [5531, 5532] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.entriesPerMove)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  entryIds: number[];

  @ApiProperty({ example: '2026-11-17', description: DATE_DESCRIPTION })
  @IsString()
  date: string;
}

export class DayNoteInput {
  @ApiProperty({ type: String, nullable: true, example: 'Felt strong today' })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(LIMITS.noteLength)
  note: string | null;
}

export class DayListQuery {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 30, maximum: LIMITS.daysPerPage })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITS.daysPerPage)
  limit?: number;
}
