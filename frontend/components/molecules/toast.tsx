"use client";

import type { FocusEvent } from "react";

import { AlertCircleIcon, CloseIcon } from "@/components/atoms/icons";
import { cn } from "@/utilities/cn";

export type ToastTone = "neutral" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastProps = {
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  onAction: () => void;
  onDismiss: () => void;
  onHoverChange: (hovered: boolean) => void;
  onFocusChange: (focused: boolean) => void;
};

const toneClasses: Record<ToastTone, { surface: string; action: string; dismiss: string }> = {
  neutral: {
    surface: "bg-slate-900 text-white shadow-bulk",
    action: "text-accent-6 hover:bg-white/10",
    dismiss: "text-slate-400 hover:bg-white/10 hover:text-white",
  },
  error: {
    surface: "border border-red-200 bg-red-50 text-red-800 shadow-popover",
    action: "text-red-700 hover:bg-red-100",
    dismiss: "text-red-400 hover:bg-red-100 hover:text-red-700",
  },
};

export function Toast({
  message,
  tone,
  action,
  onAction,
  onDismiss,
  onHoverChange,
  onFocusChange,
}: ToastProps) {
  const classes = toneClasses[tone];

  const leaveFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    onFocusChange(false);
  };

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onFocusChange(true)}
      onBlur={leaveFocus}
      className={cn(
        "pointer-events-auto flex min-h-11 w-max max-w-full items-center gap-1 rounded-xl py-1.5 pl-3.75 pr-1.5",
        classes.surface,
      )}
    >
      {tone === "error" && <AlertCircleIcon size={15} className="mr-1 shrink-0 text-red-600" />}
      <span className="mr-1.5 min-w-0 text-[13px] leading-snug">{message}</span>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-9/40",
            classes.action,
          )}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-9/40",
          classes.dismiss,
        )}
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
