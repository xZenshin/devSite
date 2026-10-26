import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "./config";

/**
 * The request body `useChat` sends. Only user and assistant roles are
 * accepted, so a client can't smuggle in its own system message.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.object({ type: z.string(), text: z.string().optional() })),
      }),
    )
    .min(1)
    .max(50),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ConversionResult =
  | { ok: true; messages: Anthropic.MessageParam[] }
  | { ok: false; error: string };

/** Converts UI messages to the last few model turns, ending with the visitor's question. */
export function toModelMessages(messages: ChatRequest["messages"]): ConversionResult {
  const turns = messages
    .map((message) => ({
      role: message.role,
      content: message.parts
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n")
        .trim(),
    }))
    .filter((turn) => turn.content)
    .slice(-MAX_HISTORY_MESSAGES);

  // The API requires the first message to be from the user.
  while (turns[0]?.role === "assistant") turns.shift();

  if (turns.at(-1)?.role !== "user") {
    return { ok: false, error: "The last message must be a question." };
  }
  if (turns.some((t) => t.role === "user" && t.content.length > MAX_QUESTION_CHARS)) {
    return {
      ok: false,
      error: `Please keep questions under ${MAX_QUESTION_CHARS} characters.`,
    };
  }

  return {
    ok: true,
    messages: turns.map((turn) => ({
      role: turn.role,
      // Old citation numbers refer to an earlier source list; drop them so the
      // model doesn't reuse them against the current one.
      content: turn.role === "assistant" ? stripCitations(turn.content) : turn.content,
    })),
  };
}

function stripCitations(text: string): string {
  return text.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "");
}
