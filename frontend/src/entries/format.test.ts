import { formatDay, formatSets } from './format';

const sets = (...pairs: [number, number | null][]) =>
  pairs.map(([reps, weight]) => ({ reps, weight, weightKg: weight }));

describe('formatSets', () => {
  test.each([
    ['uniform sets', sets([10, 47], [10, 47]), 'kg', '2 × 10 @ 47 kg'],
    ['reps vary', sets([10, 40], [8, 40], [6, 40]), 'kg', '10/8/6 @ 40 kg'],
    [
      'weights vary (pyramid)',
      sets([10, 40], [8, 45], [6, 50]),
      'kg',
      '10/8/6 @ 40/45/50 kg',
    ],
    ['bodyweight', sets([10, null], [10, null], [10, null]), 'kg', '3 × 10'],
    ['pounds, as the server gave them', sets([5, 135]), 'lb', '1 × 5 @ 135 lb'],
    ['decimals', sets([5, 61.25]), 'kg', '1 × 5 @ 61.25 kg'],
  ] as const)('%s', (_, s, unit, expected) => {
    expect(formatSets({ sets: [...s], weightUnit: unit }, 'en')).toBe(expected);
  });

  test('no sets (cardio) gives nothing', () => {
    expect(formatSets({ sets: [], weightUnit: 'kg' }, 'en')).toBeNull();
  });
});

describe('formatDay', () => {
  test('formats the calendar date in each language', () => {
    expect(formatDay('2026-11-19', 'en')).toBe('Thu, Nov 19');
    expect(formatDay('2026-11-19', 'ja')).toBe('11月19日(木)');
  });
});
