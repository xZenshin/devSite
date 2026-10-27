"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/config";
import { ChatMessage, messageText } from "./chat-message";
import { useChatContext } from "./chat-provider";
import { SuggestionChips } from "./suggestion-chips";

const MOBILE_QUERY = "(max-width: 639px)";

/** Floating assistant: a launcher button and a panel (full screen on phones). */
export function ChatWidget() {
  const chat = useChatContext();
  const { isOpen, setOpen } = chat;
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();

  // Return focus to the launcher when the panel closes.
  useEffect(() => {
    if (wasOpen.current && !isOpen) launcherRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={panelId}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex min-h-12 items-center gap-2 rounded-full bg-spruce px-5 font-semibold text-paper shadow-lg shadow-ink/15 hover:bg-spruce-strong"
        >
          <ChatIcon />
          Ask about Alexander
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
      className="fixed inset-0 z-50 flex flex-col bg-surface text-ink motion-safe:animate-[panel-in_160ms_ease-out] sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-mist sm:shadow-2xl sm:shadow-ink/20"
    >
      <header className="flex items-start justify-between gap-4 border-b border-mist px-5 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Ask about Alexander
          </h2>
          <p className="text-sm text-ink-muted">Answers come from this site and link to their source.</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => chat.setMessages([])}
              disabled={isBusy}
              className="min-h-11 rounded-lg px-3 text-sm text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Start over
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-paper hover:text-ink"
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
        className="flex-1 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="leading-relaxed text-ink-muted">
              Ask about Alexander&apos;s experience, skills, projects or availability. Or start with one of these:
            </p>
            <SuggestionChips label="Suggested questions" />
          </div>
        ) : (
          <ol aria-label="Conversation" className="space-y-5">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onNavigate={onNavigate} />
            ))}
          </ol>
        )}
        {status === "submitted" && <p className="mt-5 text-sm text-ink-muted">Looking through Alexander&apos;s site…</p>}
        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-mist bg-paper p-3 text-sm">
            <p>{errorText(error)}</p>
            <button
              type="button"
              onClick={() => {
                chat.clearError();
                void chat.regenerate();
              }}
              className="mt-2 font-semibold text-spruce underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <form onSubmit={submit} className="border-t border-mist px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
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
            className="min-h-11 flex-1 rounded-lg border border-mist bg-paper px-3 text-base placeholder:text-ink-muted focus-visible:border-spruce"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => void chat.stop()}
              className="min-h-11 rounded-lg border border-mist px-4 font-semibold hover:border-ink"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="min-h-11 rounded-lg bg-spruce px-4 font-semibold text-paper hover:bg-spruce-strong disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">Answers are AI-generated from this site and can contain mistakes.</p>
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

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
