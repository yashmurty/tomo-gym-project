import { Injectable } from '@nestjs/common';

import { LIMITS } from '../../workout/constants/workout.constant';
import { MoveEntriesInput } from '../../workout/dtos/entry-input.dto';
import { WorkoutService } from '../../workout/services/workout.service';
import { McpTool, ToolContext } from './mcp-tool';
import { assertUnitForWeights, compactEntry, schema } from './tool-helpers';
import {
  EntryIdInput,
  ExerciseRefInput,
  GetDayInput,
  QueryHistoryInput,
  SetDayNoteToolInput,
  UpdateEntryToolInput,
} from './tool-inputs.dto';

// Undo-relevant part of the origin, for services that only change rows.
const actionOrigin = (toolCtx: ToolContext, tool: string) => ({
  actionGroup: toolCtx.origin.actionGroup,
  tool,
});

@Injectable()
export class GetDayTool implements McpTool<GetDayInput> {
  readonly name = 'get_day';
  readonly description =
    'List one day\'s entries with their entryIds (default today). Use before correcting or removing entries, e.g. "only these two today" or "remove the duplicate".';
  readonly inputDto = GetDayInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: { date: schema.date },
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run({ ctx, weightUnit }: ToolContext, input: GetDayInput) {
    const day = await this.workoutService.getDay(ctx, input.date ?? 'today');
    return {
      date: day.date,
      dayNumber: day.dayNumber,
      note: day.note,
      totalKcal: day.totalKcal,
      entries: day.entries.map((e) => compactEntry(e, weightUnit)),
    };
  }
}

@Injectable()
export class GetLastEntryTool implements McpTool<ExerciseRefInput> {
  readonly name = 'get_last_entry';
  readonly description =
    'The most recent entry for an exercise. For "same as last time": read it, then call log_entry with the same sets / duration.';
  readonly inputDto = ExerciseRefInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: { exercise: schema.exercise, exerciseId: schema.exerciseId },
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run({ ctx, weightUnit }: ToolContext, input: ExerciseRefInput) {
    const last = await this.workoutService.getLastEntry(ctx, input);
    return last
      ? { found: true, entry: compactEntry(last, weightUnit) }
      : { found: false };
  }
}

@Injectable()
export class QueryHistoryTool implements McpTool<QueryHistoryInput> {
  readonly name = 'query_history';
  readonly description =
    'Read past entries, newest first, to answer questions ("what did I lift last Tuesday?", "how has my incline changed?"). Filter by exercise, muscle group and/or date range (YYYY-MM-DD, worked out from the current <context> block). Read-only.';
  readonly inputDto = QueryHistoryInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      exercise: schema.exercise,
      exerciseId: schema.exerciseId,
      muscleGroup: {
        type: 'string',
        enum: [
          'chest',
          'back',
          'shoulders',
          'arms',
          'legs',
          'core',
          'full_body',
          'cardio',
        ],
      },
      from: { ...schema.date, description: 'First day, inclusive.' },
      to: { ...schema.date, description: 'Last day, inclusive.' },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Default 30.',
      },
    },
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run({ ctx, weightUnit }: ToolContext, input: QueryHistoryInput) {
    const entries = await this.workoutService.queryHistory(ctx, input);
    return {
      count: entries.length,
      entries: entries.map((e) => compactEntry(e, weightUnit)),
    };
  }
}

@Injectable()
export class UpdateEntryTool implements McpTool<UpdateEntryToolInput> {
  readonly name = 'update_entry';
  readonly description =
    'Correct an entry ("actually it was 3 sets"). `sets` replaces all sets; `date` moves it; a cardio field set to null clears it. Calories are recomputed by the server.';
  readonly inputDto = UpdateEntryToolInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      entryId: schema.entryId,
      exercise: schema.exercise,
      exerciseId: schema.exerciseId,
      date: schema.date,
      unit: schema.unit,
      sets: schema.sets,
      durationMin: schema.nullableNumber('Duration in minutes.'),
      distanceKm: schema.nullableNumber('Distance in km.'),
      speedKmh: schema.nullableNumber('Speed in km/h.'),
      inclinePct: schema.nullableNumber('Incline in percent.'),
    },
    required: ['entryId'],
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run(toolCtx: ToolContext, input: UpdateEntryToolInput) {
    assertUnitForWeights(input);
    const entry = await this.workoutService.updateEntry(
      toolCtx.ctx,
      input.entryId,
      input,
      actionOrigin(toolCtx, this.name),
    );
    const dayNumber = await this.workoutService.dayNumberFor(
      toolCtx.ctx,
      entry.date,
    );
    return { ...compactEntry(entry, toolCtx.weightUnit), dayNumber };
  }
}

@Injectable()
export class DeleteEntryTool implements McpTool<EntryIdInput> {
  readonly name = 'delete_entry';
  readonly description = 'Remove one entry (e.g. one logged twice). Undoable.';
  readonly inputDto = EntryIdInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: { entryId: schema.entryId },
    required: ['entryId'],
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run(toolCtx: ToolContext, input: EntryIdInput) {
    await this.workoutService.deleteEntry(
      toolCtx.ctx,
      input.entryId,
      actionOrigin(toolCtx, this.name),
    );
    return { deleted: input.entryId };
  }
}

@Injectable()
export class MoveEntriesTool implements McpTool<MoveEntriesInput> {
  readonly name = 'move_entries';
  readonly description =
    'Move entries to another day in one go ("these three were actually Tuesday"). Work out the YYYY-MM-DD date from the current <context> block.';
  readonly inputDto = MoveEntriesInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      entryIds: {
        type: 'array',
        items: { type: 'integer' },
        minItems: 1,
        maxItems: LIMITS.entriesPerMove,
        uniqueItems: true,
      },
      date: schema.date,
    },
    required: ['entryIds', 'date'],
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run(toolCtx: ToolContext, input: MoveEntriesInput) {
    const day = await this.workoutService.moveEntries(
      toolCtx.ctx,
      input,
      actionOrigin(toolCtx, this.name),
    );
    return {
      date: day.date,
      dayNumber: day.dayNumber,
      entries: day.entries.map((e) => compactEntry(e, toolCtx.weightUnit)),
    };
  }
}

@Injectable()
export class SetDayNoteTool implements McpTool<SetDayNoteToolInput> {
  readonly name = 'set_day_note';
  readonly description =
    'Set or clear (null) the note for a day, e.g. "felt strong today".';
  readonly inputDto = SetDayNoteToolInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      date: schema.date,
      note: { type: ['string', 'null'], maxLength: LIMITS.noteLength },
    },
    required: ['note'],
    additionalProperties: false as const,
  };

  constructor(private readonly workoutService: WorkoutService) {}

  async run(toolCtx: ToolContext, input: SetDayNoteToolInput) {
    const day = await this.workoutService.setDayNote(
      toolCtx.ctx,
      input.date ?? 'today',
      input.note,
      actionOrigin(toolCtx, this.name),
    );
    return { date: day.date, note: day.note };
  }
}
