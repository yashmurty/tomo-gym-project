import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseRepository } from '../repositories/exercise.repository';
import { ExerciseService } from './exercise.service';
import { ExerciseAclService } from './exercise-acl.service';

describe('ExerciseService.resolve', () => {
  const repository = {
    findByAlias: jest.fn(),
    findByAliasFragments: jest.fn(),
    findVisibleById: jest.fn(),
  };
  const logger = { setContext: jest.fn(), log: jest.fn() };
  const service = new ExerciseService(
    repository as unknown as ExerciseRepository,
    new ExerciseAclService(),
    {} as DataSource,
    logger as unknown as AppLogger,
  );
  const ctx = new RequestContext();
  ctx.user = { id: 7, email: 'a@example.com', roles: [ROLE.USER] };

  beforeEach(() => jest.resetAllMocks());

  it('requires exactly one of exerciseId or exercise', async () => {
    await expect(service.resolve(ctx, {})).rejects.toThrow(BadRequestException);
    await expect(
      service.resolve(ctx, { exerciseId: 1, exercise: 'squat' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('looks names up by their normalised alias key', async () => {
    const latPulldown = {
      id: 1,
      name: 'Lat pulldown',
      userId: null,
    } as Exercise;
    repository.findByAlias.mockResolvedValue(latPulldown);

    await expect(
      service.resolve(ctx, { exercise: 'Lat Pull-Down' }),
    ).resolves.toBe(latPulldown);
    expect(repository.findByAlias).toHaveBeenCalledWith(7, 'latpulldown');
  });

  it('fails with suggestions built from name fragments', async () => {
    repository.findByAlias.mockResolvedValue(null);
    repository.findByAliasFragments.mockResolvedValue([
      { id: 4, name: 'Pec fly' },
      { id: 3, name: 'Chest press' },
    ]);

    await expect(
      service.resolve(ctx, { exercise: 'pec flye' }),
    ).rejects.toThrow(
      new UnprocessableEntityException(
        "Unknown exercise 'pec flye'. Did you mean: Pec fly, Chest press?",
      ),
    );
    // Fragments shorter than 3 characters are too noisy to search on.
    expect(repository.findByAliasFragments).toHaveBeenCalledWith(
      7,
      ['pec', 'flye'],
      5,
    );
  });
});
