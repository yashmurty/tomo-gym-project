import {
  CALORIE_MODEL,
  MODALITY,
  MUSCLE_GROUP,
} from '../../exercise/constants/exercise.constant';
import { ENTRY_SOURCE } from '../constants/workout.constant';
import { Entry } from '../entities/entry.entity';
import { toDayDetail, toDaySummary } from './workout-output.dto';

describe('workout output mappers', () => {
  const entry = {
    id: 1,
    userId: 7,
    sessionId: 3,
    exerciseId: 11,
    session: { id: 3, userId: 7, date: '2026-11-20', note: 'secret note' },
    exercise: {
      id: 11,
      userId: null,
      name: 'Lat pulldown',
      nameJa: 'ラットプルダウン',
      modality: MODALITY.STRENGTH,
      muscleGroup: MUSCLE_GROUP.BACK,
      defaultMet: 3.5,
      calorieModel: CALORIE_MODEL.MET,
    },
    sets: [
      { id: 2, entryId: 1, setIndex: 2, reps: 8, weightKg: 50 },
      { id: 1, entryId: 1, setIndex: 1, reps: 10, weightKg: 47 },
    ],
    durationMin: null,
    distanceKm: null,
    speedKmh: null,
    inclinePct: null,
    metValue: 3.5,
    estKcal: 16.8,
    rawInput: '2x10 @ 47kg lat pulldown',
    source: ENTRY_SOURCE.CHAT,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Entry;

  it('detail view carries sets, calories and raw input', () => {
    const day = toDayDetail('2026-11-20', 38, 'secret note', [entry]);
    expect(day.totalKcal).toBe(16.8);
    expect(day.entries[0].sets).toHaveLength(2);
    expect(day.entries[0].kcalIsRough).toBe(true);
    expect(day.entries[0].rawInput).toBe('2x10 @ 47kg lat pulldown');
  });

  it('summary view exposes activity only (constitution rule 16)', () => {
    const summary = toDaySummary(
      toDayDetail('2026-11-20', 38, 'secret note', [entry, entry]),
    );

    expect(summary).toEqual({
      date: '2026-11-20',
      dayNumber: 38,
      exercises: [
        {
          id: 11,
          name: 'Lat pulldown',
          nameJa: 'ラットプルダウン',
          muscleGroup: 'back',
        },
      ],
      muscleGroups: ['back'],
    });

    // Belt and braces: no detail key anywhere in the serialised summary.
    const json = JSON.stringify(summary);
    for (const key of [
      'sets',
      'reps',
      'weightKg',
      'estKcal',
      'note',
      'rawInput',
      'secret',
    ]) {
      expect(json).not.toContain(key);
    }
  });
});
