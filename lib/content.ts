import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import GithubSlugger from "github-slugger";
import matter from "gray-matter";

/** One `##` section of a content file: the unit the assistant cites. */
export interface Section {
  /** Stable key, e.g. "projects/rep-tracker#stack". */
  id: string;
  /** Source file relative to /content, e.g. "projects/rep-tracker.md". */
  file: string;
  /** Page title from frontmatter, e.g. "RepTracker". */
  pageTitle: string;
  /** One-line project summary from frontmatter; gives short chunks context. */
  pageSummary?: string;
  heading: string;
  /** Site URL with the heading anchor, e.g. "/projects/rep-tracker#stack". */
  url: string;
  /** Cleaned Markdown body, without the heading line. */
  text: string;
}

export interface Contact {
  email?: string;
  linkedin?: string;
  github?: string;
  /** Leaguepedia profile (League of Legends esports wiki). */
  leaguepedia?: string;
}

/** Frontmatter of one content file, for rendering its page. */
export interface PageMeta {
  file: string;
  /** Page path without anchor, e.g. "/cv" or "/projects/rep-tracker". */
  url: string;
  title: string;
  summary?: string;
  period?: string;
  featured: boolean;
  /** Projects only: built by Alexander alone. */
  solo: boolean;
  /** Projects only: screenshots or diagrams shown under the page header. */
  images: ProjectImage[];
}

/**
 * One picture on a project page, from the `images` frontmatter list. Images are
 * shown on the page only; the assistant never sees them.
 */
export interface ProjectImage {
  /** Path under /public, e.g. "/projects/applicator/review.png". */
  src: string;
  alt: string;
  caption?: string;
}

export interface Content {
  pages: PageMeta[];
  sections: Section[];
  contact: Contact;
  /** Unfinished content that was left out, for logging. */
  warnings: string[];
}

interface ParsedFile {
  file: string;
  order: number;
  page: PageMeta;
  sections: Section[];
  contact?: Contact;
  warnings: string[];
}

const PLACEHOLDER = /\bTODO\b/;
const BLOCK_START = /^\s{0,3}(?:[-*+]|\d+\.)\s|^#{1,6}\s/;
const CONTACT_LABELS: Record<keyof Contact, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  github: "GitHub",
  leaguepedia: "Leaguepedia",
};

let cached: Promise<Content> | undefined;

/** Loads content once per server instance; reloads on every call in development. */
export function getContent(): Promise<Content> {
  if (process.env.NODE_ENV === "development") return loadContent();
  return (cached ??= loadContent());
}

/** Reads facts.md, cv.md and projects/*.md, in that order (projects by `order`). */
export async function loadContent(): Promise<Content> {
  // Paths stay statically under content/ so the deployment bundles only that folder.
  const projectFiles = (await readdir(path.join(process.cwd(), "content", "projects")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `projects/${name}`);
  const files = ["facts.md", "cv.md", ...projectFiles];

  const parsed = await Promise.all(
    files.map(async (file) =>
      parseContentFile(file, await readFile(path.join(process.cwd(), "content", file), "utf8")),
    ),
  );
  // Fixed order keeps the baseline prompt byte-identical between requests,
  // which prompt caching requires.
  const ordered = [
    ...parsed.filter((p) => !isProject(p.file)),
    ...parsed
      .filter((p) => isProject(p.file))
      .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file)),
  ];

  return {
    pages: ordered.map((p) => p.page),
    sections: ordered.flatMap((p) => p.sections),
    contact: ordered.find((p) => p.contact)?.contact ?? {},
    warnings: ordered.flatMap((p) => p.warnings),
  };
}

/**
 * Turns one Markdown file into citable sections. Unfinished content (any block
 * containing TODO) and HTML comments are removed, so the model never sees them.
 */
export function parseContentFile(file: string, raw: string): ParsedFile {
  const { data, content } = matter(raw);
  const pageTitle = cleanValue(data.title) ?? file;
  const pageUrl = pageUrlFor(file, data.url);
  const pageSummary = isProject(file) ? cleanValue(data.summary) : undefined;
  const slugger = new GithubSlugger();
  const warnings: string[] = [];
  const sections: Section[] = [];

  if (isProject(file)) {
    const overview = projectOverview(file, pageTitle, pageUrl, data);
    if (overview) sections.push(overview);
  }

  const { preface, parts } = splitByH2(stripComments(content));
  if (preface.trim()) {
    warnings.push(`${file}: text before the first ## heading is ignored`);
  }

  for (const { heading, body } of parts) {
    // Slug every heading, even dropped ones, so anchors match the rendered page.
    const anchor = slugger.slug(heading);
    const { text, dropped } = dropPlaceholderBlocks(body);
    if (dropped > 0) {
      warnings.push(`${file} › ${heading}: left out ${dropped} unfinished block(s)`);
    }
    if (!text || PLACEHOLDER.test(heading)) continue;
    sections.push({
      id: `${stripExtension(file)}#${anchor}`,
      file,
      pageTitle,
      ...(pageSummary && { pageSummary }),
      heading,
      url: `${pageUrl}#${anchor}`,
      text,
    });
  }

  const contact = parseContact(data.contact);
  if (contact) {
    const contactSection = buildContactSection(file, pageTitle, pageUrl, contact, slugger);
    if (contactSection) sections.push(contactSection);
  }

  return {
    file,
    order: typeof data.order === "number" ? data.order : Number.MAX_SAFE_INTEGER,
    page: {
      file,
      url: pageUrl,
      title: pageTitle,
      ...(pageSummary && { summary: pageSummary }),
      ...(cleanValue(data.period) && { period: cleanValue(data.period) }),
      featured: data.featured === true,
      solo: isProject(file) && data.solo === true,
      images: isProject(file) ? parseImages(file, data.images, warnings) : [],
    },
    sections,
    contact,
    warnings,
  };
}

