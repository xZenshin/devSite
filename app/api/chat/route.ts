import Anthropic from "@anthropic-ai/sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { streamAnswer, type AnswerMode, type ChatUIMessage } from "@/lib/answer";
import { MAX_BODY_BYTES, retrievalMode } from "@/lib/config";
import { getContent, type Section } from "@/lib/content";
import { safeEqual } from "@/lib/hmac";
import { chatRequestSchema, retrievalQuery, toModelMessages } from "@/lib/messages";
import { buildSystemPrompt } from "@/lib/prompt";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { retrieve } from "@/lib/retrieval";
import { supabaseSearch } from "@/lib/supabase";

/** An answer takes 1–3 s; anything near this is stuck. */
export const maxDuration = 30;

const BUSY_MESSAGE = "The assistant is busy. Try again in a minute.";
const GENERIC_ERROR = "The assistant couldn't answer. Try again in a moment.";

/**
 * Guards run cheapest first, and everything that costs money comes last:
 * only same-site JSON requests, a capped body, a valid conversation, then the
 * rate limits. A Vercel Firewall rule (see the README) also limits each IP
 * before this runs at all.
 */
export async function POST(request: Request): Promise<Response> {
  const startedAt = performance.now();

  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const raw = await readBody(request, MAX_BODY_BYTES);
  if (raw === null) {
    return Response.json({ error: "The conversation is too long. Start over to ask more." }, { status: 413 });
  }
  const body = chatRequestSchema.safeParse(parseJson(raw));
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const conversation = toModelMessages(body.data.messages);
  if (!conversation.ok) {
    return Response.json({ error: conversation.error }, { status: 400 });
  }

  const trusted = isTrustedCaller(request);
  const limited = trusted ? "ok" : await checkRateLimit(clientIp(request));
  if (limited === "visitor") {
    return Response.json({ error: "Too many questions. Wait a few minutes and try again." }, { status: 429 });
  }
  if (limited === "daily") {
    return Response.json({ error: "The assistant has answered all it can for today." }, { status: 503 });
  }

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      const { sections, contact } = await getContent();
      const retrievalStartedAt = performance.now();
      const { sources, mode } = await selectSources(retrievalQuery(conversation.questions), sections);
      await streamAnswer({
        system: buildSystemPrompt(sources, contact),
        messages: conversation.messages,
        sources,
        mode,
        startedAt,
        retrievalMs: mode === "retrieval" ? Math.round(performance.now() - retrievalStartedAt) : null,
        diagnostics: trusted,
        signal: request.signal,
        writer,
      });
    },
    // A visitor who left mid-answer is not an error worth logging.
    onError: (error) => (request.signal.aborted ? GENERIC_ERROR : toUserFacingError(error)),
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * Stops other websites from making their visitors' browsers call this API
 * (which would cost money and dodge the per-IP limit). A cross-site page can
 * only send JSON after a CORS preflight, which this route never approves, so
 * requiring JSON closes the form and text/plain routes. Browsers also say where
 * a request came from in Sec-Fetch-Site; scripts and the evals send none.
 */
function rejectCrossSite(request: Request): Response | null {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(type)) {
    return Response.json({ error: "Send the request as application/json." }, { status: 415 });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return Response.json({ error: "Cross-site requests aren't allowed." }, { status: 403 });
  }
  return null;
}

/**
 * Callers that skip the rate limits and receive diagnostics with each answer:
 * anything outside production (local dev, the in-process evals, `npm run ask`),
 * and requests carrying the EVAL_TOKEN, for evals against a deployment.
 */
function isTrustedCaller(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.EVAL_TOKEN;
  const given = request.headers.get("x-eval-token");
  return Boolean(token && given && safeEqual(token, given));
}

/** The body as text, or null as soon as it passes `limit` bytes, without reading the rest. */
async function readBody(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Picks what goes into the prompt. If retrieval fails (database or embedding
 * API down), falls back to all content, so visitors still get an answer.
 */
async function selectSources(
  query: string,
  sections: Section[],
): Promise<{ sources: Section[]; mode: AnswerMode }> {
  if (retrievalMode() === "baseline") return { sources: sections, mode: "baseline" };
  try {
    const sources = await retrieve(query, supabaseSearch);
    // Vector search always returns rows unless the table is empty (never ingested).
    if (sources.length === 0) throw new Error("No chunks in the database; run the ingest");
    return { sources, mode: "retrieval" };
  } catch (error) {
    console.error("[chat] retrieval failed, using all content:", error);
    return { sources: sections, mode: "retrieval-fallback" };
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Logs the real error server-side and shows the visitor a safe message. */
function toUserFacingError(error: unknown): string {
  console.error("[chat] answer failed:", error);
  return error instanceof Anthropic.RateLimitError ? BUSY_MESSAGE : GENERIC_ERROR;
}
