import GithubSlugger from "github-slugger";
import type { Site, SitePage } from "./site";

type CatchKind = "project" | "experience" | "education";

/** Something the lake holds: a project, a job or a degree, with where to read more. */
export interface Catch {
  /** Stable key, kept in the visitor's basket: "projects/rep-tracker", "experience/…". */
  id: string;
  kind: CatchKind;
  title: string;
  /** Employer or school, for CV entries. */
  org?: string;
  period?: string;
  summary?: string;
  href: string;
}

/** Reeled in from water where no fish is near, instead of a catch. Never kept in the basket. */
export interface Junk {
  id: string;
  title: string;
  quip: string;
}

export const JUNK: readonly Junk[] = [
  { id: "boot", title: "An old boot", quip: "Size 44. No project inside." },
  { id: "can", title: "An old rusty can", quip: "Who threw that in there?" },
  { id: "duck", title: "A rubber duck", quip: "Good for debugging. Not much of a catch." },
  { id: "note", title: "A soggy sticky note", quip: "It says TODO. That's all it says." },
  { id: "weed", title: "A clump of lake weed", quip: "Tangled, undocumented, and nobody's project." },
];

const CV_SECTIONS: { heading: string; kind: CatchKind }[] = [
  { heading: "Experience", kind: "experience" },
  { heading: "Education", kind: "education" },
];

/** Everything catchable: projects in site order, then jobs and degrees from the CV. */
export function buildCatches(site: Site): Catch[] {
  const projects = site.pages
    .filter((page) => page.url.startsWith("/projects/"))
    .map(
      (page): Catch => ({
        id: page.url.slice(1),
        kind: "project",
        title: page.title,
        ...(page.period && { period: page.period }),
        ...(page.summary && { summary: page.summary }),
        href: page.url,
      }),
    );
  const cv = site.pages.find((page) => page.url === "/cv");
  return [...projects, ...(cv ? CV_SECTIONS.flatMap(({ heading, kind }) => cvEntries(cv, heading, kind)) : [])];
}

/**
 * The `###` entries of one CV section. Headings follow the format content/cv.md
 * asks for, "Title — Organisation (years)"; anything else is kept whole as the title.
 */
export function cvEntries(cv: SitePage, heading: string, kind: CatchKind): Catch[] {
  const section = cv.sections.find((s) => s.heading === heading);
  if (!section) return [];
  const slugger = new GithubSlugger();
  const entries: Catch[] = [];
  let current: { heading: string; lines: string[] } | undefined;

  const flush = () => {
    if (!current) return;
    const match = /^(.+?)\s+[—–-]\s+(.+?)\s*\(([^)]+)\)$/.exec(current.heading);
    const summary = summarize(current.lines);
    entries.push({
      id: `${kind}/${slugger.slug(current.heading)}`,
      kind,
      title: match ? match[1] : current.heading,
      ...(match && { org: match[2], period: match[3] }),
      ...(summary && { summary }),
      // CV sub-headings have no anchors of their own, so link to the section.
      href: `${cv.url}#${section.anchor}`,
    });
  };

  for (const line of section.text.split(/\r?\n/)) {
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      flush();
      current = { heading: h3[1], lines: [] };
    } else {
      current?.lines.push(line);
    }
  }
  flush();
  return entries;
}

/** The entry's first paragraph or bullet as plain text, without a dangling "…:" lead-in. */
function summarize(lines: string[]): string | undefined {
  const block: string[] = [];
  for (const line of lines) {
    const isBullet = /^\s*[-*+]\s/.test(line);
    if (!line.trim() || (isBullet && block.length > 0)) {
      if (block.length > 0) break;
      continue;
    }
    block.push(line.replace(/^\s*[-*+]\s+/, "").trim());
  }
  const text = block
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    // "GPA 9.38. Selected courses (grade):" introduces a list; keep only what stands alone.
    .replace(/(^|[.!?]\s+)[^.!?]*:$/, "$1")
    .trim();
  return text || undefined;
}
