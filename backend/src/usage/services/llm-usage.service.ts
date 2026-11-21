import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CalendarDate } from '../../shared/time/calendar-date';
import { LlmUsage } from '../entities/llm-usage.entity';
import { costUsd, TokenCounts } from '../pricing';

export interface UsageRecord extends TokenCounts {
  model: string;
}

interface ModelTotals extends TokenCounts {
  model: string;
}

// Model-call accounting: written after every call (constitution rule 17),
// read for budgets and the admin report. Spend is computed per model with
// the price table, so mixed-model usage (Step 5b routing) is costed right.
@Injectable()
export class LlmUsageService {
  constructor(private readonly dataSource: DataSource) {}

  async record(
    userId: number,
    turnId: number,
    usage: UsageRecord,
  ): Promise<void> {
    await this.dataSource
      .getRepository(LlmUsage)
      .insert({ userId, turnId, ...usage });
  }

  // USD spent by a user on a calendar day in their timezone.
  async userSpendOnDay(
    userId: number,
    timezone: string,
    day: CalendarDate,
  ): Promise<number> {
    return this.spend(
      `"userId" = $1 AND ("createdAt" AT TIME ZONE $2)::date = $3::date`,
      [userId, timezone, day],
    );
  }

  // USD spent by a user in the calendar month (in their timezone) of `day`.
  async userSpendInMonth(
    userId: number,
    timezone: string,
    day: CalendarDate,
  ): Promise<number> {
    return this.spend(
      `"userId" = $1
       AND date_trunc('month', "createdAt" AT TIME ZONE $2) = date_trunc('month', $3::date)`,
      [userId, timezone, day],
    );
  }

  // USD spent by everyone since an instant (the global safety cap).
  async totalSpendSince(since: Date): Promise<number> {
    return this.spend(`"createdAt" >= $1`, [since]);
  }

  // Per-user usage between two instants, most expensive first.
  async report(from: Date, to: Date) {
    const rows: (ModelTotals & {
      userId: number;
      email: string;
      turns: number;
      calls: number;
    })[] = await this.dataSource.query(
      `SELECT u."userId", us.email, u.model,
              count(DISTINCT u."turnId")::int AS turns, count(*)::int AS calls,
              sum(u."inputTokens")::int AS "inputTokens",
              sum(u."outputTokens")::int AS "outputTokens",
              sum(u."cacheReadTokens")::int AS "cacheReadTokens",
              sum(u."cacheWriteTokens")::int AS "cacheWriteTokens"
         FROM llm_usage u JOIN users us ON us.id = u."userId"
        WHERE u."createdAt" >= $1 AND u."createdAt" < $2
        GROUP BY u."userId", us.email, u.model`,
      [from, to],
    );

    const byUser = new Map<
      number,
      {
        userId: number;
        email: string;
        turns: number;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        costUsd: number;
      }
    >();
    for (const r of rows) {
      const u = byUser.get(r.userId) ?? {
        userId: r.userId,
        email: r.email,
        turns: 0,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
      };
      u.turns += r.turns;
      u.calls += r.calls;
      u.inputTokens += r.inputTokens;
      u.outputTokens += r.outputTokens;
      u.cacheReadTokens += r.cacheReadTokens;
      u.cacheWriteTokens += r.cacheWriteTokens;
      u.costUsd += costUsd(r.model, r);
      byUser.set(r.userId, u);
    }
    return [...byUser.values()].sort((a, b) => b.costUsd - a.costUsd);
  }

  private async spend(where: string, params: unknown[]): Promise<number> {
    const rows: ModelTotals[] = await this.dataSource.query(
      `SELECT model,
              coalesce(sum("inputTokens"), 0)::int AS "inputTokens",
              coalesce(sum("outputTokens"), 0)::int AS "outputTokens",
              coalesce(sum("cacheReadTokens"), 0)::int AS "cacheReadTokens",
              coalesce(sum("cacheWriteTokens"), 0)::int AS "cacheWriteTokens"
         FROM llm_usage WHERE ${where} GROUP BY model`,
      params,
    );
    return rows.reduce((total, r) => total + costUsd(r.model, r), 0);
  }
}
