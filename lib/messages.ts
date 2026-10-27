import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MAX_ASSISTANT_CHARS, MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "./config";

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
 * system prompt treats as a question only, never as instructions.
 */
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
    return { ok: false, error: `Questions can be up to ${MAX_QUESTION_CHARS} characters.` };
  }

  return {
    ok: true,
    messages: turns.map((turn) => ({
      role: turn.role,
      content: turn.role === "user" ? wrapQuestion(turn.content) : cleanAssistantTurn(turn.content),
    })),
    questions: turns.filter((t) => t.role === "user").map((t) => t.content),
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
 * Earlier answers come back from the client, so they are untrusted: cap their
 * length. Old citation numbers refer to an earlier source list; drop them so
 * the model doesn't reuse them against the current one.
 */
function cleanAssistantTurn(text: string): string {
  return text.slice(0, MAX_ASSISTANT_CHARS).replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "");
}
