import type { DayDetailOutput, EntryOutput } from '../lib/generated/models';

// REST shapes for History tests. Weights come from the server in the user's
// unit (`weight`, `weightUnit`) next to kg.
export function entryOutput(overrides: Partial<EntryOutput> = {}): EntryOutput {
  return {
    id: 1,
    date: '2026-11-19',
    exercise: {
      id: 11,
      name: 'Squat',
      nameJa: 'スクワット',
      modality: 'strength',
      muscleGroup: 'legs',
      isCustom: false,
    } as EntryOutput['exercise'],
    weightUnit: 'kg',
    sets: [
      { setIndex: 1, reps: 5, weightKg: 80, weight: 80 },
      { setIndex: 2, reps: 5, weightKg: 80, weight: 80 },
    ],
    durationMin: null,
    distanceKm: null,
    speedKmh: null,
    inclinePct: null,
    metValue: 5,
    estKcal: 20.4,
    kcalIsRough: true,
    source: 'chat',
    rawInput: '2x5 @ 80kg squat',
    createdAt: '2026-11-19T03:00:00.000Z',
    updatedAt: '2026-11-19T03:00:00.000Z',
    ...overrides,
  };
}

export function dayOutput(
  overrides: Partial<DayDetailOutput> = {},
): DayDetailOutput {
  return {
    date: '2026-11-19',
    dayNumber: 37,
    note: null,
    totalKcal: 20.4,
    entries: [entryOutput()],
    ...overrides,
  };
}
