"use client";

import { useId, useState, type FormEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/config";
import { useChatContext } from "./chat-provider";
import { SuggestionChips } from "./suggestion-chips";

/** The home page's main element: ask the assistant directly. Answers open in the chat panel. */
export function AskHero() {
  const { ask, isBusy } = useChatContext();
  const [question, setQuestion] = useState("");
  const inputId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || isBusy) return;
    ask(question);
    setQuestion("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit}>
        <label htmlFor={inputId} className="block text-lg font-semibold">
          Ask about my experience, projects or availability
        </label>
        <p className="mt-1 text-ink-muted">An assistant answers from this site and links each answer to its source.</p>
        <div className="mt-4 flex rounded-xl border-2 border-ink bg-surface has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-mustard has-[input:focus-visible]:outline-solid">
          <input
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            placeholder="Has Alexander worked with Databricks?"
            autoComplete="off"
            enterKeyHint="send"
            className="min-h-14 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-lg placeholder:text-ink-muted/80 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="m-1.5 rounded-lg bg-spruce px-5 font-semibold text-paper hover:bg-spruce-strong disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
      <SuggestionChips label="Example questions" />
    </div>
  );
}
