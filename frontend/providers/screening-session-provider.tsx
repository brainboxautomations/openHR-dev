"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { useCandidateProfile, useUpdateCandidate } from "@/hooks/use-candidates";
import { useNavigate } from "@/hooks/use-navigate";
import { useScreeningQueue, type ScreeningQueueState } from "@/hooks/use-screening-queue";
import { useToast } from "@/providers/toast-provider";
import { candidateHref, parseCandidateNavigationContext } from "@/utilities/candidate-navigation";
import { nextPendingCandidate } from "@/utilities/screening-queue";

export type ScreeningSession = ScreeningQueueState & {
  allDone: boolean;
  moveAndAdvance: (toStageId: string) => void;
};

const ScreeningSessionContext = createContext<ScreeningSession | null>(null);

export function ScreeningSessionProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ candidateId?: string }>();
  const applicationId = typeof params?.candidateId === "string" ? params.candidateId : null;
  const searchParams = useSearchParams();

  const profile = useCandidateProfile(applicationId, { keepPreviousWhileLoading: true }).data;
  const profilePositionId = profile?.application.positionId ?? null;
  const stages = profile?.stages ?? null;

  const context = useMemo(() => {
    if (!profilePositionId) return null;
    const parsed = parseCandidateNavigationContext(new URLSearchParams(searchParams.toString()));
    if (!parsed || parsed.positionId !== profilePositionId) return null;
    return parsed;
  }, [searchParams, profilePositionId]);

  const queueState = useScreeningQueue({ context, applicationId, stages });

  const { mutateAsync: patchCandidate } = useUpdateCandidate(
    queueState?.context.positionId ?? null,
  );
  const toast = useToast();
  const { push: navigateTo } = useNavigate();
  const movesInFlight = useRef(new Set<string>());

  const moveAndAdvance = useCallback(
    (toStageId: string) => {
      if (!queueState || !stages) return;

      const current = queueState.rows.find((row) => row.current);
      if (!current || !current.pending || movesInFlight.current.has(current.id)) return;

      const queueContext = queueState.context;
      const fromStageId = queueState.queue.stageId;
      const fromStageName = queueState.stageName;
      const toStageName = stages.find((stage) => stage.id === toStageId)?.name ?? "another stage";
      const movedHref = candidateHref(current.id, queueContext);
      const nextId = nextPendingCandidate(queueState.rows, current.id);

      movesInFlight.current.add(current.id);
      const move = patchCandidate({ id: current.id, patch: { stageId: toStageId } });
      const moveSettled = move.then(
        () => true,
        () => false,
      );

      if (nextId) navigateTo(candidateHref(nextId, queueContext));

      const openMoved = { label: "Open", onClick: () => navigateTo(movedHref) };

      const undo = async () => {
        if (!(await moveSettled)) return;
        try {
          await patchCandidate({ id: current.id, patch: { stageId: fromStageId } });
          navigateTo(movedHref);
        } catch {
          toast.show({
            tone: "error",
            message: `Couldn’t undo, ${current.name} is still in ${toStageName}`,
            action: openMoved,
          });
        }
      };

      toast.show({
        message: `Moved ${current.name} to ${toStageName}`,
        action: { label: "Undo", onClick: () => void undo() },
      });

      void moveSettled.then((moved) => {
        movesInFlight.current.delete(current.id);
        if (moved) return;
        toast.show({
          tone: "error",
          message: `Couldn’t move ${current.name}, they’re still in ${fromStageName}`,
          action: openMoved,
        });
      });
    },
    [queueState, stages, patchCandidate, navigateTo, toast],
  );

  const session = useMemo<ScreeningSession | null>(
    () =>
      queueState
        ? { ...queueState, allDone: queueState.progress.left === 0, moveAndAdvance }
        : null,
    [queueState, moveAndAdvance],
  );

  return (
    <ScreeningSessionContext.Provider value={session}>{children}</ScreeningSessionContext.Provider>
  );
}

export function useScreeningSession(): ScreeningSession | null {
  return useContext(ScreeningSessionContext);
}
