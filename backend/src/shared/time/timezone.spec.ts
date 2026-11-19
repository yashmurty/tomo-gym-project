import { validate } from 'class-validator';

import { IsIanaTimezone, isValidTimezone } from './timezone';

describe('isValidTimezone', () => {
  it.each(['Asia/Tokyo', 'Asia/Kolkata', 'America/New_York', 'UTC', 'Etc/UTC'])(
    'accepts %s',
    (tz) => {
      expect(isValidTimezone(tz)).toBe(true);
    },
  );

  it.each([
    ['an unknown zone', 'Mars/Base'],
    ['an empty string', ''],
    ['leading whitespace', ' Asia/Tokyo'],
    ['a fixed offset with colon', '+09:00'],
    ['a fixed negative offset', '-0500'],
    ['an over-long string', 'A'.repeat(65)],
  ])('rejects %s', (_label, tz) => {
    expect(isValidTimezone(tz)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidTimezone(undefined)).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(540)).toBe(false);
  });
});

describe('@IsIanaTimezone', () => {
  class Input {
    @IsIanaTimezone()
    timezone: unknown;
  }

  it('passes a valid zone and fails an invalid one with a helpful message', async () => {
    const ok = Object.assign(new Input(), { timezone: 'Asia/Tokyo' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = Object.assign(new Input(), { timezone: 'Tokyo' });
    const errors = await validate(bad);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isIanaTimezone).toContain('IANA time zone');
  });
});
