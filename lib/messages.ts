import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { stripCitations } from "./citations";
import { MAX_ASSISTANT_CHARS, MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "./config";
import { isSignedAnswer } from "./hmac";

/**
 * The request body `useChat` sends. Only user and assistant roles are
 * accepted, so a client can't smuggle in its own system message. Every list
 * and string is capped; the body as a whole is capped before it is parsed.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        parts: z
          .array(z.object({ type: z.string().max(40), text: z.string().max(8_000).optional() }))
          .max(20),
        /** On an answer, the signature it was sent with (see signAnswer). */
        metadata: z.object({ signature: z.string().max(100).optional() }).nullish(),
      }),
    )
    .min(1)
    .max(50),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

type ConversionResult =
  | {
      ok: true;
      messages: Anthropic.MessageParam[];
      /** The visitor's questions in the kept turns, unwrapped, oldest first. */
      questions: string[];
    }
  | { ok: false; error: string };

const QUESTION_TAG = "visitor_question";

/**
 * Converts UI messages to the last few model turns, ending with the visitor's
 * question. Each question is wrapped in <visitor_question> tags, which the
 * system prompt treats as a question only, never as instructions. An answer
 * without a valid signature (forged, edited, or cut off by an error) is left
 * out, with the question it answered.
 */
export function toModelMessages(
  messages: ChatRequest["messages"],
  isGenuine: (answer: string, signature: string | undefined) => boolean = isSignedAnswer,
): ConversionResult {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of messages) {
    const content = message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!content) continue;
    if (message.role === "assistant" && !isGenuine(content, message.metadata?.signature ?? undefined)) {
      if (turns.at(-1)?.role === "user") turns.pop();
      continue;
    }
    turns.push({ role: message.role, content });
  }
  const kept = turns.slice(-MAX_HISTORY_MESSAGES);

  // The API requires the first message to be from the user.
  while (kept[0]?.role === "assistant") kept.shift();

  if (kept.at(-1)?.role !== "user") {
    return { ok: false, error: "The last message must be a question." };
  }
  if (kept.some((t) => t.role === "user" && t.content.length > MAX_QUESTION_CHARS)) {
    return { ok: false, error: `Questions can be up to ${MAX_QUESTION_CHARS} characters.` };
  }

  return {
    ok: true,
    messages: kept.map((turn) => ({
      role: turn.role,
      content: turn.role === "user" ? wrapQuestion(turn.content) : cleanAssistantTurn(turn.content),
    })),
    questions: kept.filter((t) => t.role === "user").map((t) => t.content),
  };
}

/**
 * The search query for retrieval: the latest question plus the one before it,
 * so follow-ups like "tell me more about that" still find the right chunks.
 */
export function retrievalQuery(questions: string[]): string {
  return questions.slice(-2).join("\n");
}

/** Removes any copy of the tag inside the text, so a visitor can't close it early. */
function wrapQuestion(text: string): string {
  const inner = text.replace(new RegExp(`</?${QUESTION_TAG}\\s*>`, "gi"), "");
  return `<${QUESTION_TAG}>${inner}</${QUESTION_TAG}>`;
}

/**
 * Caps the length of an earlier answer (ours are far shorter). Old citation
 * numbers refer to an earlier source list; drop them so the model doesn't
 * reuse them against the current one.
 */
function cleanAssistantTurn(text: string): string {
  return stripCitations(text.slice(0, MAX_ASSISTANT_CHARS));
}
