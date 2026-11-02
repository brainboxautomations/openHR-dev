import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScreeningQueue } from "@/utilities/screening-queue";
import {
  forgetScreeningQueuesInMemory,
  MAX_STORED_SCREENING_QUEUES,
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

  describe("pruning old lists", () => {
    const PREFIX = "openhr:screening-queue:";

    function columnKey(index: number) {
      return `${PREFIX}position=position-1&queue=stage-${index}`;
    }

    function createdAt(index: number) {
      return new Date(Date.UTC(2026, 7, 10, 12, index)).toISOString();
    }

    function writeColumns(count: number) {
      for (let index = 1; index <= count; index++) {
        writeScreeningQueue(
          columnKey(index),
          queue({ stageId: `stage-${index}`, createdAt: createdAt(index) }),
        );
      }
    }

    function storedKeys() {
      return Object.keys(sessionStorage).filter((key) => key.startsWith(PREFIX));
    }

    it("keeps the ten most recent lists and drops the rest from storage and memory", () => {
      writeColumns(MAX_STORED_SCREENING_QUEUES + 2);

      expect(storedKeys()).toHaveLength(MAX_STORED_SCREENING_QUEUES);
      expect(sessionStorage.getItem(columnKey(1))).toBeNull();
      expect(sessionStorage.getItem(columnKey(2))).toBeNull();
      expect(readScreeningQueue(columnKey(1))).toBeNull();
      expect(readScreeningQueue(columnKey(2))).toBeNull();
      expect(readScreeningQueue(columnKey(3))?.stageId).toBe("stage-3");
      expect(readScreeningQueue(columnKey(12))?.stageId).toBe("stage-12");
    });

    it("drops by when a list was made, not by when it was written", () => {
      writeScreeningQueue(columnKey(99), queue({ createdAt: createdAt(0) }));
      writeColumns(MAX_STORED_SCREENING_QUEUES);

      expect(storedKeys()).toHaveLength(MAX_STORED_SCREENING_QUEUES);
      expect(sessionStorage.getItem(columnKey(99))).toBeNull();
      expect(sessionStorage.getItem(columnKey(1))).not.toBeNull();
    });

    it("always keeps the list just written", () => {
      writeColumns(MAX_STORED_SCREENING_QUEUES);

      writeScreeningQueue(columnKey(0), queue({ createdAt: createdAt(0) }));

      expect(storedKeys()).toHaveLength(MAX_STORED_SCREENING_QUEUES);
      expect(readScreeningQueue(columnKey(0))).not.toBeNull();
      expect(sessionStorage.getItem(columnKey(1))).toBeNull();
    });

    it("drops unreadable entries before real lists", () => {
      sessionStorage.setItem(`${PREFIX}broken`, "{not json");
      writeColumns(MAX_STORED_SCREENING_QUEUES);

      expect(sessionStorage.getItem(`${PREFIX}broken`)).toBeNull();
      expect(storedKeys()).toHaveLength(MAX_STORED_SCREENING_QUEUES);
    });

    it("leaves everything else in sessionStorage alone", () => {
      sessionStorage.setItem("openhr:position-draft", "kept");
      writeColumns(MAX_STORED_SCREENING_QUEUES + 3);

      expect(sessionStorage.getItem("openhr:position-draft")).toBe("kept");
    });

    it("keeps lists that only made it into memory within the same limit", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });

      writeColumns(MAX_STORED_SCREENING_QUEUES + 1);

      expect(readScreeningQueue(columnKey(1))).toBeNull();
      expect(readScreeningQueue(columnKey(2))?.stageId).toBe("stage-2");
      expect(readScreeningQueue(columnKey(11))?.stageId).toBe("stage-11");
    });

    it("still writes, rather than throwing, when sessionStorage cannot be listed or cleaned", () => {
      writeColumns(MAX_STORED_SCREENING_QUEUES);
      vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("blocked");
      });

      expect(() =>
        writeScreeningQueue(columnKey(11), queue({ createdAt: createdAt(11) })),
      ).not.toThrow();
      expect(readScreeningQueue(columnKey(11))).not.toBeNull();
    });
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
