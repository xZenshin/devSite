"use client";

import Link from "next/link";
import type { Haul } from "@/lib/lake/game";

/**
 * What just came up on the line, shown above the boat (its position matches
 * the boat's anchor in lake-canvas.tsx). A catch links to its page. Junk gets a
 * quip and a pointer to the fishing spots, or, once everything is caught, says so.
 */
export function CatchCard({ haul, onDismiss }: { haul: Haul; onDismiss: () => void }) {
  const isCatch = haul.type === "catch";
  const details = isCatch ? [haul.item.org, haul.item.period].filter(Boolean).join(" · ") : "";

  return (
    <aside
      aria-label="Your catch"
      className="pointer-events-auto fixed top-[70%] left-1/2 z-20 w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-[calc(100%+4.5rem)] lg:top-[56%] lg:left-[64%]"
    >
      <div className="catch-in border border-line bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-line py-1 pr-1 pl-4 font-mono text-[12px] text-ash">
          <p>
            <span aria-hidden="true">{"// "}</span>caught · {isCatch ? haul.item.kind : "junk"}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close and keep fishing"
            className="flex size-9 items-center justify-center transition-colors hover:text-bone"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="square" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-4 pb-4">
          <p className="text-2xl leading-tight font-medium tracking-tight-2">{haul.item.title}</p>
          {details && <p className="mt-1.5 font-mono text-[12px] text-ash">{details}</p>}
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ash">
            {isCatch ? haul.item.summary : haul.item.quip}
          </p>
          {!isCatch && (
            <p className="mt-3 text-sm leading-relaxed text-ash">
              {haul.fishedOut
                ? "That was the last of it. The lake is fished out."
                : "Try fishing near the fishing spots, marked by the buoys."}
            </p>
          )}

          <div className="mt-4 flex items-center gap-4 font-mono text-[13px]">
            {isCatch ? (
              <Link href={haul.item.href} className="bg-bone px-3.5 py-2 text-black transition-opacity hover:opacity-80">
                open →
              </Link>
            ) : (
              haul.fishedOut && (
                <Link href="/projects" className="bg-bone px-3.5 py-2 text-black transition-opacity hover:opacity-80">
                  see everything →
                </Link>
              )
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-9 text-ash underline decoration-dim underline-offset-4 transition-colors hover:text-bone hover:decoration-bone"
            >
              {isCatch ? "keep fishing" : "throw it back"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
