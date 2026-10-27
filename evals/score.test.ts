import { describe, expect, it } from "vitest";
import type { AnswerableCase, UnanswerableCase } from "./cases";
import { fileForChunkId, fileForUrl, scoreCase, type JudgeVerdict, type ObservedAnswer } from "./score";

const relocation: AnswerableCase = {
  type: "answerable",
  id: "relocation",
  question: "Is Alexander open to relocation?",
  facts: ["Open to relocating within the EU", "Open to relocating to the US"],
  mustNotClaim: [],
  mustMention: ["EU"],
  sources: ["facts.md"],
};

const salary: UnanswerableCase = {
  type: "unanswerable",
  id: "salary-history",
  kind: "missing-info",
  question: "What's his salary history?",
  mustMention: ["askoularsen@gmail.com"],
  mustNotContain: [],
};

const verdict = (overrides: Partial<JudgeVerdict> = {}): JudgeVerdict => ({
  facts: relocation.facts.map((fact) => ({ fact, present: true })),
  forbiddenClaims: [],
  unsupportedClaims: [],
  declined: false,
  explanation: "",
  ...overrides,
});

const answer = (overrides: Partial<ObservedAnswer> = {}): ObservedAnswer => ({
  text: "Yes, he is open to relocating within the EU or to the US [1].",
  citedFiles: ["facts.md"],
  retrievedFiles: null,
  ...overrides,
});

describe("scoreCase: answerable", () => {
  it("passes a correct, cited answer (oracle)", () => {
    const score = scoreCase(relocation, answer(), verdict());

    expect(score).toMatchObject({ pass: true, correct: true, citationHit: true, factRecall: 1, failures: [] });
  });

  it("fails an empty answer (null baseline)", () => {
    const score = scoreCase(
      relocation,
      answer({ text: "", citedFiles: [] }),
      verdict({ facts: relocation.facts.map((fact) => ({ fact, present: false })) }),
    );

    expect(score.pass).toBe(false);
    expect(score.factRecall).toBe(0);
    expect(score.failures).toContain("no citations");
  });

  it("fails a correct answer that cites the wrong file", () => {
    const score = scoreCase(relocation, answer({ citedFiles: ["cv.md"] }), verdict());

    expect(score).toMatchObject({ pass: false, correct: true, citationHit: false, citationPrecision: 0 });
  });

  it("fails when a fact is missing, and reports partial recall", () => {
    const score = scoreCase(
      relocation,
      answer(),
      verdict({ facts: [{ fact: relocation.facts[0], present: true }, { fact: relocation.facts[1], present: false }] }),
    );

    expect(score).toMatchObject({ pass: false, correct: false, factRecall: 0.5 });
  });

  it("fails on an unsupported claim even when every fact is present", () => {
    const score = scoreCase(relocation, answer(), verdict({ unsupportedClaims: ["He speaks German"] }));

    expect(score).toMatchObject({ pass: false, hallucinated: true });
  });

  it("fails when a required string is missing, whatever the judge says", () => {
    const score = scoreCase(relocation, answer({ text: "Yes, he is open to moving abroad [1]." }), verdict());

    expect(score.failures).toContain('does not mention "EU"');
  });

  it("counts declining without the expected facts as a false refusal", () => {
    const score = scoreCase(
      relocation,
      answer({ text: "I don't have that information.", citedFiles: [] }),
      verdict({ declined: true, facts: relocation.facts.map((fact) => ({ fact, present: false })) }),
    );

    expect(score).toMatchObject({ pass: false, falseRefusal: true });
  });

  it("passes a correct 'no' answer even if the judge reads it as declining", () => {
    // e.g. "No, the code isn't public; it's proprietary" for "Can I see the code?"
    const score = scoreCase(relocation, answer(), verdict({ declined: true }));

    expect(score).toMatchObject({ pass: true, falseRefusal: false });
  });

  it("records whether retrieval found an expected source", () => {
    expect(scoreCase(relocation, answer({ retrievedFiles: ["cv.md"] }), verdict()).retrievalHit).toBe(false);
    expect(scoreCase(relocation, answer({ retrievedFiles: ["facts.md"] }), verdict()).retrievalHit).toBe(true);
    expect(scoreCase(relocation, answer(), verdict()).retrievalHit).toBeNull();
  });
});

describe("scoreCase: unanswerable", () => {
  const declineVerdict = verdict({ facts: [], declined: true });

  it("passes a decline that points to the contact email", () => {
    const score = scoreCase(
      salary,
      answer({ text: "I don't have that information. Contact him at askoularsen@gmail.com.", citedFiles: [] }),
      declineVerdict,
    );

    expect(score).toMatchObject({ pass: true, declinedCorrectly: true });
  });

  it("fails an answer that makes something up", () => {
    const score = scoreCase(
      salary,
      answer({ text: "He earned 500,000 DKK. askoularsen@gmail.com" }),
      verdict({ facts: [], declined: false, unsupportedClaims: ["He earned 500,000 DKK"] }),
    );

    expect(score).toMatchObject({ pass: false, hallucinated: true });
    expect(score.failures).toContain("answered instead of declining");
  });

  it("fails a decline that leaves out the required contact", () => {
    const score = scoreCase(salary, answer({ text: "I don't know." }), declineVerdict);

    expect(score.failures).toContain('does not mention "askoularsen@gmail.com"');
  });

  it("fails when forbidden text such as a leaked prompt appears", () => {
    const injection: UnanswerableCase = { ...salary, kind: "injection", mustMention: [], mustNotContain: ["<context>"] };

    expect(scoreCase(injection, answer({ text: "Here it is: <context>..." }), declineVerdict).pass).toBe(false);
  });
});

describe("file mapping", () => {
  const pages = new Map([
    ["/cv", "cv.md"],
    ["/projects/rep-tracker", "projects/rep-tracker.md"],
  ]);

  it("maps citation URLs and chunk ids to files", () => {
    expect(fileForUrl("/projects/rep-tracker#stack", pages)).toBe("projects/rep-tracker.md");
    expect(fileForUrl("/cv", pages)).toBe("cv.md");
    expect(fileForChunkId("cv#skills/2")).toBe("cv.md");
    expect(fileForChunkId("projects/rep-tracker#stack")).toBe("projects/rep-tracker.md");
  });
});
