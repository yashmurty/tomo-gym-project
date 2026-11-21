import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Action } from '../../shared/acl/action.constant';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { addDays, isCalendarDate } from '../../shared/time/calendar-date';
import { Clock } from '../../shared/time/clock';
import { UsageReportOutput } from '../dtos/usage-report.dto';
import { LlmUsageService } from './llm-usage.service';
import { UsageAclService } from './usage-acl.service';

@Injectable()
export class UsageReportService {
  constructor(
    private readonly usage: LlmUsageService,
    private readonly aclService: UsageAclService,
    private readonly clock: Clock,
  ) {}

  // Per-user usage between two UTC dates (inclusive); default last 30 days.
  async report(
    ctx: RequestContext,
    fromArg?: string,
    toArg?: string,
  ): Promise<UsageReportOutput> {
    if (!this.aclService.forActor(ctx.user!).canDoAction(Action.List)) {
      throw new UnauthorizedException();
    }

    const today = this.clock.now().toISOString().slice(0, 10);
    const to = toArg ?? today;
    const from = fromArg ?? addDays(today, -30);
    if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) {
      throw new BadRequestException(
        'from / to must be YYYY-MM-DD dates with from <= to',
      );
    }

    const users = await this.usage.report(
      new Date(`${from}T00:00:00Z`),
      new Date(`${addDays(to, 1)}T00:00:00Z`),
    );
    const totalCostUsd = users.reduce((sum, u) => sum + u.costUsd, 0);
    return { from, to, totalCostUsd, users };
  }
}
