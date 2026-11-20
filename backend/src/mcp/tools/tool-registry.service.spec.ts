import { BadRequestException } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

import { RequestContext } from '../../shared/request-context/request-context.dto';
import { ENTRY_SOURCE } from '../../workout/constants/workout.constant';
import { LogEntryInput } from '../../workout/dtos/entry-input.dto';
import { WorkoutService } from '../../workout/services/workout.service';
import { LogEntryTool } from './log-entry.tool';
import { ToolRegistry } from './tool-registry.service';

describe('ToolRegistry', () => {
  const workoutService = {
    logEntry: jest.fn(),
    dayNumberFor: jest.fn(),
  };
  const logger = { setContext: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const logEntry = new LogEntryTool(
    workoutService as unknown as WorkoutService,
  );
  const registry = new ToolRegistry(logEntry, logger as any);

  const ctx = new RequestContext();
  ctx.user = { id: 7, email: 'a@example.com', roles: ['USER'] as any };
  const toolCtx = {
    ctx,
    origin: { source: ENTRY_SOURCE.CHAT, actionGroup: 'msg:1' },
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
    workoutService.logEntry.mockResolvedValue({
      id: 1,
      date: '2026-11-20',
      exercise: { name: 'Squat', nameJa: 'スクワット' },
      sets: [{ setIndex: 1, reps: 5, weightKg: 100 }],
      durationMin: null,
      distanceKm: null,
      speedKmh: null,
      inclinePct: null,
      estKcal: 12,
      kcalIsRough: true,
    });
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

  it('requires a unit when sets carry weights, instead of guessing', async () => {
    const outcome = await registry.call(
      'log_entry',
      { exercise: 'squat', sets: [{ reps: 5, weight: 100 }] },
      toolCtx,
    );
    expect(outcome).toEqual({
      ok: false,
      error: "Give `unit` ('kg' or 'lb') when sets have weights.",
    });
    expect(workoutService.logEntry).not.toHaveBeenCalled();

    // Bodyweight sets without weights don't need one.
    workoutService.logEntry.mockRejectedValueOnce(
      new BadRequestException('stop here'),
    );
    const noWeight = await registry.call(
      'log_entry',
      { exercise: 'push-up', sets: [{ reps: 20 }] },
      toolCtx,
    );
    expect(noWeight).toEqual({ ok: false, error: 'stop here' });
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

  it("advertises exactly the DTO's fields in log_entry's schema", () => {
    const dtoFields = new Set(
      getMetadataStorage()
        .getTargetValidationMetadatas(LogEntryInput, '', true, false)
        .map((m) => m.propertyName),
    );
    expect(new Set(Object.keys(logEntry.inputSchema.properties))).toEqual(
      dtoFields,
    );
    expect(logEntry.inputSchema.additionalProperties).toBe(false);
  });
});
