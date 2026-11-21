// The entry shape that log_entry, update_entry and friends return (the
// backend's compactEntry). Every derived value is the server's: weights in
// the user's unit, calories, day number (constitution rule 9). The app
// formats them and never recomputes them.
export type EntryResult = {
  entryId: number;
  date: string;
  exercise: string;
  exerciseJa?: string | null;
  weightUnit: 'kg' | 'lb';
  sets: { reps: number; weightKg: number | null; weight: number | null }[];
  durationMin: number | null;
  distanceKm: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  estKcal: number | null;
  kcalIsRough: boolean;
  dayNumber?: number;
};

export function isEntryResult(value: unknown): value is EntryResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.exercise === 'string' &&
    typeof v.date === 'string' &&
    Array.isArray(v.sets)
  );
}

// move_entries returns the day the entries landed on; set_day_note the note.
export function dateOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const date = (value as Record<string, unknown>).date;
  return typeof date === 'string' ? date : null;
}
