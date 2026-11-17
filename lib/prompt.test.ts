import { describe, expect, it } from "vitest";
import type { Section } from "./content";
import { buildSystemPrompt } from "./prompt";

const sections: Section[] = [
  {
    id: "facts#location",
    file: "facts.md",
    pageTitle: "Quick facts",
    heading: "Location",
    url: "/about#location",
    text: "Copenhagen, Denmark.",
  },
  {
    id: "projects/rep-tracker#stack",
    file: "projects/rep-tracker.md",
    pageTitle: "RepTracker",
    heading: "Stack",
    url: "/projects/rep-tracker#stack",
    text: 'Costs $0 and uses "React".',
  },
];

describe("buildSystemPrompt", () => {
  it("numbers sources from 1 with their title and URL", () => {
    const prompt = buildSystemPrompt(sections, { email: "a@example.com" });

    expect(prompt).toContain(
      '<source id="1" title="Quick facts › Location" url="/about#location">\nCopenhagen, Denmark.\n</source>',
    );
    expect(prompt).toContain('<source id="2" title="RepTracker › Stack"');
  });

  it("fills both placeholders and keeps $ and quotes in content intact", () => {
    const prompt = buildSystemPrompt(sections, { email: "a@example.com" });

    expect(prompt).toContain("contacting Alexander at a@example.com");
    expect(prompt).not.toMatch(/\[CONTACT\]|\{retrieved_chunks\}/);
    expect(prompt).toContain('Costs $0 and uses "React".');
  });

  it("falls back to a generic contact line when no details exist", () => {
    expect(buildSystemPrompt(sections, {})).toContain(
      "contacting Alexander at the contact details on this website",
    );
  });

  it("is deterministic, so the prompt cache can hit", () => {
    expect(buildSystemPrompt(sections, {})).toBe(buildSystemPrompt([...sections], {}));
  });
});
