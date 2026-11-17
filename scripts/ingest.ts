/**
 * Chunks /content, embeds new or changed chunks and syncs them to Supabase.
 * Idempotent: unchanged chunks are skipped and deleted sections are removed.
 *
 *   npm run ingest                 skip unfinished (TODO) content with a warning
 *   npm run ingest -- --strict     fail if any unfinished content is left
 *   npm run ingest -- --dry-run    show the plan without embedding or writing
 */
import { existsSync } from "node:fs";
import { chunkSections } from "../lib/chunking";
import { loadContent } from "../lib/content";
import { embed } from "../lib/embeddings";
import { getDb } from "../lib/supabase";
import { planSync } from "../lib/sync";

const strict = process.argv.includes("--strict");
const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const { sections, warnings } = await loadContent();
  for (const warning of warnings) warn(warning);
  if (strict && warnings.length > 0) {
    throw new Error(`${warnings.length} unfinished block(s) left; remove the TODOs or drop --strict`);
  }

  const chunks = chunkSections(sections);
  // Guard against wiping the database because of a broken content folder.
  if (chunks.length === 0) throw new Error("No chunks were produced from /content");

  const db = getDb();
  const plan = planSync(chunks, await fetchStoredHashes());
  console.log(
    `${chunks.length} chunks: ${plan.upsert.length} to embed, ${plan.unchanged} unchanged, ${plan.deleteIds.length} to delete`,
  );
  if (dryRun) return;

  if (plan.upsert.length > 0) {
    const embeddings = await embed(
      plan.upsert.map((chunk) => chunk.searchText),
      "document",
    );
    const { error } = await db.from("chunks").upsert(
      plan.upsert.map((chunk, i) => ({
        id: chunk.id,
        section_id: chunk.sectionId,
        file: chunk.file,
        page_title: chunk.pageTitle,
        heading: chunk.heading,
        url: chunk.url,
        content: chunk.text,
        search_text: chunk.searchText,
        content_hash: chunk.hash,
        embedding: embeddings[i],
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }

  if (plan.deleteIds.length > 0) {
    const { error } = await db.from("chunks").delete().in("id", plan.deleteIds);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }
  console.log("Ingest complete.");
}

async function fetchStoredHashes(): Promise<Map<string, string>> {
  const { data, error } = await getDb().from("chunks").select("id, content_hash");
  if (error) throw new Error(`Could not read stored chunks: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.id as string, row.content_hash as string]));
}

/** Shows up as an annotation in GitHub Actions, and as a plain line locally. */
function warn(message: string): void {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `warning: ${message}`);
}

// exitCode rather than process.exit(): exiting while network handles are still
// closing crashes Node on Windows (libuv assertion in async.c).
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
