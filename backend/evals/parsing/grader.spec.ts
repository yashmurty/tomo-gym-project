import { CASES } from './cases';
import { ActualEntry, gradeDay } from './grader';

const actual = (
  name: string,
  sets: [number, number | null][] = [],
  cardio: Partial<ActualEntry> = {},
): ActualEntry => ({
  exercise: { name },
  sets: sets.map(([reps, weightKg], i) => ({
    setIndex: i + 1,
    reps,
    weightKg,
  })),
  durationMin: null,
  speedKmh: null,
  inclinePct: null,
  distanceKm: null,
  ...cardio,
});

describe('parsing eval grader', () => {
  it('passes an exact match regardless of entry order', () => {
    const grade = gradeDay(
      'today',
      [
        {
          exercise: 'Pec fly',
          sets: [
            [10, 40],
            [10, 40],
          ],
        },
        {
          exercise: 'Treadmill walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        },
      ],
      [
        actual('Treadmill walk', [], {
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        }),
        actual('Pec fly', [
          [10, 40],
          [10, 40],
        ]),
      ],
    );
    expect(grade.pass).toBe(true);
  });

  it('counts duplicates: two expected, one actual fails', () => {
    const lat = {
      exercise: 'Lat pulldown',
      sets: [[10, 47]] as [number, number][],
    };
    const grade = gradeDay(
      'today',
      [lat, lat],
      [actual('Lat pulldown', [[10, 47]])],
    );
    expect(grade.pass).toBe(false);
    expect(grade.missing).toEqual(['Lat pulldown | 10x47']);
  });

  it('fails a wrong weight, a wrong set count, and anything extra', () => {
    const expected = [
      {
        exercise: 'Pec fly',
        sets: [
          [10, 40],
          [10, 40],
        ] as [number, number][],
      },
    ];
    expect(
      gradeDay('today', expected, [
        actual('Pec fly', [
          [10, 41],
          [10, 40],
        ]),
      ]).pass,
    ).toBe(false);
    expect(
      gradeDay('today', expected, [actual('Pec fly', [[10, 40]])]).pass,
    ).toBe(false);
    expect(
      gradeDay('today', expected, [
        actual('Pec fly', [
          [10, 40],
          [10, 40],
        ]),
        actual('Squat', [[5, 80]]),
      ]).unexpected,
    ).toEqual(['Squat | 5x80']);
  });

  it('compares weights to 0.01 kg (lb conversions)', () => {
    const grade = gradeDay(
      'today',
      [{ exercise: 'Bench press', sets: [[5, 61.23]] }],
      [actual('Bench press', [[5, 61.2349]])],
    );
    expect(grade.pass).toBe(true);
  });

  it('expects an empty day to stay empty', () => {
    expect(gradeDay('today', [], []).pass).toBe(true);
    expect(gradeDay('today', [], [actual('Squat', [[5, 80]])]).pass).toBe(
      false,
    );
  });

  it('has unique, well-formed cases', () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASES) {
      expect(Object.keys(c.expect).length).toBeGreaterThan(0);
      for (const day of Object.keys(c.expect)) {
        expect(day).toMatch(/^(today|yesterday|\d{4}-\d{2}-\d{2})$/);
      }
    }
  });
});
