import Anthropic from "@anthropic-ai/sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { streamAnswer, type AnswerMode, type ChatUIMessage } from "@/lib/answer";
import { MAX_BODY_CHARS, retrievalMode } from "@/lib/config";
import { getContent, type Section } from "@/lib/content";
import { chatRequestSchema, retrievalQuery, toModelMessages } from "@/lib/messages";
import { buildSystemPrompt } from "@/lib/prompt";
import { retrieve } from "@/lib/retrieval";
import { supabaseSearch } from "@/lib/supabase";

const BUSY_MESSAGE = "The assistant is busy. Try again in a minute.";
const GENERIC_ERROR = "The assistant couldn't answer. Try again in a moment.";

/**
 * Rate limiting happens before this runs: a Vercel Firewall rule limits POST
 * /api/chat per IP and answers 429 itself (see the README).
 */
export async function POST(request: Request): Promise<Response> {
  const startedAt = performance.now();

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
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
        writer,
      });
    },
    onError: toUserFacingError,
  });
  return createUIMessageStreamResponse({ stream });
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
