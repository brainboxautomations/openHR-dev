import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateProfile } from "@/types/api";

const harness = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  send: vi.fn(),
  searchParams: new URLSearchParams(),
  profile: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, back: harness.back }),
  useSearchParams: () => harness.searchParams,
}));

vi.mock("@/hooks/use-navigate", () => ({
  useNavigate: () => ({ push: harness.push, replace: vi.fn(), isNavigating: false }),
}));

vi.mock("@/hooks/use-candidates", () => ({
  useCandidateProfile: () => ({
    data: harness.profile,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-message-templates", () => ({
  useMessageTemplates: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/hooks/use-messages", () => ({
  useSendMessage: () => ({ mutateAsync: harness.send, isPending: false }),
}));

const ComposePage = (await import("./page")).default;

const QUEUE_RETURN = "/candidates/application-1?position=position-1&unseen=1&queue=stage-1";

function makeProfile(): CandidateProfile {
  return {
    application: {
      id: "application-1",
      positionId: "position-1",
      positionTitle: "Growth Engineer",
      stageId: "stage-1",
      starred: false,
      seen: true,
      archived: false,
      appliedAt: "2026-01-05T09:00:00.000Z",
      formAnswers: {},
      resubmissionAttempts: { count: 0, mostRecentAt: null },
    },
    person: {
      id: "person-1",
      firstName: "Amara",
      lastName: "Okafor",
      email: "amara@example.com",
      phone: null,
      headline: "Senior Frontend Engineer",
      links: [],
      customAttributes: {},
    },
    stages: [{ id: "stage-1", name: "Applied", sortOrder: 1 }],
    applications: [],
    documents: [],
    questionnaires: [],
    upcomingAutomations: [],
  };
}

function openComposer(returnTo?: string) {
  const params = new URLSearchParams({ applicationId: "application-1" });
  if (returnTo !== undefined) params.set("returnTo", returnTo);
  harness.searchParams = params;
  render(<ComposePage />);
}

beforeEach(() => {
  harness.push.mockReset();
  harness.back.mockReset();
  harness.send.mockReset();
  harness.profile = makeProfile();
});

describe("ComposePage leaving the composer", () => {
  it("returns to the candidate with their screening list when closed", async () => {
    const user = userEvent.setup();
    openComposer(QUEUE_RETURN);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(harness.push).toHaveBeenCalledWith(QUEUE_RETURN);
  });

  it("returns to the candidate with their screening list once the email is sent", async () => {
    const user = userEvent.setup();
    harness.send.mockResolvedValue({});
    openComposer(QUEUE_RETURN);

    await user.type(screen.getByLabelText("Subject"), "Next steps");
    await user.type(screen.getByLabelText("Message body"), "Thanks for applying.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(harness.push).toHaveBeenCalledWith(QUEUE_RETURN));
    expect(harness.send).toHaveBeenCalledTimes(1);
  });

  it("returns to the plain profile when it was opened without a return location", async () => {
    const user = userEvent.setup();
    openComposer();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(harness.push).toHaveBeenCalledWith("/candidates/application-1");
  });

  it("ignores a return location that points anywhere but this candidate", async () => {
    const user = userEvent.setup();
    openComposer("https://example.com/candidates/application-1");

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(harness.push).toHaveBeenCalledWith("/candidates/application-1");
  });

  it("ignores a return location for another candidate", async () => {
    const user = userEvent.setup();
    openComposer("/candidates/application-2?position=position-1&queue=stage-1");

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(harness.push).toHaveBeenCalledWith("/candidates/application-1");
  });
});
