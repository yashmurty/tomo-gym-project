import { ConfigService } from '@nestjs/config';

import { QuotaExceededException } from '../../shared/exceptions/quota-exceeded.exception';
import { Clock } from '../../shared/time/clock';
import {
  BudgetService,
  daysUntilNextMonth,
  secondsUntilLocalMidnight,
} from './budget.service';
import { LlmUsageService } from './llm-usage.service';

describe('BudgetService', () => {
  // 2026-11-21 14:00 UTC = 23:00 in Tokyo.
  const now = new Date('2026-11-21T14:00:00Z');
  const user = { id: 7, timezone: 'Asia/Tokyo' };
  const usage = {
    totalSpendSince: jest.fn(),
    userSpendOnDay: jest.fn(),
    userSpendInMonth: jest.fn(),
  };
  const config = {
    get: () => ({ userDailyUsd: 0.05, userMonthlyUsd: 1, globalDailyUsd: 5 }),
  };
  const service = new BudgetService(
    usage as unknown as LlmUsageService,
    config as unknown as ConfigService,
    { now: () => now } as Clock,
  );

  const spend = (global: number, daily: number, monthly: number) => {
    usage.totalSpendSince.mockResolvedValue(global);
    usage.userSpendOnDay.mockResolvedValue(daily);
    usage.userSpendInMonth.mockResolvedValue(monthly);
  };

  const failure = async () => {
    try {
      await service.assertWithinBudget(user);
    } catch (err) {
      return err as QuotaExceededException;
    }
    return null;
  };

  it('allows spend under every cap', async () => {
    spend(4.99, 0.049, 0.99);
    expect(await failure()).toBeNull();
  });

  it("checks the user's spend on their local calendar day", async () => {
    spend(0, 0, 0);
    await service.assertWithinBudget(user);
    expect(usage.userSpendOnDay).toHaveBeenCalledWith(
      7,
      'Asia/Tokyo',
      '2026-11-21',
    );
    expect(usage.totalSpendSince).toHaveBeenCalledWith(
      new Date('2026-11-21T00:00:00Z'),
    );
  });

  it('pauses everyone once the global daily cap is reached', async () => {
    spend(5, 0, 0);
    const err = await failure();
    expect(err?.code).toBe('service_paused');
    expect(err?.retryAfterSec).toBe(10 * 3600); // until 00:00 UTC
  });

  it('stops a user at their daily budget until their local midnight', async () => {
    spend(0, 0.05, 0.05);
    const err = await failure();
    expect(err?.code).toBe('daily_budget');
    expect(err?.retryAfterSec).toBe(3600); // 23:00 → 00:00 Tokyo
    expect(err?.getStatus()).toBe(429);
  });

  it('stops a user at their monthly budget until the 1st', async () => {
    spend(0, 0.01, 1);
    const err = await failure();
    expect(err?.code).toBe('monthly_budget');
    // 1 h to midnight + 9 more days (22 Nov → 1 Dec)
    expect(err?.retryAfterSec).toBe(3600 + 9 * 86400);
  });
});

describe('reset-time helpers', () => {
  it('counts seconds to local midnight in the user timezone', () => {
    const now = new Date('2026-11-21T14:00:00Z');
    expect(secondsUntilLocalMidnight('Asia/Tokyo', now)).toBe(3600);
    expect(secondsUntilLocalMidnight('UTC', now)).toBe(10 * 3600);
  });

  it('counts days to the 1st of next month', () => {
    expect(daysUntilNextMonth('2026-11-21')).toBe(10);
    expect(daysUntilNextMonth('2026-11-30')).toBe(1);
    expect(daysUntilNextMonth('2026-12-31')).toBe(1);
    expect(daysUntilNextMonth('2028-02-28')).toBe(2); // leap year
  });
});
