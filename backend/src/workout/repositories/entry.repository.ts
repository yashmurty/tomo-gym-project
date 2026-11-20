import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';

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

function sortSets(entry: Entry): Entry {
  entry.sets = (entry.sets ?? []).sort((a, b) => a.setIndex - b.setIndex);
  return entry;
}
