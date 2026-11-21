import { randomBytes } from 'crypto';

// 16 random bytes = 128 bits, base64url without padding: 22 URL-safe chars.
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function newInviteToken(): string {
  return randomBytes(16).toString('base64url');
}

// Lets malformed tokens be answered with a 404 without a database lookup.
export function isInviteToken(value: string): boolean {
  return INVITE_TOKEN_PATTERN.test(value);
}
