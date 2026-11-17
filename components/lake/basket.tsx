"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Catch } from "@/lib/catches";
import { clearBasket } from "./use-basket";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * What has been caught so far: a counter that opens into a list. Caught things
 * link to their page; the rest only say what kind of thing is still out there.
 */
export function Basket({
  catches,
  caught,
  onOpen,
}: {
  catches: readonly Catch[];
  caught: readonly string[];
  /** The list is about to cover the middle of the lake. */
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const held = catches.filter((item) => caught.includes(item.id));

  return (
    <div
      className="pointer-events-auto absolute top-20 right-0 z-30 flex flex-col items-end font-mono text-[13px]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 items-center gap-3 border border-line bg-panel px-3.5 text-ash transition-colors duration-200 hover:border-bone hover:text-bone"
      >
        <span aria-hidden="true">\__/</span>
        <span>
          basket{" "}
          {/* Re-keyed on every catch so the count flashes as it changes. */}
          <span key={held.length} className={held.length > 0 ? "basket-count text-bone" : "text-bone"}>
            {pad(held.length)}
          </span>
          /{pad(catches.length)}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="catch-in mt-2 max-h-[calc(100svh-12rem)] w-[min(20rem,calc(100vw-2.5rem))] overflow-y-auto border border-line bg-panel p-4"
        >
          {held.length === 0 && <p className="mb-3 font-sans text-sm text-ash">Nothing yet. Cast a line and wait.</p>}
          <ol className="space-y-px">
            {catches.map((item, i) => {
              const isHeld = caught.includes(item.id);
              return (
                <li key={item.id} className="grid grid-cols-[1.75rem_1fr_auto] items-baseline gap-x-2">
                  <span aria-hidden="true" className="text-ash">
                    {pad(i + 1)}
                  </span>
                  {isHeld ? (
                    <Link
                      href={item.href}
                      className="truncate py-1 font-sans text-sm underline decoration-dim underline-offset-4 hover:decoration-bone"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="py-1 text-ash">
                      <span aria-hidden="true">???</span>
                      <span className="sr-only">Not caught yet</span>
                    </span>
                  )}
                  <span className="text-[11px] text-ash">{item.kind}</span>
                </li>
              );
            })}
          </ol>
          {held.length > 0 && (
            <button
              type="button"
              onClick={clearBasket}
              className="mt-3 min-h-9 text-[12px] text-ash underline decoration-dim underline-offset-4 transition-colors hover:text-bone hover:decoration-bone"
            >
              release all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