/** Splits Markdown on `## ` headings, ignoring headings inside code fences. */
export function splitByH2(markdown: string): {
  preface: string;
  parts: { heading: string; body: string }[];
} {
  const preface: string[] = [];
  const parts: { heading: string; lines: string[] }[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const heading = !inFence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      parts.push({ heading: heading[1], lines: [] });
    } else {
      (parts.at(-1)?.lines ?? preface).push(line);
    }
  }

  return {
    preface: preface.join("\n"),
    parts: parts.map((p) => ({ heading: p.heading, body: p.lines.join("\n") })),
  };
}

/**
 * Removes every block (paragraph, list item with its continuation lines, or
 * heading) that contains a TODO placeholder.
 */
export function dropPlaceholderBlocks(body: string): { text: string; dropped: number } {
  const lines = body.split(/\r?\n/);
  const blocks: number[][] = [];
  let current: number[] | null = null;

  lines.forEach((line, i) => {
    if (!line.trim()) {
      current = null;
      return;
    }
    if (!current || BLOCK_START.test(line)) {
      current = [];
      blocks.push(current);
    }
    current.push(i);
  });

  const removed = new Set<number>();
  let dropped = 0;
  for (const block of blocks) {
    if (block.some((i) => PLACEHOLDER.test(lines[i]))) {
      block.forEach((i) => removed.add(i));
      dropped++;
    }
  }

  const text = lines
    .filter((_, i) => !removed.has(i))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, dropped };
}

function stripComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

function projectOverview(
  file: string,
  pageTitle: string,
  pageUrl: string,
  data: Record<string, unknown>,
): Section | null {
  const summary = cleanValue(data.summary);
  const period = cleanValue(data.period);
  const lines = [
    summary,
    period && `- Period: ${period}`,
    // Spelled out, because the model never sees the frontmatter flag itself.
    data.featured === true && "- Featured project: Alexander considers this his strongest project.",
    data.solo === true && "- Solo project: Alexander designed and built it alone.",
  ].filter((line): line is string => Boolean(line));
  if (lines.length === 0) return null;

  return {
    id: `${stripExtension(file)}#overview`,
    file,
    pageTitle,
    heading: "Overview",
    url: pageUrl,
    text: lines.join("\n"),
  };
}

/** The Contact section is generated from frontmatter, its single source of truth. */
function buildContactSection(
  file: string,
  pageTitle: string,
  pageUrl: string,
  contact: Contact,
  slugger: GithubSlugger,
): Section | null {
  const lines = (Object.keys(CONTACT_LABELS) as (keyof Contact)[])
    .filter((key) => contact[key])
    .map((key) => `- ${CONTACT_LABELS[key]}: ${contact[key]}`);
  if (lines.length === 0) return null;

  const anchor = slugger.slug("Contact");
  return {
    id: `${stripExtension(file)}#${anchor}`,
    file,
    pageTitle,
    heading: "Contact",
    url: `${pageUrl}#${anchor}`,
    text: lines.join("\n"),
  };
}

function parseImages(file: string, value: unknown, warnings: string[]): ProjectImage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    warnings.push(`${file}: "images" must be a list`);
    return [];
  }
  const images: ProjectImage[] = [];
  for (const item of value) {
    const raw = (item ?? {}) as Record<string, unknown>;
    const src = cleanValue(raw.src);
    const alt = cleanValue(raw.alt);
    if (!src?.startsWith("/") || !alt) {
      warnings.push(`${file}: skipped an image without a "src" under /public or without "alt" text`);
      continue;
    }
    const caption = cleanValue(raw.caption);
    images.push({ src, alt, ...(caption && { caption }) });
  }
  return images;
}

function parseContact(value: unknown): Contact | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const contact: Contact = {};
  for (const key of Object.keys(CONTACT_LABELS) as (keyof Contact)[]) {
    const cleaned = cleanValue(raw[key]);
    if (cleaned) contact[key] = cleaned;
  }
  return contact;
}

function pageUrlFor(file: string, url: unknown): string {
  if (isProject(file)) return `/${stripExtension(file)}`;
  const cleaned = cleanValue(url);
  if (!cleaned) throw new Error(`${file}: frontmatter needs a "url" field`);
  return cleaned;
}

/** A trimmed string value, or undefined when missing or still a placeholder. */
function cleanValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text && !PLACEHOLDER.test(text) ? text : undefined;
}

function isProject(file: string): boolean {
  return file.startsWith("projects/");
}

function stripExtension(file: string): string {
  return file.replace(/\.md$/, "");
}
