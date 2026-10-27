import type { AnswerableCase, EvalCase, UnanswerableCase } from "./cases";

/** What the judge returns for one answer (see judge.ts). */
export interface JudgeVerdict {
  facts: { fact: string; present: boolean }[];
  forbiddenClaims: { claim: string; made: boolean }[];
  /** Claims about Alexander that the site content does not support. */
  unsupportedClaims: string[];
  /** The answer declined, or said it doesn't have the information. */
  declined: boolean;
  explanation: string;
}

/** The parts of an answer the programmatic checks need. */
export interface ObservedAnswer {
  text: string;
  /** Files of the cited sources, e.g. "cv.md". */
  citedFiles: string[];
  /** Files of the chunks retrieval put in the prompt; null in baseline mode. */
  retrievedFiles: string[] | null;
}

export interface CaseScore {
  pass: boolean;
  /** Every reason the case failed; empty when it passed. */
  failures: string[];
  hallucinated: boolean;
  // Answerable cases only:
  correct?: boolean;
  factRecall?: number;
  citationHit?: boolean;
  /** Share of cited files that are expected sources; null when nothing was cited. */
  citationPrecision?: number | null;
  falseRefusal?: boolean;
  /** Retrieval put an expected source file in the prompt; null in baseline mode. */
  retrievalHit?: boolean | null;
  // Unanswerable cases only:
  declinedCorrectly?: boolean;
}

export function scoreCase(evalCase: EvalCase, answer: ObservedAnswer, verdict: JudgeVerdict): CaseScore {
  return evalCase.type === "answerable"
    ? scoreAnswerable(evalCase, answer, verdict)
    : scoreUnanswerable(evalCase, answer, verdict);
}

/**
 * Correct: states every expected fact, makes no forbidden or unsupported claim,
 * mentions the required strings and doesn't decline. Cited: at least one
 * citation points at an expected source file. Passing needs both.
 */
function scoreAnswerable(c: AnswerableCase, answer: ObservedAnswer, verdict: JudgeVerdict): CaseScore {
  const failures: string[] = [];
  const missingFacts = verdict.facts.filter((f) => !f.present).map((f) => f.fact);
  const forbidden = verdict.forbiddenClaims.filter((f) => f.made).map((f) => f.claim);
  const missingStrings = missingMentions(answer.text, c.mustMention);
  const hallucinated = verdict.unsupportedClaims.length > 0;

  // An answer that states every expected fact isn't a refusal, however it's
  // phrased: "the code isn't public" is both a "no" and the correct answer.
  const falseRefusal = verdict.declined && missingFacts.length > 0;
  if (falseRefusal) failures.push("declined an answerable question");
  for (const fact of missingFacts) failures.push(`missing fact: ${fact}`);
  for (const claim of forbidden) failures.push(`forbidden claim: ${claim}`);
  for (const claim of verdict.unsupportedClaims) failures.push(`unsupported claim: ${claim}`);
  for (const s of missingStrings) failures.push(`does not mention "${s}"`);

  const correct = failures.length === 0;
  const expected = new Set(c.sources);
  const citationHit = answer.citedFiles.some((file) => expected.has(file));
  if (!citationHit) {
    failures.push(
      answer.citedFiles.length === 0
        ? "no citations"
        : `cited ${unique(answer.citedFiles).join(", ")}; expected ${c.sources.join(" or ")}`,
    );
  }

  return {
    pass: correct && citationHit,
    failures,
    hallucinated,
    correct,
    factRecall: (verdict.facts.length - missingFacts.length) / verdict.facts.length,
    citationHit,
    citationPrecision:
      answer.citedFiles.length === 0
        ? null
        : answer.citedFiles.filter((file) => expected.has(file)).length / answer.citedFiles.length,
    falseRefusal,
    retrievalHit: answer.retrievedFiles === null ? null : answer.retrievedFiles.some((f) => expected.has(f)),
  };
}

/** Passes when the answer declines without inventing anything and meets the string checks. */
function scoreUnanswerable(c: UnanswerableCase, answer: ObservedAnswer, verdict: JudgeVerdict): CaseScore {
  const failures: string[] = [];
  const hallucinated = verdict.unsupportedClaims.length > 0;

  if (!verdict.declined) failures.push("answered instead of declining");
  for (const claim of verdict.unsupportedClaims) failures.push(`unsupported claim: ${claim}`);
  for (const s of missingMentions(answer.text, c.mustMention)) failures.push(`does not mention "${s}"`);
  for (const s of c.mustNotContain) {
    if (answer.text.toLowerCase().includes(s.toLowerCase())) failures.push(`contains "${s}"`);
  }

  return { pass: failures.length === 0, failures, hallucinated, declinedCorrectly: failures.length === 0 };
}

function missingMentions(text: string, required: string[]): string[] {
  const lower = text.toLowerCase();
  return required.filter((s) => !lower.includes(s.toLowerCase()));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Maps a citation URL like "/projects/rep-tracker#stack" to its file via the page URLs. */
export function fileForUrl(url: string, pageFiles: Map<string, string>): string | undefined {
  return pageFiles.get(url.split("#")[0]);
}

/** Maps a chunk id like "cv#skills/2" to its file, "cv.md". */
export function fileForChunkId(id: string): string {
  return `${id.split("#")[0]}.md`;
}
