import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 128;
const TIMEOUT_MS = 15_000;

const responseSchema = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
});

/**
 * Voyage embeds questions and documents differently ("query" vs "document"),
 * which improves retrieval over embedding both the same way.
 */
type InputType = "query" | "document";

export async function embed(texts: string[], inputType: InputType): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    embeddings.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE), inputType)));
  }
  return embeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embed([query], "query");
  return embedding;
}

async function embedBatch(input: string[], inputType: InputType): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  const response = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      input,
      model: EMBEDDING_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings failed: HTTP ${response.status} ${await response.text()}`);
  }

  const { data } = responseSchema.parse(await response.json());
  return data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}
