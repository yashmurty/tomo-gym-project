export enum MODALITY {
  // Sets × reps (× optional weight).
  STRENGTH = 'strength',
  // Body-weight work: sets × reps, or a duration (e.g. plank).
  BODYWEIGHT = 'bodyweight',
  // Duration-based, with optional distance / speed / incline.
  CARDIO = 'cardio',
}

export enum MUSCLE_GROUP {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  ARMS = 'arms',
  LEGS = 'legs',
  CORE = 'core',
  FULL_BODY = 'full_body',
  CARDIO = 'cardio',
}

export enum CALORIE_MODEL {
  // Fixed MET for the exercise × body weight × time.
  MET = 'met',
  // Walking / running: ACSM equations from speed + incline when speed is
  // known, else the exercise's fixed MET.
  TREADMILL = 'treadmill',
}

export const MAX_EXERCISE_NAME_LENGTH = 100;
