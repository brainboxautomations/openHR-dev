"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Avatar } from "@/components/atoms/avatar";
import { ChevronsLeftIcon, ChevronsRightIcon, CloseIcon, StarIcon } from "@/components/atoms/icons";
import { useCollapsedPreference } from "@/hooks/use-collapsed-preference";
import { cn } from "@/utilities/cn";
import { candidateHref, type CandidateNavigationContext } from "@/utilities/candidate-navigation";
import type { ScreeningQueueRow } from "@/utilities/screening-queue";

export const SCREENING_PANEL_COLLAPSED_KEY = "openhr:screening-panel-collapsed";

export type ScreeningQueuePanelProps = {
  stageName: string;
  rows: ScreeningQueueRow[];
  left: number;
  context: CandidateNavigationContext;
};

const iconButtonClass =
  "h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600";

function handledLabel(row: ScreeningQueueRow): string {
  if (row.archived) return "→ Archived";
  return `→ ${row.stageName ?? "No stage"}`;
}

function QueueRow({
  row,
  context,
  onOpen,
}: {
  row: ScreeningQueueRow;
  context: CandidateNavigationContext;
  onOpen: () => void;
}) {
  const handled = !row.pending;

  return (
    <li>
      <Link
        href={candidateHref(row.id, context)}
        aria-current={row.current ? "page" : undefined}
        onClick={onOpen}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5",
          row.current ? "bg-accent-3" : "hover:bg-slate-50",
        )}
      >
        <Avatar name={row.name} size={24} className={cn(handled && "opacity-50")} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[13px]",
              row.current ? "font-semibold text-accent-12" : "text-slate-700",
              handled && !row.current && "text-slate-400",
            )}
          >
            {row.name}
          </span>
          {handled && (
            <span className="block truncate font-mono text-[10px] text-slate-400">
              {handledLabel(row)}
            </span>
          )}
        </span>
        {row.starred && (
          <>
            <StarIcon size={12} filled className="shrink-0 text-amber-600" />
            <span className="sr-only">Starred</span>
          </>
        )}
      </Link>
    </li>
  );
}

export function ScreeningQueuePanel({ stageName, rows, left, context }: ScreeningQueuePanelProps) {
  const [collapsed, setCollapsed] = useCollapsedPreference(SCREENING_PANEL_COLLAPSED_KEY);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const listShown = !collapsed || overlayOpen;
  const currentId = rows.find((row) => row.current)?.id ?? null;

  useEffect(() => {
    if (!listShown || !currentId) return;
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && typeof current.scrollIntoView === "function") {
      current.scrollIntoView({ block: "nearest" });
    }
  }, [listShown, currentId]);

  useEffect(() => {
    if (!overlayOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlayOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOverlayOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [overlayOpen]);

  const collapse = () => {
    setOverlayOpen(false);
    setCollapsed(true);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Screening list"
      className="relative hidden h-full min-h-0 shrink-0 md:flex"
    >
      <div
        className={cn(
          "flex w-10 flex-col items-center gap-2 border-r border-slate-200 bg-white pt-2.5",
          !collapsed && "lg:hidden",
        )}
      >
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          aria-label="Show screening list"
          aria-expanded={overlayOpen}
          title="Show screening list"
          className={cn(iconButtonClass, "flex lg:hidden")}
        >
          <ChevronsRightIcon size={14} />
        </button>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand screening list"
            title="Expand screening list"
            className={cn(iconButtonClass, "hidden lg:flex")}
          >
            <ChevronsRightIcon size={14} />
          </button>
        )}
        <span className="font-mono text-[10px] text-slate-400" title={`${left} left`}>
          {left}
        </span>
      </div>

      {listShown && (
        <div
          className={cn(
            "flex w-64 min-h-0 flex-col border-r border-slate-200 bg-white",
            overlayOpen
              ? "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:shadow-modal"
              : "max-lg:hidden",
            collapsed && "lg:hidden",
          )}
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-100 pl-4 pr-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">
              {stageName}
            </span>
            <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-slate-400">
              {left} left
            </span>
            <button
              type="button"
              onClick={collapse}
              aria-label="Collapse screening list"
              title="Collapse screening list"
              className={cn(iconButtonClass, "hidden lg:flex")}
            >
              <ChevronsLeftIcon size={14} />
            </button>
            {overlayOpen && (
              <button
                type="button"
                onClick={() => setOverlayOpen(false)}
                aria-label="Close screening list"
                className={cn(iconButtonClass, "flex lg:hidden")}
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
          <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto p-1.5">
            {rows.map((row) => (
              <QueueRow
                key={row.id}
                row={row}
                context={context}
                onOpen={() => setOverlayOpen(false)}
              />
            ))}
          </ol>
        </div>
      )}
    </nav>
  );
}
