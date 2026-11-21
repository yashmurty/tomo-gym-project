import { Injectable } from '@nestjs/common';

import { LIMITS } from '../../workout/constants/workout.constant';
import { LogEntryInput } from '../../workout/dtos/entry-input.dto';
import { WorkoutService } from '../../workout/services/workout.service';
import { McpTool, ToolContext } from './mcp-tool';
import { assertUnitForWeights, compactEntry } from './tool-helpers';

const number = (description: string, extra: object = {}) => ({
  type: 'number',
  description,
  ...extra,
});

@Injectable()
export class LogEntryTool implements McpTool<LogEntryInput> {
  readonly name = 'log_entry';
  readonly description = [
    'Log one exercise the user did. Call once per exercise; for several exercises in one message, call it several times.',
    'Strength: give `sets` (one object per set; "2x10 @ 47kg" is two sets of {reps: 10, weight: 47}).',
    'Cardio: give `durationMin`, plus `speedKmh` / `inclinePct` / `distanceKm` if mentioned.',
    'Bodyweight: either `sets` or `durationMin`.',
    "`date`: 'today' unless the user names another day; then 'yesterday' or YYYY-MM-DD. Never guess a date from earlier messages.",
    '`unit` (kg or lb) is required whenever a set has a weight; "lg" and "kgs" mean kg. The server converts units and computes calories and the day number. Never compute them yourself.',
  ].join(' ');
  readonly inputDto = LogEntryInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      exercise: {
        type: 'string',
        description:
          'Exercise name as the user wrote it (EN or JP), e.g. "lat pulldown", "ペックフライ".',
      },
      exerciseId: {
        type: 'integer',
        description: 'Alternative to `exercise`, if known.',
      },
      date: {
        type: 'string',
        description: "'today' (default), 'yesterday', or YYYY-MM-DD.",
      },
      unit: {
        type: 'string',
        enum: ['kg', 'lb'],
        description: 'Unit of set weights. Required when any set has a weight.',
      },
      sets: {
        type: 'array',
        minItems: 1,
        maxItems: LIMITS.setsPerEntry,
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
      durationMin: number('Cardio / timed exercise duration in minutes.', {
        exclusiveMinimum: 0,
      }),
      distanceKm: number('Distance in km.', { exclusiveMinimum: 0 }),
      speedKmh: number('Treadmill speed in km/h.', { exclusiveMinimum: 0 }),
      inclinePct: number('Treadmill incline in percent.'),
    },
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run({ ctx, origin }: ToolContext, input: LogEntryInput) {
    assertUnitForWeights(input);

    const entry = await this.workoutService.logEntry(ctx, input, {
      ...origin,
      tool: this.name,
    });
    const dayNumber = await this.workoutService.dayNumberFor(ctx, entry.date);

    // Echo the resolved date and day number so the model (and user) can see
    // exactly where the entry was filed (constitution rule 8).
    return { ...compactEntry(entry), dayNumber };
  }
}
