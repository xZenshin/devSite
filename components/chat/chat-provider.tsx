"use client";

import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ChatUIMessage } from "@/lib/answer";

type ChatContextValue = UseChatHelpers<ChatUIMessage> & {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  isBusy: boolean;
  /** Opens the widget and sends a question. */
  ask: (question: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Owns the conversation. Lives in the root layout, so the chat survives
 * navigation when a visitor follows a citation to another page.
 */
export function ChatProvider({ children, contactEmail }: { children: ReactNode; contactEmail?: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport<ChatUIMessage>({ fetch: withRateLimitMessage(contactEmail) }),
    [contactEmail],
  );
  // A fixed id: the default is random, which Cache Components rejects during prerendering.
  const chat = useChat<ChatUIMessage>({ id: "portfolio-assistant", transport });
  const [isOpen, setOpen] = useState(false);
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const { sendMessage } = chat;

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      setOpen(true);
      if (text && !isBusy) void sendMessage({ text });
    },
    [isBusy, sendMessage],
  );

  const value = useMemo(() => ({ ...chat, isOpen, setOpen, isBusy, ask }), [chat, isOpen, isBusy, ask]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used inside <ChatProvider>");
  return context;
}

/**
 * Rate limits answer 429 (one visitor, from the Vercel Firewall or the API) or
 * 503 (the daily limit for everyone), and the firewall's body isn't ours.
 * Replace both with a message the widget can show as is.
 */
function withRateLimitMessage(contactEmail?: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status !== 429 && response.status !== 503) return response;
    const reach = contactEmail ? `, or email Alexander at ${contactEmail}` : "";
    const error =
      response.status === 429
        ? `You've asked a lot of questions in a short time. Wait a few minutes and try again${reach}.`
        : `The assistant has answered all the questions it can for today. Try again tomorrow${reach}.`;
    return Response.json({ error }, { status: response.status });
  };
}
