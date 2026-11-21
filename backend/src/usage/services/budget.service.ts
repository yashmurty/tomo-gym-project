import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QuotaExceededException } from '../../shared/exceptions/quota-exceeded.exception';
import { addDays, todayIn } from '../../shared/time/calendar-date';
import { Clock } from '../../shared/time/clock';
import { LlmUsageService } from './llm-usage.service';

const DAY_SEC = 86_400;

// Spend caps checked before every model call (constitution rule 17): a
// global daily cap across all users (the safety net against bugs and abuse),
// then the user's own daily and monthly budgets on their local calendar.
@Injectable()
export class BudgetService {
  constructor(
    private readonly usage: LlmUsageService,
    private readonly config: ConfigService,
    private readonly clock: Clock,
  ) {}

  async assertWithinBudget(user: {
    id: number;
    timezone: string;
  }): Promise<void> {
    const now = this.clock.now();
    const budgets = this.config.get<{
      userDailyUsd: number;
      userMonthlyUsd: number;
      globalDailyUsd: number;
    }>('budgets')!;

    const utcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (
      (await this.usage.totalSpendSince(utcMidnight)) >= budgets.globalDailyUsd
    ) {
      throw new QuotaExceededException(
        'service_paused',
        'Chat is paused for today. Please try again tomorrow.',
        secondsUntil(utcMidnight.getTime() + DAY_SEC * 1000, now),
      );
    }

    const today = todayIn(user.timezone, now);
    const untilLocalMidnight = secondsUntilLocalMidnight(user.timezone, now);

    if (
      (await this.usage.userSpendOnDay(user.id, user.timezone, today)) >=
      budgets.userDailyUsd
    ) {
      throw new QuotaExceededException(
        'daily_budget',
        "You've reached today's chat limit. It resets at midnight.",
        untilLocalMidnight,
      );
    }

    if (
      (await this.usage.userSpendInMonth(user.id, user.timezone, today)) >=
      budgets.userMonthlyUsd
    ) {
      const daysLeft = daysUntilNextMonth(today);
      throw new QuotaExceededException(
        'monthly_budget',
        "You've reached this month's chat limit. It resets on the 1st.",
        untilLocalMidnight + (daysLeft - 1) * DAY_SEC,
      );
    }
  }
}

function secondsUntil(epochMs: number, now: Date): number {
  return Math.max(1, Math.ceil((epochMs - now.getTime()) / 1000));
}

// Approximate (ignores a DST jump tonight): a Retry-After hint, not a contract.
export function secondsUntilLocalMidnight(timezone: string, now: Date): number {
  const [h, m, s] = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .split(':')
    .map(Number);
  return Math.max(1, DAY_SEC - (h * 3600 + m * 60 + s));
}

// Days from `day` until the 1st of next month (1 on the last day of a month).
export function daysUntilNextMonth(day: string): number {
  let d = day;
  let n = 0;
  do {
    d = addDays(d, 1);
    n++;
  } while (!d.endsWith('-01'));
  return n;
}
