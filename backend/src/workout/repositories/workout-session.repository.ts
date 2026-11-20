import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CalendarDate } from '../../shared/time/calendar-date';
import { WorkoutSession } from '../entities/workout-session.entity';

@Injectable()
export class WorkoutSessionRepository extends Repository<WorkoutSession> {
  constructor(private dataSource: DataSource) {
    super(WorkoutSession, dataSource.createEntityManager());
  }

  // The user's session for `date`, created if it doesn't exist yet. Safe
  // under concurrent requests: the unique (userId, date) constraint plus
  // ON CONFLICT DO NOTHING means two writers end up with the same row.
  async findOrCreate(
    manager: EntityManager,
    userId: number,
    date: CalendarDate,
  ): Promise<WorkoutSession> {
    await manager.query(
      `INSERT INTO sessions ("userId", "date") VALUES ($1, $2)
       ON CONFLICT ("userId", "date") DO NOTHING`,
      [userId, date],
    );
    return manager.findOneByOrFail(WorkoutSession, { userId, date });
  }

  // Day numbers for the given dates: the position of each date among the
  // user's days that still have at least one live entry. Computed, never
  // stored (constitution rule 9), so moving or deleting entries can't make
  // it drift. Dates with no live entries are absent from the result.
  async dayNumbers(
    userId: number,
    dates: CalendarDate[],
  ): Promise<Map<CalendarDate, number>> {
    if (dates.length === 0) return new Map();

    const rows: { date: CalendarDate; dayNumber: string }[] =
      await this.dataSource.query(
        `SELECT d."date", d."dayNumber"
           FROM (SELECT s."date",
                        ROW_NUMBER() OVER (ORDER BY s."date") AS "dayNumber"
                   FROM sessions s
                  WHERE s."userId" = $1
                    AND EXISTS (SELECT 1 FROM entries e
                                 WHERE e."sessionId" = s.id
                                   AND e."deletedAt" IS NULL)) d
          WHERE d."date" = ANY($2::date[])`,
        [userId, dates],
      );

    // DATE comes back as 'YYYY-MM-DD' (shared/typeorm/pg-date-parser);
    // ROW_NUMBER is bigint, which pg returns as a string.
    return new Map(rows.map((r) => [r.date, parseInt(r.dayNumber, 10)]));
  }

  // The user's days that have live entries, newest first.
  async findDaysWithEntries(
    userId: number,
    from: CalendarDate | undefined,
    to: CalendarDate | undefined,
    limit: number,
  ): Promise<WorkoutSession[]> {
    const qb = this.createQueryBuilder('s')
      .where('s.userId = :userId', { userId })
      .andWhere(
        `EXISTS (SELECT 1 FROM entries e
                  WHERE e."sessionId" = s.id AND e."deletedAt" IS NULL)`,
      );
    if (from) qb.andWhere('s.date >= :from', { from });
    if (to) qb.andWhere('s.date <= :to', { to });

    return qb.orderBy('s.date', 'DESC').limit(limit).getMany();
  }
}
