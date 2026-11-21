import { isInviteToken, newInviteToken } from './invite-token';

describe('invite tokens', () => {
  it('are 22 URL-safe characters (128 random bits) and differ each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, newInviteToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(isInviteToken(token)).toBe(true);
    }
  });

  it.each([
    '',
    'short',
    'a'.repeat(23),
    'abc/defghijklmnopqrstu',
    'abcdefghijklmnopqrst==',
  ])('rejects %p', (value) => {
    expect(isInviteToken(value)).toBe(false);
  });
});
