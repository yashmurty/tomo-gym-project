import { costUsd, MODEL_PRICES } from './pricing';

describe('costUsd', () => {
  const tokens = (
    input: number,
    output: number,
    cacheRead = 0,
    cacheWrite = 0,
  ) => ({
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
  });

  it('prices each token kind per million', () => {
    // 1M input + 1M output on Haiku = $0.10 + $0.50
    expect(costUsd('claude-haiku-5-5', tokens(1e6, 1e6))).toBeCloseTo(0.6, 10);
    // cache reads and writes on Opus
    expect(costUsd('claude-opus-5-5', tokens(0, 0, 1e6, 1e6))).toBeCloseTo(
      5.2,
      10,
    );
  });

  it('makes the stub free', () => {
    expect(costUsd('stub', tokens(1e6, 1e6, 1e6, 1e6))).toBe(0);
  });

  it('prices unknown models like the most expensive one, never as free', () => {
    const unknown = costUsd('some-new-model', tokens(1e6, 0));
    const priciest = Math.max(
      ...Object.values(MODEL_PRICES).map((p) => p.input),
    );
    expect(unknown).toBe(priciest);
  });
});
