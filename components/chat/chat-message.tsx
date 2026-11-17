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
        <p className="max-w-[85%] whitespace-pre-wrap bg-bone px-4 py-2.5 text-black">
          <span className="sr-only">You: </span>
          {text}
        </p>
      </li>
    );
  }

  const sources = messageSources(message);
  return (
    <li>
      <p className="whitespace-pre-wrap leading-relaxed text-bone/90">
        <span className="sr-only">Assistant: </span>
        {splitCitations(text).map((segment, i) =>
          segment.type === "text" ? (
            segment.text
          ) : (
            <Citation key={i} numbers={segment.numbers} sources={sources} onNavigate={onNavigate} />
          ),
        )}
      </p>
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
    if (!source) return <span key={n} className="text-ash">[{n}]</span>;
    return (
      <Link
        key={n}
        href={source.url}
        onClick={onNavigate}
        aria-label={`Source ${n}: ${source.title}`}
        // With no list of sources below the answer, hovering a marker says where it leads.
        title={source.title}
        className="mx-0.5 inline-block border border-bone/40 px-1 align-baseline font-mono text-[0.75em] leading-snug text-bone transition-colors hover:border-bone hover:bg-bone hover:text-black"
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
