import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TOAST_AUTO_DISMISS_MS,
  ToastProvider,
  useToast,
  type ToastOptions,
} from "./toast-provider";

let showToast: (options: ToastOptions) => void = () => {};

function renderWithToasts() {
  const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
  showToast = (options) => result.current.show(options);
}

function show(options: ToastOptions) {
  act(() => showToast(options));
}

function advance(ms: number) {
  act(() => void vi.advanceTimersByTime(ms));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("shows the message in a polite live region", () => {
    renderWithToasts();

    show({ message: "Moved Jordan Lee to Shortlist" });

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Moved Jordan Lee to Shortlist");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("runs the action once and dismisses the toast", () => {
    const undo = vi.fn();
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: undo } });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("can be dismissed without running the action", () => {
    const undo = vi.fn();
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: undo } });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(undo).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("dismisses itself after a few seconds", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });

    advance(TOAST_AUTO_DISMISS_MS - 1);
    expect(screen.getByRole("status")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("replaces the current toast with a new one, which gets its own full time", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });
    advance(TOAST_AUTO_DISMISS_MS - 1000);

    show({ message: "Couldn’t move Sam Rivera", tone: "error" });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t move Sam Rivera");

    advance(1000);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t move Sam Rivera");

    advance(TOAST_AUTO_DISMISS_MS - 1000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits while the pointer is over it, then finishes the time that was left", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });
    advance(2000);

    fireEvent.mouseEnter(screen.getByRole("status"));
    advance(TOAST_AUTO_DISMISS_MS * 2);
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole("status"));
    advance(TOAST_AUTO_DISMISS_MS - 2001);
    expect(screen.getByRole("status")).toBeInTheDocument();

    advance(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits while keyboard focus is inside it", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: vi.fn() } });

    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    advance(TOAST_AUTO_DISMISS_MS * 2);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Undo" }).blur());
    advance(TOAST_AUTO_DISMISS_MS);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
