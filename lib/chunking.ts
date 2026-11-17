import { createHash } from "node:crypto";
import { EMBEDDING_MODEL, MAX_CHUNK_TOKENS, SITE_OWNER } from "./config";
import type { Section } from "./content";

/**
 * A retrievable piece of a section. It has the same shape as a Section, so the
 * prompt can cite chunks and sections alike.
 */
export interface Chunk extends Section {
  sectionId: string;
  /** Title, summary and body: the text that is embedded and full-text indexed. */
  searchText: string;
  /** Changes whenever anything stored for this chunk changes; drives re-embedding. */
  hash: string;
}

/**
 * One chunk per section. Sections over `maxTokens` are split at ### headings,
 * then at paragraphs. Short sections are never merged, so a citation always
 * points at exactly one section.
 */
export function chunkSections(sections: Section[], maxTokens = MAX_CHUNK_TOKENS): Chunk[] {
  return sections.flatMap((section) => {
    const parts = splitText(section.text, maxTokens);
    return parts.map((text, i) =>
      toChunk(section, text, parts.length === 1 ? section.id : `${section.id}/${i + 1}`),
    );
  });
}

/** Rough token count: about 4 characters per token for English. Only used for sizing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitText(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const bySubheading = text.split(/\n(?=###\s)/);
  const pieces =
    bySubheading.length > 1 ? bySubheading : text.split(/\n\s*\n/).map((p) => p.trim());
  // A single piece that still doesn't fit is kept whole rather than cut mid-sentence.
  if (pieces.length === 1) return [text];

  return packPieces(pieces, maxTokens).flatMap((packed) =>
    packed === text ? [packed] : splitText(packed, maxTokens),
  );
}

/** Greedily joins consecutive pieces while they stay under the limit. */
function packPieces(pieces: string[], maxTokens: number): string[] {
  const packed: string[] = [];
  for (const piece of pieces.filter(Boolean)) {
    const last = packed.at(-1);
    if (last !== undefined && estimateTokens(`${last}\n\n${piece}`) <= maxTokens) {
      packed[packed.length - 1] = `${last}\n\n${piece}`;
    } else {
      packed.push(piece);
    }
  }
  return packed;
}

function toChunk(section: Section, text: string, id: string): Chunk {
  const header = [`${SITE_OWNER} › ${section.pageTitle} › ${section.heading}`, section.pageSummary]
    .filter(Boolean)
    .join("\n");
  const searchText = `${header}\n\n${text}`;
  const chunk = {
    id,
    sectionId: section.id,
    file: section.file,
    pageTitle: section.pageTitle,
    heading: section.heading,
    url: section.url,
    text,
    searchText,
  };
  return { ...chunk, hash: hashChunk(chunk) };
}

function hashChunk(chunk: Omit<Chunk, "hash">): string {
  return createHash("sha256")
    .update(JSON.stringify([EMBEDDING_MODEL, chunk]))
    .digest("hex");
}
