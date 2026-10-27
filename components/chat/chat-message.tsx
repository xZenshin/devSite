"use client";

import Link from "next/link";
import type { ChatUIMessage } from "@/lib/answer";
import { splitCitations } from "@/lib/citations";

interface Source {
  url: string;
  title: string;
}

export function ChatMessage({
  message,
  onNavigate,
}: {
  message: ChatUIMessage;
  /** Called when a citation link is followed. */
  onNavigate: () => void;
}) {
  const text = messageText(message);

  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-spruce px-4 py-2.5 text-paper">
          <span className="sr-only">You: </span>
          {text}
        </p>
      </li>
    );
  }

  const sources = messageSources(message);
  return (
    <li>
      <p className="whitespace-pre-wrap leading-relaxed">
        <span className="sr-only">Assistant: </span>
        {splitCitations(text).map((segment, i) =>
          segment.type === "text" ? (
            segment.text
          ) : (
            <Citation key={i} numbers={segment.numbers} sources={sources} onNavigate={onNavigate} />
          ),
        )}
      </p>
      {sources.size > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-ink-muted">Sources</h3>
          <ol className="mt-1 space-y-1 text-sm">
            {[...sources].map(([n, source]) => (
              <li key={n} className="flex gap-2">
                <span className="w-4 shrink-0 text-ink-muted">{n}</span>
                <Link
                  href={source.url}
                  onClick={onNavigate}
                  className="text-spruce underline underline-offset-2 hover:text-spruce-strong"
                >
                  {source.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

/** One marker like [1, 3]: a link per number once its source has arrived. */
function Citation({
  numbers,
  sources,
  onNavigate,
}: {
  numbers: number[];
  sources: Map<number, Source>;
  onNavigate: () => void;
}) {
  return numbers.map((n) => {
    const source = sources.get(n);
    // Sources arrive after the text, so markers stay plain until then.
    if (!source) return <span key={n} className="text-ink-muted">[{n}]</span>;
    return (
      <Link
        key={n}
        href={source.url}
        onClick={onNavigate}
        aria-label={`Source ${n}: ${source.title}`}
        className="mx-0.5 inline-block rounded bg-mustard/20 px-1.5 align-baseline text-[0.8em] font-semibold text-ink hover:bg-mustard/40"
      >
        {n}
      </Link>
    );
  });
}

export function messageText(message: ChatUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function messageSources(message: ChatUIMessage): Map<number, Source> {
  const sources = new Map<number, Source>();
  for (const part of message.parts) {
    if (part.type === "source-url") {
      sources.set(Number(part.sourceId), { url: part.url, title: part.title ?? part.url });
    }
  }
  return sources;
}
