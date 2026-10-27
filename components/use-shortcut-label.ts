"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. Both keys work everywhere. */
export function useShortcutLabel(): string {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}
