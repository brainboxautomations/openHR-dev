"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useCandidates } from "@/hooks/use-candidates";
import { useNow } from "@/hooks/use-now";
import type { PipelineStage } from "@/types/api";
import {
  neighbouringCandidates,
  type CandidateNavigationContext,
  type CandidateNeighbours,
} from "@/utilities/candidate-navigation";
import {
  createScreeningQueue,
  isScreeningQueueFresh,
  screeningQueueKey,
  screeningQueueProgress,
  screeningQueueRows,
  type ScreeningQueue,
  type ScreeningQueueProgress,
  type ScreeningQueueRow,
} from "@/utilities/screening-queue";
import {
  readScreeningQueue,
  subscribeScreeningQueue,
  writeScreeningQueue,
} from "@/utilities/screening-queue-storage";

export type ScreeningQueueState = {
  queue: ScreeningQueue;
  rows: ScreeningQueueRow[];
  progress: ScreeningQueueProgress;
  neighbours: CandidateNeighbours;
  context: CandidateNavigationContext;
  stageName: string;
};

const readNothing = () => null;

function matchesContext(queue: ScreeningQueue, context: CandidateNavigationContext): boolean {
  return queue.positionId === context.positionId && queue.stageId === context.queueStageId;
}

export function useScreeningQueue({
  context,
  applicationId,
  stages,
}: {
  context: CandidateNavigationContext | null;
  applicationId: string | null;
  stages: PipelineStage[] | null;
}): ScreeningQueueState | null {
  const queueContext = context?.queueStageId ? context : null;
  const key = queueContext ? screeningQueueKey(queueContext) : null;
  const queueStage =
    queueContext && stages
      ? (stages.find((stage) => stage.id === queueContext.queueStageId) ?? null)
      : null;

  const stored = useSyncExternalStore(
    subscribeScreeningQueue,
    () => (key ? readScreeningQueue(key) : null),
    readNothing,
  );

  const liveQuery = useCandidates(queueContext ? queueContext.positionId : null);
  const live = liveQuery.data;

  const now = useNow();
  const usable =
    stored !== null &&
    queueContext !== null &&
    matchesContext(stored, queueContext) &&
    isScreeningQueueFresh(stored, new Date(now));

  const needsSnapshot = key !== null && queueStage !== null && live !== undefined && !usable;

  useEffect(() => {
    if (!needsSnapshot || !key || !queueContext || !queueStage || !live || !stages) return;

    writeScreeningQueue(
      key,
      createScreeningQueue({
        positionId: queueContext.positionId,
        stageId: queueStage.id,
        candidates: live,
        stages,
        filters: queueContext.filters,
        now: new Date(),
      }),
    );
  }, [needsSnapshot, key, queueContext, queueStage, live, stages]);

  return useMemo(() => {
    if (!usable || !stored || !queueContext || !queueStage || !live || !stages) return null;
    if (!applicationId || !stored.applicationIds.includes(applicationId)) return null;

    const rows = screeningQueueRows(stored, live, stages, applicationId);

    return {
      queue: stored,
      rows,
      progress: screeningQueueProgress(rows),
      neighbours: neighbouringCandidates(
        rows.map((row) => row.id),
        applicationId,
      ),
      context: queueContext,
      stageName: queueStage.name,
    };
  }, [usable, stored, queueContext, queueStage, live, stages, applicationId]);
}
