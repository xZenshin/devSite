"use client";

import { useEffect, useRef } from "react";
import { useMediaQuery, usePrefersReducedMotion } from "./use-media-query";

const INTERACTIVE = "a, button, input, [role='button']";

/**
 * A dot that trails the pointer and inverts what's under it. It grows over
 * links and buttons. The system cursor stays visible; this only decorates it.
 * Mouse and trackpad only, and off when reduced motion is requested.
 */
export function Cursor() {
  const finePointer = useMediaQuery("(pointer: fine)");
  const reducedMotion = usePrefersReducedMotion();
  const enabled = finePointer && !reducedMotion;
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!enabled || !dot) return;

    const target = { x: -100, y: -100 };
    const position = { ...target };
    let scale = 1;
    let targetScale = 1;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      targetScale = (event.target as Element | null)?.closest(INTERACTIVE) ? 3.2 : 1;
      dot.style.opacity = "1";
    };
    const onLeave = () => {
      dot.style.opacity = "0";
    };
    const tick = () => {
      // Ease towards the pointer for a slight trailing feel.
      position.x += (target.x - position.x) * 0.22;
      position.y += (target.y - position.y) * 0.22;
      scale += (targetScale - scale) * 0.18;
      dot.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[80] size-3 rounded-full bg-white opacity-0 mix-blend-difference transition-opacity duration-300"
    />
  );
}
