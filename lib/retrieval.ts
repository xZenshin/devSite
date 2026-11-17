import { SEARCH_CANDIDATES, TOP_K } from "./config";
import type { Section } from "./content";

/** The two searches hybrid retrieval combines. Injected so retrieval is testable without a database. */
export interface SearchBackend {
  embedQuery(query: string): Promise<number[]>;
  vectorSearch(embedding: number[], limit: number): Promise<Section[]>;
  textSearch(query: string, limit: number): Promise<Section[]>;
}

/**
 * Hybrid retrieval. Vector search finds chunks that mean the same thing as the
 * question; full-text search finds exact terms like "PySpark" that embeddings
 * can blur. Both rankings are merged with reciprocal rank fusion.
 */
export async function retrieve(
  query: string,
  backend: SearchBackend,
  topK = TOP_K,
): Promise<Section[]> {
  const keywords = keywordQuery(query);
  // Full-text search doesn't need the embedding, so it runs while we embed.
  const [byVector, byText] = await Promise.all([
    backend.embedQuery(query).then((e) => backend.vectorSearch(e, SEARCH_CANDIDATES)),
    keywords ? backend.textSearch(keywords, SEARCH_CANDIDATES) : Promise.resolve([]),
  ]);

  const chunksById = new Map([...byText, ...byVector].map((chunk) => [chunk.id, chunk]));
  return fuseRankings([byVector.map((c) => c.id), byText.map((c) => c.id)])
    .slice(0, topK)
    .map((id) => chunksById.get(id)!);
}

/** Capitalised words that are questions or the site owner, not search terms. */
const NOT_KEYWORDS = new Set(
  ["what", "where", "when", "which", "who", "why", "how", "is", "are", "was", "were", "does", "do", "did",
    "has", "have", "can", "could", "would", "will", "tell", "i", "he", "his", "him", "alexander", "alexander's",
    "skou", "larsen", "skou-larsen"],
);

/**
 * The terms worth an exact-match search: names and technical terms such as
 * "PySpark", "CI/CD" or "C#". Common words are left to vector search: in
 * full-text search "based" matches "web-based", and the owner's name is in every
 * chunk, so they add noise rather than signal. Returns "" when nothing is left.
 */
export function keywordQuery(query: string): string {
  const tokens = query.match(/[\p{L}\p{N}][\p{L}\p{N}#+./'-]*/gu) ?? [];
  return tokens
    .map((token) => token.replace(/[.'-]+$/, ""))
    .filter((token) => /[\p{Lu}\p{N}#+]/u.test(token) && !NOT_KEYWORDS.has(token.toLowerCase()))
    .join(" ");
}

/**
 * Reciprocal rank fusion: each list adds 1 / (k + rank) for every id it
 * contains. Uses ranks rather than raw scores, because cosine similarity and
 * text rank aren't on comparable scales. k = 60 is the usual default; it stops
 * the top position of a single list from dominating.
 */
export function fuseRankings(rankings: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  // Map keeps insertion order, and sort is stable, so ties go to the vector ranking.
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
