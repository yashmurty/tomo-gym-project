// The parsing eval set (constitution rule 15): real inputs from the brief,
// plus Japanese and mixed variants. Each case is graded on the rows the
// agent leaves in the database, never on its reply text.
//
// Dates are relative to FIXED_NOW, so weekday phrasing ("Tuesday") is stable.

// Thursday 2026-11-19, 12:00 in Asia/Tokyo.
export const FIXED_NOW = '2026-11-19T03:00:00Z';
export const EVAL_TIMEZONE = 'Asia/Tokyo';

// [reps, weightKg | null]
export type EvalSet = [number, number | null];

export interface EvalEntry {
  exercise: string; // catalog display name, e.g. 'Lat pulldown'
  sets?: EvalSet[];
  durationMin?: number;
  speedKmh?: number;
  inclinePct?: number;
  distanceKm?: number;
}

// 'today', 'yesterday' or YYYY-MM-DD.
export type DayKey = string;

export interface EvalCase {
  id: string;
  description: string;
  locale?: 'en' | 'ja';
  weightUnit?: 'kg' | 'lb';
  // Entries that exist before the conversation (logged via the app).
  setup?: { date: DayKey; entry: EvalEntry }[];
  // Messages sent through the agent before the one under test.
  priorTurns?: string[];
  input: string;
  // The complete expected contents of these days after the turn.
  expect: Record<DayKey, EvalEntry[]>;
}

const sets = (n: number, reps: number, weightKg: number | null): EvalSet[] =>
  Array.from({ length: n }, () => [reps, weightKg] as EvalSet);

