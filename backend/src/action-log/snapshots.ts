import { EntityManager } from 'typeorm';

import { User } from '../user/entities/user.entity';
import { Entry } from '../workout/entities/entry.entity';
import { EntrySet } from '../workout/entities/entry-set.entity';
import { WorkoutSession } from '../workout/entities/workout-session.entity';

// Row snapshots stored in agent_actions (before / after a change) and
// compared at undo time. The same functions build both, inside the same
// transaction as the change, so a snapshot taken later can be compared to
// the recorded `after` exactly: if they differ, something else changed the
// row since and undo must not overwrite it.

export interface EntrySnapshot {
  sessionId: number;
  exerciseId: number;
  durationMin: number | null;
  distanceKm: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  metValue: number | null;
  estKcal: number | null;
  deleted: boolean;
  sets: { setIndex: number; reps: number; weightKg: number | null }[];
}

export interface SessionSnapshot {
  note: string | null;
}

export interface ProfileSnapshot {
  timezone: string;
  locale: string;
  weightKg: number | null;
  weightUnit: string;
}

export async function snapshotEntry(
  manager: EntityManager,
  entryId: number,
): Promise<EntrySnapshot | null> {
  const entry = await manager.findOne(Entry, {
    where: { id: entryId },
    withDeleted: true,
  });
  if (!entry) return null;

  const sets = await manager.find(EntrySet, {
    where: { entryId },
    order: { setIndex: 'ASC' },
  });
  return {
    sessionId: entry.sessionId,
    exerciseId: entry.exerciseId,
    durationMin: entry.durationMin,
    distanceKm: entry.distanceKm,
    speedKmh: entry.speedKmh,
    inclinePct: entry.inclinePct,
    metValue: entry.metValue,
    estKcal: entry.estKcal,
    deleted: entry.deletedAt !== null,
    sets: sets.map((s) => ({
      setIndex: s.setIndex,
      reps: s.reps,
      weightKg: s.weightKg,
    })),
  };
}

export async function snapshotSession(
  manager: EntityManager,
  sessionId: number,
): Promise<SessionSnapshot | null> {
  const session = await manager.findOneBy(WorkoutSession, { id: sessionId });
  return session ? { note: session.note } : null;
}

export async function snapshotProfile(
  manager: EntityManager,
  userId: number,
): Promise<ProfileSnapshot | null> {
  const user = await manager.findOneBy(User, { id: userId });
  return user
    ? {
        timezone: user.timezone,
        locale: user.locale,
        weightKg: user.weightKg,
        weightUnit: user.weightUnit,
      }
    : null;
}

// Deep equality that ignores object key order: the recorded snapshot comes
// back from a jsonb column, and Postgres stores jsonb keys in its own order
// (shortest first), not the order they were written in.
export function sameSnapshot(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as any)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
