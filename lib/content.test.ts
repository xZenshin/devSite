import { describe, expect, it } from "vitest";
import { dropPlaceholderBlocks, loadContent, parseContentFile, splitByH2 } from "./content";

const CV = `---
title: CV
url: /cv
---

<!-- authoring guidance -->

## Summary

Recent graduate.

## Skills

- Python: production.
- Java. TODO: context for
  each language.
- SQL: coursework.

## Spoken languages

TODO: fill in.
`;

describe("parseContentFile", () => {
  it("creates one section per ## heading with page-anchored URLs", () => {
    const { sections } = parseContentFile("cv.md", CV);

    expect(sections.map((s) => [s.id, s.heading, s.url])).toEqual([
      ["cv#summary", "Summary", "/cv#summary"],
      ["cv#skills", "Skills", "/cv#skills"],
    ]);
    expect(sections[0]).toMatchObject({ file: "cv.md", pageTitle: "CV", text: "Recent graduate." });
  });

  it("drops TODO blocks, including their continuation lines, and reports them", () => {
    const { sections, warnings } = parseContentFile("cv.md", CV);
    const skills = sections.find((s) => s.heading === "Skills");

    expect(skills?.text).toBe("- Python: production.\n- SQL: coursework.");
    expect(warnings).toEqual([
      "cv.md › Skills: left out 1 unfinished block(s)",
      "cv.md › Spoken languages: left out 1 unfinished block(s)",
    ]);
  });

  it("removes HTML comments, including multi-line ones", () => {
    const raw = "---\nurl: /x\n---\n## A\n\nKeep <!-- inline --> this.\n<!--\nmulti\nline\n-->\n";
    const [section] = parseContentFile("x.md", raw).sections;

    expect(section.text).toBe("Keep  this.");
  });

  it("dedupes repeated headings the same way the rendered page will", () => {
    const raw = "---\nurl: /x\n---\n## Notes\n\none\n\n## Notes\n\ntwo\n";

    expect(parseContentFile("x.md", raw).sections.map((s) => s.url)).toEqual([
      "/x#notes",
      "/x#notes-1",
    ]);
  });

  it("keeps anchors stable when an earlier heading is dropped", () => {
    const raw = "---\nurl: /x\n---\n## Notes\n\nTODO\n\n## Notes\n\nreal\n";

    expect(parseContentFile("x.md", raw).sections.map((s) => s.url)).toEqual(["/x#notes-1"]);
  });

  it("derives project URLs from the file name and adds an overview from frontmatter", () => {
    const raw = `---
title: RepTracker
summary: A workout tracker.
period: TODO
featured: true
order: 3
---
## Stack

- React
`;
    const parsed = parseContentFile("projects/rep-tracker.md", raw);

    expect(parsed.order).toBe(3);
    expect(parsed.sections.map((s) => [s.id, s.url])).toEqual([
      ["projects/rep-tracker#overview", "/projects/rep-tracker"],
      ["projects/rep-tracker#stack", "/projects/rep-tracker#stack"],
    ]);
    expect(parsed.sections[0].text).toBe("A workout tracker.\n- Featured project");
  });

  it("builds the contact section and contact details from frontmatter, skipping TODOs", () => {
    const raw = `---
title: Quick facts
url: /about
contact:
  email: a@example.com
  linkedin: TODO
  github: https://github.com/example
---
## Location

Copenhagen.
`;
    const parsed = parseContentFile("facts.md", raw);

    expect(parsed.contact).toEqual({ email: "a@example.com", github: "https://github.com/example" });
    expect(parsed.sections.at(-1)).toMatchObject({
      heading: "Contact",
      url: "/about#contact",
      text: "- Email: a@example.com\n- GitHub: https://github.com/example",
    });
  });

  it("requires a url in frontmatter for non-project pages", () => {
    expect(() => parseContentFile("cv.md", "## A\n\ntext")).toThrow(/url/);
  });
});

describe("splitByH2", () => {
  it("ignores headings inside code fences and keeps H3s in the body", () => {
    const { preface, parts } = splitByH2("intro\n## A\n```\n## not a heading\n```\n### Sub\n## B");

    expect(preface).toBe("intro");
    expect(parts.map((p) => p.heading)).toEqual(["A", "B"]);
    expect(parts[0].body).toContain("## not a heading");
    expect(parts[0].body).toContain("### Sub");
  });
});

describe("dropPlaceholderBlocks", () => {
  it("drops a TODO heading but keeps the following paragraph separate", () => {
    expect(dropPlaceholderBlocks("### TODO: Title\n\nReal text.")).toEqual({
      text: "Real text.",
      dropped: 1,
    });
  });
});

describe("loadContent (real /content folder)", () => {
  it("produces unique, clean sections and finds the contact details", async () => {
    const { sections, contact } = await loadContent();
    const ids = sections.map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const section of sections) {
      expect(section.text).not.toMatch(/\bTODO\b|<!--/);
      expect(section.url).toMatch(/^\//);
    }
    expect(contact.email).toBeTruthy();
    expect(sections[0].file).toBe("facts.md");
  });
});
