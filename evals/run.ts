/**
 * Runs every case in evals/questions.json through the chat API, grades each
 * answer, prints a summary per mode and saves results to evals/results/<mode>.json.
 *
 *   npm run eval                                       both modes, 3 reps
 *   npm run eval -- --mode retrieval --reps 1
 *   npm run eval -- --cases relocation,salary-history  a few cases (pilot)
 *   npm run eval -- --url https://example.com/api/chat a deployed server instead
 *   npm run eval -- --min-pass 0.85                    exit 1 below this pass rate
 *
 * By default the route handler is called in-process: the same code path as
 * production, without starting a server, and the mode can be switched per run.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { POST } from "../app/api/chat/route";
import type { ChatMetadata } from "../lib/answer";
import { MODEL, type RetrievalMode } from "../lib/config";
import { loadContent } from "../lib/content";
import { costUsd } from "../lib/cost";
import { readUIMessageChunks } from "../lib/ui-stream";
import { loadCases, type EvalCase } from "./cases";
import { formatSiteContent, judge, JUDGE_MODEL } from "./judge";
import { formatFailures, formatSummaryTable, summarize, type RunRow, type Summary } from "./report";
import { fileForChunkId, fileForUrl, scoreCase } from "./score";

const CASE_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RESULTS_DIR = path.join(process.cwd(), "evals", "results");

const { values: args } = parseArgs({
  options: {
    mode: { type: "string", default: "both" },
    reps: { type: "string", default: "3" },
    concurrency: { type: "string", default: "4" },
    cases: { type: "string" },
    url: { type: "string" },
    "min-pass": { type: "string" },
  },
});

interface Collected {
  text: string;
  cited: { n: number; url: string }[];
  metadata?: ChatMetadata;
  errorText?: string;
}

interface Context {
  /** Undefined when running against a remote --url, where the server picks the mode. */
  mode?: RetrievalMode;
  siteContent: string;
  pageFiles: Map<string, string>;
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const reps = Number(args.reps);
  const concurrency = Number(args.concurrency);
  const filter = args.cases?.split(",").map((id) => id.trim());
  const cases = (await loadCases()).filter((c) => !filter || filter.includes(c.id));
  if (cases.length === 0) throw new Error("No cases match --cases");

  const { pages, sections } = await loadContent();
  const siteContent = formatSiteContent(sections);
  const pageFiles = new Map(pages.map((page) => [page.url, page.file]));

  const modes: (RetrievalMode | undefined)[] = args.url
    ? [undefined]
    : args.mode === "both"
      ? ["baseline", "retrieval"]
      : [parseMode(args.mode)];

  const summaries: Summary[] = [];
  for (const mode of modes) {
    const label = mode ?? "remote";
    if (mode) process.env.RETRIEVAL_MODE = mode;
    console.log(`\n${label}: ${cases.length} cases × ${reps} reps, judge ${JUDGE_MODEL}`);

    const startedAt = Date.now();
    const tasks = cases.flatMap((evalCase) => Array.from({ length: reps }, (_, rep) => ({ evalCase, rep })));
    const context: Context = { mode, siteContent, pageFiles };
    // Run one case alone first so baseline's prompt cache is written once, not by every worker.
    const [first, ...rest] = tasks;
    const rows = [
      await runTask(first.evalCase, first.rep, context),
      ...(await mapPool(rest, concurrency, (t) => runTask(t.evalCase, t.rep, context))),
    ];

    const summary = summarize(label, rows);
    summaries.push(summary);
    await saveResults(label, { reps, cases: cases.length, durationS: (Date.now() - startedAt) / 1000, summary, rows });
    console.log(`\nFailures (${label}):\n${formatFailures(rows)}`);
  }

  const table = formatSummaryTable(summaries);
  console.log(`\n${table}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Eval results\n\n${table}\n`);
  }

  const minPass = args["min-pass"] === undefined ? undefined : Number(args["min-pass"]);
  const below = summaries.filter((s) => minPass !== undefined && s.passRate < minPass);
  if (below.length > 0) {
    console.error(`Pass rate below ${minPass}: ${below.map((s) => `${s.mode} ${s.passRate.toFixed(3)}`).join(", ")}`);
    process.exitCode = 1;
  }
}

