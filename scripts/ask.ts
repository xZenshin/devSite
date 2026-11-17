/**
 * Asks the running chat API one question and prints the streamed answer, its
 * cited sources and the diagnostics (latency, tokens, cost).
 *
 *   npm run dev                      (in another terminal)
 *   npm run ask -- "Is Alexander open to relocation?"
 *
 * A dev server always sends diagnostics; a deployment only with EVAL_TOKEN set.
 */
import { existsSync } from "node:fs";
import { collectAnswer, questionRequest } from "../lib/ui-stream";

const API_URL = process.env.CHAT_API_URL ?? "http://localhost:3000/api/chat";

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) throw new Error('Usage: npm run ask -- "your question"');

  const response = await fetch(API_URL, questionRequest(question));
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const answer = await collectAnswer(response.body, (delta) => process.stdout.write(delta));
  if (answer.errorText) console.error(`\nError: ${answer.errorText}`);

  const sources = answer.cited.map((c) => `[${c.n}] ${c.title} → ${c.url}`);
  console.log(sources.length ? `\n\nSources:\n${sources.join("\n")}` : "\n\n(no sources cited)");
  if (answer.diagnostics) console.log("\nDiagnostics:", answer.diagnostics);
}

// exitCode rather than process.exit(): exiting while network handles are still
// closing crashes Node on Windows (libuv assertion in async.c).
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
