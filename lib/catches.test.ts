import { describe, expect, it } from "vitest";
import { buildCatches, cvEntries } from "./catches";
import type { Site, SitePage } from "./site";

function page(url: string, title: string, extra: Partial<SitePage> = {}): SitePage {
  return { file: `${url.slice(1)}.md`, url, title, featured: false, solo: false, images: [], sections: [], ...extra };
}

function section(heading: string, text: string): SitePage["sections"][number] {
  const anchor = heading.toLowerCase();
  return { id: `cv#${anchor}`, file: "cv.md", pageTitle: "CV", heading, url: `/cv#${anchor}`, text, anchor };
}

const CV = page("/cv", "CV", {
  sections: [
    section("Summary", "Recent graduate."),
    section(
      "Experience",
      [
        "### Data Engineer Intern — Novonesis, Data Office (2026)",
        "",
        "- Built a framework for ingesting public API data into",
        "  Databricks. See [Data Fetching Pipeline](/projects/data-fetching-pipeline).",
        "- A second bullet that is not part of the summary.",
        "",
        "### Student Assistant — University of Copenhagen, South Campus (2023–2025)",
        "",
        "- On-site **AV support**.",
      ].join("\n"),
    ),
    section(
      "Education",
      [
        "Grades are on the Danish 7-point grading scale.",
        "",
        "### MSc in Computer Science — IT University of Copenhagen (2023–2025)",
        "",
        "GPA 9.38. Selected courses (grade):",
        "",
        "- Algorithm Design (10)",
        "",
        "### A heading in some other shape",
      ].join("\n"),
    ),
  ],
});

const SITE: Site = {
  contact: {},
  pages: [
    page("/about", "Quick facts"),
    CV,
    page("/projects/rep-tracker", "RepTracker", { summary: "A workout tracker.", period: "2026" }),
    page("/projects/bare", "Bare"),
  ],
};

describe("buildCatches", () => {
  it("lists projects in site order, then jobs, then degrees", () => {
    expect(buildCatches(SITE).map((c) => [c.kind, c.title])).toEqual([
      ["project", "RepTracker"],
      ["project", "Bare"],
      ["experience", "Data Engineer Intern"],
      ["experience", "Student Assistant"],
      ["education", "MSc in Computer Science"],
      ["education", "A heading in some other shape"],
    ]);
  });

  it("takes project details from the page and leaves out what is missing", () => {
    const [full, bare] = buildCatches(SITE);
    expect(full).toEqual({
      id: "projects/rep-tracker",
      kind: "project",
      title: "RepTracker",
      period: "2026",
      summary: "A workout tracker.",
      href: "/projects/rep-tracker",
    });
    expect(bare).toEqual({ id: "projects/bare", kind: "project", title: "Bare", href: "/projects/bare" });
  });

  it("gives every catch a unique id", () => {
    const ids = buildCatches(SITE).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("works without a CV page", () => {
    expect(buildCatches({ contact: {}, pages: [page("/projects/a", "A")] })).toHaveLength(1);
  });
});

describe("cvEntries", () => {
  it("splits the heading into title, organisation and period", () => {
    expect(cvEntries(CV, "Experience", "experience")[1]).toMatchObject({
      id: "experience/student-assistant--university-of-copenhagen-south-campus-20232025",
      title: "Student Assistant",
      org: "University of Copenhagen, South Campus",
      period: "2023–2025",
      href: "/cv#experience",
    });
  });

  it("summarises with the first bullet, joined across lines, as plain text", () => {
    const [intern, assistant] = cvEntries(CV, "Experience", "experience");
    expect(intern.summary).toBe(
      "Built a framework for ingesting public API data into Databricks. See Data Fetching Pipeline.",
    );
    expect(assistant.summary).toBe("On-site AV support.");
  });

  it("drops a lead-in that only introduces a list", () => {
    expect(cvEntries(CV, "Education", "education")[0].summary).toBe("GPA 9.38.");
  });

  it("keeps an unrecognised heading whole and ignores text before the first entry", () => {
    const entries = cvEntries(CV, "Education", "education");
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({
      id: "education/a-heading-in-some-other-shape",
      kind: "education",
      title: "A heading in some other shape",
      href: "/cv#education",
    });
  });

  it("returns nothing for a section the CV does not have", () => {
    expect(cvEntries(CV, "Awards", "education")).toEqual([]);
  });
});
