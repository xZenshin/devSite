import type { UIMessageChunk } from "ai";
import type { ChatDiagnostics, ChatMetadata } from "./answer";

/** An answer read from the chat API's stream to its end. */
export interface CollectedAnswer {
  text: string;
  /** Cited sources, by source number. */
  cited: { n: number; title?: string; url: string }[];
  /** Present when the server trusted the caller (see isTrustedCaller in the route). */
  diagnostics?: ChatDiagnostics;
  errorText?: string;
}

/**
 * A POST asking the chat API one question, as the scripts and evals send it.
 * EVAL_TOKEN, when set, is sent along, so a deployment returns diagnostics.
 */
export function questionRequest(question: string): RequestInit {
  const token = process.env.EVAL_TOKEN;
  return {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { "x-eval-token": token }) },
    body: JSON.stringify({ messages: [{ id: "1", role: "user", parts: [{ type: "text", text: question }] }] }),
  };
}

/** Reads a chat answer stream to its end. `onText` sees the text as it arrives. */
export async function collectAnswer(
  body: ReadableStream<Uint8Array>,
  onText?: (delta: string) => void,
): Promise<CollectedAnswer> {
  const collected: CollectedAnswer = { text: "", cited: [] };
  for await (const chunk of readUIMessageChunks(body)) {
    if (chunk.type === "text-delta") {
      collected.text += chunk.delta;
      onText?.(chunk.delta);
    } else if (chunk.type === "source-url") {
      collected.cited.push({ n: Number(chunk.sourceId), title: chunk.title, url: chunk.url });
    } else if (chunk.type === "error") {
      collected.errorText = chunk.errorText;
    } else if (chunk.type === "finish") {
      collected.diagnostics = (chunk.messageMetadata as ChatMetadata | undefined)?.diagnostics;
    }
  }
  return collected;
}

/** Parses the server-sent events of a UI message stream into chunks. */
async function* readUIMessageChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<UIMessageChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event.replace(/^data: /, "").trim();
      if (data && data !== "[DONE]") yield JSON.parse(data) as UIMessageChunk;
    }
  }
}
