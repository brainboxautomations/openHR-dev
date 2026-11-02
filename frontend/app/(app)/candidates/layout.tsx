import { Suspense, type ReactNode } from "react";

import { ScreeningSessionProvider } from "@/providers/screening-session-provider";

export default function CandidatesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ScreeningSessionProvider>{children}</ScreeningSessionProvider>
    </Suspense>
  );
}
