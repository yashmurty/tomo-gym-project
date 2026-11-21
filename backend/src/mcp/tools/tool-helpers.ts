import { BadRequestException } from '@nestjs/common';

import { fromKg, WEIGHT_UNIT } from '../../shared/units/weight';
import { LIMITS } from '../../workout/constants/workout.constant';
import { SetInput } from '../../workout/dtos/entry-input.dto';
import { EntryOutput } from '../../workout/dtos/workout-output.dto';

// The entry shape every tool returns: ids for follow-up calls, the resolved
// date, and server-computed values the model must repeat, not recompute.
export function compactEntry(entry: EntryOutput, weightUnit: WEIGHT_UNIT) {
  return {
    entryId: entry.id,
    date: entry.date,
    exercise: entry.exercise.name,
    exerciseJa: entry.exercise.nameJa,
    // `weight` is in `weightUnit` (the user's), for quoting back to them.
    weightUnit,
    sets: entry.sets.map((s) => ({
      reps: s.reps,
      weightKg: s.weightKg,
      weight: s.weightKg === null ? null : fromKg(s.weightKg, weightUnit),
    })),
    durationMin: entry.durationMin,
    distanceKm: entry.distanceKm,
    speedKmh: entry.speedKmh,
    inclinePct: entry.inclinePct,
    estKcal: entry.estKcal,
    kcalIsRough: entry.kcalIsRough,
  };
}

// REST falls back to the user's display unit, which is fine when a form
// shows it. For a model it would be a silent guess ("47" stored as 47 lb =
// 21.3 kg), so tools must say which unit they mean.
export function assertUnitForWeights(input: {
  sets?: SetInput[];
  unit?: string;
}): void {
  if (input.sets?.some((s) => s.weight !== undefined) && !input.unit) {
    throw new BadRequestException(
      "Give `unit` ('kg' or 'lb') when sets have weights.",
    );
  }
}

// JSON Schema fragments shared by tool definitions.
export const schema = {
  date: {
    type: 'string',
    description: "'today' (default), 'yesterday', or YYYY-MM-DD.",
  },
  exercise: {
    type: 'string',
    description:
      'Exercise name as the user wrote it (EN or JP), e.g. "lat pulldown", "ペックフライ".',
  },
  exerciseId: { type: 'integer', description: 'Alternative to `exercise`.' },
  unit: {
    type: 'string',
    enum: ['kg', 'lb'],
    description: 'Unit of set weights. Required when any set has a weight.',
  },
  sets: {
    type: 'array',
    minItems: 1,
    maxItems: LIMITS.setsPerEntry,
    description:
      'One object per set; "2x10 @ 47" is two {reps: 10, weight: 47}.',
    items: {
      type: 'object',
      properties: {
        reps: { type: 'integer', minimum: 1 },
        weight: { type: 'number', minimum: 0 },
      },
      required: ['reps'],
      additionalProperties: false,
    },
  },
  number: (description: string, extra: object = {}) => ({
    type: 'number',
    description,
    ...extra,
  }),
  nullableNumber: (description: string) => ({
    type: ['number', 'null'],
    description: `${description} null clears it.`,
  }),
  entryId: {
    type: 'integer',
    description: 'From log_entry / get_day / query_history results.',
  },
} as const;
