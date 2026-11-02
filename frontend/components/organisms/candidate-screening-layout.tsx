"use client";

import type { ReactNode } from "react";

import { ScreeningQueuePanel } from "@/components/organisms/screening-queue-panel";
import { useQueueShortcuts } from "@/hooks/use-queue-shortcuts";
import { useScreeningSession } from "@/providers/screening-session-provider";

export function CandidateScreeningLayout({ children }: { children: ReactNode }) {
  const session = useScreeningSession();
  useQueueShortcuts(session);

  return (
    <div className="flex h-full min-h-0">
      {session && (
        <ScreeningQueuePanel
          stageName={session.stageName}
          rows={session.rows}
          left={session.progress.left}
          context={session.context}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
