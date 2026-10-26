/** Claude Haiku 5.5: the current fast, low-cost Claude model. */
export const MODEL = "claude-haiku-5-5";

/**
 * Haiku 5.5 always thinks adaptively; effort controls how much. Short chat
 * answers don't need deep reasoning, and "low" keeps latency and cost down.
 * Revisit with the Phase 5 evals.
 */
export const EFFORT = "low" as const;

/** Per answer, thinking included. 2–4 sentences need far less; this guards against runaway output. */
export const MAX_OUTPUT_TOKENS = 1024;

/** Longest accepted visitor message. Real questions are short; long ones are usually abuse. */
export const MAX_QUESTION_CHARS = 500;

/** Conversation turns sent to the model, so follow-ups like "tell me more" work. */
export const MAX_HISTORY_MESSAGES = 6;
