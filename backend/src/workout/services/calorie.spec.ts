import {
  CALORIE_MODEL,
  MODALITY,
} from '../../exercise/constants/exercise.constant';
import { estimateCalories, treadmillMet } from './calorie';

describe('calorie estimates', () => {
  const walk = {
    modality: MODALITY.CARDIO,
    calorieModel: CALORIE_MODEL.TREADMILL,
    defaultMet: 3.5,
    setCount: 0,
  };

  describe('treadmillMet (ACSM)', () => {
    it('walking 6 km/h at 2% incline ≈ MET 4.89 (hand-computed)', () => {
      // S = 100 m/min, G = 0.02: VO2 = 10 + 3.6 + 3.5 = 17.1 → 17.1 / 3.5
      expect(treadmillMet(6, 2)).toBeCloseTo(4.8857, 3);
    });

    it('running 10 km/h flat uses the running equation', () => {
      // S = 166.67: VO2 = 33.33 + 3.5 = 36.83 → MET 10.52
      expect(treadmillMet(10, 0)).toBeCloseTo(10.5238, 3);
    });

    it('incline raises the estimate; decline is treated as flat', () => {
      expect(treadmillMet(5, 10)).toBeGreaterThan(treadmillMet(5, 0));
      expect(treadmillMet(5, -5)).toBe(treadmillMet(5, 0));
    });
  });

  it("matches the brief's example: 10 min walk at 6 km/h, incline 2, 72 kg", () => {
    // 4.8857 × 72 × 10/60 = 58.63
    expect(
      estimateCalories(
        { ...walk, durationMin: 10, speedKmh: 6, inclinePct: 2 },
        72,
      ),
    ).toEqual({ metValue: 4.89, estKcal: 58.6, isRough: false });
  });

  it('falls back to the fixed MET when a treadmill entry has no speed', () => {
    expect(
      estimateCalories(
        { ...walk, durationMin: 30, speedKmh: null, inclinePct: null },
        60,
      ),
    ).toEqual({ metValue: 3.5, estKcal: 105, isRough: false });
  });

  it('estimates strength work at 2 minutes per set and flags it rough', () => {
    // 3.5 × 72 × (2 sets × 2 min)/60 = 16.8
    expect(
      estimateCalories(
        {
          modality: MODALITY.STRENGTH,
          calorieModel: CALORIE_MODEL.MET,
          defaultMet: 3.5,
          setCount: 2,
          durationMin: null,
          speedKmh: null,
          inclinePct: null,
        },
        72,
      ),
    ).toEqual({ metValue: 3.5, estKcal: 16.8, isRough: true });
  });

  it('returns no kcal (but still a MET) without a body weight', () => {
    expect(
      estimateCalories(
        { ...walk, durationMin: 10, speedKmh: 6, inclinePct: 2 },
        null,
      ),
    ).toEqual({ metValue: 4.89, estKcal: null, isRough: false });
  });
});
