import { HttpException, HttpStatus } from '@nestjs/common';

export type QuotaCode =
  | 'rate_limited'
  | 'daily_budget'
  | 'monthly_budget'
  | 'service_paused';

// 429 with a machine-readable code (so the app can say "back tomorrow" vs
// "try again in a minute") and a Retry-After header, which
// AllExceptionsFilter sets from retryAfterSec.
export class QuotaExceededException extends HttpException {
  constructor(
    readonly code: QuotaCode,
    message: string,
    readonly retryAfterSec: number,
  ) {
    super({ message, code, retryAfterSec }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
