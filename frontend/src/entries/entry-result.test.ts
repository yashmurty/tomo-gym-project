import { entryOutput } from '../test/fixtures';
import { dateOf, fromEntryOutput, isEntryResult } from './entry-result';

test('a REST entry maps to the card shape, keeping the server’s numbers', () => {
  const entry = fromEntryOutput(
    entryOutput({
      weightUnit: 'lb',
      sets: [{ setIndex: 1, reps: 5, weightKg: 61.23, weight: 135 }],
    }),
  );
  expect(entry).toMatchObject({
    entryId: 1,
    exercise: 'Squat',
    exerciseJa: 'スクワット',
    weightUnit: 'lb',
    sets: [{ reps: 5, weightKg: 61.23, weight: 135 }],
    estKcal: 20.4,
    kcalIsRough: true,
  });
  expect(isEntryResult(entry)).toBe(true);
});

test('tool results that are not entries are recognised as such', () => {
  expect(isEntryResult({ deleted: 3 })).toBe(false);
  expect(dateOf({ date: '2026-11-19', note: 'x' })).toBe('2026-11-19');
  expect(dateOf('nope')).toBeNull();
});
