import Anthropic from "@anthropic-ai/sdk";
import type { FinishReason, UIMessage, UIMessageStreamWriter } from "ai";
import { EFFORT, MAX_OUTPUT_TOKENS, MODEL } from "./config";
import type { Section } from "./content";
import { costUsd } from "./cost";
import { extractCitations, sourceTitle } from "./prompt";

/** Sent with the final stream chunk; the evals read it for latency and cost. */
export interface ChatMetadata {
  mode: "baseline";
  model: string;
  stopReason: string | null;
  latencyMs: number;
  timeToFirstTokenMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export type ChatUIMessage = UIMessage<ChatMetadata>;

const TEXT_ID = "answer";
const REFUSAL_TEXT = "Sorry, I can't help with that. I can answer questions about Alexander's background, skills and projects.";

let client: Anthropic | undefined;

/** Created lazily so a missing API key fails the request, not the build. */
function getClient(): Anthropic {
  return (client ??= new Anthropic());
}

/**
 * Streams Claude's answer to the widget as UI message chunks: the text token
 * by token, then the cited sources as links, then usage metadata.
 */
export async function streamAnswer({
  system,
  messages,
  sources,
  writer,
}: {
  system: string;
  messages: Anthropic.MessageParam[];
  sources: Section[];
  writer: UIMessageStreamWriter<ChatUIMessage>;
}): Promise<void> {
  const startedAt = performance.now();
  let firstTokenAt: number | null = null;
  let answer = "";

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: EFFORT },
    // The system prompt is identical for every question in baseline mode,
    // so after the first request it is read from cache at a tenth of the price.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  });

  writer.write({ type: "start" });
  writer.write({ type: "text-start", id: TEXT_ID });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      firstTokenAt ??= performance.now();
      answer += event.delta.text;
      writer.write({ type: "text-delta", id: TEXT_ID, delta: event.delta.text });
    }
  }
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal" && !answer.trim()) {
    writer.write({ type: "text-delta", id: TEXT_ID, delta: REFUSAL_TEXT });
  }
  writer.write({ type: "text-end", id: TEXT_ID });

  for (const n of extractCitations(answer, sources.length)) {
    const source = sources[n - 1];
    writer.write({
      type: "source-url",
      sourceId: String(n),
      url: source.url,
      title: sourceTitle(source),
    });
  }

  writer.write({
    type: "finish",
    finishReason: toFinishReason(message.stop_reason),
    messageMetadata: {
      mode: "baseline",
      model: message.model,
      stopReason: message.stop_reason,
      latencyMs: Math.round(performance.now() - startedAt),
      timeToFirstTokenMs: firstTokenAt === null ? null : Math.round(firstTokenAt - startedAt),
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      costUsd: costUsd(message.usage),
    },
  });
}

function toFinishReason(stopReason: Anthropic.StopReason | null): FinishReason {
  switch (stopReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content-filter";
    default:
      return "other";
  }
}
