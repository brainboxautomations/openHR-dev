"use client";

import { useEffect } from "react";

import { useNavigate } from "@/hooks/use-navigate";
import {
  candidateHref,
  type CandidateNavigationContext,
  type CandidateNeighbours,
} from "@/utilities/candidate-navigation";

export type QueueShortcutsSession = {
  neighbours: CandidateNeighbours;
  context: CandidateNavigationContext;
};

const NEXT_KEYS = new Set(["j", "J", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["k", "K", "ArrowLeft"]);

const TYPING_SELECTOR = [
  "input",
  "textarea",
  "select",
  "video",
  "audio",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="tablist"]',
  '[role="radiogroup"]',
].join(", ");

const OPEN_LAYER_SELECTOR = [
  "[data-floating-menu]",
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
  '[role="menu"]',
  '[role="listbox"]',
].join(", ");

function isTypingIn(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return element.closest(TYPING_SELECTOR) !== null;
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function shouldIgnore(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing || hasModifier(event)) {
    return true;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (isTypingIn(target) || isTypingIn(document.activeElement)) return true;
  return document.querySelector(OPEN_LAYER_SELECTOR) !== null;
}

export function useQueueShortcuts(session: QueueShortcutsSession | null): void {
  const { push } = useNavigate();
  const previousId = session?.neighbours.previousId ?? null;
  const nextId = session?.neighbours.nextId ?? null;
  const context = session?.context ?? null;

  useEffect(() => {
    if (!context) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const targetId = NEXT_KEYS.has(event.key)
        ? nextId
        : PREVIOUS_KEYS.has(event.key)
          ? previousId
          : undefined;
      if (!targetId || shouldIgnore(event)) return;

      event.preventDefault();
      push(candidateHref(targetId, context));
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [context, previousId, nextId, push]);
}
