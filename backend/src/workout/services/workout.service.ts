import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { MODALITY } from '../../exercise/constants/exercise.constant';
import { Exercise } from '../../exercise/entities/exercise.entity';
import { ExerciseService } from '../../exercise/services/exercise.service';
import { Action } from '../../shared/acl/action.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  CalendarDate,
  isCalendarDate,
  resolveWorkoutDate,
} from '../../shared/time/calendar-date';
import { toKg, WEIGHT_UNIT } from '../../shared/units/weight';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { UserService } from '../../user/services/user.service';
import { ENTRY_SOURCE, LIMITS } from '../constants/workout.constant';
import {
  DayListQuery,
  LogEntryInput,
  MoveEntriesInput,
  SetInput,
  UpdateEntryInput,
} from '../dtos/entry-input.dto';
import {
  DayDetailOutput,
  EntryOutput,
  toDayDetail,
  toEntryOutput,
} from '../dtos/workout-output.dto';
import { Entry } from '../entities/entry.entity';
import { EntrySet } from '../entities/entry-set.entity';
import { EntryRepository } from '../repositories/entry.repository';
import { WorkoutSessionRepository } from '../repositories/workout-session.repository';
import { estimateCalories } from './calorie';
import { WorkoutAclService } from './workout-acl.service';

// Server-side facts about where a write came from. Never part of any
// client-facing input DTO (constitution rule 12): REST callers get the
// default; the MCP layer (Step 4) passes chat / mcp origins.
export interface EntryOrigin {
  source: ENTRY_SOURCE;
  rawInput?: string | null;
  sourceClient?: string | null;
  sourceMessageId?: number | null;
}

interface SetKg {
  reps: number;
  weightKg: number | null;
}

// An entry's measurements, normalised to kg, before validation against the
// exercise's modality.
interface EntryShape {
  sets: SetKg[];
  durationMin: number | null;
  distanceKm: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
}

const DEFAULT_DAYS_PER_PAGE = 30;

