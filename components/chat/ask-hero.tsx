"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/config";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestions";
import { usePrefersReducedMotion } from "../use-media-query";
import { useShortcutLabel } from "../use-shortcut-label";
import { useChatContext } from "./chat-provider";
import { SuggestionChips } from "./suggestion-chips";

const TYPED_EXAMPLES = ["Has Alexander worked with Databricks?", ...SUGGESTED_QUESTIONS];

/** The home page's main element: a prompt that asks the assistant directly. */
export function AskHero() {
  const { ask, isBusy } = useChatContext();
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const placeholder = useTypedPlaceholder(TYPED_EXAMPLES, !focused && !question && !reducedMotion);
  const inputId = useId();
  const shortcut = useShortcutLabel();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || isBusy) return;
    ask(question);
    setQuestion("");
  }

  return (
    <div className="max-w-3xl space-y-5">
      <form onSubmit={submit} className="border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[12px] text-ash">
          <label htmlFor={inputId}>
            <span aria-hidden="true">~/</span>ask-alexander
          </label>
          {/* Phones have no keyboard shortcut to advertise. */}
          <span aria-hidden="true" className="hidden sm:inline">
            <kbd className="font-mono">{shortcut}</kbd> anywhere
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-[-2px] has-[input:focus-visible]:outline-bone has-[input:focus-visible]:outline-solid">
          <span aria-hidden="true" className="font-mono text-ash">
            ›
          </span>
          <div className="relative min-w-0 flex-1">
            <input
              id={inputId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={MAX_QUESTION_CHARS}
              placeholder={focused ? TYPED_EXAMPLES[0] : ""}
              autoComplete="off"
              enterKeyHint="send"
              className="min-h-16 w-full bg-transparent font-mono text-base placeholder:text-ash focus-visible:outline-none sm:text-lg"
            />
            {/* The typing demo, drawn over the empty input with a block caret. */}
            {!question && !focused && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden font-mono text-base whitespace-nowrap text-ash sm:text-lg"
              >
                {placeholder}
                <span className="caret ml-0.5 shrink-0" />
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="shrink-0 bg-bone px-4 py-2 font-mono text-[13px] text-black transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            ask ↵
          </button>
        </div>
      </form>
      <SuggestionChips label="Example questions" />
    </div>
  );
}

/** Types each example out, pauses, deletes it and moves on, like a terminal demo. */
function useTypedPlaceholder(examples: string[], running: boolean): string {
  const [text, setText] = useState(examples[0]);

  useEffect(() => {
    if (!running) return;
    let example = 0;
    let length = examples[0].length;
    let deleting = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = examples[example];
      length += deleting ? -1 : 1;
      setText(current.slice(0, length));
      let delay = deleting ? 22 : 48;
      if (!deleting && length === current.length) {
        deleting = true;
        delay = 2200;
      } else if (deleting && length === 0) {
        deleting = false;
        example = (example + 1) % examples.length;
        delay = 350;
      }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 2600);
    return () => clearTimeout(timer);
  }, [examples, running]);

  return running ? text : examples[0];
}
