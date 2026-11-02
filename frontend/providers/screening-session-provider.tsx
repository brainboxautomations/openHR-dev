"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { useCandidateProfile } from "@/hooks/use-candidates";
import { useScreeningQueue, type ScreeningQueueState } from "@/hooks/use-screening-queue";
import { parseCandidateNavigationContext } from "@/utilities/candidate-navigation";

export type ScreeningSession = ScreeningQueueState;

const ScreeningSessionContext = createContext<ScreeningSession | null>(null);

export function ScreeningSessionProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ candidateId?: string }>();
  const applicationId = typeof params?.candidateId === "string" ? params.candidateId : null;
  const searchParams = useSearchParams();

  const profile = useCandidateProfile(applicationId).data;
  const profilePositionId = profile?.application.positionId ?? null;
  const stages = profile?.stages ?? null;

  const context = useMemo(() => {
    if (!profilePositionId) return null;
    const parsed = parseCandidateNavigationContext(new URLSearchParams(searchParams.toString()));
    if (!parsed || parsed.positionId !== profilePositionId) return null;
    return parsed;
  }, [searchParams, profilePositionId]);

  const session = useScreeningQueue({ context, applicationId, stages });

  return (
    <ScreeningSessionContext.Provider value={session}>{children}</ScreeningSessionContext.Provider>
  );
}

export function useScreeningSession(): ScreeningSession | null {
  return useContext(ScreeningSessionContext);
}
