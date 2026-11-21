import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { Exercise } from '../../exercise/entities/exercise.entity';
import { ExerciseAlias } from '../../exercise/entities/exercise-alias.entity';
import { Action } from '../../shared/acl/action.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { User } from '../../user/entities/user.entity';
import { Entry } from '../../workout/entities/entry.entity';
import { EntrySet } from '../../workout/entities/entry-set.entity';
import { WorkoutSession } from '../../workout/entities/workout-session.entity';
import { AgentAction } from '../entities/agent-action.entity';
import {
  EntrySnapshot,
  ProfileSnapshot,
  sameSnapshot,
  SessionSnapshot,
  snapshotEntry,
  snapshotProfile,
  snapshotSession,
} from '../snapshots';
import { ActionLogAclService } from './action-log-acl.service';

export interface UndoSkip {
  entityType: string;
  entityId: number;
  reason: string;
}

export interface UndoResult {
  undone: number;
  skipped: UndoSkip[];
}

export interface UndoScope {
  // Only groups whose key starts with this ('msg:' or 'mcp:<token id>:').
  prefix: string;
  // Never this group (the current chat turn).
  exclude?: string;
}

// How much of an action group is still in place: `total` changes were
// recorded, `active` of them not undone yet.
export interface GroupState {
  total: number;
  active: number;
}

