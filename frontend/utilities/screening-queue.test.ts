import { describe, expect, it } from "vitest";

import type { Candidate, PipelineStage } from "@/types/api";
import { emptyCandidateFilters, type CandidateFilters } from "@/utilities/candidate-filters";
import {
  createScreeningQueue,
  isScreeningQueueFresh,
  nextPendingCandidate,
  parseScreeningQueue,
  screeningProgressLabel,
  screeningQueueKey,
  screeningQueueProgress,
  screeningQueueRows,
  SCREENING_QUEUE_TTL_MS,
  type ScreeningQueue,
  type ScreeningQueueRow,
} from "@/utilities/screening-queue";

const STAGES: PipelineStage[] = [
  { id: "stage-1", name: "Applied", sortOrder: 1 },
  { id: "stage-2", name: "Shortlist", sortOrder: 2 },
  { id: "stage-3", name: "Rejected", sortOrder: 3 },
];

const NOW = new Date("2026-08-10T12:00:00.000Z");

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "application-1",
    firstName: "Amara",
    lastName: "Okafor",
    email: "amara@example.com",
    headline: "Engineer",
    stageId: "stage-1",
    starred: false,
    seen: true,
    archived: false,
    questionnaire: "none",
    appliedAt: NOW.toISOString(),
    stageEnteredAt: NOW.toISOString(),
    lastActivityAt: NOW.toISOString(),
    ...overrides,
  };
}

function filters(overrides: Partial<CandidateFilters> = {}): CandidateFilters {
  return { ...emptyCandidateFilters(), ...overrides };
}

