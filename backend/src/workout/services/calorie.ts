import {
  CALORIE_MODEL,
  MODALITY,
} from '../../exercise/constants/exercise.constant';

// Deterministic calorie estimates (constitution rule 9): never the LLM's.
//
//   kcal = MET × body weight (kg) × hours
//
// Walking / running with a known speed use the ACSM metabolic equations,
// so incline counts:
//   walking: VO2 = 0.1·S + 1.8·S·G + 3.5
//   running: VO2 = 0.2·S + 0.9·S·G + 3.5
// (VO2 in ml/kg/min, S = speed in m/min, G = grade as a fraction; MET = VO2 / 3.5)
//
// Strength work has no recorded duration, so it's estimated at a fixed time
// per set (work + rest). Those estimates are rough and flagged as such.

export const MINUTES_PER_SET = 2;
// ACSM: the walking equation fits up to ~100 m/min; running above ~134 m/min.
// 8 km/h (133 m/min) is the usual switch-over.
export const RUNNING_THRESHOLD_KMH = 8;

export interface CalorieInput {
  modality: MODALITY;
  calorieModel: CALORIE_MODEL;
  defaultMet: number;
  setCount: number;
  durationMin: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
}

export interface CalorieEstimate {
  metValue: number;
  estKcal: number | null;
  isRough: boolean;
}

export function treadmillMet(
  speedKmh: number,
  inclinePct: number | null,
): number {
  const speed = (speedKmh * 1000) / 60; // m/min
  // The equations aren't validated for decline; treat it as flat.
  const grade = Math.max(0, inclinePct ?? 0) / 100;
  const vo2 =
    speedKmh < RUNNING_THRESHOLD_KMH
      ? 0.1 * speed + 1.8 * speed * grade + 3.5
      : 0.2 * speed + 0.9 * speed * grade + 3.5;
  return vo2 / 3.5;
}

export function estimateCalories(
  input: CalorieInput,
  bodyWeightKg: number | null,
): CalorieEstimate {
  const timed = input.durationMin !== null;

  const met =
    input.calorieModel === CALORIE_MODEL.TREADMILL && input.speedKmh !== null
      ? treadmillMet(input.speedKmh, input.inclinePct)
      : input.defaultMet;

  const minutes = timed ? input.durationMin! : input.setCount * MINUTES_PER_SET;

  const metValue = round(met, 2);
  const estKcal =
    bodyWeightKg === null
      ? null
      : round((met * bodyWeightKg * minutes) / 60, 1);

  // Only measured durations give a real estimate; set-based time is a guess.
  return { metValue, estKcal, isRough: !timed };
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
