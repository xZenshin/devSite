"use client";

import { useSyncExternalStore } from "react";

const KEY = "lake-basket";
const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();

/** Loaded from storage on first use; kept in memory so it still works where storage is blocked. */
let ids: readonly string[] | undefined;

function load(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // Unreadable or blocked storage: start with an empty basket.
  }
  return EMPTY;
}

function save(next: readonly string[]): void {
  ids = next;
  try {
    if (next.length > 0) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage is full or blocked: the basket lasts until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

/** The ids of everything caught so far, oldest first. */
export function getBasket(): readonly string[] {
  return (ids ??= load());
}

export function addToBasket(id: string): void {
  const current = getBasket();
  if (!current.includes(id)) save([...current, id]);
}

export function clearBasket(): void {
  save(EMPTY);
}

function subscribe(onChange: () => void): () => void {
  // Another tab changed the basket.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    ids = load();
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The basket's contents. Empty on the server and until the browser has read its storage. */
export function useBasket(): readonly string[] {
  return useSyncExternalStore(subscribe, getBasket, () => EMPTY);
}
