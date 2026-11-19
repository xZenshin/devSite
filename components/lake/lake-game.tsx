"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Catch } from "@/lib/catches";
import { pickHaul, shareOut, type Haul, type Stock } from "@/lib/lake/game";
import { GROUNDS } from "@/lib/lake/lake";
import { useChatContext } from "../chat/chat-provider";
import { useMediaQuery } from "../use-media-query";
import { Basket } from "./basket";
import { CatchCard } from "./catch-card";
import { LakeCanvas, type Control, type TouchMode } from "./lake-canvas";
import { addToBasket, getBasket, useBasket } from "./use-basket";

/**
 * Which mouse controls the visitor has used. Each hint goes away once its button
 * is first pressed, and stays away while the visitor reads the site's other pages;
 * like the lake itself, it lives as long as the page does.
 */
const used: Record<Control, boolean> = { sail: false, cast: false };

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

  // Everything to catch, shared out evenly between the fishing grounds; and what is left at each:
  // that many fish swim in its shoal.
  const pools = useMemo(() => shareOut(catches, GROUNDS), [catches]);
  const stock = useMemo<Stock>(
    () => pools.map((pool) => pool.filter((item) => !caught.includes(item.id)).length),
    [pools, caught],
  );

  const onHaul = useCallback((shoal: number | null) => {
    const pool = shoal === null ? null : (pools[shoal] ?? null);
    const haul = pickHaul(catches, new Set(getBasket()), pool, Math.random, history.current.lastJunk);
    history.current = {
      lastJunk: haul.type === "junk" ? haul.item.id : history.current.lastJunk,
      hauls: history.current.hauls + 1,
    };
    if (haul.type === "catch") addToBasket(haul.item.id);
    setCard({ haul, n: history.current.hauls });
  }, [catches, pools]);

  const dismiss = useCallback(() => setCard(null), []);

  // A hint is pressed the first time its button is, then fades; once faded it is gone.
  const [pressed, setPressed] = useState<Record<Control, boolean>>(() => ({ ...used }));
  const [faded, setFaded] = useState<Record<Control, boolean>>(() => ({ ...used }));
  const onControl = useCallback((control: Control) => {
    if (used[control]) return;
    used[control] = true;
    setPressed((p) => ({ ...p, [control]: true }));
  }, []);
  const onFaded = useCallback((control: Control) => setFaded((f) => ({ ...f, [control]: true })), []);

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
      <LakeCanvas onHaul={onHaul} onAction={dismiss} onControl={onControl} touchMode={touchMode} stock={stock} />

      {/* A fade from the window's left edge, so the shore and wake drifting under the text don't
          tangle with it. Only where the text sits beside the boat; the boat never sails into it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-[5] hidden w-[42.5rem] min-[72rem]:w-[47.5rem] bg-linear-to-r from-black via-black/80 via-60% to-transparent lg:-left-8 lg:block min-[72rem]:left-[calc((72rem-100vw)/2-2rem)]"
      />

      {/* On narrow screens the text sits above the boat, where the far shore is: the same fade, from the top. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[62svh] bg-linear-to-b from-black via-black/85 via-65% to-transparent lg:hidden"
      />

      {/* On screens wider than the page column, the text and the hints leave it and sit near the
          left edge of the window (72rem is main's max width), so the lake gets the room. Beside the
          lake they keep a little way in from the edge, further once there is room (the pl-, and the same in the hints below).
          In a narrow window with a mouse the text starts lower, below the control hints. */}
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col justify-start pt-36 pb-24 max-sm:pointer-fine:pt-44 sm:justify-center sm:pt-24 lg:pl-10 min-[72rem]:pl-30 min-[72rem]:ml-[calc((72rem-100vw)/2)]">
        {children}
      </div>

      <Basket catches={catches} caught={caught} onOpen={dismiss} />

      {!touch && !(faded.sail && faded.cast) && <ControlHints pressed={pressed} faded={faded} onFaded={onFaded} />}

      {/* With a mouse, "skip fishing" and the settled hints sit side by side at every width, and the
          button stretches to the hints' height. With touch, it and the move/cast toggle stack on phones. */}
      <div className="pointer-events-none absolute bottom-5 left-0 z-10 flex flex-col items-start gap-3 font-mono text-[12px] text-ash sm:flex-row sm:gap-6 pointer-fine:flex-row pointer-fine:items-stretch pointer-fine:gap-2 lg:left-10 min-[72rem]:left-[calc((72rem-100vw)/2+7.5rem)]">
        <Link
          href="/projects"
          className="pointer-events-auto flex min-h-11 items-center border border-line bg-panel px-3.5 text-[13px] text-bone transition-colors duration-200 hover:border-bone hover:bg-bone hover:text-black"
        >
          skip fishing →
        </Link>
        {!touch && <SettledHints faded={faded} />}
        {touch && (
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
        )}
      </div>

      {card && <CatchCard key={card.n} haul={card.haul} onDismiss={dismiss} />}

      <p className="sr-only" aria-live="polite">
        {card ? `Caught: ${card.haul.item.title}.` : ""}
      </p>
    </section>
  );
}

const HINTS: { control: Control; key: string; label: string }[] = [
  { control: "sail", key: "left-click", label: "sail" },
  { control: "cast", key: "right-click", label: "cast" },
];

/** A key and what it does. Every key is as wide as the longest, "right-click": 11 characters, its padding and border. */
function Hint({ keyName, label }: { keyName: string; label: string }) {
  return (
    <>
      <kbd className="min-w-[calc(11ch+14px)] border border-line bg-panel px-1.5 py-0.5 text-center font-mono text-[11px] text-bone shadow-[0_2px_0_var(--dim)]">
        {keyName}
      </kbd>
      {label}
    </>
  );
}

/**
 * The mouse controls, across the top of the lake, just below the basket. Each key
 * stands raised until its button is first pressed on the water, then goes down and
 * the hint fades out (to reappear by "skip fishing"; see SettledHints). A faded hint
 * keeps its place, so the other doesn't jump. Until then a gleam runs over the keys
 * a few times as the page comes in, to catch the eye.
 */
function ControlHints({
  pressed,
  faded,
  onFaded,
}: {
  pressed: Record<Control, boolean>;
  faded: Record<Control, boolean>;
  onFaded: (control: Control) => void;
}) {
  return (
    <ul
      aria-label="Controls"
      className="pointer-events-none absolute top-[130px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-6 font-mono text-[12px] whitespace-nowrap text-ash"
    >
      {HINTS.map(({ control, key, label }) => (
        <li
          key={control}
          className={`flex items-center gap-2 ${faded[control] ? "invisible" : pressed[control] ? "hint-used" : "hint-gleam"}`}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) onFaded(control);
          }}
        >
          <Hint keyName={key} label={label} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The mouse controls again, once they have faded from the top: one above the
 * other by "skip fishing", where they stay as a quiet reminder. Each comes in as
 * its hint at the top goes. Both always keep their places, even before either has
 * come, so "skip fishing" is the same height throughout and nothing jumps. The
 * gap is the suggested questions' gap; the bottom padding takes in the keys' shadow.
 */
function SettledHints({ faded }: { faded: Record<Control, boolean> }) {
  const none = !faded.sail && !faded.cast;
  return (
    <ul aria-label="Controls" aria-hidden={none || undefined} className="flex flex-col items-start gap-2 pb-0.5">
      {HINTS.map(({ control, key, label }) => (
        <li key={control} className={`flex items-center gap-2 ${faded[control] ? "hint-back" : "invisible"}`}>
          <Hint keyName={key} label={label} />
        </li>
      ))}
    </ul>
  );
}
