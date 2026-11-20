import { ApiProperty } from '@nestjs/swagger';

import { MUSCLE_GROUP } from '../../exercise/constants/exercise.constant';
import {
  ExerciseOutput,
  toExerciseOutput,
} from '../../exercise/dtos/exercise-output.dto';
import { CalendarDate } from '../../shared/time/calendar-date';
import { ENTRY_SOURCE } from '../constants/workout.constant';
import { Entry } from '../entities/entry.entity';

// All outputs are built by the explicit mappers below, never by serialising
// entities, so a new entity column can't leak by accident.

export class SetOutput {
  @ApiProperty()
  setIndex: number;

  @ApiProperty()
  reps: number;

  @ApiProperty({ type: Number, nullable: true })
  weightKg: number | null;
}

export class EntryOutput {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: '2026-11-20' })
  date: CalendarDate;

  @ApiProperty({ type: ExerciseOutput })
  exercise: ExerciseOutput;

  @ApiProperty({ type: [SetOutput] })
  sets: SetOutput[];

  @ApiProperty({ type: Number, nullable: true })
  durationMin: number | null;

  @ApiProperty({ type: Number, nullable: true })
  distanceKm: number | null;

  @ApiProperty({ type: Number, nullable: true })
  speedKmh: number | null;

  @ApiProperty({ type: Number, nullable: true })
  inclinePct: number | null;

  @ApiProperty({ type: Number, nullable: true })
  metValue: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Null until the user sets a body weight.',
  })
  estKcal: number | null;

  @ApiProperty({
    description:
      'True when the estimate is based on assumed time per set rather than a measured duration. Show it as approximate.',
  })
  kcalIsRough: boolean;

  @ApiProperty({ enum: ENTRY_SOURCE })
  source: ENTRY_SOURCE;

  @ApiProperty({ type: String, nullable: true })
  rawInput: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// The owner's view of a day: everything.
export class DayDetailOutput {
  @ApiProperty({ example: '2026-11-20' })
  date: CalendarDate;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Position among your training days; null if the day has no entries.',
  })
  dayNumber: number | null;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: Number, description: 'Sum of known estimates.' })
  totalKcal: number;

  @ApiProperty({ type: [EntryOutput] })
  entries: EntryOutput[];
}

export class DaySummaryExercise {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  nameJa: string | null;

  @ApiProperty({ enum: MUSCLE_GROUP })
  muscleGroup: MUSCLE_GROUP;
}

// The activity-only view of a day, for friends who weren't given full
// details (constitution rule 16, roadmap Step 12). It must never gain sets,
// reps, weights, calories, notes or raw input.
export class DaySummaryOutput {
  @ApiProperty({ example: '2026-11-20' })
  date: CalendarDate;

  @ApiProperty({ type: Number, nullable: true })
  dayNumber: number | null;

  @ApiProperty({ type: [DaySummaryExercise] })
  exercises: DaySummaryExercise[];

  @ApiProperty({ enum: MUSCLE_GROUP, isArray: true })
  muscleGroups: MUSCLE_GROUP[];
}

export function toEntryOutput(entry: Entry): EntryOutput {
  return {
    id: entry.id,
    date: entry.session!.date,
    exercise: toExerciseOutput(entry.exercise!),
    sets: (entry.sets ?? []).map((s) => ({
      setIndex: s.setIndex,
      reps: s.reps,
      weightKg: s.weightKg,
    })),
    durationMin: entry.durationMin,
    distanceKm: entry.distanceKm,
    speedKmh: entry.speedKmh,
    inclinePct: entry.inclinePct,
    metValue: entry.metValue,
    estKcal: entry.estKcal,
    // Mirrors estimateCalories(): only a measured duration is a real estimate.
    kcalIsRough: entry.durationMin === null,
    source: entry.source,
    rawInput: entry.rawInput,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function toDayDetail(
  date: CalendarDate,
  dayNumber: number | null,
  note: string | null,
  entries: Entry[],
): DayDetailOutput {
  const outputs = entries.map(toEntryOutput);
  const totalKcal = outputs.reduce((sum, e) => sum + (e.estKcal ?? 0), 0);
  return {
    date,
    dayNumber,
    note,
    totalKcal: Math.round(totalKcal * 10) / 10,
    entries: outputs,
  };
}

// Built field by field from the detail view: only activity-level facts.
export function toDaySummary(day: DayDetailOutput): DaySummaryOutput {
  const exercises = new Map<number, DaySummaryExercise>();
  for (const entry of day.entries) {
    exercises.set(entry.exercise.id, {
      id: entry.exercise.id,
      name: entry.exercise.name,
      nameJa: entry.exercise.nameJa,
      muscleGroup: entry.exercise.muscleGroup,
    });
  }
  const list = [...exercises.values()];
  return {
    date: day.date,
    dayNumber: day.dayNumber,
    exercises: list,
    muscleGroups: [...new Set(list.map((e) => e.muscleGroup))],
  };
}
