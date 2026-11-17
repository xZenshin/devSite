import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A keyed hash of `data`, one key per `purpose`. The keys are derived from the
 * Anthropic API key: it is server-only, and set wherever the chat works at all,
 * so there is no extra secret to manage. Rotating it only resets rate-limit
 * windows and drops earlier answers from open conversations.
 */
export function hmac(purpose: string, data: string): string {
  const secret = process.env.ANTHROPIC_API_KEY;
  if (!secret) throw new Error("ANTHROPIC_API_KEY must be set");
  const key = createHmac("sha256", secret).update(`devsite:${purpose}`).digest();
  return createHmac("sha256", key).update(data).digest("base64url");
}

/** Compares two strings in constant time, so a guess can't be refined by timing. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Earlier answers come back from the browser with every question, so a visitor
 * could rewrite them, or invent answers the assistant never gave, to steer the
 * model. Each answer is signed as it is sent; only answers whose signature
 * checks out are given to the model again.
 */
export function signAnswer(text: string): string {
  return hmac("answer", text.trim());
}

export function isSignedAnswer(text: string, signature: string | undefined): boolean {
  return signature !== undefined && safeEqual(signAnswer(text), signature);
}
