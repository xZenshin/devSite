import { describe, expect, it } from "vitest";
import { chunkSections, estimateTokens } from "./chunking";
import type { Section } from "./content";

const section = (overrides: Partial<Section> = {}): Section => ({
  id: "projects/rep-tracker#stack",
  file: "projects/rep-tracker.md",
  pageTitle: "RepTracker",
  pageSummary: "A free workout tracker.",
  heading: "Stack",
  url: "/projects/rep-tracker#stack",
  text: "- React\n- PostgreSQL",
  ...overrides,
});

/** A paragraph of roughly `tokens` estimated tokens. */
const paragraph = (tokens: number, word = "lorem") =>
  Array.from({ length: Math.ceil((tokens * 4) / (word.length + 1)) }, () => word).join(" ");

describe("chunkSections", () => {
  it("keeps a short section as one chunk with the section's id and url", () => {
    const [chunk, ...rest] = chunkSections([section()]);

    expect(rest).toEqual([]);
    expect(chunk).toMatchObject({
      id: "projects/rep-tracker#stack",
      sectionId: "projects/rep-tracker#stack",
      url: "/projects/rep-tracker#stack",
      text: "- React\n- PostgreSQL",
    });
  });

  it("never merges short sections, so each citation maps to one section", () => {
    const chunks = chunkSections([
      section(),
      section({ id: "projects/rep-tracker#links", heading: "Links", text: "- GitHub" }),
    ]);

    expect(chunks.map((c) => c.id)).toEqual([
      "projects/rep-tracker#stack",
      "projects/rep-tracker#links",
    ]);
  });

  it("prefixes the search text with owner, title, heading and summary for context", () => {
    const [chunk] = chunkSections([section()]);

    expect(chunk.searchText).toBe(
      "Alexander Skou-Larsen › RepTracker › Stack\nA free workout tracker.\n\n- React\n- PostgreSQL",
    );
  });

  it("omits the summary line for pages without one", () => {
    const [chunk] = chunkSections([
      section({ pageTitle: "CV", pageSummary: undefined, heading: "Skills", text: "Python" }),
    ]);

    expect(chunk.searchText).toBe("Alexander Skou-Larsen › CV › Skills\n\nPython");
  });

  it("splits an oversized section at ### headings", () => {
    const text = [
      `### Data Engineer Intern\n\n${paragraph(300, "pipeline")}`,
      `### Student Assistant\n\n${paragraph(300, "support")}`,
    ].join("\n\n");
    const chunks = chunkSections([section({ id: "cv#experience", text })], 500);

    expect(chunks.map((c) => c.id)).toEqual(["cv#experience/1", "cv#experience/2"]);
    expect(chunks[0].text).toMatch(/^### Data Engineer Intern/);
    expect(chunks[1].text).toMatch(/^### Student Assistant/);
    expect(chunks.every((c) => c.url === "/projects/rep-tracker#stack")).toBe(true);
  });

  it("splits at paragraphs when there are no ### headings, packing up to the limit", () => {
    const text = [paragraph(200), paragraph(200), paragraph(200)].join("\n\n");
    const chunks = chunkSections([section({ text })], 500);

    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) expect(estimateTokens(chunk.text)).toBeLessThanOrEqual(500);
  });

  it("keeps a single oversized paragraph whole instead of cutting it mid-sentence", () => {
    const text = paragraph(800);

    expect(chunkSections([section({ text })], 500).map((c) => c.text)).toEqual([text]);
  });

  it("gives a stable hash that changes when the content changes", () => {
    const [a] = chunkSections([section()]);
    const [b] = chunkSections([section()]);
    const [changed] = chunkSections([section({ text: "- React\n- Vue" })]);

    expect(a.hash).toBe(b.hash);
    expect(changed.hash).not.toBe(a.hash);
  });
});