// Reverses agent / MCP changes (constitution rule 13). Each group is undone
// newest-first in one transaction. A change is only reversed if the row
// still looks exactly as the change left it; otherwise it was edited since
// and is skipped (reported, never overwritten).
@Injectable()
export class UndoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aclService: ActionLogAclService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(UndoService.name);
  }

  // Change counts per group, for showing an Undo button. Scoped to the
  // caller's own actions by userId (from the JWT), so it needs no per-row
  // ACL check; groups without actions are absent from the map.
  async groupStates(
    ctx: RequestContext,
    groupKeys: string[],
  ): Promise<Map<string, GroupState>> {
    const states = new Map<string, GroupState>();
    if (groupKeys.length === 0) return states;
    const rows: { groupKey: string; total: number; active: number }[] =
      await this.dataSource.query(
        `SELECT "groupKey",
                count(*)::int AS total,
                count(*) FILTER (WHERE "undoneAt" IS NULL)::int AS active
           FROM agent_actions
          WHERE "userId" = $1 AND "groupKey" = ANY($2)
          GROUP BY "groupKey"`,
        [ctx.user!.id, groupKeys],
      );
    for (const row of rows) {
      states.set(row.groupKey, { total: row.total, active: row.active });
    }
    return states;
  }

  async undoGroup(ctx: RequestContext, groupKey: string): Promise<UndoResult> {
    this.logger.log(ctx, `${this.undoGroup.name} was called`);
    const userId = ctx.user!.id;

    return this.dataSource.transaction(async (manager) => {
      const actions = await manager.find(AgentAction, {
        where: { userId, groupKey, undoneAt: IsNull() },
        order: { id: 'DESC' },
      });

      const result: UndoResult = { undone: 0, skipped: [] };
      for (const action of actions) {
        if (
          !this.aclService
            .forActor(ctx.user!)
            .canDoAction(Action.Update, action)
        ) {
          throw new UnauthorizedException();
        }

        const skip = await this.reverse(manager, userId, action);
        if (skip) {
          result.skipped.push({
            entityType: action.entityType,
            entityId: action.entityId,
            reason: skip,
          });
          continue;
        }
        await manager.update(AgentAction, action.id, { undoneAt: new Date() });
        result.undone++;
      }
      return result;
    });
  }

  // Undo the caller's most recent not-yet-undone group within `scope`.
  async undoLast(
    ctx: RequestContext,
    scope: UndoScope,
  ): Promise<UndoResult & { groupKey: string | null }> {
    const latest = await this.findLatestInScope(ctx.user!.id, scope);
    if (!latest) return { undone: 0, skipped: [], groupKey: null };

    const result = await this.undoGroup(ctx, latest.groupKey);
    return { ...result, groupKey: latest.groupKey };
  }

  private async findLatestInScope(
    userId: number,
    scope: UndoScope,
  ): Promise<AgentAction | null> {
    const qb = this.dataSource.manager
      .createQueryBuilder(AgentAction, 'a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.undoneAt IS NULL')
      .andWhere('a.groupKey LIKE :prefix', { prefix: `${scope.prefix}%` });
    if (scope.exclude)
      qb.andWhere('a.groupKey <> :exclude', { exclude: scope.exclude });
    return qb.orderBy('a.id', 'DESC').getOne();
  }

  // Returns a skip reason, or undefined when the change was reversed.
  private async reverse(
    manager: EntityManager,
    userId: number,
    action: AgentAction,
  ): Promise<string | undefined> {
    switch (action.entityType) {
      case 'entry':
        return this.reverseEntry(manager, userId, action);
      case 'session':
        return this.reverseSession(manager, action);
      case 'exercise':
        return this.reverseExerciseCreate(manager, userId, action);
      case 'exercise_alias':
        await manager.delete(ExerciseAlias, { id: action.entityId, userId });
        return undefined;
      case 'user':
        return this.reverseProfile(manager, userId, action);
      default:
        return `don't know how to undo ${action.entityType}`;
    }
  }

  private async reverseEntry(
    manager: EntityManager,
    userId: number,
    action: AgentAction,
  ): Promise<string | undefined> {
    const current = await snapshotEntry(manager, action.entityId);
    if (!current || !sameSnapshot(current, action.after)) {
      return 'changed since; left as is';
    }

    const before = action.before as unknown as EntrySnapshot | null;
    if (before === null || before.deleted) {
      // The action created the entry (or the entry was deleted before it).
      await manager.softDelete(Entry, { id: action.entityId, userId });
      return undefined;
    }

    if (current.deleted)
      await manager.restore(Entry, { id: action.entityId, userId });
    await manager.update(Entry, action.entityId, {
      sessionId: before.sessionId,
      exerciseId: before.exerciseId,
      durationMin: before.durationMin,
      distanceKm: before.distanceKm,
      speedKmh: before.speedKmh,
      inclinePct: before.inclinePct,
      metValue: before.metValue,
      estKcal: before.estKcal,
    });
    if (!sameSnapshot(current.sets, before.sets)) {
      await manager.delete(EntrySet, { entryId: action.entityId });
      if (before.sets.length) {
        await manager.insert(
          EntrySet,
          before.sets.map((s) => ({ entryId: action.entityId, ...s })),
        );
      }
    }
    return undefined;
  }

  private async reverseSession(
    manager: EntityManager,
    action: AgentAction,
  ): Promise<string | undefined> {
    const current = await snapshotSession(manager, action.entityId);
    if (!current || !sameSnapshot(current, action.after)) {
      return 'changed since; left as is';
    }
    const before = action.before as unknown as SessionSnapshot;
    await manager.update(WorkoutSession, action.entityId, {
      note: before.note,
    });
    return undefined;
  }

  private async reverseExerciseCreate(
    manager: EntityManager,
    userId: number,
    action: AgentAction,
  ): Promise<string | undefined> {
    // Soft-deleted entries still reference it (restore must stay possible).
    const uses = await manager.count(Entry, {
      where: { exerciseId: action.entityId },
      withDeleted: true,
    });
    if (uses > 0) return 'kept: entries use this exercise';

    await manager.delete(Exercise, { id: action.entityId, userId });
    return undefined;
  }

  private async reverseProfile(
    manager: EntityManager,
    userId: number,
    action: AgentAction,
  ): Promise<string | undefined> {
    const current = await snapshotProfile(manager, userId);
    if (!current || !sameSnapshot(current, action.after)) {
      return 'changed since; left as is';
    }
    const before = action.before as unknown as ProfileSnapshot;
    await manager.update(User, userId, {
      timezone: before.timezone,
      locale: before.locale as User['locale'],
      weightKg: before.weightKg,
      weightUnit: before.weightUnit as User['weightUnit'],
    });
    return undefined;
  }
}
