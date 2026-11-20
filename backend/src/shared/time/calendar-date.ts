import { BadRequestException } from '@nestjs/common';

// A calendar day as 'YYYY-MM-DD', with no time and no timezone. Workout days
// are calendar dates, never timestamps (roadmap Step 3: dates vs timestamps),
// and travel as strings end to end: never JS Date objects.
export type CalendarDate = string;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const RELATIVE_DATES = ['today', 'yesterday'] as const;
export type RelativeDate = (typeof RELATIVE_DATES)[number];

// True for a real calendar day in 'YYYY-MM-DD' form (rejects 2026-02-30).
export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

// The calendar day it is right now in `timezone` (an IANA name).
export function todayIn(
  timezone: string,
  now: Date = new Date(),
): CalendarDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Calendar arithmetic on the date itself (UTC maths on Y-M-D), so DST
// transitions can't skip or repeat a day.
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Resolves a date argument from a client or the agent ('today', 'yesterday'
// or 'YYYY-MM-DD') to a calendar day in the user's timezone (constitution
// rule 8). Future days are rejected: logging a workout that hasn't happened
// is almost always a misfiled date, the #1 bug this app exists to prevent.
export function resolveWorkoutDate(
  value: string | undefined,
  timezone: string,
  now: Date = new Date(),
): CalendarDate {
  const today = todayIn(timezone, now);

  if (value === undefined || value === 'today') return today;
  if (value === 'yesterday') return addDays(today, -1);

  if (!isCalendarDate(value)) {
    throw new BadRequestException(
      `date must be 'today', 'yesterday' or a real date in YYYY-MM-DD form (got '${value}')`,
    );
  }
  if (value > today) {
    throw new BadRequestException(
      `date ${value} is in the future (today is ${today} in ${timezone})`,
    );
  }
  return value;
}
