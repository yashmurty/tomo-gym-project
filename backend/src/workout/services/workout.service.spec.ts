import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ROLE } from '../../auth/constants/role.constant';
import {
  CALORIE_MODEL,
  MODALITY,
  MUSCLE_GROUP,
} from '../../exercise/constants/exercise.constant';
import { Exercise } from '../../exercise/entities/exercise.entity';
import { ExerciseService } from '../../exercise/services/exercise.service';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserService } from '../../user/services/user.service';
import { LogEntryInput } from '../dtos/entry-input.dto';
import { EntryRepository } from '../repositories/entry.repository';
import { WorkoutSessionRepository } from '../repositories/workout-session.repository';
import { WorkoutService } from './workout.service';
import { WorkoutAclService } from './workout-acl.service';

// Validation that runs before any write: modality rules and set limits.
describe('WorkoutService.logEntry validation', () => {
  const exercise = (modality: MODALITY): Exercise =>
    ({
      id: 1,
      userId: null,
      name: 'Test exercise',
      nameJa: null,
      modality,
      muscleGroup: MUSCLE_GROUP.LEGS,
      defaultMet: 3.5,
      calorieModel: CALORIE_MODEL.MET,
    }) as Exercise;

  const exerciseService = { resolve: jest.fn() };
  const userService = {
    getSelfProfile: jest.fn().mockResolvedValue({
      id: 7,
      timezone: 'Asia/Tokyo',
      weightKg: 72,
      weightUnit: WEIGHT_UNIT.KG,
    }),
  };
  const dataSource = { transaction: jest.fn() };
  const logger = { setContext: jest.fn(), log: jest.fn() };

  const service = new WorkoutService(
    {} as EntryRepository,
    {} as WorkoutSessionRepository,
    exerciseService as unknown as ExerciseService,
    userService as unknown as UserService,
    new WorkoutAclService(),
    dataSource as unknown as DataSource,
    logger as unknown as AppLogger,
  );
  const ctx = new RequestContext();
  ctx.user = { id: 7, email: 'a@example.com', roles: [ROLE.USER] };

  const log = (modality: MODALITY, input: Partial<LogEntryInput>) => {
    exerciseService.resolve.mockResolvedValue(exercise(modality));
    return service.logEntry(ctx, { exercise: 'x', ...input } as LogEntryInput);
  };
  const sets = [{ reps: 10, weight: 40 }];

  it.each([
    ['strength without sets', MODALITY.STRENGTH, {}, 'give sets'],
    [
      'strength with a duration',
      MODALITY.STRENGTH,
      { sets, durationMin: 5 },
      'remove duration',
    ],
    [
      'cardio without a duration',
      MODALITY.CARDIO,
      { speedKmh: 6 },
      'give a duration',
    ],
    [
      'cardio with sets',
      MODALITY.CARDIO,
      { sets, durationMin: 5 },
      'remove sets',
    ],
    ['bodyweight with neither', MODALITY.BODYWEIGHT, {}, 'either sets'],
    [
      'bodyweight with both',
      MODALITY.BODYWEIGHT,
      { sets, durationMin: 1 },
      'either sets',
    ],
    [
      'bodyweight with speed',
      MODALITY.BODYWEIGHT,
      { durationMin: 1, speedKmh: 5 },
      "doesn't take",
    ],
  ])(
    'rejects %s, saying what to send instead',
    async (_l, modality, input, hint) => {
      await expect(log(modality, input)).rejects.toThrow(BadRequestException);
      await expect(log(modality, input)).rejects.toThrow(hint);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a set weight over the limit after unit conversion', async () => {
    // 2300 lb ≈ 1043 kg
    await expect(
      log(MODALITY.STRENGTH, {
        unit: WEIGHT_UNIT.LB,
        sets: [{ reps: 1, weight: 2300 }],
      }),
    ).rejects.toThrow('over the 1000 kg limit');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a future date before touching the database', async () => {
    await expect(
      log(MODALITY.STRENGTH, { sets, date: '2999-01-01' }),
    ).rejects.toThrow('is in the future');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
