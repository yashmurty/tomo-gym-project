import type { MessageKey, TranslateParams } from '../i18n/i18n';
import { ApiError } from '../lib/api-error';
import { describeError } from '../lib/describe-error';

// The backend's 409 codes for group limits (GROUP_LIMITS on the server).
// The limits themselves stay on the server, so the copy doesn't repeat them.
export function groupError(err: unknown): MessageKey {
  if (err instanceof ApiError && err.status === 409) {
    if (err.code === 'group_full') return 'join.full';
    if (err.code === 'group_limit') return 'groups.limitReached';
  }
  return describeError(err);
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

// "1 member" / "6 members": a separate key for one, since English plurals
// can't be a placeholder.
export function memberCountText(
  t: (key: MessageKey, params?: TranslateParams) => string,
  n: number,
): string {
  return n === 1 ? t('groups.oneMember') : t('groups.memberCount', { n });
}
