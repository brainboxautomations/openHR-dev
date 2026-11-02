"use client";

import { useCallback, useSyncExternalStore } from "react";

const COLLAPSED = "true";

const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

function readStoredCollapsed(key: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? null : stored === COLLAPSED;
  } catch {
    return null;
  }
}

function readCollapsed(key: string): boolean {
  return readStoredCollapsed(key) ?? memory.get(key) ?? false;
}

function writeStoredCollapsed(key: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(key, COLLAPSED);
    else window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const serverSnapshot = () => false;

export function forgetCollapsedPreferencesInMemory(): void {
  memory.clear();
}

export function useCollapsedPreference(key: string): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, () => readCollapsed(key), serverSnapshot);

  const setCollapsed = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      writeStoredCollapsed(key, next);
      notify();
    },
    [key],
  );

  return [collapsed, setCollapsed];
}
