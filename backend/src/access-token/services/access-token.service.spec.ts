import { hashAccessToken, PAT_PREFIX } from './access-token.service';

describe('access token hashing', () => {
  it('is a stable SHA-256 hex digest', () => {
    const token = `${PAT_PREFIX}example`;
    expect(hashAccessToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
    expect(hashAccessToken(token)).not.toBe(hashAccessToken(`${token}x`));
  });
});
