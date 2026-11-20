import { BadRequestException } from '@nestjs/common';

import {
  addDays,
  isCalendarDate,
  resolveWorkoutDate,
  todayIn,
} from './calendar-date';

describe('calendar-date', () => {
  // 2026-11-19 15:30 UTC = 2026-11-20 00:30 in Tokyo, still the 19th in New York.
  const justAfterTokyoMidnight = new Date('2026-11-19T15:30:00Z');

  describe('todayIn', () => {
    it("is the user's local calendar day, not the server's", () => {
      expect(todayIn('Asia/Tokyo', justAfterTokyoMidnight)).toBe('2026-11-20');
      expect(todayIn('America/New_York', justAfterTokyoMidnight)).toBe(
        '2026-11-19',
      );
      expect(todayIn('UTC', justAfterTokyoMidnight)).toBe('2026-11-19');
    });
  });

  describe('addDays', () => {
    it('crosses month and year boundaries', () => {
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
      expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
      expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('is unaffected by DST transitions', () => {
      // US DST ended 2026-11-01; Europe's ended 2026-10-25.
      expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
      expect(addDays('2026-10-26', -1)).toBe('2026-10-25');
    });
  });

  describe('isCalendarDate', () => {
    it('accepts real days and rejects impossible or malformed ones', () => {
      expect(isCalendarDate('2026-11-19')).toBe(true);
      expect(isCalendarDate('2024-02-29')).toBe(true);
      expect(isCalendarDate('2026-02-29')).toBe(false);
      expect(isCalendarDate('2026-13-01')).toBe(false);
      expect(isCalendarDate('2026-1-9')).toBe(false);
      expect(isCalendarDate('19/11/2026')).toBe(false);
      expect(isCalendarDate(20261119)).toBe(false);
    });
  });

  describe('resolveWorkoutDate', () => {
    const tz = 'Asia/Tokyo';
    const now = justAfterTokyoMidnight; // 2026-11-20 in Tokyo

    it('defaults to today in the user timezone', () => {
      expect(resolveWorkoutDate(undefined, tz, now)).toBe('2026-11-20');
      expect(resolveWorkoutDate('today', tz, now)).toBe('2026-11-20');
    });

    it('resolves yesterday relative to the user, not the server', () => {
      expect(resolveWorkoutDate('yesterday', tz, now)).toBe('2026-11-19');
      expect(resolveWorkoutDate('yesterday', 'America/New_York', now)).toBe(
        '2026-11-18',
      );
    });

    it('passes past and present explicit dates through', () => {
      expect(resolveWorkoutDate('2026-11-17', tz, now)).toBe('2026-11-17');
      expect(resolveWorkoutDate('2026-11-20', tz, now)).toBe('2026-11-20');
    });

    it('rejects future dates in the user timezone', () => {
      // The 20th is "today" in Tokyo but the future in New York.
      expect(() =>
        resolveWorkoutDate('2026-11-20', 'America/New_York', now),
      ).toThrow(BadRequestException);
      expect(() => resolveWorkoutDate('2026-11-21', tz, now)).toThrow(
        'is in the future',
      );
    });

    it('rejects malformed dates and unknown keywords', () => {
      expect(() => resolveWorkoutDate('tomorrow', tz, now)).toThrow(
        BadRequestException,
      );
      expect(() => resolveWorkoutDate('2026-02-30', tz, now)).toThrow(
        BadRequestException,
      );
    });
  });
});
