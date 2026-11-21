import { ApiError, toApiError } from './api-error';
import { describeError } from './describe-error';
import { safeRedirect } from './safe-redirect';

describe('toApiError', () => {
  test("reads the backend's error body, code and Retry-After", async () => {
    const err = await toApiError(
      new Response(
        JSON.stringify({
          error: {
            message: 'Too Many Requests',
            details: { message: 'Slow down', code: 'rate_limited' },
          },
        }),
        { status: 429, headers: { 'Retry-After': '42' } },
      ),
    );
    expect(err).toMatchObject({
      status: 429,
      message: 'Slow down',
      code: 'rate_limited',
      retryAfterSec: 42,
    });
  });

  test('copes with a body that is not JSON', async () => {
    const err = await toApiError(new Response('<html>', { status: 502 }));
    expect(err).toMatchObject({ status: 502, code: undefined });
  });
});

describe('describeError', () => {
  test.each([
    [new ApiError('x', 429, 'daily_budget'), 'errors.dailyBudget'],
    [new ApiError('x', 429, 'monthly_budget'), 'errors.monthlyBudget'],
    [new ApiError('x', 429, 'service_paused'), 'errors.servicePaused'],
    [new ApiError('x', 429), 'errors.rateLimited'],
    [new ApiError('x', 503), 'errors.server'],
    [new ApiError('x', 400), 'errors.generic'],
    [new TypeError('Failed to fetch'), 'errors.network'],
  ])('%o → %s', (err, key) => {
    expect(describeError(err)).toBe(key);
  });
});

describe('safeRedirect', () => {
  test.each([
    ['/history', '/history'],
    [null, '/'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
  ])('%s → %s', (from, expected) => {
    expect(safeRedirect(from)).toBe(expected);
  });
});