@Injectable()
export class WorkoutService {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly sessionRepository: WorkoutSessionRepository,
    private readonly exerciseService: ExerciseService,
    private readonly userService: UserService,
    private readonly aclService: WorkoutAclService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(WorkoutService.name);
  }

  async logEntry(
    ctx: RequestContext,
    input: LogEntryInput,
    origin: EntryOrigin = { source: ENTRY_SOURCE.APP },
  ): Promise<EntryOutput> {
    this.logger.log(ctx, `${this.logEntry.name} was called`);
    this.assertAllowed(ctx, Action.Create);

    const user = await this.userService.getSelfProfile(ctx);
    const date = resolveWorkoutDate(input.date, user.timezone);
    const exercise = await this.exerciseService.resolve(ctx, input);

    const shape: EntryShape = {
      sets: this.setsToKg(input.sets, input.unit ?? user.weightUnit) ?? [],
      durationMin: input.durationMin ?? null,
      distanceKm: input.distanceKm ?? null,
      speedKmh: input.speedKmh ?? null,
      inclinePct: input.inclinePct ?? null,
    };
    this.assertShapeFits(exercise, shape);
    const calories = this.calories(exercise, shape, user);

    // One short transaction: session (find or create), entry, sets.
    const entryId = await this.dataSource.transaction(async (manager) => {
      const session = await this.sessionRepository.findOrCreate(
        manager,
        user.id,
        date,
      );
      const entry = await manager.save(
        manager.create(Entry, {
          userId: user.id,
          sessionId: session.id,
          exerciseId: exercise.id,
          durationMin: shape.durationMin,
          distanceKm: shape.distanceKm,
          speedKmh: shape.speedKmh,
          inclinePct: shape.inclinePct,
          metValue: calories.metValue,
          estKcal: calories.estKcal,
          source: origin.source,
          rawInput: origin.rawInput ?? null,
          sourceClient: origin.sourceClient ?? null,
          sourceMessageId: origin.sourceMessageId ?? null,
        }),
      );
      await this.insertSets(manager, entry.id, shape.sets);
      return entry.id;
    });

    return this.getEntryOutput(entryId);
  }

  // `sets` replaces all sets; `date` moves the entry; cardio fields set to
  // null are cleared. Calories are recomputed with the current body weight.
  async updateEntry(
    ctx: RequestContext,
    entryId: number,
    input: UpdateEntryInput,
  ): Promise<EntryOutput> {
    this.logger.log(ctx, `${this.updateEntry.name} was called`);

    const entry = await this.getOwnedEntry(ctx, entryId, Action.Update);
    const user = await this.userService.getSelfProfile(ctx);

    const changingExercise =
      input.exercise !== undefined || input.exerciseId !== undefined;
    const exercise = changingExercise
      ? await this.exerciseService.resolve(ctx, input)
      : entry.exercise!;

    const newSets = this.setsToKg(input.sets, input.unit ?? user.weightUnit);
    const shape: EntryShape = {
      sets:
        newSets ??
        entry.sets!.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
      durationMin: pick(input.durationMin, entry.durationMin),
      distanceKm: pick(input.distanceKm, entry.distanceKm),
      speedKmh: pick(input.speedKmh, entry.speedKmh),
      inclinePct: pick(input.inclinePct, entry.inclinePct),
    };
    this.assertShapeFits(exercise, shape);
    const calories = this.calories(exercise, shape, user);

    const targetDate =
      input.date === undefined
        ? undefined
        : resolveWorkoutDate(input.date, user.timezone);

    await this.dataSource.transaction(async (manager) => {
      let sessionId = entry.sessionId;
      if (targetDate !== undefined && targetDate !== entry.session!.date) {
        sessionId = (
          await this.sessionRepository.findOrCreate(
            manager,
            user.id,
            targetDate,
          )
        ).id;
      }

      await manager.update(Entry, entry.id, {
        sessionId,
        exerciseId: exercise.id,
        durationMin: shape.durationMin,
        distanceKm: shape.distanceKm,
        speedKmh: shape.speedKmh,
        inclinePct: shape.inclinePct,
        metValue: calories.metValue,
        estKcal: calories.estKcal,
      });

      if (newSets) {
        await manager.delete(EntrySet, { entryId: entry.id });
        await this.insertSets(manager, entry.id, newSets);
      }
    });

    return this.getEntryOutput(entry.id);
  }

  // Soft delete, so a later undo can restore it.
  async deleteEntry(ctx: RequestContext, entryId: number): Promise<void> {
    this.logger.log(ctx, `${this.deleteEntry.name} was called`);
    const entry = await this.getOwnedEntry(ctx, entryId, Action.Delete);
    await this.entryRepository.softDelete(entry.id);
  }

  // "These three were actually Tuesday": all entries move, or none do.
  async moveEntries(
    ctx: RequestContext,
    input: MoveEntriesInput,
  ): Promise<DayDetailOutput> {
    this.logger.log(ctx, `${this.moveEntries.name} was called`);
    const user = await this.userService.getSelfProfile(ctx);
    const date = resolveWorkoutDate(input.date, user.timezone);

    const entries = await this.entryRepository.findWithDetails(input.entryIds);
    const found = new Set(entries.map((e) => e.id));
    const missing = input.entryIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(`Entries not found: ${missing.join(', ')}`);
    }
    for (const entry of entries) {
      this.assertAllowed(ctx, Action.Update, entry);
    }

    await this.dataSource.transaction(async (manager) => {
      const session = await this.sessionRepository.findOrCreate(
        manager,
        user.id,
        date,
      );
      await manager.update(Entry, input.entryIds, { sessionId: session.id });
    });

    return this.getDayForUser(user.id, date);
  }

  async getDay(ctx: RequestContext, dateArg: string): Promise<DayDetailOutput> {
    this.logger.log(ctx, `${this.getDay.name} was called`);
    this.assertAllowed(ctx, Action.List);

    const user = await this.userService.getSelfProfile(ctx);
    const date = resolveWorkoutDate(dateArg, user.timezone);
    return this.getDayForUser(user.id, date);
  }

  // The user's training days (days with entries), newest first.
  async listDays(
    ctx: RequestContext,
    query: DayListQuery,
  ): Promise<DayDetailOutput[]> {
    this.logger.log(ctx, `${this.listDays.name} was called`);
    this.assertAllowed(ctx, Action.List);

    for (const [name, value] of [
      ['from', query.from],
      ['to', query.to],
    ] as const) {
      if (value !== undefined && !isCalendarDate(value)) {
        throw new BadRequestException(
          `${name} must be a date in YYYY-MM-DD form`,
        );
      }
    }

    const userId = ctx.user!.id;
    const sessions = await this.sessionRepository.findDaysWithEntries(
      userId,
      query.from,
      query.to,
      query.limit ?? DEFAULT_DAYS_PER_PAGE,
    );
    const [entries, dayNumbers] = await Promise.all([
      this.entryRepository.findForSessions(sessions.map((s) => s.id)),
      this.sessionRepository.dayNumbers(
        userId,
        sessions.map((s) => s.date),
      ),
    ]);

    return sessions.map((s) =>
      toDayDetail(
        s.date,
        dayNumbers.get(s.date) ?? null,
        s.note,
        entries.filter((e) => e.sessionId === s.id),
      ),
    );
  }

  async setDayNote(
    ctx: RequestContext,
    dateArg: string,
    note: string | null,
  ): Promise<DayDetailOutput> {
    this.logger.log(ctx, `${this.setDayNote.name} was called`);
    this.assertAllowed(ctx, Action.Create);

    const user = await this.userService.getSelfProfile(ctx);
    const date = resolveWorkoutDate(dateArg, user.timezone);

    await this.dataSource.transaction(async (manager) => {
      const session = await this.sessionRepository.findOrCreate(
        manager,
        user.id,
        date,
      );
      this.assertAllowed(ctx, Action.Update, session);
      await manager.update('sessions', session.id, { note });
    });

    return this.getDayForUser(user.id, date);
  }

  // ---- helpers ----

  private async getDayForUser(
    userId: number,
    date: CalendarDate,
  ): Promise<DayDetailOutput> {
    const session = await this.sessionRepository.findOneBy({ userId, date });
    if (!session) return toDayDetail(date, null, null, []);

    const [entries, dayNumbers] = await Promise.all([
      this.entryRepository.findForSessions([session.id]),
      this.sessionRepository.dayNumbers(userId, [date]),
    ]);
    return toDayDetail(
      date,
      dayNumbers.get(date) ?? null,
      session.note,
      entries,
    );
  }

  private async getEntryOutput(entryId: number): Promise<EntryOutput> {
    const [entry] = await this.entryRepository.findWithDetails([entryId]);
    return toEntryOutput(entry);
  }

  private async getOwnedEntry(
    ctx: RequestContext,
    entryId: number,
    action: Action,
  ): Promise<Entry> {
    const [entry] = await this.entryRepository.findWithDetails([entryId]);
    if (!entry) throw new NotFoundException(`Entry ${entryId} not found`);
    this.assertAllowed(ctx, action, entry);
    return entry;
  }

  private assertAllowed(
    ctx: RequestContext,
    action: Action,
    resource?: { userId: number },
  ): void {
    if (!this.aclService.forActor(ctx.user!).canDoAction(action, resource)) {
      throw new UnauthorizedException();
    }
  }

  private setsToKg(
    sets: SetInput[] | undefined,
    unit: WEIGHT_UNIT,
  ): SetKg[] | undefined {
    if (sets === undefined) return undefined;
    return sets.map((s) => {
      const weightKg = s.weight === undefined ? null : toKg(s.weight, unit);
      if (weightKg !== null && weightKg > LIMITS.setWeightKg) {
        throw new BadRequestException(
          `A set weight of ${s.weight} ${unit} is over the ${LIMITS.setWeightKg} kg limit`,
        );
      }
      return { reps: s.reps, weightKg };
    });
  }

  // Strength needs sets; cardio needs a duration; bodyweight takes either.
  // Messages are written for the agent as much as for people: they say what
  // to send instead.
  private assertShapeFits(exercise: Exercise, shape: EntryShape): void {
    const hasSets = shape.sets.length > 0;
    const hasCardio =
      shape.durationMin !== null ||
      shape.distanceKm !== null ||
      shape.speedKmh !== null ||
      shape.inclinePct !== null;
    const name = exercise.name;

    switch (exercise.modality) {
      case MODALITY.STRENGTH:
        if (!hasSets) {
          throw new BadRequestException(
            `${name} is a strength exercise: give sets (e.g. 2 × 10 @ 47 kg).`,
          );
        }
        if (hasCardio) {
          throw new BadRequestException(
            `${name} is a strength exercise: remove duration / distance / speed / incline.`,
          );
        }
        return;

      case MODALITY.BODYWEIGHT:
        if (hasSets === (shape.durationMin !== null)) {
          throw new BadRequestException(
            `${name} takes either sets (e.g. 3 × 15) or a duration in minutes, not both or neither.`,
          );
        }
        if (
          shape.distanceKm !== null ||
          shape.speedKmh !== null ||
          shape.inclinePct !== null
        ) {
          throw new BadRequestException(
            `${name} doesn't take distance / speed / incline.`,
          );
        }
        return;

      case MODALITY.CARDIO:
        if (shape.durationMin === null) {
          throw new BadRequestException(
            `${name} is cardio: give a duration in minutes (plus optional distance / speed / incline).`,
          );
        }
        if (hasSets) {
          throw new BadRequestException(`${name} is cardio: remove sets.`);
        }
        return;
    }
  }

  private calories(exercise: Exercise, shape: EntryShape, user: UserOutput) {
    return estimateCalories(
      {
        modality: exercise.modality,
        calorieModel: exercise.calorieModel,
        defaultMet: exercise.defaultMet,
        setCount: shape.sets.length,
        durationMin: shape.durationMin,
        speedKmh: shape.speedKmh,
        inclinePct: shape.inclinePct,
      },
      user.weightKg,
    );
  }

  private async insertSets(
    manager: EntityManager,
    entryId: number,
    sets: SetKg[],
  ): Promise<void> {
    if (sets.length === 0) return;
    await manager.insert(
      EntrySet,
      sets.map((s, i) => ({
        entryId,
        setIndex: i + 1,
        reps: s.reps,
        weightKg: s.weightKg,
      })),
    );
  }
}

// For partial updates: undefined keeps the current value, null clears it.
function pick<T>(next: T | null | undefined, current: T | null): T | null {
  return next === undefined ? current : next;
}
