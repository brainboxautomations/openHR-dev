import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScreeningQueue } from "@/utilities/screening-queue";
import {
  forgetScreeningQueuesInMemory,
  readScreeningQueue,
  subscribeScreeningQueue,
  writeScreeningQueue,
} from "@/utilities/screening-queue-storage";

const KEY = "openhr:screening-queue:position=position-1&queue=stage-1";

function queue(overrides: Partial<ScreeningQueue> = {}): ScreeningQueue {
  return {
    version: 1,
    positionId: "position-1",
    stageId: "stage-1",
    includeArchived: false,
    applicationIds: ["a1", "a2"],
    createdAt: "2026-08-10T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  forgetScreeningQueuesInMemory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("screening queue storage", () => {
  it("reads nothing for a column that was never opened", () => {
    expect(readScreeningQueue(KEY)).toBeNull();
  });

  it("reads back what was written", () => {
    writeScreeningQueue(KEY, queue());

    expect(readScreeningQueue(KEY)).toEqual(queue());
  });

  it("hands back the same object on every read, so a subscriber does not loop", () => {
    writeScreeningQueue(KEY, queue());

    expect(readScreeningQueue(KEY)).toBe(readScreeningQueue(KEY));
  });

  it("survives a reload by reading sessionStorage once memory is gone", () => {
    writeScreeningQueue(KEY, queue());
    forgetScreeningQueuesInMemory();

    expect(readScreeningQueue(KEY)).toEqual(queue());
  });

  it("replaces the snapshot when the column is opened again", () => {
    writeScreeningQueue(KEY, queue());
    writeScreeningQueue(KEY, queue({ applicationIds: ["a3"] }));
    forgetScreeningQueuesInMemory();

    expect(readScreeningQueue(KEY)?.applicationIds).toEqual(["a3"]);
  });

  it("ignores an entry that is not a snapshot", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ version: 1 }));

    expect(readScreeningQueue(KEY)).toBeNull();
  });

  it("ignores an entry that is not JSON", () => {
    sessionStorage.setItem(KEY, "{not json");

    expect(readScreeningQueue(KEY)).toBeNull();
  });

  it("reads nothing, rather than throwing, when sessionStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readScreeningQueue(KEY)).toBeNull();
  });

  it("still keeps the snapshot for this page when sessionStorage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => writeScreeningQueue(KEY, queue())).not.toThrow();
    expect(readScreeningQueue(KEY)).toEqual(queue());
  });

  it("tells subscribers about a write, and stops once they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeScreeningQueue(listener);

    writeScreeningQueue(KEY, queue());
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    writeScreeningQueue(KEY, queue());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
