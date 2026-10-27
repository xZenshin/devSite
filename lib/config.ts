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

/** Earlier assistant turns come from the client, so they are untrusted; ours are far shorter. */
export const MAX_ASSISTANT_CHARS = 2000;

/** Largest request body accepted, before it is parsed. */
export const MAX_BODY_CHARS = 32_000;

/**
 * "baseline" puts all content in the prompt; "retrieval" puts only the top
 * matching chunks there. Read per request so evals can compare both.
 */
export type RetrievalMode = "baseline" | "retrieval";

export function retrievalMode(): RetrievalMode {
  return process.env.RETRIEVAL_MODE === "baseline" ? "baseline" : "retrieval";
}

/**
 * Prefixed to every chunk before embedding. Questions name Alexander but most
 * content doesn't, so without it, chunks that happen to mention him (like the
 * Ask my portfolio project) match every question.
 */
export const SITE_OWNER = "Alexander Skou-Larsen";

/** Voyage AI's low-cost embedding model; 1024 dimensions must match the database column. */
export const EMBEDDING_MODEL = "voyage-4-lite";
export const EMBEDDING_DIMENSIONS = 1024;

/** Chunks given to the model per question in retrieval mode. */
export const TOP_K = 5;

/** Candidates each search (vector and full-text) returns before they are fused. */
export const SEARCH_CANDIDATES = 20;

/** Sections longer than this are split; shorter ones stay whole so citations stay precise. */
export const MAX_CHUNK_TOKENS = 500;
