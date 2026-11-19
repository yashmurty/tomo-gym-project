import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_TIMEZONE_LENGTH = 64;

// True for IANA zone names the runtime's Intl understands (`Asia/Tokyo`,
// `America/New_York`, `UTC`). Fixed UTC offsets (`+09:00`) are rejected even
// though newer runtimes accept them: they ignore daylight saving, so "today"
// would be wrong for an hour a day for half the year.
//
// Names are validated, not canonicalised: ICU's canonical form is
// version-dependent and sometimes the legacy name (`Asia/Kolkata` →
// `Asia/Calcutta`), and any valid name gives identical results when used.
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_TIMEZONE_LENGTH) return false;
  if (/^[+-]/.test(value)) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIanaTimezone',
      validator: {
        validate: (value) => isValidTimezone(value),
        defaultMessage: () =>
          '$property must be an IANA time zone name such as Asia/Tokyo',
      },
    },
    validationOptions,
  );
}