/** Asks one question (retrying plumbing failures), grades the answer and scores it. */
async function runTask(evalCase: EvalCase, rep: number, context: Context): Promise<RunRow> {
  const base = { id: evalCase.id, rep, type: evalCase.type, question: evalCase.question };
  const asked = await askWithRetries(evalCase.question, context.mode);
  if ("error" in asked) {
    log("✗", evalCase.id, rep, asked.error);
    return { ...base, status: "error", error: asked.error, attempts: asked.attempts };
  }

  const { result, attempts } = asked;
  const metadata = result.metadata!;
  const cited = result.cited.map((c) => ({ ...c, file: fileForUrl(c.url, context.pageFiles) }));
  const row: RunRow = { ...base, status: "ok", attempts, answer: result.text, cited, metadata };

  // A clipped answer is recorded but not scored as wrong.
  if (metadata.stopReason === "max_tokens") {
    log("…", evalCase.id, rep, "truncated");
    return { ...row, status: "truncated" };
  }

  try {
    const judged = await judge(evalCase, result.text, context.siteContent);
    const score = scoreCase(
      evalCase,
      {
        text: result.text,
        citedFiles: cited.map((c) => c.file).filter((f): f is string => Boolean(f)),
        retrievedFiles: metadata.retrievedIds?.map(fileForChunkId) ?? null,
      },
      judged.verdict,
    );
    log(score.pass ? "✓" : "✗", evalCase.id, rep);
    return {
      ...row,
      score,
      judgeExplanation: judged.verdict.explanation,
      verdict: judged.verdict,
      judgeCostUsd: costUsd(judged.usage),
    };
  } catch (error) {
    const message = `judge failed: ${errorMessage(error)}`;
    log("✗", evalCase.id, rep, message);
    return { ...row, status: "error", error: message };
  }
}

/**
 * Retries plumbing failures (stream errors, timeouts, retrieval falling back)
 * with jittered backoff. Wrong-model answers are errors, never scores.
 */
async function askWithRetries(
  question: string,
  mode: RetrievalMode | undefined,
): Promise<{ result: Collected; attempts: number } | { error: string; attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await withTimeout(ask(question), CASE_TIMEOUT_MS);
      if (result.errorText) throw new Error(`stream error: ${result.errorText}`);
      if (!result.metadata) throw new Error("stream ended without metadata");
      if (result.metadata.model !== MODEL) throw new Error(`served by ${result.metadata.model}, expected ${MODEL}`);
      if (mode && result.metadata.mode !== mode) {
        throw new Error(`ran in ${result.metadata.mode} mode, expected ${mode}`);
      }
      return { result, attempts: attempt };
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) return { error: errorMessage(error), attempts: attempt };
      await sleep(1000 * 2 ** attempt * (0.5 + Math.random()));
    }
  }
}

async function ask(question: string): Promise<Collected> {
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ id: "1", role: "user", parts: [{ type: "text", text: question }] }] }),
  };
  const response = args.url ? await fetch(args.url, init) : await POST(new Request("http://localhost/api/chat", init));
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

  const collected: Collected = { text: "", cited: [] };
  for await (const chunk of readUIMessageChunks(response.body)) {
    if (chunk.type === "text-delta") collected.text += chunk.delta;
    else if (chunk.type === "source-url") collected.cited.push({ n: Number(chunk.sourceId), url: chunk.url });
    else if (chunk.type === "error") collected.errorText = chunk.errorText;
    else if (chunk.type === "finish") collected.metadata = chunk.messageMetadata as ChatMetadata;
  }
  return collected;
}

async function saveResults(label: string, results: object): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${label}.json`);
  await writeFile(
    file,
    JSON.stringify({ mode: label, model: MODEL, judgeModel: JUDGE_MODEL, finishedAt: new Date().toISOString(), ...results }, null, 2),
  );
  console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping input order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseMode(value: string | undefined): RetrievalMode {
  if (value === "baseline" || value === "retrieval") return value;
  throw new Error(`--mode must be baseline, retrieval or both (got ${value})`);
}

function log(mark: string, id: string, rep: number, detail?: string): void {
  console.log(`${mark} ${id} #${rep + 1}${detail ? ` (${detail})` : ""}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// exitCode rather than process.exit(): exiting while network handles are still
// closing crashes Node on Windows (libuv assertion in async.c).
main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
