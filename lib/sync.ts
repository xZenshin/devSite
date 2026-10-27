import type { Chunk } from "./chunking";

export interface SyncPlan {
  /** New or changed chunks: these get embedded and upserted. */
  upsert: Chunk[];
  unchanged: number;
  /** Rows in the database whose chunk no longer exists. */
  deleteIds: string[];
}

/**
 * Compares the chunks built from /content with what is stored, by content hash.
 * Running the ingest twice in a row therefore embeds nothing the second time.
 */
export function planSync(chunks: Chunk[], storedHashes: Map<string, string>): SyncPlan {
  const currentIds = new Set(chunks.map((chunk) => chunk.id));
  const upsert = chunks.filter((chunk) => storedHashes.get(chunk.id) !== chunk.hash);
  return {
    upsert,
    unchanged: chunks.length - upsert.length,
    deleteIds: [...storedHashes.keys()].filter((id) => !currentIds.has(id)),
  };
}
