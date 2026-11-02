import type { Candidate, PipelineStage } from "@/types/api";
import type { CandidateFilters } from "@/utilities/candidate-filters";
import {
  boardStageOrder,
  candidateNavigationSearch,
  columnCandidates,
  orderedBoardCandidates,
  type CandidateNavigationContext,
} from "@/utilities/candidate-navigation";

export const SCREENING_QUEUE_KEY_PREFIX = "openhr:screening-queue:";

export const SCREENING_QUEUE_TTL_MS = 12 * 60 * 60 * 1000;

export type ScreeningQueue = {
  version: 1;
  positionId: string;
  stageId: string;
  includeArchived: boolean;
  applicationIds: string[];
  createdAt: string;
};

export type ScreeningQueueRow = {
  id: string;
  name: string;
  starred: boolean;
  archived: boolean;
  stageName: string | null;
  pending: boolean;
  current: boolean;
};

export type ScreeningQueueProgress = {
  position: number | null;
  total: number;
  left: number;
};

export function createScreeningQueue({
  positionId,
  stageId,
  candidates,
  stages,
  filters,
  now,
  alwaysInclude = null,
}: {
  positionId: string;
  stageId: string;
  candidates: Candidate[];
  stages: PipelineStage[];
  filters: CandidateFilters;
  now: Date;
  alwaysInclude?: string | null;
}): ScreeningQueue {
  const visible = orderedBoardCandidates(candidates, boardStageOrder(stages), filters, now);
  const kept = new Set(columnCandidates(visible, stageId).map((candidate) => candidate.id));
  if (alwaysInclude) kept.add(alwaysInclude);

  return {
    version: 1,
    positionId,
    stageId,
    includeArchived: filters.includeArchived,
    applicationIds: columnCandidates(candidates, stageId)
      .filter((candidate) => kept.has(candidate.id))
      .map((candidate) => candidate.id),
    createdAt: now.toISOString(),
  };
}

export function screeningQueueKey(context: CandidateNavigationContext): string {
  return `${SCREENING_QUEUE_KEY_PREFIX}${candidateNavigationSearch(context)}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseScreeningQueue(raw: unknown): ScreeningQueue | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  if (!isNonEmptyString(candidate.positionId) || !isNonEmptyString(candidate.stageId)) return null;
  if (typeof candidate.includeArchived !== "boolean") return null;
  if (!isNonEmptyString(candidate.createdAt) || Number.isNaN(Date.parse(candidate.createdAt))) {
    return null;
  }

  const ids = candidate.applicationIds;
  if (!Array.isArray(ids) || !ids.every(isNonEmptyString)) return null;

  return {
    version: 1,
    positionId: candidate.positionId,
    stageId: candidate.stageId,
    includeArchived: candidate.includeArchived,
    applicationIds: [...ids],
    createdAt: candidate.createdAt,
  };
}

export function isScreeningQueueFresh(queue: ScreeningQueue, now: Date): boolean {
  const age = now.getTime() - Date.parse(queue.createdAt);
  return age < SCREENING_QUEUE_TTL_MS;
}

export function isScreeningPending(queue: ScreeningQueue, candidate: Candidate): boolean {
  return candidate.stageId === queue.stageId && (queue.includeArchived || !candidate.archived);
}

function fullName(candidate: Candidate): string {
  return `${candidate.firstName} ${candidate.lastName ?? ""}`.trim();
}

export function screeningQueueRows(
  queue: ScreeningQueue,
  live: Candidate[],
  stages: PipelineStage[],
  currentId: string,
): ScreeningQueueRow[] {
  const byId = new Map(live.map((candidate) => [candidate.id, candidate]));
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));

  const rows: ScreeningQueueRow[] = [];
  for (const id of queue.applicationIds) {
    const candidate = byId.get(id);
    if (!candidate) continue;

    rows.push({
      id,
      name: fullName(candidate),
      starred: candidate.starred,
      archived: candidate.archived,
      stageName: candidate.stageId ? (stageNames.get(candidate.stageId) ?? null) : null,
      pending: isScreeningPending(queue, candidate),
      current: id === currentId,
    });
  }

  return rows;
}

export function screeningQueueProgress(rows: ScreeningQueueRow[]): ScreeningQueueProgress {
  const index = rows.findIndex((row) => row.current);

  return {
    position: index === -1 ? null : index + 1,
    total: rows.length,
    left: rows.filter((row) => row.pending).length,
  };
}

export function nextPendingCandidate(rows: ScreeningQueueRow[], currentId: string): string | null {
  const index = rows.findIndex((row) => row.id === currentId);
  const after = index === -1 ? rows : rows.slice(index + 1);
  const before = index === -1 ? [] : rows.slice(0, index);

  const next =
    after.find((row) => row.pending && row.id !== currentId) ??
    before.find((row) => row.pending && row.id !== currentId);

  return next?.id ?? null;
}

export function screeningProgressLabel(
  stageName: string,
  progress: ScreeningQueueProgress,
): string {
  const left = `${progress.left} left`;
  if (progress.position === null) return `${stageName} · ${left}`;
  return `${stageName} · ${progress.position} of ${progress.total} · ${left}`;
}
