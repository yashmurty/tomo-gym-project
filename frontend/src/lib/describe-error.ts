import type { MessageKey } from '../i18n/i18n';
import { ApiError } from './api-error';

// The backend's 429 codes (QuotaExceededException), as catalog keys.
const QUOTA_KEYS: Record<string, MessageKey> = {
  rate_limited: 'errors.rateLimited',
  daily_budget: 'errors.dailyBudget',
  monthly_budget: 'errors.monthlyBudget',
  service_paused: 'errors.servicePaused',
};

export function quotaMessage(code: string | undefined): MessageKey | null {
  return (code && QUOTA_KEYS[code]) || null;
}

// A failed call as something to tell the user, in their language. Screens
// handle the statuses that mean something specific to them (a 401 at login,
// a 409 at sign-up) before falling back to this.
export function describeError(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return quotaMessage(err.code) ?? 'errors.rateLimited';
    }
    if (err.status >= 500) return 'errors.server';
    return 'errors.generic';
  }
  return 'errors.network';
}
