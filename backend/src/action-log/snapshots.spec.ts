import { sameSnapshot } from './snapshots';

describe('sameSnapshot', () => {
  it('ignores key order (jsonb reorders keys)', () => {
    const written = {
      sessionId: 1,
      exerciseId: 2,
      sets: [{ setIndex: 1, reps: 10, weightKg: 40 }],
    };
    const fromJsonb = {
      sets: [{ reps: 10, setIndex: 1, weightKg: 40 }],
      exerciseId: 2,
      sessionId: 1,
    };
    expect(sameSnapshot(written, fromJsonb)).toBe(true);
  });

  it('still detects any value or set-order difference', () => {
    const a = {
      sets: [
        { setIndex: 1, reps: 10 },
        { setIndex: 2, reps: 8 },
      ],
      note: null,
    };
    expect(sameSnapshot(a, { ...a, note: 'x' })).toBe(false);
    expect(sameSnapshot(a, { ...a, sets: [...a.sets].reverse() })).toBe(false);
    expect(sameSnapshot(a, null)).toBe(false);
  });
});
