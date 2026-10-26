import Anthropic from "@anthropic-ai/sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { streamAnswer, type ChatUIMessage } from "@/lib/answer";
import { getContent } from "@/lib/content";
import { chatRequestSchema, toModelMessages } from "@/lib/messages";
import { buildSystemPrompt } from "@/lib/prompt";

const BUSY_MESSAGE = "The assistant is busy right now. Please try again in a minute.";
const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";

export async function POST(request: Request): Promise<Response> {
  const body = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const conversation = toModelMessages(body.data.messages);
  if (!conversation.ok) {
    return Response.json({ error: conversation.error }, { status: 400 });
  }

  // Baseline mode: every section goes into the prompt. Phase 3 swaps this
  // for the top-k retrieved sections.
  const { sections, contact } = await getContent();
  const system = buildSystemPrompt(sections, contact);

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: ({ writer }) =>
      streamAnswer({ system, messages: conversation.messages, sources: sections, writer }),
    onError: toUserFacingError,
  });
  return createUIMessageStreamResponse({ stream });
}

/** Logs the real error server-side and shows the visitor a safe message. */
function toUserFacingError(error: unknown): string {
  console.error("[chat] answer failed:", error);
  return error instanceof Anthropic.RateLimitError ? BUSY_MESSAGE : GENERIC_ERROR;
}
