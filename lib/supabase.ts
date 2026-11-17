import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Section } from "./content";
import { embedQuery } from "./embeddings";
import type { SearchBackend } from "./retrieval";

const searchRowSchema = z.object({
  id: z.string(),
  file: z.string(),
  page_title: z.string(),
  heading: z.string(),
  url: z.string(),
  content: z.string(),
});

let client: SupabaseClient | undefined;

/**
 * Server-only client using the secret key, which bypasses row level security.
 * The chunks table has RLS on with no policies, so the public keys can't read it.
 */
export function getDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  if (new URL(url).pathname !== "/") {
    throw new Error(
      "SUPABASE_URL must be the bare project URL (https://<ref>.supabase.co), without a path such as /rest/v1/",
    );
  }
  return (client ??= createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

/** Hybrid search backed by the SQL functions in supabase/migrations. */
export const supabaseSearch: SearchBackend = {
  embedQuery,
  vectorSearch: (embedding, limit) =>
    callSearch("match_chunks_vector", { query_embedding: embedding, match_count: limit }),
  textSearch: (query, limit) =>
    callSearch("match_chunks_text", { query_text: query, match_count: limit }),
};

async function callSearch(fn: string, args: Record<string, unknown>): Promise<Section[]> {
  const { data, error } = await getDb().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return z
    .array(searchRowSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      file: row.file,
      pageTitle: row.page_title,
      heading: row.heading,
      url: row.url,
      text: row.content,
    }));
}
