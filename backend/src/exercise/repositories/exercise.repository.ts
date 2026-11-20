import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, Repository } from 'typeorm';

import { Exercise } from '../entities/exercise.entity';

@Injectable()
export class ExerciseRepository extends Repository<Exercise> {
  constructor(private dataSource: DataSource) {
    super(Exercise, dataSource.createEntityManager());
  }

  // An exercise the user can see: the shared catalog or their own.
  async findVisibleById(userId: number, id: number): Promise<Exercise | null> {
    return this.createQueryBuilder('e')
      .where('e.id = :id', { id })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('e.userId IS NULL')
            .orWhere('e.userId = :userId', { userId }),
        ),
      )
      .getOne();
  }

  // Exact alias match; the user's own alias wins over a shared one.
  async findByAlias(
    userId: number,
    normalizedAlias: string,
  ): Promise<Exercise | null> {
    return this.createQueryBuilder('e')
      .innerJoin('exercise_aliases', 'a', 'a.exerciseId = e.id')
      .where('a.normalizedAlias = :normalizedAlias', { normalizedAlias })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('a.userId IS NULL')
            .orWhere('a.userId = :userId', { userId }),
        ),
      )
      .orderBy('a.userId', 'ASC', 'NULLS LAST')
      .getOne();
  }

  // Visible exercises whose aliases contain any of the given fragments.
  // Used to suggest candidates when an exact match fails.
  async findByAliasFragments(
    userId: number,
    fragments: string[],
    limit: number,
  ): Promise<Exercise[]> {
    if (fragments.length === 0) return [];

    const qb = this.createQueryBuilder('e')
      .innerJoin('exercise_aliases', 'a', 'a.exerciseId = e.id')
      .where(
        new Brackets((b) =>
          b.where('a.userId IS NULL').orWhere('a.userId = :userId', { userId }),
        ),
      )
      .andWhere(
        new Brackets((b) => {
          fragments.forEach((fragment, i) => {
            b.orWhere(`a.normalizedAlias LIKE :f${i}`, {
              [`f${i}`]: `%${escapeLike(fragment)}%`,
            });
          });
        }),
      )
      .distinct(true)
      .orderBy('e.name', 'ASC')
      .limit(limit);

    return qb.getMany();
  }

  async listVisible(
    userId: number,
    normalizedSearch?: string,
  ): Promise<Exercise[]> {
    const qb = this.createQueryBuilder('e').where(
      new Brackets((b) =>
        b.where('e.userId IS NULL').orWhere('e.userId = :userId', { userId }),
      ),
    );

    if (normalizedSearch) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM exercise_aliases a
                 WHERE a."exerciseId" = e.id
                   AND (a."userId" IS NULL OR a."userId" = :userId)
                   AND a."normalizedAlias" LIKE :search)`,
        { userId, search: `%${escapeLike(normalizedSearch)}%` },
      );
    }

    return qb.orderBy('e.name', 'ASC').getMany();
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
