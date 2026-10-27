"use client";

import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";
import { useChatContext } from "./chat-provider";

export function SuggestionChips({ label }: { label: string }) {
  const { ask, isBusy } = useChatContext();
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {SUGGESTED_QUESTIONS.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => ask(question)}
            disabled={isBusy}
            className="min-h-11 rounded-full border border-mist bg-surface px-4 py-2 text-left text-sm text-ink transition-colors hover:border-spruce hover:text-spruce disabled:opacity-50"
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}
