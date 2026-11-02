import { Suspense, type ReactNode } from "react";

import { CandidateScreeningLayout } from "@/components/organisms/candidate-screening-layout";
import { ScreeningSessionProvider } from "@/providers/screening-session-provider";

export default function CandidatesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ScreeningSessionProvider>
        <CandidateScreeningLayout>{children}</CandidateScreeningLayout>
      </ScreeningSessionProvider>
    </Suspense>
  );
}
