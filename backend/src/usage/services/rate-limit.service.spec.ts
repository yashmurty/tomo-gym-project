import { windowBounds } from './rate-limit.service';

describe('windowBounds', () => {
  const at = (iso: string) => new Date(iso);

  it('aligns minute windows to the UTC minute and counts down to the next', () => {
    const { start, retryAfterSec } = windowBounds(
      'minute',
      at('2026-11-21T10:15:42.300Z'),
    );
    expect(start.toISOString()).toBe('2026-11-21T10:15:00.000Z');
    expect(retryAfterSec).toBe(18);
  });

  it('aligns hour and day windows', () => {
    expect(
      windowBounds('hour', at('2026-11-21T10:15:42Z')).start.toISOString(),
    ).toBe('2026-11-21T10:00:00.000Z');
    const day = windowBounds('day', at('2026-11-21T23:59:30Z'));
    expect(day.start.toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(day.retryAfterSec).toBe(30);
  });

  it('never asks a client to retry in 0 seconds', () => {
    expect(
      windowBounds('minute', at('2026-11-21T10:15:59.999Z')).retryAfterSec,
    ).toBe(1);
  });
});
