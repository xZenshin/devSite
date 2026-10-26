/**
 * Asks the running chat API one question and prints the streamed answer, its
 * cited sources and the usage metadata.
 *
 *   npm run dev                      (in another terminal)
 *   npm run ask -- "Is Alexander open to relocation?"
 */
import type { UIMessageChunk } from "ai";
import type { ChatMetadata } from "../lib/answer";

const API_URL = process.env.CHAT_API_URL ?? "http://localhost:3000/api/chat";

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run ask -- "your question"');
    process.exit(1);
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: question }] }],
    }),
  });
  if (!response.ok || !response.body) {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const sources: string[] = [];
  let metadata: ChatMetadata | undefined;

  for await (const chunk of readChunks(response.body)) {
    switch (chunk.type) {
      case "text-delta":
        process.stdout.write(chunk.delta);
        break;
      case "source-url":
        sources.push(`[${chunk.sourceId}] ${chunk.title} → ${chunk.url}`);
        break;
      case "error":
        console.error(`\nError: ${chunk.errorText}`);
        break;
      case "finish":
        metadata = chunk.messageMetadata as ChatMetadata | undefined;
        break;
    }
  }

  console.log(sources.length ? `\n\nSources:\n${sources.join("\n")}` : "\n\n(no sources cited)");
  if (metadata) console.log("\nMetadata:", metadata);
}

/** Parses the server-sent events of a UI message stream into chunks. */
async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<UIMessageChunk> {
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
