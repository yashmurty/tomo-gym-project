import { EvalEntry } from './cases';

// What the API returns for an entry (the subset the grader looks at).
export interface ActualEntry {
  exercise: { name: string };
  sets: { setIndex: number; reps: number; weightKg: number | null }[];
  durationMin: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  distanceKm: number | null;
}

export interface DayGrade {
  day: string;
  pass: boolean;
  missing: string[];
  unexpected: string[];
}

// Canonical text for an entry, so a day can be compared as a multiset
// (order doesn't matter, duplicates do). Weights are rounded to 0.01 kg.
// Cardio fields count only if the expectation names them.
export function describeExpected(entry: EvalEntry): string {
  return key({
    exercise: entry.exercise,
    sets: entry.sets ?? [],
    durationMin: entry.durationMin,
    speedKmh: entry.speedKmh,
    inclinePct: entry.inclinePct,
    distanceKm: entry.distanceKm,
  });
}

export function describeActual(entry: ActualEntry, like?: EvalEntry): string {
  const pickIf = (field: keyof EvalEntry, value: number | null) =>
    like && like[field] !== undefined ? (value ?? undefined) : undefined;
  return key({
    exercise: entry.exercise.name,
    sets: [...entry.sets]
      .sort((a, b) => a.setIndex - b.setIndex)
      .map((s) => [s.reps, s.weightKg] as [number, number | null]),
    durationMin: pickIf('durationMin', entry.durationMin),
    speedKmh: pickIf('speedKmh', entry.speedKmh),
    inclinePct: pickIf('inclinePct', entry.inclinePct),
    distanceKm: pickIf('distanceKm', entry.distanceKm),
  });
}

export function gradeDay(
  day: string,
  expected: EvalEntry[],
  actual: ActualEntry[],
): DayGrade {
  // Match each actual entry against the expectation for the same exercise,
  // so optional cardio fields are compared like-for-like.
  const expectedKeys = expected.map(describeExpected);
  const remaining = [...expectedKeys];
  const unexpected: string[] = [];

  for (const entry of actual) {
    const like = expected.find((e) => e.exercise === entry.exercise.name);
    const k = describeActual(entry, like);
    const i = remaining.indexOf(k);
    if (i >= 0) remaining.splice(i, 1);
    else unexpected.push(k);
  }
  return {
    day,
    pass: remaining.length === 0 && unexpected.length === 0,
    missing: remaining,
    unexpected,
  };
}

function key(e: {
  exercise: string;
  sets: [number, number | null][];
  durationMin?: number;
  speedKmh?: number;
  inclinePct?: number;
  distanceKm?: number;
}): string {
  const parts = [e.exercise];
  if (e.sets.length) {
    parts.push(
      e.sets
        .map(([r, w]) => `${r}x${w === null ? '-' : Math.round(w * 100) / 100}`)
        .join(','),
    );
  }
  for (const f of [
    'durationMin',
    'speedKmh',
    'inclinePct',
    'distanceKm',
  ] as const) {
    if (e[f] !== undefined) parts.push(`${f}=${e[f]}`);
  }
  return parts.join(' | ');
}
