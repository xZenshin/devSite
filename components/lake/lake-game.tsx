"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Catch, CatchKind } from "@/lib/catches";
import { pickHaul, type Haul, type Stock } from "@/lib/lake/game";
import { useChatContext } from "../chat/chat-provider";
import { useMediaQuery } from "../use-media-query";
import { Basket } from "./basket";
import { CatchCard } from "./catch-card";
import { LakeCanvas, type TouchMode } from "./lake-canvas";
import { addToBasket, getBasket, useBasket } from "./use-basket";

/**
 * The home page: a lake to fish projects and CV entries out of. The canvas
 * fills the screen; `children` (name, intro, the ask box) lie over its left
 * side and let clicks through to the water wherever they aren't interactive.
 */
export function LakeGame({ catches, children }: { catches: Catch[]; children: ReactNode }) {
  const caught = useBasket();
  const { isOpen: chatOpen } = useChatContext();
  const touch = useMediaQuery("(pointer: coarse)");
  const [touchMode, setTouchMode] = useState<TouchMode>("move");
  // `n` re-keys the card so each haul animates in, even the same junk twice.
  const [card, setCard] = useState<{ haul: Haul; n: number } | null>(null);
  // The last piece of junk, so the next is a different one, and how many hauls so far.
  const history = useRef<{ lastJunk: string | null; hauls: number }>({ lastJunk: null, hauls: 0 });

  // What is left to catch of each kind: that many fish swim in its shoal.
  const stock = useMemo(() => {
    const left: Stock = {};
    for (const item of catches) {
      if (!caught.includes(item.id)) left[item.kind] = (left[item.kind] ?? 0) + 1;
    }
    return left;
  }, [catches, caught]);

  const onHaul = useCallback((shoal: CatchKind | null) => {
    const haul = pickHaul(catches, new Set(getBasket()), shoal, Math.random, history.current.lastJunk);
    history.current = {
      lastJunk: haul.type === "junk" ? haul.item.id : history.current.lastJunk,
      hauls: history.current.hauls + 1,
    };
    if (haul.type === "catch") addToBasket(haul.item.id);
    setCard({ haul, n: history.current.hauls });
  }, [catches]);

  const dismiss = useCallback(() => setCard(null), []);

  useEffect(() => {
    if (!card || chatOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCard(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [card, chatOpen]);

  return (
    // Cancels main's bottom padding: the lake is exactly one screen, then the footer.
    <section aria-label="Introduction and fishing lake" className="relative -mb-32 flex min-h-[100svh] flex-col">
      <LakeCanvas onHaul={onHaul} onAction={dismiss} touchMode={touchMode} keysBlocked={chatOpen} stock={stock} />

      {/* A fade from the window's left edge, so the shore and wake drifting under the text don't
          tangle with it. Only where the text sits beside the boat; the boat never sails into it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-[5] hidden w-[40rem] bg-linear-to-r from-black via-black/80 via-60% to-transparent lg:-left-8 lg:block min-[72rem]:left-[calc((72rem-100vw)/2-2rem)]"
      />

      {/* On narrow screens the text sits above the boat, where the far shore is: the same fade, from the top. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[62svh] bg-linear-to-b from-black via-black/85 via-65% to-transparent lg:hidden"
      />

      {/* On screens wider than the page column, the text and the hints leave it and sit by the
          left edge of the window (72rem is main's max width), so the lake gets the room. */}
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col justify-start pt-36 pb-24 sm:justify-center sm:pt-24 min-[72rem]:ml-[calc((72rem-100vw)/2)]">
        {children}
      </div>

      <Basket catches={catches} caught={caught} onOpen={dismiss} />

      <div className="pointer-events-none absolute bottom-5 left-0 z-10 flex flex-col items-start gap-3 font-mono text-[12px] text-ash sm:flex-row sm:items-center sm:gap-6 min-[72rem]:left-[calc((72rem-100vw)/2)]">
        <Link
          href="/projects"
          className="pointer-events-auto flex min-h-11 items-center border border-line bg-panel px-3.5 text-[13px] text-bone transition-colors duration-200 hover:border-bone hover:bg-bone hover:text-black"
        >
          skip fishing →
        </Link>
        {touch ? (
          <div role="group" aria-label="What a tap on the water does" className="pointer-events-auto flex">
            {(["move", "cast"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={touchMode === mode}
                onClick={() => setTouchMode(mode)}
                className="min-h-11 border border-line bg-panel px-4 text-[13px] transition-colors not-first:border-l-0 aria-pressed:border-bone aria-pressed:bg-bone aria-pressed:text-black"
              >
                {mode}
              </button>
            ))}
          </div>
        ) : (
          <p>
            <Key>right-click</Key> sail <span aria-hidden="true">·</span> <Key>Q</Key> cast at the pointer
          </p>
        )}
      </div>

      {card && <CatchCard key={card.n} haul={card.haul} onDismiss={dismiss} />}

      <p className="sr-only" aria-live="polite">
        {card ? `Caught: ${card.haul.item.title}.` : ""}
      </p>
    </section>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px] text-bone">{children}</kbd>;
}
