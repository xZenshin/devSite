"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/config";
import { useShortcutLabel } from "../use-shortcut-label";
import { ChatMessage, messageText } from "./chat-message";
import { useChatContext } from "./chat-provider";
import { SuggestionChips } from "./suggestion-chips";

const MOBILE_QUERY = "(max-width: 639px)";

/** Floating assistant: a launcher button and a panel (full screen on phones). ⌘K / Ctrl K toggles it. */
export function ChatWidget() {
  const chat = useChatContext();
  const { isOpen, setOpen } = chat;
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  const shortcut = useShortcutLabel();

  // Return focus to the launcher when the panel closes.
  useEffect(() => {
    if (wasOpen.current && !isOpen) launcherRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={panelId}
          aria-keyshortcuts="Meta+K Control+K"
          className="group fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex min-h-12 items-center gap-3 border border-bone bg-bone pr-2 pl-4 font-mono text-[13px] text-black transition-colors duration-300 hover:bg-black hover:text-bone"
        >
          <span className="size-2 rounded-full bg-black transition-colors group-hover:bg-bone" aria-hidden="true" />
          ask alexander
          <kbd
            aria-hidden="true"
            className="hidden border border-black/25 px-1.5 py-0.5 font-mono text-[11px] transition-colors group-hover:border-bone/30 sm:inline"
          >
            {shortcut}
          </kbd>
        </button>
      )}
      {isOpen && <ChatPanel id={panelId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const chat = useChatContext();
  const { messages, status, error, isBusy } = chat;
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const titleId = useId();

  useEffect(() => inputRef.current?.focus(), []);

  // Follow the streaming answer unless the visitor has scrolled up to read.
  useEffect(() => {
    const log = logRef.current;
    if (log && stickToBottom.current) log.scrollTop = log.scrollHeight;
  }, [messages, status]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || isBusy) return;
    chat.ask(input);
    setInput("");
    stickToBottom.current = true;
  }

  /** On phones the panel covers the page, so close it to show the cited section. */
  function onNavigate() {
    if (window.matchMedia(MOBILE_QUERY).matches) onClose();
  }

  const last = messages.at(-1);
  // Screen readers get the finished answer once, not every streamed token.
  const announcement =
    status === "submitted"
      ? "Looking for an answer."
      : status === "ready" && last?.role === "assistant"
        ? messageText(last)
        : "";

  return (
    <section
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className="panel-in fixed inset-0 z-50 flex flex-col bg-panel text-bone sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(660px,calc(100dvh-2.5rem))] sm:w-[420px] sm:border sm:border-line sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
    >
      <header className="flex items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-bone" />
          <h2 id={titleId} className="font-mono text-[13px]">
            <span aria-hidden="true" className="text-ash">
              ~/
            </span>
            ask-alexander
          </h2>
        </div>
        <div className="flex items-center">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => chat.setMessages([])}
              disabled={isBusy}
              className="min-h-11 px-3 font-mono text-[12px] text-ash transition-colors hover:text-bone disabled:opacity-40"
            >
              clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex size-11 items-center justify-center text-ash transition-colors hover:text-bone"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div
        ref={logRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 overflow-y-auto px-5 py-6"
      >
        {messages.length === 0 ? (
          <div className="space-y-5">
            <p className="text-[1.65rem] leading-tight font-medium tracking-tight-2">
              Ask about Alexander&apos;s work, skills or availability.
            </p>
            <p className="text-sm leading-relaxed text-ash">
              Answers come only from this site, and every claim links to the section it&apos;s from.
            </p>
            <SuggestionChips label="Suggested questions" />
          </div>
        ) : (
          <ol aria-label="Conversation" className="space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onNavigate={onNavigate} />
            ))}
          </ol>
        )}
        {status === "submitted" && (
          <p className="mt-6 font-mono text-[12px] text-ash">
            searching the site <span aria-hidden="true" className="caret ml-1 h-[0.9em] w-[0.45em]" />
          </p>
        )}
        {error && (
          <div role="alert" className="mt-6 border border-line p-4 text-sm">
            <p>{errorText(error)}</p>
            <button
              type="button"
              onClick={() => {
                chat.clearError();
                void chat.regenerate();
              }}
              className="mt-3 font-mono text-[12px] underline decoration-dim underline-offset-4 hover:decoration-bone"
            >
              try again
            </button>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <form onSubmit={submit} className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 border border-line pl-3 has-[input:focus-visible]:border-bone">
          <span aria-hidden="true" className="font-mono text-ash">
            ›
          </span>
          <label htmlFor={`${id}-input`} className="sr-only">
            Your question
          </label>
          <input
            ref={inputRef}
            id={`${id}-input`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            placeholder="Ask a question"
            autoComplete="off"
            enterKeyHint="send"
            // 16px keeps iOS Safari from zooming in on focus.
            className="min-h-12 min-w-0 flex-1 bg-transparent text-base placeholder:text-ash focus-visible:outline-none"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => void chat.stop()}
              className="m-1 min-h-10 border border-line px-3 font-mono text-[12px] transition-colors hover:border-bone"
            >
              stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="m-1 min-h-10 bg-bone px-3 font-mono text-[12px] text-black transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              send ↵
            </button>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] text-ash">Answers are AI-generated from this site and can contain mistakes.</p>
      </form>
    </section>
  );
}

/** The API answers bad requests with JSON like {"error": "..."}; show just the message. */
function errorText(error: Error): string {
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Not JSON: already a readable message from the stream.
  }
  return error.message || "The assistant couldn't answer. Try again in a moment.";
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="square" />
    </svg>
  );
}
