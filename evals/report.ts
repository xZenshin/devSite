import type { ChatDiagnostics } from "../lib/answer";
import type { CaseScore, JudgeVerdict } from "./score";

/** One (case, rep) attempt. Errors carry no score and are left out of every metric. */
export interface RunRow {
  id: string;
  rep: number;
  type: "answerable" | "unanswerable";
  status: "ok" | "truncated" | "error";
  error?: string;
  attempts: number;
  question: string;
  answer?: string;
  cited?: { n: number; url: string; file?: string }[];
  metadata?: ChatDiagnostics;
  judgeExplanation?: string;
  /** Raw judge output, so scoring changes can be re-applied without re-running. */
  verdict?: JudgeVerdict;
  judgeCostUsd?: number;
  score?: CaseScore;
}

export interface Summary {
  mode: string;
  runs: number;
  errors: number;
  truncated: number;
  passRate: number;
  /** Half-width of the 95% confidence interval on passRate. */
  passMargin: number;
  correctness: number;
  factRecall: number;
  citationHit: number;
  citationPrecision: number;
  falseRefusals: number;
  declinedCorrectly: number;
  hallucinationRate: number;
  retrievalHit: number | null;
  latencyP50: number;
  latencyP95: number;
  ttftP50: number;
  retrievalP50: number | null;
  costPerQuestion: number;
  judgeCostTotal: number;
}

export function summarize(mode: string, rows: RunRow[]): Summary {
  const scored = rows.filter((r): r is RunRow & { score: CaseScore; metadata: ChatDiagnostics } =>
    Boolean(r.status === "ok" && r.score && r.metadata),
  );
  const answerable = scored.filter((r) => r.type === "answerable").map((r) => r.score);
  const unanswerable = scored.filter((r) => r.type === "unanswerable").map((r) => r.score);
  const meta = scored.map((r) => r.metadata);
  const passRate = rate(scored.map((r) => r.score.pass));
  const retrieval = answerable.map((s) => s.retrievalHit).filter((v): v is boolean => v !== null && v !== undefined);
  const retrievalTimes = meta.map((m) => m.retrievalMs).filter((v): v is number => v !== null);

  return {
    mode,
    runs: rows.length,
    errors: rows.filter((r) => r.status === "error").length,
    truncated: rows.filter((r) => r.status === "truncated").length,
    passRate,
    passMargin: 1.96 * Math.sqrt((passRate * (1 - passRate)) / Math.max(scored.length, 1)),
    correctness: rate(answerable.map((s) => s.correct === true)),
    factRecall: mean(answerable.map((s) => s.factRecall ?? 0)),
    citationHit: rate(answerable.map((s) => s.citationHit === true)),
    citationPrecision: mean(
      answerable.map((s) => s.citationPrecision).filter((v): v is number => v !== null && v !== undefined),
    ),
    falseRefusals: answerable.filter((s) => s.falseRefusal).length,
    declinedCorrectly: rate(unanswerable.map((s) => s.declinedCorrectly === true)),
    hallucinationRate: rate(scored.map((r) => r.score.hallucinated)),
    retrievalHit: retrieval.length ? rate(retrieval) : null,
    latencyP50: percentile(meta.map((m) => m.latencyMs), 50),
    latencyP95: percentile(meta.map((m) => m.latencyMs), 95),
    ttftP50: percentile(meta.map((m) => m.timeToFirstTokenMs ?? m.latencyMs), 50),
    retrievalP50: retrievalTimes.length ? percentile(retrievalTimes, 50) : null,
    costPerQuestion: mean(meta.map((m) => m.costUsd)),
    judgeCostTotal: rows.reduce((sum, r) => sum + (r.judgeCostUsd ?? 0), 0),
  };
}

/** A Markdown table with one column per mode, for the terminal, CI summaries and the README. */
export function formatSummaryTable(summaries: Summary[]): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const ms = (v: number) => `${Math.round(v)} ms`;
  const usd = (v: number) => `$${v.toFixed(5)}`;
  const rowsSpec: [string, (s: Summary) => string][] = [
    ["Pass rate (95% CI)", (s) => `${pct(s.passRate)} ± ${(s.passMargin * 100).toFixed(1)}`],
    ["Correctness (answerable)", (s) => pct(s.correctness)],
    ["Fact recall", (s) => pct(s.factRecall)],
    ["Citation hit", (s) => pct(s.citationHit)],
    ["Citation precision", (s) => pct(s.citationPrecision)],
    ["Declined correctly (unanswerable)", (s) => pct(s.declinedCorrectly)],
    ["False refusals", (s) => String(s.falseRefusals)],
    ["Answers with unsupported claims", (s) => pct(s.hallucinationRate)],
    ["Retrieval found expected source", (s) => (s.retrievalHit === null ? "n/a" : pct(s.retrievalHit))],
    ["Latency p50 / p95", (s) => `${ms(s.latencyP50)} / ${ms(s.latencyP95)}`],
    ["Time to first token p50", (s) => ms(s.ttftP50)],
    ["Retrieval time p50", (s) => (s.retrievalP50 === null ? "n/a" : ms(s.retrievalP50))],
    ["Cost per question", (s) => usd(s.costPerQuestion)],
    ["Cost per 1,000 questions", (s) => `$${(s.costPerQuestion * 1000).toFixed(2)}`],
    ["Runs (errors / truncated)", (s) => `${s.runs} (${s.errors} / ${s.truncated})`],
    ["Judge cost (whole run)", (s) => `$${s.judgeCostTotal.toFixed(3)}`],
  ];
  const header = `| Metric | ${summaries.map((s) => s.mode).join(" | ")} |`;
  const divider = `|---|${summaries.map(() => "---:").join("|")}|`;
  const body = rowsSpec.map(([label, value]) => `| ${label} | ${summaries.map(value).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

/** Cases that failed at least one rep, with the reasons from the first failure. */
export function formatFailures(rows: RunRow[]): string {
  const byId = new Map<string, RunRow[]>();
  for (const row of rows) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);

  const lines: string[] = [];
  for (const [id, caseRows] of byId) {
    const failed = caseRows.filter((r) => r.status === "error" || (r.score && !r.score.pass));
    if (failed.length === 0) continue;
    const first = failed[0];
    const reason = first.status === "error" ? `error: ${first.error}` : first.score!.failures.join("; ");
    lines.push(`- ${id} (${failed.length}/${caseRows.length} failed): ${reason}`);
  }
  return lines.length ? lines.join("\n") : "- none";
}

function rate(values: boolean[]): number {
  return values.length ? values.filter(Boolean).length / values.length : 0;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
