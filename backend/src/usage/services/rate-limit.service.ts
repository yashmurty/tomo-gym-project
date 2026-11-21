import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { QuotaExceededException } from '../../shared/exceptions/quota-exceeded.exception';
import { Clock } from '../../shared/time/clock';

export type RateWindow = 'minute' | 'hour' | 'day';

export interface RateRule {
  // Identifies who/what is limited, e.g. 'chat:user:42'.
  key: string;
  window: RateWindow;
  limit: number;
}

const WINDOW_MS: Record<RateWindow, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

// Fixed windows aligned to UTC (e.g. 12:34:00–12:34:59 for a minute).
export function windowBounds(window: RateWindow, now: Date) {
  const size = WINDOW_MS[window];
  const start = Math.floor(now.getTime() / size) * size;
  return {
    start: new Date(start),
    retryAfterSec: Math.max(
      1,
      Math.ceil((start + size - now.getTime()) / 1000),
    ),
  };
}

@Injectable()
export class RateLimitService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  // Counts one request against every rule; throws 429 if any is over.
  async consume(rules: RateRule[]): Promise<void> {
    const now = this.clock.now();
    let blockedFor = 0;

    for (const rule of rules) {
      const { start, retryAfterSec } = windowBounds(rule.window, now);
      const [{ count }] = await this.dataSource.query(
        `INSERT INTO rate_limit_counters (key, "windowStart", count)
         VALUES ($1, $2, 1)
         ON CONFLICT (key, "windowStart")
         DO UPDATE SET count = rate_limit_counters.count + 1
         RETURNING count`,
        [`${rule.key}:${rule.window}`, start],
      );
      if (count > rule.limit) blockedFor = Math.max(blockedFor, retryAfterSec);
    }

    // Keep the table small without a scheduler.
    if (Math.random() < 0.01) await this.prune(now);

    if (blockedFor > 0) {
      throw new QuotaExceededException(
        'rate_limited',
        `Too many requests; try again in ${blockedFor} seconds.`,
        blockedFor,
      );
    }
  }

  private async prune(now: Date): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM rate_limit_counters WHERE "windowStart" < $1`,
      [new Date(now.getTime() - 2 * WINDOW_MS.day)],
    );
  }
}
