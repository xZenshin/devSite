import { VISITOR_LIMIT, VISITOR_WINDOW_SECONDS, dailyLimit } from "./config";
import { hmac } from "./hmac";
import { getDb } from "./supabase";

/** "visitor": this IP asked too often lately. "daily": all visitors together reached today's limit. */
type RateLimitResult = "ok" | "visitor" | "daily";

/**
 * Counts one question against the per-visitor and daily limits, in the
 * database (supabase/migrations/…_chat_rate_limit.sql). Visitors are counted by
 * a keyed hash of their IP, never the IP itself, and counts are deleted after
 * two days.
 *
 * If the database can't be reached the question goes ahead: the chat already
 * works without the database (retrieval falls back to all content), and the
 * spend limit in the Anthropic Console is the last line of defence.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = dailyLimit();
  if (limit === 0) return "daily";
  try {
    const { data, error } = await getDb().rpc("chat_rate_limit", {
      visitor: hmac("visitor", ip),
      visitor_limit: VISITOR_LIMIT,
      visitor_window_seconds: VISITOR_WINDOW_SECONDS,
      daily_limit: limit,
    });
    if (error) throw new Error(error.message);
    return data === "visitor" || data === "daily" ? data : "ok";
  } catch (error) {
    console.error("[chat] rate limit check failed, allowing the request:", error);
    return "ok";
  }
}

/**
 * The visitor's IP. On Vercel, x-real-ip and x-forwarded-for are set by the
 * platform, which overwrites whatever the client sent.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  );
}
