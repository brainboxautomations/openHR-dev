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

function liveRegion() {
  return screen.getByRole("status");
}

function shownToast() {
  const toast = liveRegion().firstElementChild;
  expect(toast).not.toBeNull();
  return toast as HTMLElement;
}

function expectNoToast() {
  expect(liveRegion()).toBeEmptyDOMElement();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("keeps an empty polite live region on the page before any toast is shown", () => {
    renderWithToasts();

    const region = liveRegion();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows the message inside that same live region, so it is announced", () => {
    renderWithToasts();
    const region = liveRegion();

    show({ message: "Moved Jordan Lee to Shortlist" });

    expect(liveRegion()).toBe(region);
    expect(region).toHaveTextContent("Moved Jordan Lee to Shortlist");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(region.querySelector("[aria-live]")).toBeNull();
  });

  it("runs the action once and dismisses the toast", () => {
    const undo = vi.fn();
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: undo } });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledTimes(1);
    expectNoToast();
  });

  it("can be dismissed without running the action", () => {
    const undo = vi.fn();
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: undo } });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(undo).not.toHaveBeenCalled();
    expectNoToast();
  });

  it("dismisses itself after a few seconds", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });

    advance(TOAST_AUTO_DISMISS_MS - 1);
    expect(liveRegion()).toHaveTextContent("Moved Jordan Lee to Shortlist");

    advance(1);
    expectNoToast();
  });

  it("replaces the current toast with a new one, which gets its own full time", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });
    advance(TOAST_AUTO_DISMISS_MS - 1000);

    show({ message: "Couldn’t move Sam Rivera", tone: "error" });

    expect(liveRegion()).toHaveTextContent("Couldn’t move Sam Rivera");
    expect(liveRegion()).not.toHaveTextContent("Moved Jordan Lee");

    advance(1000);
    expect(liveRegion()).toHaveTextContent("Couldn’t move Sam Rivera");

    advance(TOAST_AUTO_DISMISS_MS - 1000);
    expectNoToast();
  });

  it("waits while the pointer is over it, then finishes the time that was left", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist" });
    advance(2000);

    fireEvent.mouseEnter(shownToast());
    advance(TOAST_AUTO_DISMISS_MS * 2);
    expect(liveRegion()).toHaveTextContent("Moved Jordan Lee to Shortlist");

    fireEvent.mouseLeave(shownToast());
    advance(TOAST_AUTO_DISMISS_MS - 2001);
    expect(liveRegion()).toHaveTextContent("Moved Jordan Lee to Shortlist");

    advance(1);
    expectNoToast();
  });

  it("waits while keyboard focus is inside it", () => {
    renderWithToasts();
    show({ message: "Moved Jordan Lee to Shortlist", action: { label: "Undo", onClick: vi.fn() } });

    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    advance(TOAST_AUTO_DISMISS_MS * 2);
    expect(liveRegion()).toHaveTextContent("Moved Jordan Lee to Shortlist");

    act(() => screen.getByRole("button", { name: "Undo" }).blur());
    advance(TOAST_AUTO_DISMISS_MS);
    expectNoToast();
  });
});
