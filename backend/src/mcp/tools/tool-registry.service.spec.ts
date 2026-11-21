import { BadRequestException } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

import { UndoService } from '../../action-log/services/undo.service';
import { ExerciseService } from '../../exercise/services/exercise.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { Clock } from '../../shared/time/clock';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserService } from '../../user/services/user.service';
import { ENTRY_SOURCE } from '../../workout/constants/workout.constant';
import { LogEntryInput } from '../../workout/dtos/entry-input.dto';
import { WorkoutService } from '../../workout/services/workout.service';
import {
  DeleteEntryTool,
  GetDayTool,
  GetLastEntryTool,
  MoveEntriesTool,
  QueryHistoryTool,
  SetDayNoteTool,
  UpdateEntryTool,
} from './entry.tools';
import { AddExerciseAliasTool, CreateExerciseTool } from './exercise.tools';
import { LogEntryTool } from './log-entry.tool';
import { GetProfileTool, UpdateProfileTool } from './profile.tools';
import { ToolRegistry } from './tool-registry.service';
import { UndoLastTool } from './undo.tools';

describe('ToolRegistry', () => {
  const workoutService = {
    logEntry: jest.fn(),
    dayNumberFor: jest.fn(),
    updateEntry: jest.fn(),
  };
  const userService = { updateUser: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const ws = workoutService as unknown as WorkoutService;
  const exerciseService = {} as ExerciseService;
  const us = userService as unknown as UserService;
  const registry = new ToolRegistry(
    new LogEntryTool(ws),
    new GetDayTool(ws),
    new GetLastEntryTool(ws),
    new QueryHistoryTool(ws),
    new UpdateEntryTool(ws),
    new DeleteEntryTool(ws),
    new MoveEntriesTool(ws),
    new SetDayNoteTool(ws),
    new CreateExerciseTool(exerciseService),
    new AddExerciseAliasTool(exerciseService),
    new GetProfileTool(us, new Clock()),
    new UpdateProfileTool(us),
    new UndoLastTool({} as UndoService),
    logger as any,
  );

  const ctx = new RequestContext();
  ctx.user = { id: 7, email: 'a@example.com', roles: ['USER'] as any };
  const toolCtx = {
    ctx,
    origin: { source: ENTRY_SOURCE.CHAT, actionGroup: 'msg:1' },
    undoScope: { prefix: 'msg:', exclude: 'msg:1' },
  };

  const entryOutput = {
    id: 1,
    date: '2026-11-20',
    exercise: { name: 'Squat', nameJa: 'スクワット' },
    weightUnit: WEIGHT_UNIT.KG,
    sets: [{ setIndex: 1, reps: 5, weightKg: 100, weight: 100 }],
    durationMin: null,
    distanceKm: null,
    speedKmh: null,
    inclinePct: null,
    estKcal: 12,
    kcalIsRough: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects unknown fields as an error, logs it, and never runs the tool', async () => {
    const outcome = await registry.call(
      'log_entry',
      { exercise: 'squat', sets: [{ reps: 5 }], userId: 999 },
      toolCtx,
    );
    expect(outcome).toEqual({
      ok: false,
      error: expect.stringContaining('property userId should not exist'),
    });
    expect(logger.warn).toHaveBeenCalled();
    expect(workoutService.logEntry).not.toHaveBeenCalled();
  });

  it('rejects invalid nested values with the DTO rules', async () => {
    const outcome = await registry.call(
      'log_entry',
      { exercise: 'squat', sets: [{ reps: 0 }] },
      toolCtx,
    );
    expect(outcome.ok).toBe(false);
    expect(workoutService.logEntry).not.toHaveBeenCalled();
  });

  it('passes validated input and the server-side origin to the service', async () => {
    workoutService.logEntry.mockResolvedValue(entryOutput);
    workoutService.dayNumberFor.mockResolvedValue(3);

    const outcome = await registry.call(
      'log_entry',
      { exercise: 'squat', unit: 'kg', sets: [{ reps: 5, weight: 100 }] },
      toolCtx,
    );

    expect(outcome).toMatchObject({
      ok: true,
      result: { entryId: 1, date: '2026-11-20', dayNumber: 3 },
    });
    const [, input, origin] = workoutService.logEntry.mock.calls[0];
    expect(input).toBeInstanceOf(LogEntryInput);
    expect(origin).toEqual({
      source: ENTRY_SOURCE.CHAT,
      actionGroup: 'msg:1',
      tool: 'log_entry',
    });
  });

  it("passes on the service's weights in the user's unit, next to kg", async () => {
    workoutService.logEntry.mockResolvedValue({
      ...entryOutput,
      weightUnit: WEIGHT_UNIT.LB,
      sets: [{ setIndex: 1, reps: 5, weightKg: 61.23, weight: 135 }],
    });
    workoutService.dayNumberFor.mockResolvedValue(3);

    const outcome = await registry.call(
      'log_entry',
      { exercise: 'bench', unit: 'lb', sets: [{ reps: 5, weight: 135 }] },
      toolCtx,
    );

    expect(outcome).toMatchObject({
      ok: true,
      result: {
        weightUnit: 'lb',
        sets: [{ reps: 5, weightKg: 61.23, weight: 135 }],
      },
    });
  });

  it.each([
    ['log_entry', { exercise: 'squat', sets: [{ reps: 5, weight: 100 }] }],
    ['update_entry', { entryId: 1, sets: [{ reps: 5, weight: 100 }] }],
  ])('%s requires a unit when sets carry weights', async (tool, args) => {
    const outcome = await registry.call(tool, args, toolCtx);
    expect(outcome).toEqual({
      ok: false,
      error: "Give `unit` ('kg' or 'lb') when sets have weights.",
    });
    expect(workoutService.logEntry).not.toHaveBeenCalled();
    expect(workoutService.updateEntry).not.toHaveBeenCalled();
  });

  it('passes only the undo-relevant origin to row-changing services', async () => {
    workoutService.updateEntry.mockResolvedValue(entryOutput);
    workoutService.dayNumberFor.mockResolvedValue(3);

    await registry.call(
      'update_entry',
      { entryId: 1, sets: [{ reps: 6 }] },
      toolCtx,
    );

    const [, entryId, , origin] = workoutService.updateEntry.mock.calls[0];
    expect(entryId).toBe(1);
    expect(origin).toEqual({ actionGroup: 'msg:1', tool: 'update_entry' });
  });

  it('update_profile never forwards name or password', async () => {
    userService.updateUser.mockResolvedValue({
      timezone: 'Asia/Tokyo',
      locale: 'en',
      weightUnit: 'kg',
      weightKg: 72,
    });

    const rejected = await registry.call(
      'update_profile',
      { weight: 72, password: 'hijack' },
      toolCtx,
    );
    expect(rejected.ok).toBe(false);

    await registry.call(
      'update_profile',
      { weight: 72, weightUnit: 'kg' },
      toolCtx,
    );
    const [, userId, changes] = userService.updateUser.mock.calls[0];
    expect(userId).toBe(7);
    expect(changes).toEqual({ weight: 72, weightUnit: 'kg' });
  });

  it('maps domain errors to tool errors', async () => {
    workoutService.logEntry.mockRejectedValue(
      new BadRequestException('Squat is a strength exercise: give sets.'),
    );
    const outcome = await registry.call(
      'log_entry',
      { exercise: 'squat', durationMin: 5 },
      toolCtx,
    );
    expect(outcome).toEqual({
      ok: false,
      error: 'Squat is a strength exercise: give sets.',
    });
  });

  it('reports unknown tools', async () => {
    expect(await registry.call('drop_tables', {}, toolCtx)).toEqual({
      ok: false,
      error: "Unknown tool 'drop_tables'",
    });
  });

  it('rejects arguments to tools that take none', async () => {
    const outcome = await registry.call(
      'undo_last',
      { groupKey: 'msg:999' },
      toolCtx,
    );
    expect(outcome).toEqual({
      ok: false,
      error: 'Invalid input: property groupKey should not exist',
    });
  });

  it('registers every tool once, with a description', () => {
    const names = registry.all().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual(
      [
        'add_exercise_alias',
        'create_exercise',
        'delete_entry',
        'get_day',
        'get_last_entry',
        'get_profile',
        'log_entry',
        'move_entries',
        'query_history',
        'set_day_note',
        'undo_last',
        'update_entry',
        'update_profile',
      ].sort(),
    );
    for (const tool of registry.all()) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it.each(registry.all().map((t) => [t.name, t] as const))(
    "%s advertises exactly its DTO's fields, with no extras allowed",
    (_name, tool) => {
      const dtoFields = tool.inputDto
        ? getMetadataStorage()
            .getTargetValidationMetadatas(tool.inputDto, '', true, false)
            .map((m) => m.propertyName)
        : [];
      expect(new Set(Object.keys(tool.inputSchema.properties))).toEqual(
        new Set(dtoFields),
      );
      expect(tool.inputSchema.additionalProperties).toBe(false);
      for (const required of tool.inputSchema.required ?? []) {
        expect(dtoFields).toContain(required);
      }
    },
  );
});
