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
            className="min-h-11 border border-line px-3.5 py-2 text-left text-sm text-ash transition-colors duration-200 hover:border-bone hover:bg-bone hover:text-black disabled:opacity-40"
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}
