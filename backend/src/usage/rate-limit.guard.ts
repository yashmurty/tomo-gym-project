import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { RateLimitService, RateRule } from './services/rate-limit.service';

// Per-IP limits for unauthenticated endpoints (login, signup), where there's
// no user to key on. Declared with @RateLimitByIp('login') and enforced by
// RateLimitGuard, which must run before any other guard (e.g. before
// LocalAuthGuard checks the password).
export type IpLimitName = 'login' | 'signup';

const RATE_LIMIT_KEY = 'rateLimitByIp';
export const RateLimitByIp = (name: IpLimitName) =>
  SetMetadata(RATE_LIMIT_KEY, name);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const name = this.reflector.get<IpLimitName | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!name) return true;

    // In production Express trusts one proxy hop (Caddy), so req.ip is the
    // client address rather than a client-supplied X-Forwarded-For value.
    const ip = context.switchToHttp().getRequest<Request>().ip ?? 'unknown';
    await this.rateLimits.consume([this.rule(name, ip)]);
    return true;
  }

  private rule(name: IpLimitName, ip: string): RateRule {
    const limits = this.config.get<Record<string, number>>('limits')!;
    return name === 'login'
      ? {
          key: `login:ip:${ip}`,
          window: 'minute',
          limit: limits.loginPerMinute,
        }
      : { key: `signup:ip:${ip}`, window: 'hour', limit: limits.signupPerHour };
  }
}
