"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

/**
 * A link that can point at a section, like "/#projects". Next skips navigation
 * when the URL wouldn't change, so clicking it again after scrolling away did
 * nothing. On the same page this scrolls to the section itself; anywhere else
 * it is a normal Link.
 */
export function SectionLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const [path, hash] = href.split("#");
    const isPlainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const target = hash ? document.getElementById(hash) : null;
    if (event.defaultPrevented || !isPlainClick || !target || (path || "/") !== pathname) return;

    event.preventDefault();
    // Uses the CSS scroll-behavior (smooth unless reduced motion) and the section's scroll margin.
    target.scrollIntoView();
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, "", `#${hash}`);
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
