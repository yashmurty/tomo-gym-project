import { plainToClass } from 'class-transformer';

import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserOutput } from './user-output.dto';

const toOutput = (user: object) =>
  plainToClass(UserOutput, user, { excludeExtraneousValues: true });

describe('UserOutput', () => {
  it("gives the body weight in the user's unit, worked out on the server", () => {
    expect(
      toOutput({ weightKg: 72.57, weightUnit: WEIGHT_UNIT.LB }).weight,
    ).toBe(160);
    expect(toOutput({ weightKg: 72, weightUnit: WEIGHT_UNIT.KG }).weight).toBe(
      72,
    );
  });

  it('is null until a weight is set', () => {
    expect(
      toOutput({ weightKg: null, weightUnit: WEIGHT_UNIT.KG }).weight,
    ).toBeNull();
  });
});