export const CASES: EvalCase[] = [
  {
    id: 'separators-star',
    description: 'Varied separators, no spaces',
    input: '2*10@47kg lat pull down',
    expect: { today: [{ exercise: 'Lat pulldown', sets: sets(2, 10, 47) }] },
  },
  {
    id: 'name-first',
    description: 'Exercise name before the numbers',
    input: 'Pec fly machine 2 x 10 @ 40 kg',
    expect: { today: [{ exercise: 'Pec fly', sets: sets(2, 10, 40) }] },
  },
  {
    id: 'typo-lg',
    description: '"lg" is a kg typo',
    input: 'Seated leg curl 2 x 10 @ 19lg',
    expect: { today: [{ exercise: 'Seated leg curl', sets: sets(2, 10, 19) }] },
  },
  {
    id: 'cardio-walk',
    description: 'Cardio with speed and incline',
    input: '10 min walk speed 6 incline 2',
    expect: {
      today: [
        {
          exercise: 'Treadmill walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        },
      ],
    },
  },
  {
    id: 'same-as-last-time',
    description: '"Same as last time" for three exercises',
    setup: [
      {
        date: 'yesterday',
        entry: {
          exercise: 'Treadmill walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        },
      },
      {
        date: 'yesterday',
        entry: { exercise: 'Pec fly', sets: sets(2, 10, 40) },
      },
      {
        date: 'yesterday',
        entry: { exercise: 'Seated leg curl', sets: sets(2, 10, 19) },
      },
    ],
    input: 'Same sets as last time of walk, chest pec fly, seated leg curl',
    expect: {
      today: [
        {
          exercise: 'Treadmill walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        },
        { exercise: 'Pec fly', sets: sets(2, 10, 40) },
        { exercise: 'Seated leg curl', sets: sets(2, 10, 19) },
      ],
      yesterday: [
        {
          exercise: 'Treadmill walk',
          durationMin: 10,
          speedKmh: 6,
          inclinePct: 2,
        },
        { exercise: 'Pec fly', sets: sets(2, 10, 40) },
        { exercise: 'Seated leg curl', sets: sets(2, 10, 19) },
      ],
    },
  },
  {
    id: 'day-number-statement',
    description: '"Today is day 37" writes nothing (day numbers are computed)',
    input: 'Today is day 37',
    expect: { today: [] },
  },
  {
    id: 'only-these-two',
    description: 'Correcting today to exactly two entries',
    setup: [
      {
        date: 'today',
        entry: { exercise: 'Lat pulldown', sets: sets(2, 10, 47) },
      },
      {
        date: 'today',
        entry: { exercise: 'Lat pulldown', sets: sets(2, 10, 47) },
      },
      {
        date: 'today',
        entry: { exercise: 'Seated row', sets: sets(2, 10, 40) },
      },
      {
        date: 'today',
        entry: { exercise: 'Leg press', sets: sets(2, 10, 60) },
      },
    ],
    input:
      'Only these two today: lat pulldown 2x10 @ 47kg and seated row 2x10 @ 40kg',
    expect: {
      today: [
        { exercise: 'Lat pulldown', sets: sets(2, 10, 47) },
        { exercise: 'Seated row', sets: sets(2, 10, 40) },
      ],
    },
  },
  {
    id: 'move-to-tuesday',
    description: 'Bulk date reassignment by weekday name',
    setup: [
      { date: 'today', entry: { exercise: 'Squat', sets: sets(3, 5, 80) } },
      {
        date: 'today',
        entry: { exercise: 'Leg press', sets: sets(2, 10, 60) },
      },
      {
        date: 'today',
        entry: { exercise: 'Calf raise', sets: sets(2, 15, 40) },
      },
    ],
    input: 'These three were actually Tuesday',
    expect: {
      today: [],
      '2026-11-17': [
        { exercise: 'Squat', sets: sets(3, 5, 80) },
        { exercise: 'Leg press', sets: sets(2, 10, 60) },
        { exercise: 'Calf raise', sets: sets(2, 15, 40) },
      ],
    },
  },
  {
    id: 'ja-katakana',
    description: 'Japanese exercise name',
    locale: 'ja',
    input: 'ラットプルダウン 2x10 47kg',
    expect: { today: [{ exercise: 'Lat pulldown', sets: sets(2, 10, 47) }] },
  },
  {
    id: 'ja-full-width',
    description: 'Full-width digits and ×',
    locale: 'ja',
    input: 'レッグプレス ２×１０ ６０kg',
    expect: { today: [{ exercise: 'Leg press', sets: sets(2, 10, 60) }] },
  },
  {
    id: 'ja-sentence',
    description: 'Japanese sentence with 回 / セット / キロ',
    locale: 'ja',
    input: '今日はスクワット 5回3セット 80キロ',
    expect: { today: [{ exercise: 'Squat', sets: sets(3, 5, 80) }] },
  },
  {
    id: 'yesterday',
    description: 'Explicit "yesterday"',
    input: 'yesterday: squat 3x8 @ 60kg',
    expect: {
      today: [],
      yesterday: [{ exercise: 'Squat', sets: sets(3, 8, 60) }],
    },
  },
  {
    id: 'pounds',
    description: 'Weights in lb are stored in kg',
    input: '3x5 @ 135 lb bench press',
    expect: { today: [{ exercise: 'Bench press', sets: sets(3, 5, 61.23) }] },
  },
  {
    id: 'pyramid',
    description: 'Different reps and weights per set',
    input: 'lat pulldown 10/8/6 @ 40/45/50 kg',
    expect: {
      today: [
        {
          exercise: 'Lat pulldown',
          sets: [
            [10, 40],
            [8, 45],
            [6, 50],
          ],
        },
      ],
    },
  },
  {
    id: 'plank-duration',
    description: 'Bodyweight exercise by duration',
    input: 'plank 2 min',
    expect: { today: [{ exercise: 'Plank', durationMin: 2 }] },
  },
  {
    id: 'multi-exercise',
    description: 'Two exercises in one message',
    input: 'leg press 2x10 @ 60kg, leg extension 2x12 @ 30kg',
    expect: {
      today: [
        { exercise: 'Leg press', sets: sets(2, 10, 60) },
        { exercise: 'Leg extension', sets: sets(2, 12, 30) },
      ],
    },
  },
  {
    id: 'question-writes-nothing',
    description: 'A history question must not write',
    setup: [
      {
        date: '2026-11-17',
        entry: { exercise: 'Deadlift', sets: sets(3, 5, 100) },
      },
    ],
    input: 'What did I lift on Tuesday?',
    expect: {
      today: [],
      '2026-11-17': [{ exercise: 'Deadlift', sets: sets(3, 5, 100) }],
    },
  },
  {
    id: 'correction-set-count',
    description: '"Actually it was 3 sets" corrects the previous entry',
    priorTurns: ['pec fly 2x10 @ 40kg'],
    input: 'actually it was 3 sets',
    expect: { today: [{ exercise: 'Pec fly', sets: sets(3, 10, 40) }] },
  },
  {
    id: 'remove-duplicate',
    description: 'Removing an entry logged twice',
    setup: [
      {
        date: 'today',
        entry: { exercise: 'Lat pulldown', sets: sets(2, 10, 47) },
      },
      {
        date: 'today',
        entry: { exercise: 'Lat pulldown', sets: sets(2, 10, 47) },
      },
    ],
    input: 'I logged lat pulldown twice, remove one',
    expect: { today: [{ exercise: 'Lat pulldown', sets: sets(2, 10, 47) }] },
  },
];
