import type Anthropic from "@anthropic-ai/sdk";

/**
 * Claude Haiku 5.5 list prices in USD per million tokens, for prompts of up to
 * 100K tokens (ours are far smaller). Cache writes use the 5-minute TTL.
 */
const PRICE_PER_MTOK = {
  input: 0.1,
  output: 0.5,
  cacheWrite: 0.125,
  cacheRead: 0.01,
};

/** Cost of one request. Output tokens include thinking tokens. */
export function costUsd(usage: Anthropic.Usage): number {
  const dollars =
    usage.input_tokens * PRICE_PER_MTOK.input +
    usage.output_tokens * PRICE_PER_MTOK.output +
    (usage.cache_creation_input_tokens ?? 0) * PRICE_PER_MTOK.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * PRICE_PER_MTOK.cacheRead;
  return dollars / 1_000_000;
}
