// List prices in USD per million tokens, used for budgets and the admin
// usage report. Check them against Anthropic's pricing page when changing
// models. Cache writes assume the 5-minute cache (1.25 × input).
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
  'claude-sonnet-5-5': {
    input: 2,
    output: 10,
    cacheRead: 0.1,
    cacheWrite: 2.5,
  },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  // The deterministic stand-in (LLM_PROVIDER=stub) costs nothing.
  stub: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

// A model missing from the table is priced like the most expensive one, so
// a forgotten entry can never switch budgets off.
export const UNKNOWN_MODEL_PRICE: ModelPrice = MODEL_PRICES['claude-opus-5-5'];

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function costUsd(model: string, tokens: TokenCounts): number {
  const p = MODEL_PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  return (
    (tokens.inputTokens * p.input +
      tokens.outputTokens * p.output +
      tokens.cacheReadTokens * p.cacheRead +
      tokens.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}
