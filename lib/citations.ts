/** Matches "[1]" and "[1, 3]". Shared by the server (which sources were cited) and the widget (links). */
const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

type AnswerSegment = { type: "text"; text: string } | { type: "citation"; numbers: number[] };

/**
 * Source numbers cited in an answer, in order of first appearance. Accepts
 * "[1]", "[1][3]" and "[1, 3]"; ignores numbers outside 1..sourceCount.
 */
export function extractCitations(answer: string, sourceCount: number): number[] {
  const cited: number[] = [];
  for (const segment of splitCitations(answer)) {
    if (segment.type !== "citation") continue;
    for (const n of segment.numbers) {
      if (n >= 1 && n <= sourceCount && !cited.includes(n)) cited.push(n);
    }
  }
  return cited;
}

/** Removes citation markers and the spaces before them: "Copenhagen [1]." becomes "Copenhagen.". */
export function stripCitations(answer: string): string {
  return answer.replace(new RegExp(`[ \\t]*${CITATION.source}`, "g"), "");
}

/** Splits an answer into plain text and citation markers, for rendering markers as links. */
export function splitCitations(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of answer.matchAll(CITATION)) {
    if (match.index > last) segments.push({ type: "text", text: answer.slice(last, match.index) });
    segments.push({
      type: "citation",
      numbers: match[1].split(",").map((n) => Number(n.trim())),
    });
    last = match.index + match[0].length;
  }
  if (last < answer.length) segments.push({ type: "text", text: answer.slice(last) });
  return segments;
}
