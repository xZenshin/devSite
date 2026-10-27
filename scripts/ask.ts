/**
 * Asks the running chat API one question and prints the streamed answer, its
 * cited sources and the usage metadata.
 *
 *   npm run dev                      (in another terminal)
 *   npm run ask -- "Is Alexander open to relocation?"
 */
import type { ChatMetadata } from "../lib/answer";
import { readUIMessageChunks } from "../lib/ui-stream";

const API_URL = process.env.CHAT_API_URL ?? "http://localhost:3000/api/chat";

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) throw new Error('Usage: npm run ask -- "your question"');

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: question }] }],
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const sources: string[] = [];
  let metadata: ChatMetadata | undefined;

  for await (const chunk of readUIMessageChunks(response.body)) {
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

// exitCode rather than process.exit(): exiting while network handles are still
// closing crashes Node on Windows (libuv assertion in async.c).
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
