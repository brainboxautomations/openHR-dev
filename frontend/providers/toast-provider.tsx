"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Toast, type ToastAction, type ToastTone } from "@/components/molecules/toast";

export const TOAST_AUTO_DISMISS_MS = 6000;

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
};

type ShownToast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ShownToast | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const nextId = useRef(1);
  const countdown = useRef({ id: 0, remainingMs: TOAST_AUTO_DISMISS_MS });

  const show = useCallback(({ message, tone = "neutral", action }: ToastOptions) => {
    const id = nextId.current++;
    countdown.current = { id, remainingMs: TOAST_AUTO_DISMISS_MS };
    setHovered(false);
    setFocused(false);
    setToast({ id, message, tone, action });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  const paused = hovered || focused;

  useEffect(() => {
    if (!toast || paused) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, countdown.current.remainingMs);

    return () => {
      clearTimeout(timer);
      if (countdown.current.id !== toast.id) return;
      countdown.current = {
        id: toast.id,
        remainingMs: Math.max(0, countdown.current.remainingMs - (Date.now() - startedAt)),
      };
    };
  }, [toast, paused]);

  const runAction = () => {
    const action = toast?.action;
    setToast(null);
    action?.onClick();
  };

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center"
      >
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            tone={toast.tone}
            action={toast.action}
            onAction={runAction}
            onDismiss={dismiss}
            onHoverChange={setHovered}
            onFocusChange={setFocused}
          />
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
