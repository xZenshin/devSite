import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const answerableSchema = z.object({
  id: z.string(),
  question: z.string(),
  facts: z.array(z.string()).min(1),
  mustNotClaim: z.array(z.string()).default([]),
  mustMention: z.array(z.string()).default([]),
  sources: z.array(z.string()).min(1),
});

const unanswerableSchema = z.object({
  id: z.string(),
  kind: z.enum(["missing-info", "off-topic", "injection"]),
  question: z.string(),
  mustMention: z.array(z.string()).default([]),
  mustNotContain: z.array(z.string()).default([]),
});

const questionsSchema = z.object({
  answerable: z.array(answerableSchema),
  unanswerable: z.array(unanswerableSchema),
});

export type AnswerableCase = z.infer<typeof answerableSchema> & { type: "answerable" };
export type UnanswerableCase = z.infer<typeof unanswerableSchema> & { type: "unanswerable" };
export type EvalCase = AnswerableCase | UnanswerableCase;

export async function loadCases(file = path.join(process.cwd(), "evals", "questions.json")): Promise<EvalCase[]> {
  const parsed = questionsSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const cases: EvalCase[] = [
    ...parsed.answerable.map((c) => ({ ...c, type: "answerable" as const })),
    ...parsed.unanswerable.map((c) => ({ ...c, type: "unanswerable" as const })),
  ];
  const ids = cases.map((c) => c.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new Error(`Duplicate case id: ${duplicate}`);
  return cases;
}
