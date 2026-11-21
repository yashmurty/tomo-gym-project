import { BadRequestException } from '@nestjs/common';

export enum WEIGHT_UNIT {
  KG = 'kg',
  LB = 'lb',
}

// Exact by definition (international avoirdupois pound).
export const KG_PER_LB = 0.45359237;

export const MIN_BODY_WEIGHT_KG = 20;
export const MAX_BODY_WEIGHT_KG = 400;

// Converts a weight to kg, rounded to 2 decimals (the precision we store).
// Unit conversion is deterministic server code, never done by the LLM
// (constitution rule 9).
export function toKg(value: number, unit: WEIGHT_UNIT): number {
  const kg = unit === WEIGHT_UNIT.LB ? value * KG_PER_LB : value;
  return Math.round(kg * 100) / 100;
}

// A stored kg weight in the user's display unit, for showing it back to them
// and for the model to quote (so it never converts; constitution rule 9). lb
// is rounded to 0.1: kg is stored to 2 decimals, so this gives back what the
// user typed (135 lb → 61.23 kg → 135 lb).
export function fromKg(kg: number, unit: WEIGHT_UNIT): number {
  if (unit === WEIGHT_UNIT.KG) return kg;
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

// Converts a body weight to kg and checks it's humanly plausible. The range
// is checked after conversion so it means the same thing in either unit.
export function toBodyWeightKg(value: number, unit: WEIGHT_UNIT): number {
  const kg = toKg(value, unit);
  if (kg < MIN_BODY_WEIGHT_KG || kg > MAX_BODY_WEIGHT_KG) {
    throw new BadRequestException(
      `weight must be between ${MIN_BODY_WEIGHT_KG} and ${MAX_BODY_WEIGHT_KG} kg`,
    );
  }
  return kg;
}
