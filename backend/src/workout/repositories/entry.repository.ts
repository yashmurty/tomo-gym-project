import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';

import { MUSCLE_GROUP } from '../../exercise/constants/exercise.constant';
import { CalendarDate } from '../../shared/time/calendar-date';
import { Entry } from '../entities/entry.entity';

@Injectable()
export class EntryRepository extends Repository<Entry> {
  constructor(private dataSource: DataSource) {
    super(Entry, dataSource.createEntityManager());
  }

  // Live (not soft-deleted) entries with everything needed for output.
  async findWithDetails(ids: number[]): Promise<Entry[]> {
    if (ids.length === 0) return [];
    const entries = await this.find({
      where: { id: In(ids) },
      relations: { session: true, exercise: true, sets: true },
    });
    return entries.map(sortSets);
  }

  async findHistory(userId: number, query: HistoryQuery): Promise<Entry[]> {
    const qb = this.createQueryBuilder('e')
      .innerJoin('e.session', 's')
      .innerJoin('e.exercise', 'x')
      .where('e.userId = :userId', { userId });
    if (query.exerciseId) {
      qb.andWhere('e.exerciseId = :exerciseId', {
        exerciseId: query.exerciseId,
      });
    }
    if (query.muscleGroup) {
      qb.andWhere('x.muscleGroup = :muscleGroup', {
        muscleGroup: query.muscleGroup,
      });
    }
    if (query.from) qb.andWhere('s.date >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.date <= :to', { to: query.to });

    // Pick the newest entry ids first, then load them with their sets (a
    // LIMIT across the sets join would cut sets off).
    const rows = await qb
      .select('e.id', 'id')
      .orderBy('s.date', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .limit(query.limit)
      .getRawMany<{ id: number }>();
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];

    const entries = await this.findWithDetails(ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    return entries.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  async findForSessions(sessionIds: number[]): Promise<Entry[]> {
    if (sessionIds.length === 0) return [];
    const entries = await this.find({
      where: { sessionId: In(sessionIds) },
      relations: { session: true, exercise: true, sets: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return entries.map(sortSets);
  }
}

// Live entries for a user, newest day first, optionally filtered.
export interface HistoryQuery {
  exerciseId?: number;
  muscleGroup?: MUSCLE_GROUP;
  from?: CalendarDate;
  to?: CalendarDate;
  limit: number;
}

function sortSets(entry: Entry): Entry {
  entry.sets = (entry.sets ?? []).sort((a, b) => a.setIndex - b.setIndex);
  return entry;
}
