import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Action } from '../../shared/acl/action.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { CALORIE_MODEL, MODALITY } from '../constants/exercise.constant';
import { CreateExerciseInput } from '../dtos/exercise-create-input.dto';
import { ExerciseOutput, toExerciseOutput } from '../dtos/exercise-output.dto';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseAlias } from '../entities/exercise-alias.entity';
import { ExerciseRepository } from '../repositories/exercise.repository';
import { normalizeExerciseName } from '../utils/normalize-exercise-name';
import { ExerciseAclService } from './exercise-acl.service';

// Defaults for user-created exercises (Compendium of Physical Activities,
// moderate effort). Catalog entries carry their own values.
const CUSTOM_EXERCISE_MET: Record<MODALITY, number> = {
  [MODALITY.STRENGTH]: 3.5,
  [MODALITY.BODYWEIGHT]: 3.8,
  [MODALITY.CARDIO]: 5.0,
};

const MAX_SUGGESTIONS = 5;
const MIN_FRAGMENT_LENGTH = 3;

// Identifies an exercise either by id (UI pickers) or by name as typed
// (agent tools). Exactly one must be given.
export interface ExerciseRef {
  exerciseId?: number;
  exercise?: string;
}

@Injectable()
export class ExerciseService {
  constructor(
    private readonly repository: ExerciseRepository,
    private readonly aclService: ExerciseAclService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ExerciseService.name);
  }

  // Resolves an id or a typed name to an exercise the caller may use.
  // Unknown names fail with suggestions, so the agent (or user) can pick one
  // or create the exercise.
  async resolve(ctx: RequestContext, ref: ExerciseRef): Promise<Exercise> {
    this.logger.log(ctx, `${this.resolve.name} was called`);
    const userId = ctx.user!.id;

    const hasId = ref.exerciseId !== undefined;
    const hasName = ref.exercise !== undefined;
    if (hasId === hasName) {
      throw new BadRequestException(
        'Give exactly one of exerciseId or exercise',
      );
    }

    if (hasId) {
      return this.getVisibleEntity(ctx, ref.exerciseId!);
    }

    const normalized = normalizeExerciseName(ref.exercise!);
    const match = await this.repository.findByAlias(userId, normalized);
    if (match) return match;

    const fragments = ref
      .exercise!.normalize('NFKC')
      .toLowerCase()
      .split(/[\s\-_・.,/]+/)
      .map(normalizeExerciseName)
      .filter((f) => f.length >= MIN_FRAGMENT_LENGTH);
    const candidates = await this.repository.findByAliasFragments(
      userId,
      fragments,
      MAX_SUGGESTIONS,
    );

    const suggestion = candidates.length
      ? ` Did you mean: ${candidates.map((c) => c.name).join(', ')}?`
      : '';
    throw new UnprocessableEntityException(
      `Unknown exercise '${ref.exercise}'.${suggestion}`,
    );
  }

  async getVisibleEntity(ctx: RequestContext, id: number): Promise<Exercise> {
    const exercise = await this.repository.findVisibleById(ctx.user!.id, id);
    if (!exercise) throw new NotFoundException(`Exercise ${id} not found`);

    if (
      !this.aclService.forActor(ctx.user!).canDoAction(Action.Read, exercise)
    ) {
      throw new UnauthorizedException();
    }
    return exercise;
  }

  async list(ctx: RequestContext, search?: string): Promise<ExerciseOutput[]> {
    this.logger.log(ctx, `${this.list.name} was called`);

    if (!this.aclService.forActor(ctx.user!).canDoAction(Action.List)) {
      throw new UnauthorizedException();
    }

    const normalized = search ? normalizeExerciseName(search) : undefined;
    const exercises = await this.repository.listVisible(
      ctx.user!.id,
      normalized || undefined,
    );
    return exercises.map(toExerciseOutput);
  }

  async create(
    ctx: RequestContext,
    input: CreateExerciseInput,
  ): Promise<ExerciseOutput> {
    this.logger.log(ctx, `${this.create.name} was called`);
    const userId = ctx.user!.id;

    if (!this.aclService.forActor(ctx.user!).canDoAction(Action.Create)) {
      throw new UnauthorizedException();
    }

    const names = [input.name, input.nameJa].filter(
      (n): n is string => n !== undefined,
    );
    for (const name of names) {
      const existing = await this.repository.findByAlias(
        userId,
        normalizeExerciseName(name),
      );
      if (existing) {
        throw new ConflictException(
          `'${name}' already exists as the exercise '${existing.name}'`,
        );
      }
    }

    // Exercise + its name aliases in one short transaction.
    const created = await this.dataSource.transaction(async (manager) => {
      const exercise = await manager.save(
        manager.create(Exercise, {
          userId,
          name: input.name,
          nameJa: input.nameJa ?? null,
          modality: input.modality,
          muscleGroup: input.muscleGroup,
          defaultMet: CUSTOM_EXERCISE_MET[input.modality],
          calorieModel: CALORIE_MODEL.MET,
        }),
      );

      const uniqueKeys = new Map(
        names.map((n) => [normalizeExerciseName(n), n] as const),
      );
      await manager.save(
        [...uniqueKeys].map(([normalizedAlias, alias]) =>
          manager.create(ExerciseAlias, {
            userId,
            exerciseId: exercise.id,
            alias,
            normalizedAlias,
          }),
        ),
      );
      return exercise;
    });

    return toExerciseOutput(created);
  }
}
