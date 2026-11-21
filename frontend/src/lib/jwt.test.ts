import { decodeJwt, isExpired } from './jwt';

function makeJwt(payload: object): string {
  return `header.${btoa(JSON.stringify(payload))}.sig`;
}

describe('decodeJwt', () => {
  test('decodes a valid JWT payload', () => {
    const token = makeJwt({ sub: 1, email: 'alice@example.com' });
    expect(decodeJwt(token)).toEqual({ sub: 1, email: 'alice@example.com' });
  });

  test('returns null when no middle segment', () => {
    expect(decodeJwt('only-one-segment')).toBeNull();
  });

  test('returns null when payload is invalid base64 / JSON', () => {
    expect(decodeJwt('header.not-base64-!@#.sig')).toBeNull();
  });
});

describe('isExpired', () => {
  test('returns true for past exp', () => {
    expect(isExpired({ exp: 1 })).toBe(true);
  });

  test('returns false for future exp', () => {
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) + 3600 })).toBe(
      false,
    );
  });
});
