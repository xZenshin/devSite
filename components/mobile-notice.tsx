"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMediaQuery } from "./use-media-query";

/** A phone: a touch screen that is narrow, or short (a phone on its side). Tablets and computers don't match. */
const PHONE = "(pointer: coarse) and (max-width: 47.99rem), (pointer: coarse) and (max-height: 30rem)";
/** Set once the notice has been waved away; kept for the visit (the tab), so it doesn't come back on every page. */
const SEEN = "mobile-notice-seen";

const subscribe = () => () => {};

/**
 * On a phone, the first page of a visit opens with a notice that the site is made
 * for a computer, and a button to carry on anyway. Escape does the same. It shows
 * nothing on the server or before the page has loaded, so computers never see it.
 */
export function MobileNotice() {
  const phone = useMediaQuery(PHONE);
  const seen = useSyncExternalStore(subscribe, () => sessionStorage.getItem(SEEN) === "1", () => true);
  const [dismissed, setDismissed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const open = phone && !seen && !dismissed;

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="mobile-notice-title"
      onClose={() => {
        sessionStorage.setItem(SEEN, "1");
        setDismissed(true);
      }}
      className="catch-in m-auto w-[min(22rem,calc(100vw-2.5rem))] border border-line bg-panel p-0 text-bone shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop:bg-black/80"
    >
      <p className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-ash">
        <span aria-hidden="true">{"// "}</span>heads up
      </p>
      <div className="p-4">
        <h2 id="mobile-notice-title" className="text-2xl leading-tight font-medium tracking-tight-2">
          This site isn&apos;t made for phones
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          It&apos;s built for a computer, with a mouse and a wide screen. You can still look around, but some things
          won&apos;t work as well as they should.
        </p>
        <form method="dialog" className="mt-5">
          {/* A form in a dialog closes it on submit, without script. Opening the dialog focuses this button. */}
          <button
            type="submit"
            className="min-h-11 bg-bone px-4 font-mono text-[13px] text-black transition-opacity hover:opacity-80"
          >
            proceed anyway →
          </button>
        </form>
      </div>
    </dialog>
  );
}