function queue(overrides: Partial<ScreeningQueue> = {}): ScreeningQueue {
  return {
    version: 1,
    positionId: "position-1",
    stageId: "stage-1",
    includeArchived: false,
    applicationIds: ["a1", "a2", "a3"],
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function row(id: string, overrides: Partial<ScreeningQueueRow> = {}): ScreeningQueueRow {
  return {
    id,
    name: id,
    starred: false,
    archived: false,
    stageName: "Applied",
    pending: true,
    current: false,
    ...overrides,
  };
}

describe("createScreeningQueue", () => {
  it("snapshots one column in the order the board shows it", () => {
    const created = createScreeningQueue({
      positionId: "position-1",
      stageId: "stage-1",
      candidates: [
        candidate({ id: "a-newest" }),
        candidate({ id: "s-1", stageId: "stage-2" }),
        candidate({ id: "a-oldest" }),
      ],
      stages: STAGES,
      filters: filters(),
      now: NOW,
    });

    expect(created).toEqual({
      version: 1,
      positionId: "position-1",
      stageId: "stage-1",
      includeArchived: false,
      applicationIds: ["a-newest", "a-oldest"],
      createdAt: NOW.toISOString(),
    });
  });

  it("leaves out whoever the board's filters were hiding", () => {
    const created = createScreeningQueue({
      positionId: "position-1",
      stageId: "stage-1",
      candidates: [
        candidate({ id: "starred", starred: true }),
        candidate({ id: "plain" }),
        candidate({ id: "archived", starred: true, archived: true }),
      ],
      stages: STAGES,
      filters: filters({ starredOnly: true }),
      now: NOW,
    });

    expect(created.applicationIds).toEqual(["starred"]);
  });

  it("remembers that archived candidates were on show, so they still count as pending", () => {
    const created = createScreeningQueue({
      positionId: "position-1",
      stageId: "stage-1",
      candidates: [candidate({ id: "archived", archived: true })],
      stages: STAGES,
      filters: filters({ includeArchived: true }),
      now: NOW,
    });

    expect(created.includeArchived).toBe(true);
    expect(created.applicationIds).toEqual(["archived"]);
  });
});

describe("screeningQueueKey", () => {
  it("is namespaced and carries the column with the rest of the board's context", () => {
    expect(
      screeningQueueKey({
        positionId: "position-1",
        filters: filters({ starredOnly: true }),
        queueStageId: "stage-1",
      }),
    ).toBe("openhr:screening-queue:position=position-1&starred=1&queue=stage-1");
  });

  it("differs between two columns of the same board", () => {
    const context = { positionId: "position-1", filters: filters() };

    expect(screeningQueueKey({ ...context, queueStageId: "stage-1" })).not.toBe(
      screeningQueueKey({ ...context, queueStageId: "stage-2" }),
    );
  });
});

describe("parseScreeningQueue", () => {
  it("accepts what createScreeningQueue produced, after a trip through JSON", () => {
    const stored = queue();

    expect(parseScreeningQueue(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it.each([
    ["nothing", null],
    ["a string", "queue"],
    ["another version", { ...queue(), version: 2 }],
    ["no position", { ...queue(), positionId: "" }],
    ["no stage", { ...queue(), stageId: undefined }],
    ["a non-boolean archived flag", { ...queue(), includeArchived: "yes" }],
    ["ids that are not a list", { ...queue(), applicationIds: "a1,a2" }],
    ["a list with a non-string id", { ...queue(), applicationIds: ["a1", 2] }],
    ["an unreadable timestamp", { ...queue(), createdAt: "yesterday" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseScreeningQueue(raw)).toBeNull();
  });
});

describe("isScreeningQueueFresh", () => {
  it("is fresh straight after it was taken", () => {
    expect(isScreeningQueueFresh(queue(), NOW)).toBe(true);
  });

  it("is fresh just inside twelve hours", () => {
    const later = new Date(NOW.getTime() + SCREENING_QUEUE_TTL_MS - 1);

    expect(isScreeningQueueFresh(queue(), later)).toBe(true);
  });

  it("is stale at twelve hours", () => {
    const later = new Date(NOW.getTime() + SCREENING_QUEUE_TTL_MS);

    expect(isScreeningQueueFresh(queue(), later)).toBe(false);
  });

  it("is fresh when it was taken just after the clock that reads it", () => {
    const earlier = new Date(NOW.getTime() - 60_000);

    expect(isScreeningQueueFresh(queue(), earlier)).toBe(true);
  });
});

describe("screeningQueueRows", () => {
  it("keeps the snapshot's order, whatever order the live list is in", () => {
    const rows = screeningQueueRows(
      queue(),
      [candidate({ id: "a3" }), candidate({ id: "a1" }), candidate({ id: "a2" })],
      STAGES,
      "a2",
    );

    expect(rows.map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
    expect(rows.map((r) => r.current)).toEqual([false, true, false]);
  });

  it("keeps a moved candidate listed, no longer pending, with where they went", () => {
    const rows = screeningQueueRows(
      queue(),
      [
        candidate({ id: "a1", stageId: "stage-3" }),
        candidate({ id: "a2" }),
        candidate({ id: "a3" }),
      ],
      STAGES,
      "a1",
    );

    expect(rows[0]).toMatchObject({ id: "a1", pending: false, stageName: "Rejected" });
    expect(rows[1]).toMatchObject({ id: "a2", pending: true, stageName: "Applied" });
  });

  it("counts an archived candidate as handled unless archived ones were on show", () => {
    const live = [candidate({ id: "a1", archived: true })];

    expect(screeningQueueRows(queue(), live, STAGES, "a1")[0]).toMatchObject({
      archived: true,
      pending: false,
    });
    expect(
      screeningQueueRows(queue({ includeArchived: true }), live, STAGES, "a1")[0],
    ).toMatchObject({ archived: true, pending: true });
  });

  it("drops a candidate who has been deleted since the snapshot", () => {
    const rows = screeningQueueRows(
      queue(),
      [candidate({ id: "a1" }), candidate({ id: "a3" })],
      STAGES,
      "a1",
    );

    expect(rows.map((r) => r.id)).toEqual(["a1", "a3"]);
  });

  it("does not add someone who applied after the snapshot was taken", () => {
    const rows = screeningQueueRows(
      queue({ applicationIds: ["a1"] }),
      [candidate({ id: "newcomer" }), candidate({ id: "a1" })],
      STAGES,
      "a1",
    );

    expect(rows.map((r) => r.id)).toEqual(["a1"]);
  });

  it("carries the name and star from the live list", () => {
    const rows = screeningQueueRows(
      queue({ applicationIds: ["a1"] }),
      [candidate({ id: "a1", firstName: "Lena", lastName: "Fischer", starred: true })],
      STAGES,
      "a1",
    );

    expect(rows[0]).toMatchObject({ name: "Lena Fischer", starred: true });
  });

  it("names no stage for a candidate whose stage is unknown", () => {
    const rows = screeningQueueRows(
      queue({ applicationIds: ["a1"] }),
      [candidate({ id: "a1", stageId: null })],
      STAGES,
      "a1",
    );

    expect(rows[0]).toMatchObject({ stageName: null, pending: false });
  });
});

describe("screeningQueueProgress", () => {
  it("says where the current candidate is and how many are still pending", () => {
    const rows = [
      row("a1", { pending: false }),
      row("a2"),
      row("a3", { current: true }),
      row("a4"),
    ];

    expect(screeningQueueProgress(rows)).toEqual({ position: 3, total: 4, left: 3 });
  });

  it("counts the current candidate as left while they are still pending", () => {
    expect(screeningQueueProgress([row("a1", { current: true })]).left).toBe(1);
  });

  it("has no position when the current candidate is not in the rows", () => {
    expect(screeningQueueProgress([row("a1"), row("a2")])).toEqual({
      position: null,
      total: 2,
      left: 2,
    });
  });
});

describe("nextPendingCandidate", () => {
  it("goes to the first pending candidate after the current one", () => {
    const rows = [
      row("a1"),
      row("a2", { current: true }),
      row("a3", { pending: false }),
      row("a4"),
    ];

    expect(nextPendingCandidate(rows, "a2")).toBe("a4");
  });

  it("wraps to the first pending candidate before the current one when none are after", () => {
    const rows = [row("a1", { pending: false }), row("a2"), row("a3", { current: true })];

    expect(nextPendingCandidate(rows, "a3")).toBe("a2");
  });

  it("never offers the current candidate, even while they are still pending", () => {
    expect(nextPendingCandidate([row("a1", { current: true })], "a1")).toBeNull();
  });

  it("is null when nobody is left", () => {
    const rows = [row("a1", { pending: false }), row("a2", { pending: false, current: true })];

    expect(nextPendingCandidate(rows, "a2")).toBeNull();
  });

  it("starts from the top when the current candidate is not in the rows", () => {
    expect(nextPendingCandidate([row("a1", { pending: false }), row("a2")], "gone")).toBe("a2");
  });
});

describe("screeningProgressLabel", () => {
  it("reads stage, position and what is left", () => {
    expect(screeningProgressLabel("Applied", { position: 3, total: 7, left: 5 })).toBe(
      "Applied · 3 of 7 · 5 left",
    );
  });

  it("leaves out the position when there is none", () => {
    expect(screeningProgressLabel("Applied", { position: null, total: 7, left: 0 })).toBe(
      "Applied · 0 left",
    );
  });
});
