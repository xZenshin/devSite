import type { UIMessageChunk } from "ai";

/** Parses the server-sent events of a UI message stream into chunks. */
export async function* readUIMessageChunks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<UIMessageChunk> {
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
