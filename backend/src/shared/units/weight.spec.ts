import { BadRequestException } from '@nestjs/common';

import { fromKg, KG_PER_LB, toBodyWeightKg, toKg, WEIGHT_UNIT } from './weight';

describe('toKg', () => {
  it('passes kg through, rounded to 2 decimals', () => {
    expect(toKg(72.5, WEIGHT_UNIT.KG)).toBe(72.5);
    expect(toKg(72.456, WEIGHT_UNIT.KG)).toBe(72.46);
  });

  it('converts lb using the exact definition', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(toKg(100, WEIGHT_UNIT.LB)).toBe(45.36);
    expect(toKg(160, WEIGHT_UNIT.LB)).toBe(72.57);
  });
});

describe('toBodyWeightKg', () => {
  it('accepts the bounds in kg', () => {
    expect(toBodyWeightKg(20, WEIGHT_UNIT.KG)).toBe(20);
    expect(toBodyWeightKg(400, WEIGHT_UNIT.KG)).toBe(400);
  });

  it('checks the range after converting, so it means the same in lb', () => {
    // 40 lb ≈ 18.14 kg: a plausible kg number, but too light as a body weight.
    expect(() => toBodyWeightKg(40, WEIGHT_UNIT.LB)).toThrow(
      BadRequestException,
    );
    expect(toBodyWeightKg(160, WEIGHT_UNIT.LB)).toBe(72.57);
  });

  it('rejects implausible values', () => {
    expect(() => toBodyWeightKg(19.99, WEIGHT_UNIT.KG)).toThrow(
      'weight must be between 20 and 400 kg',
    );
    expect(() => toBodyWeightKg(401, WEIGHT_UNIT.KG)).toThrow(
      BadRequestException,
    );
  });
});

describe('fromKg', () => {
  it('passes kg through', () => {
    expect(fromKg(61.23, WEIGHT_UNIT.KG)).toBe(61.23);
  });

  it('gives back what the user typed in lb after the kg round trip', () => {
    for (const lb of [135, 47.5, 225, 2.5, 315.5]) {
      expect(fromKg(toKg(lb, WEIGHT_UNIT.LB), WEIGHT_UNIT.LB)).toBe(lb);
    }
  });
});
