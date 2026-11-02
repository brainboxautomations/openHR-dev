import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgetCollapsedPreferencesInMemory } from "@/hooks/use-collapsed-preference";
import { ToastProvider } from "@/providers/toast-provider";
import {
  forgetScreeningQueuesInMemory,
  readScreeningQueue,
  writeScreeningQueue,
} from "@/utilities/screening-queue-storage";
import type {
  Candidate,
  CandidateProfile,
  Note,
  PipelineStage,
  QuestionnaireResponseDetail,
} from "@/types/api";

const harness = vi.hoisted(() => ({
  profile: undefined as unknown,
  notes: [] as unknown,
  getProfile: vi.fn(),
  listNotes: vi.fn(),
  addNote: vi.fn(),
  updateCandidate: vi.fn(),
  listByPosition: vi.fn(),
  updatePerson: vi.fn(),
  setRemindersStopped: vi.fn(),
  resendQuestionnaire: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
  candidateId: "application-1",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ candidateId: harness.candidateId }),
  useRouter: () => ({ push: harness.push }),
  useSearchParams: () => harness.searchParams,
}));

vi.mock("@/services/candidates-service", () => ({
  CandidatesService: {
    getProfile: harness.getProfile,
    listNotes: harness.listNotes,
    addNote: harness.addNote,
    update: harness.updateCandidate,
    listByPosition: harness.listByPosition,
  },
}));

vi.mock("@/services/people-service", () => ({
  PeopleService: { update: harness.updatePerson },
}));

vi.mock("@/services/questionnaires-service", () => ({
  QuestionnairesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  QuestionnaireRemindersService: { setStopped: harness.setRemindersStopped },
  QuestionnaireResponsesService: { resend: harness.resendQuestionnaire },
}));

const CandidateProfilePage = (await import("./page")).default;
const CandidatesLayout = (await import("../layout")).default;

const STAGES: PipelineStage[] = [
  { id: "stage-1", name: "Applied", sortOrder: 1 },
  { id: "stage-2", name: "Shortlist", sortOrder: 2 },
];

const SERVER_REFUSED = { response: { status: 500, data: { error: "Database is down" } } };

function makeProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
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
    stages: STAGES,
    applications: [],
    documents: [],
    questionnaires: [],
    upcomingAutomations: [],
    ...overrides,
  };
}

function profileInStage(stageId: string): CandidateProfile {
  const base = makeProfile();
  return { ...base, application: { ...base.application, stageId } };
}

function profileStarred(starred: boolean): CandidateProfile {
  const base = makeProfile();
  return { ...base, application: { ...base.application, starred } };
}

function makeNote(body: string): Note {
  return {
    id: "note-1",
    body,
    authorName: "Priya",
    createdAt: "2026-02-01T10:00:00.000Z",
  };
}

function updatedCandidate(): Candidate {
  return {
    id: "application-1",
    firstName: "Amara",
    lastName: "Okafor",
    email: "amara@example.com",
    headline: "Senior Frontend Engineer",
    stageId: "stage-2",
    starred: true,
    seen: true,
    archived: false,
    questionnaire: "none",
    appliedAt: "2026-01-05T09:00:00.000Z",
    stageEnteredAt: "2026-01-05T09:00:00.000Z",
    lastActivityAt: "2026-01-05T09:00:00.000Z",
  };
}

function acceptUpdateAndReturn(nextProfile: CandidateProfile) {
  harness.updateCandidate.mockImplementation(async () => {
    harness.profile = nextProfile;
    return updatedCandidate();
  });
}

async function renderProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <CandidateProfilePage />
    </QueryClientProvider>,
  );

  await screen.findAllByText("Amara Okafor");
}

function stageButton(name: string) {
  return screen.getByRole("button", { name });
}

async function moveToShortlist(user: ReturnType<typeof userEvent.setup>) {
  await user.click(stageButton("Applied"));
  await user.click(screen.getByRole("button", { name: "Shortlist" }));
}

async function settled() {
  await waitFor(() => expect(harness.getProfile).toHaveBeenCalledTimes(2));
}

beforeEach(() => {
  harness.profile = makeProfile();
  harness.notes = [];
  harness.getProfile.mockImplementation(async () => harness.profile);
  harness.listNotes.mockImplementation(async () => harness.notes);
  harness.listByPosition.mockResolvedValue([]);
  harness.addNote.mockReset();
  harness.updateCandidate.mockReset();
  harness.updatePerson.mockReset();
  harness.setRemindersStopped.mockReset();
  harness.resendQuestionnaire.mockReset();
  harness.push.mockReset();
  harness.searchParams = new URLSearchParams();
  harness.candidateId = "application-1";
  sessionStorage.clear();
  localStorage.clear();
  forgetScreeningQueuesInMemory();
  forgetCollapsedPreferencesInMemory();
});

describe("CandidateProfilePage stage change", () => {
  it("shows the new stage when the server accepts the move", async () => {
    const user = userEvent.setup();
    acceptUpdateAndReturn(profileInStage("stage-2"));
    await renderProfile();

    await moveToShortlist(user);

    expect(await screen.findByRole("button", { name: "Shortlist" })).toBeInTheDocument();
    await waitFor(() => expect(harness.getProfile).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Shortlist" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends the chosen stage to the server", async () => {
    const user = userEvent.setup();
    acceptUpdateAndReturn(profileInStage("stage-2"));
    await renderProfile();

    await moveToShortlist(user);

    expect(harness.updateCandidate).toHaveBeenCalledWith("application-1", { stageId: "stage-2" });
  });

  it("puts the candidate back in their old stage when the move fails", async () => {
    const user = userEvent.setup();
    harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await moveToShortlist(user);
    await settled();

    expect(stageButton("Applied")).toBeInTheDocument();
    expect(screen.queryByText("Shortlist")).toBeNull();
  });

  it("says why the move failed instead of failing quietly", async () => {
    const user = userEvent.setup();
    harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await moveToShortlist(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t move this candidate");
    expect(screen.getByRole("alert")).toHaveTextContent("Database is down");
  });
});

describe("CandidateProfilePage moving to the stage they are already in", () => {
  it("closes the menu and sends nothing", async () => {
    const user = userEvent.setup();
    await renderProfile();

    await user.click(stageButton("Applied"));
    const [, currentStageOption] = screen.getAllByRole("button", { name: "Applied" });
    await user.click(currentStageOption!);

    expect(harness.updateCandidate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Shortlist" })).toBeNull();
  });
});

describe("CandidateProfilePage star toggle", () => {
  it("stars the candidate when the server accepts it", async () => {
    const user = userEvent.setup();
    acceptUpdateAndReturn(profileStarred(true));
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Star" }));

    expect(await screen.findByRole("button", { name: "Unstar" })).toBeInTheDocument();
    expect(harness.updateCandidate).toHaveBeenCalledWith("application-1", { starred: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves the candidate unstarred when the server refuses", async () => {
    const user = userEvent.setup();
    harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Star" }));
    await settled();

    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unstar" })).toBeNull();
  });

  it("says why the star could not be set", async () => {
    const user = userEvent.setup();
    harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Star" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t star this candidate");
    expect(screen.getByRole("alert")).toHaveTextContent("Database is down");
  });

  it("leaves an already starred candidate starred when unstarring fails", async () => {
    const user = userEvent.setup();
    harness.profile = profileStarred(true);
    harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Unstar" }));
    await settled();

    expect(screen.getByRole("button", { name: "Unstar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Star" })).toBeNull();
  });
});

describe("CandidateProfilePage internal notes", () => {
  const NOTE = "Strong systems answer, move fast";

  it("posts the note and clears the box when the server accepts it", async () => {
    const user = userEvent.setup();
    harness.addNote.mockImplementation(async (_id: string, body: string) => makeNote(body));
    await renderProfile();

    const box = screen.getByPlaceholderText("Write a note for the team…");
    await user.type(box, NOTE);
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(box).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps what was typed when the note cannot be saved", async () => {
    const user = userEvent.setup();
    harness.addNote.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    const box = screen.getByPlaceholderText("Write a note for the team…");
    await user.type(box, NOTE);
    await user.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(harness.addNote).toHaveBeenCalledTimes(1));

    expect(box).toHaveValue(NOTE);
    expect(screen.getByText("No notes yet. Add the first one below.")).toBeInTheDocument();
  });

  it("says why the note could not be saved", async () => {
    const user = userEvent.setup();
    harness.addNote.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await user.type(screen.getByPlaceholderText("Write a note for the team…"), NOTE);
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t save this note");
    expect(screen.getByRole("alert")).toHaveTextContent("Database is down");
  });
});

describe("CandidateProfilePage custom attributes", () => {
  beforeEach(() => {
    const base = makeProfile();
    harness.profile = {
      ...base,
      person: { ...base.person, customAttributes: { Seniority: "Staff" } },
    };
  });

  it("saves the edited attribute when the server accepts it", async () => {
    const user = userEvent.setup();
    harness.updatePerson.mockResolvedValue({ ok: true });
    await renderProfile();

    const value = screen.getByDisplayValue("Staff");
    await user.clear(value);
    await user.type(value, "Principal");
    await user.tab();

    await waitFor(() =>
      expect(harness.updatePerson).toHaveBeenCalledWith("person-1", {
        customAttributes: { Seniority: "Principal" },
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says the attribute was not saved and keeps the edit when the server refuses", async () => {
    const user = userEvent.setup();
    harness.updatePerson.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    const value = screen.getByDisplayValue("Staff");
    await user.clear(value);
    await user.type(value, "Principal");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t save the custom attributes",
    );
    expect(screen.getByDisplayValue("Principal")).toBeInTheDocument();
  });
});

describe("CandidateProfilePage questionnaire reminders", () => {
  beforeEach(() => {
    const base = makeProfile();
    harness.profile = {
      ...base,
      questionnaires: [
        {
          id: "response-1",
          name: "Video screening",
          context: "stage_sent",
          status: "pending",
          sentAt: "2026-02-01T10:00:00.000Z",
          completedAt: null,
          remindersStoppedAt: null,
          pendingReminders: 2,
          linkExpiresAt: "2026-12-01T10:00:00.000Z",
          questionCount: 3,
          answers: [],
        },
      ],
    };
  });

  function withQuestionnaire(patch: Partial<QuestionnaireResponseDetail>) {
    const current = harness.profile as CandidateProfile;
    const [first] = current.questionnaires;
    harness.profile = { ...current, questionnaires: [{ ...first!, ...patch }] };
  }

  // A pending questionnaire has no answers yet, and the card used to count
  // answers, so it said "0 questions".
  it("shows how many questions the questionnaire has, not how many are answered", async () => {
    await renderProfile();
    await userEvent.setup().click(screen.getByRole("button", { name: /Questionnaires/ }));
    expect(screen.getByText(/· 3 questions/)).toBeInTheDocument();
  });

  // The button only appeared for stage-sent questionnaires, so reminders on a
  // bulk or manual send could not be stopped at all.
  it("offers Stop reminders on a manually sent questionnaire that is still being chased", async () => {
    withQuestionnaire({ context: "manual_sent" });
    await renderProfile();
    await userEvent.setup().click(screen.getByRole("button", { name: /Questionnaires/ }));
    expect(screen.getByRole("button", { name: "Stop reminders" })).toBeInTheDocument();
  });

  it("does not claim reminders are chasing when none are queued", async () => {
    withQuestionnaire({ context: "manual_sent", pendingReminders: 0 });
    await renderProfile();
    await userEvent.setup().click(screen.getByRole("button", { name: /Questionnaires/ }));
    expect(screen.queryByRole("button", { name: "Stop reminders" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Reminders keep chasing/)).not.toBeInTheDocument();
  });

  it("says the reminders are unchanged when the server refuses to stop them", async () => {
    const user = userEvent.setup();
    harness.setRemindersStopped.mockRejectedValue(SERVER_REFUSED);
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /Questionnaires/ }));
    await user.click(screen.getByRole("button", { name: "Stop reminders" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t change the reminders");
    expect(screen.getByRole("button", { name: "Stop reminders" })).toBeInTheDocument();
  });
});

describe("CandidateProfilePage sending a questionnaire again", () => {
  function withQuestionnaire(patch: Partial<QuestionnaireResponseDetail>) {
    harness.profile = {
      ...makeProfile(),
      questionnaires: [
        {
          id: "response-1",
          name: "Video screening",
          context: "manual_sent",
          status: "pending",
          sentAt: "2026-02-01T10:00:00.000Z",
          completedAt: null,
          remindersStoppedAt: null,
          pendingReminders: 0,
          linkExpiresAt: "2026-12-01T10:00:00.000Z",
          questionCount: 3,
          answers: [],
          ...patch,
        },
      ],
    };
  }

  // The button was a permanently disabled placeholder.
  it("lets you send a questionnaire from the profile", async () => {
    withQuestionnaire({});
    await renderProfile();
    await userEvent.setup().click(screen.getByRole("button", { name: /Questionnaires/ }));
    expect(screen.getByRole("button", { name: "Send questionnaire" })).toBeEnabled();
  });

  it("resends a pending questionnaire with a fresh link at once", async () => {
    const user = userEvent.setup();
    withQuestionnaire({ status: "pending" });
    harness.resendQuestionnaire.mockResolvedValue({
      mode: "resent",
      questionnaireResponseId: "response-1",
    });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /Questionnaires/ }));
    await user.click(screen.getByRole("button", { name: "Resend" }));

    expect(harness.resendQuestionnaire).toHaveBeenCalledWith("response-1");
    expect(await screen.findByText(/Resent with a fresh link/)).toBeInTheDocument();
  });

  it("asks before sending a completed questionnaire again, and does nothing on Cancel", async () => {
    const user = userEvent.setup();
    withQuestionnaire({ status: "completed", completedAt: "2026-02-02T10:00:00.000Z" });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /Questionnaires/ }));
    await user.click(screen.getByRole("button", { name: "Send again" }));

    expect(screen.getByText(/Ask them to fill this in again/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(harness.resendQuestionnaire).not.toHaveBeenCalled();
  });

  it("sends a completed questionnaire again once confirmed", async () => {
    const user = userEvent.setup();
    withQuestionnaire({ status: "completed", completedAt: "2026-02-02T10:00:00.000Z" });
    harness.resendQuestionnaire.mockResolvedValue({
      mode: "asked_again",
      questionnaireResponseId: "response-2",
    });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /Questionnaires/ }));
    await user.click(screen.getByRole("button", { name: "Send again" }));
    const confirm = screen.getAllByRole("button", { name: "Send again" }).at(-1)!;
    await user.click(confirm);

    expect(harness.resendQuestionnaire).toHaveBeenCalledWith("response-1");
    expect(await screen.findByText(/Sent again/)).toBeInTheDocument();
  });

  it("says why when the server refuses", async () => {
    const user = userEvent.setup();
    withQuestionnaire({ status: "pending" });
    harness.resendQuestionnaire.mockRejectedValue({
      response: { status: 409, data: { error: "The questionnaire link could not be issued" } },
    });
    await renderProfile();

    await user.click(screen.getByRole("button", { name: /Questionnaires/ }));
    await user.click(screen.getByRole("button", { name: "Resend" }));

    expect(await screen.findByText(/could not be issued/)).toBeInTheDocument();
  });
});

describe("CandidateProfilePage Email button", () => {
  // It used to be a permanently disabled placeholder: it looked like the way
  // to email the candidate and did nothing.
  it("opens the composer for this candidate", async () => {
    harness.push.mockReset();
    const user = userEvent.setup();
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Email" }));

    expect(harness.push).toHaveBeenCalledWith("/compose?applicationId=application-1");
  });

  it("tells the composer to come back to the board context it was opened from", async () => {
    const user = userEvent.setup();
    harness.searchParams = new URLSearchParams("position=position-1&starred=1");
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Email" }));

    const href = harness.push.mock.calls.at(-1)?.[0] as string;
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("applicationId")).toBe("application-1");
    expect(params.get("returnTo")).toBe("/candidates/application-1?position=position-1&starred=1");
  });
});

describe("CandidateProfilePage walking a board column", () => {
  const QUEUE_SEARCH = "position=position-1&stages=stage-1&queue=stage-1";
  const QUEUE_KEY = `openhr:screening-queue:${QUEUE_SEARCH}`;

  let board: Candidate[];

  function boardCandidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
    return {
      ...updatedCandidate(),
      id,
      firstName: id,
      stageId: "stage-1",
      starred: false,
      ...overrides,
    };
  }

  function snapshot(applicationIds: string[]) {
    writeScreeningQueue(QUEUE_KEY, {
      version: 1,
      positionId: "position-1",
      stageId: "stage-1",
      includeArchived: false,
      applicationIds,
      createdAt: new Date().toISOString(),
    });
  }

  async function renderInLayout() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const tree = () => (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <CandidatesLayout>
            <CandidateProfilePage />
          </CandidatesLayout>
        </ToastProvider>
      </QueryClientProvider>
    );
    const view = render(tree());

    await screen.findAllByText("Amara Okafor");
    return {
      openCandidate: (applicationId: string) => {
        harness.candidateId = applicationId;
        view.rerender(tree());
      },
    };
  }

  function arrow(label: "Previous candidate" | "Next candidate") {
    return screen.getByRole("link", { name: label });
  }

  function profileHref(applicationId: string) {
    return `/candidates/${applicationId}?${QUEUE_SEARCH}`;
  }

  beforeEach(() => {
    harness.searchParams = new URLSearchParams(QUEUE_SEARCH);
    board = [
      boardCandidate("application-0"),
      boardCandidate("application-1"),
      boardCandidate("application-2"),
    ];
    harness.listByPosition.mockImplementation(async () => board);
    harness.updateCandidate.mockImplementation(async () => {
      board = board.map((c) => (c.id === "application-1" ? { ...c, stageId: "stage-2" } : c));
      harness.profile = profileInStage("stage-2");
      return updatedCandidate();
    });
  });

  it("walks the snapshot taken on the board, in its order rather than the live order", async () => {
    snapshot(["application-2", "application-1", "application-0"]);
    await renderInLayout();

    expect(await screen.findByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
    expect(arrow("Previous candidate")).toHaveAttribute("href", profileHref("application-2"));
    expect(arrow("Next candidate")).toHaveAttribute("href", profileHref("application-0"));
  });

  it("opens the composer with a way back to this candidate in the same column", async () => {
    const user = userEvent.setup();
    snapshot(["application-0", "application-1", "application-2"]);
    await renderInLayout();
    await screen.findByText("Applied · 2 of 3 · 3 left");

    await user.click(screen.getByRole("button", { name: "Email" }));

    const href = harness.push.mock.calls.at(-1)?.[0] as string;
    expect(new URL(href, "http://localhost").searchParams.get("returnTo")).toBe(
      profileHref("application-1"),
    );
  });

  it("keeps both arrows after the candidate is moved out of the filtered column", async () => {
    const user = userEvent.setup();
    snapshot(["application-0", "application-1", "application-2"]);
    await renderInLayout();
    await screen.findByText("Applied · 2 of 3 · 3 left");

    await moveToShortlist(user);

    expect(await screen.findByText("Applied · 2 of 3 · 2 left")).toBeInTheDocument();
    await waitFor(() => expect(harness.listByPosition).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Applied · 2 of 3 · 2 left")).toBeInTheDocument();
    expect(arrow("Previous candidate")).toHaveAttribute("href", profileHref("application-0"));
    expect(arrow("Next candidate")).toHaveAttribute("href", profileHref("application-2"));
  });

  it("rebuilds the snapshot from the live board when there is none, and saves it", async () => {
    await renderInLayout();

    expect(await screen.findByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
    expect(arrow("Next candidate")).toHaveAttribute("href", profileHref("application-2"));
    forgetScreeningQueuesInMemory();
    expect(readScreeningQueue(QUEUE_KEY)?.applicationIds).toEqual([
      "application-0",
      "application-1",
      "application-2",
    ]);
  });

  it("keeps the current candidate when a rebuild under Unseen only would leave them out", async () => {
    const search = "position=position-1&unseen=1&queue=stage-1";
    harness.searchParams = new URLSearchParams(search);
    board = [
      boardCandidate("application-0", { seen: false }),
      boardCandidate("application-1", { seen: true }),
      boardCandidate("application-2", { seen: false }),
    ];
    await renderInLayout();

    expect(await screen.findByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
    expect(arrow("Previous candidate")).toHaveAttribute(
      "href",
      `/candidates/application-0?${search}`,
    );
    expect(arrow("Next candidate")).toHaveAttribute("href", `/candidates/application-2?${search}`);
    expect(screen.getByRole("navigation", { name: "Screening list" })).toBeInTheDocument();
    forgetScreeningQueuesInMemory();
    expect(readScreeningQueue(`openhr:screening-queue:${search}`)?.applicationIds).toEqual([
      "application-0",
      "application-1",
      "application-2",
    ]);
  });

  it("rebuilds a snapshot older than twelve hours", async () => {
    writeScreeningQueue(QUEUE_KEY, {
      version: 1,
      positionId: "position-1",
      stageId: "stage-1",
      includeArchived: false,
      applicationIds: ["application-1", "application-9"],
      createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    });
    await renderInLayout();

    expect(await screen.findByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
  });

  it("falls back to the live board, without the queue, when this candidate is not in the snapshot", async () => {
    snapshot(["application-0", "application-2"]);
    await renderInLayout();

    await waitFor(() =>
      expect(arrow("Next candidate")).toHaveAttribute(
        "href",
        "/candidates/application-2?position=position-1&stages=stage-1",
      ),
    );
    expect(screen.queryByText(/ left$/)).toBeNull();
  });

  it("falls back to the live board when the queued stage is not in this pipeline", async () => {
    harness.searchParams = new URLSearchParams("position=position-1&queue=stage-gone");
    await renderInLayout();

    await waitFor(() =>
      expect(arrow("Next candidate")).toHaveAttribute(
        "href",
        "/candidates/application-2?position=position-1",
      ),
    );
    expect(screen.queryByText(/ left$/)).toBeNull();
  });

  describe("screening list", () => {
    function screeningList() {
      return screen.queryByRole("navigation", { name: "Screening list" });
    }

    it("lists the column beside the profile while walking a queue", async () => {
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();

      const list = await screen.findByRole("navigation", { name: "Screening list" });
      expect(within(list).getByText("3 left")).toBeInTheDocument();
      expect(within(list).getAllByRole("link")).toHaveLength(3);
      expect(within(list).getByRole("link", { current: "page" })).toHaveAttribute(
        "href",
        profileHref("application-1"),
      );
      expect(within(list).getByRole("link", { name: /application-2/ })).toHaveAttribute(
        "href",
        profileHref("application-2"),
      );
    });

    it("greys out the candidate once they are moved, and keeps them in the list", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await moveToShortlist(user);

      const list = await screen.findByRole("navigation", { name: "Screening list" });
      expect(await within(list).findByText("→ Shortlist")).toBeInTheDocument();
      expect(within(list).getByText("2 left")).toBeInTheDocument();
      expect(within(list).getAllByRole("link")).toHaveLength(3);
    });

    it("stays on screen while the next candidate loads", async () => {
      snapshot(["application-0", "application-1", "application-2"]);
      const { openCandidate } = await renderInLayout();
      await screen.findByRole("navigation", { name: "Screening list" });
      harness.getProfile.mockImplementation(() => new Promise(() => {}));

      openCandidate("application-2");

      expect(await screen.findByText("Loading candidate…")).toBeInTheDocument();
      const list = screen.getByRole("navigation", { name: "Screening list" });
      expect(within(list).getByRole("link", { current: "page" })).toHaveAttribute(
        "href",
        profileHref("application-2"),
      );
    });

    it("is not shown without a queue", async () => {
      harness.searchParams = new URLSearchParams("position=position-1&stages=stage-1");
      await renderInLayout();

      await waitFor(() => expect(arrow("Next candidate")).toBeInTheDocument());
      expect(screeningList()).toBeNull();
    });

    it("is not shown when this candidate is not in the snapshot", async () => {
      snapshot(["application-0", "application-2"]);
      await renderInLayout();

      await waitFor(() =>
        expect(arrow("Next candidate")).toHaveAttribute(
          "href",
          "/candidates/application-2?position=position-1&stages=stage-1",
        ),
      );
      expect(screeningList()).toBeNull();
    });
  });

  describe("keyboard shortcuts", () => {
    it("opens the next and previous candidates in the column with J and K", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      const { openCandidate } = await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await user.keyboard("j");
      expect(harness.push).toHaveBeenLastCalledWith(profileHref("application-2"));

      openCandidate("application-2");
      await screen.findByText("Applied · 3 of 3 · 3 left");
      await user.keyboard("{ArrowLeft}");
      expect(harness.push).toHaveBeenLastCalledWith(profileHref("application-1"));
      expect(harness.push).toHaveBeenCalledTimes(2);
    });

    it("opens the next candidate once when J is pressed again before it loads", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await user.keyboard("jj");

      expect(harness.push).toHaveBeenCalledTimes(1);
      expect(harness.push).toHaveBeenCalledWith(profileHref("application-2"));
    });

    it("hints at the keys on the arrows", async () => {
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      expect(arrow("Previous candidate")).toHaveAttribute("title", "Previous (K)");
      expect(arrow("Next candidate")).toHaveAttribute("title", "Next (J)");
    });

    it("does nothing while typing a note", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await user.type(screen.getByPlaceholderText("Write a note for the team…"), "jk");

      expect(harness.push).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText("Write a note for the team…")).toHaveValue("jk");
    });

    it("does nothing while the stage menu is open", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await user.click(stageButton("Applied"));
      await user.keyboard("j{ArrowRight}");

      expect(harness.push).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Shortlist" })).toBeInTheDocument();
    });

    it("is off without a queue", async () => {
      const user = userEvent.setup();
      harness.searchParams = new URLSearchParams("position=position-1&stages=stage-1");
      await renderInLayout();
      await waitFor(() =>
        expect(arrow("Next candidate")).toHaveAttribute(
          "href",
          "/candidates/application-2?position=position-1&stages=stage-1",
        ),
      );

      await user.keyboard("jk{ArrowRight}{ArrowLeft}");

      expect(harness.push).not.toHaveBeenCalled();
      expect(arrow("Next candidate")).not.toHaveAttribute("title");
    });
  });

  it("falls back when the queue belongs to another position", async () => {
    harness.searchParams = new URLSearchParams("position=position-2&queue=stage-1");
    await renderInLayout();

    expect(screen.queryByRole("link", { name: "Next candidate" })).toBeNull();
    expect(screen.queryByText(/ left$/)).toBeNull();
  });
  describe("moving a pending candidate", () => {
    function moveOnTheServer() {
      harness.updateCandidate.mockImplementation(async (id: string, patch: { stageId: string }) => {
        board = board.map((c) => (c.id === id ? { ...c, stageId: patch.stageId } : c));
        if (id === "application-1") harness.profile = profileInStage(patch.stageId);
        return { ...updatedCandidate(), id, stageId: patch.stageId };
      });
    }

    beforeEach(() => {
      board = board.map((c) =>
        c.id === "application-1" ? { ...c, firstName: "Amara", lastName: "Okafor" } : c,
      );
      moveOnTheServer();
    });

    it("goes straight to the next pending candidate in the column", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await moveToShortlist(user);

      expect(harness.updateCandidate).toHaveBeenCalledWith("application-1", {
        stageId: "stage-2",
      });
      expect(harness.push).toHaveBeenCalledTimes(1);
      expect(harness.push).toHaveBeenCalledWith(profileHref("application-2"));
    });

    it("skips candidates who have already been handled", async () => {
      const user = userEvent.setup();
      board = [
        ...board.map((c) => (c.id === "application-2" ? { ...c, stageId: "stage-2" } : c)),
        boardCandidate("application-3", { archived: true }),
        boardCandidate("application-4"),
      ];
      snapshot(["application-1", "application-2", "application-3", "application-4"]);
      await renderInLayout();
      await screen.findByText("Applied · 1 of 4 · 2 left");

      await moveToShortlist(user);

      expect(harness.push).toHaveBeenCalledWith(profileHref("application-4"));
    });

    it("wraps to the first pending candidate before this one when none is left after it", async () => {
      const user = userEvent.setup();
      board = board.map((c) => (c.id === "application-2" ? { ...c, stageId: "stage-2" } : c));
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 2 left");

      await moveToShortlist(user);

      expect(harness.push).toHaveBeenCalledWith(profileHref("application-0"));
    });

    it("stays put and says the column is done when nobody is left", async () => {
      const user = userEvent.setup();
      board = board.map((c) => (c.id === "application-1" ? c : { ...c, stageId: "stage-2" }));
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 1 left");
      expect(screen.queryByText("All done in Applied")).toBeNull();

      await moveToShortlist(user);

      expect(await screen.findByText("All done in Applied")).toBeInTheDocument();
      expect(harness.push).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Back to board" }));
      expect(harness.push).toHaveBeenCalledWith("/positions/position-1/board");
    });

    it("says who was moved where, with an Undo", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await moveToShortlist(user);

      const toast = screen.getByRole("status");
      await waitFor(() => expect(toast).toHaveTextContent("Moved Amara Okafor to Shortlist"));
      expect(within(toast).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    });

    it("puts the candidate back in their stage and returns to them on Undo", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");
      await moveToShortlist(user);
      harness.push.mockClear();

      await user.click(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() =>
        expect(harness.updateCandidate).toHaveBeenLastCalledWith("application-1", {
          stageId: "stage-1",
        }),
      );
      await waitFor(() => expect(harness.push).toHaveBeenCalledWith(profileHref("application-1")));
      expect(harness.updateCandidate).toHaveBeenCalledTimes(2);
      expect(await screen.findByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
    });

    it("waits for the move to land before undoing it", async () => {
      const user = userEvent.setup();
      let finishMove: () => void = () => {};
      harness.updateCandidate.mockImplementationOnce(
        (id: string, patch: { stageId: string }) =>
          new Promise((resolve) => {
            finishMove = () => {
              board = board.map((c) => (c.id === id ? { ...c, stageId: patch.stageId } : c));
              resolve({ ...updatedCandidate(), id, stageId: patch.stageId });
            };
          }),
      );
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");
      await moveToShortlist(user);

      await user.click(await screen.findByRole("button", { name: "Undo" }));
      expect(harness.updateCandidate).toHaveBeenCalledTimes(1);

      finishMove();

      await waitFor(() => expect(harness.updateCandidate).toHaveBeenCalledTimes(2));
      expect(harness.updateCandidate).toHaveBeenLastCalledWith("application-1", {
        stageId: "stage-1",
      });
    });

    it("says the undo failed and offers to open the candidate", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");
      await moveToShortlist(user);
      await waitFor(() =>
        expect(screen.getByText("Applied · 2 of 3 · 2 left")).toBeInTheDocument(),
      );
      harness.updateCandidate.mockRejectedValueOnce(SERVER_REFUSED);
      harness.push.mockClear();

      await user.click(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Couldn’t undo, Amara Okafor is still in Shortlist",
        ),
      );
      expect(harness.push).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(harness.push).toHaveBeenCalledWith(profileHref("application-1"));
    });

    it("rolls back and says so when the move fails, with a way back to them", async () => {
      const user = userEvent.setup();
      harness.updateCandidate.mockRejectedValue(SERVER_REFUSED);
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await moveToShortlist(user);

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Couldn’t move Amara Okafor, they’re still in Applied",
        ),
      );
      expect(screen.getByText("Applied · 2 of 3 · 3 left")).toBeInTheDocument();
      expect(stageButton("Applied")).toBeInTheDocument();
      expect(harness.push).toHaveBeenCalledWith(profileHref("application-2"));

      harness.push.mockClear();
      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(harness.push).toHaveBeenCalledWith(profileHref("application-1"));
    });

    it("sends nothing and stays when the stage is the one they are already in", async () => {
      const user = userEvent.setup();
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 3 left");

      await user.click(stageButton("Applied"));
      const [, currentStageOption] = screen.getAllByRole("button", { name: "Applied" });
      await user.click(currentStageOption!);

      expect(harness.updateCandidate).not.toHaveBeenCalled();
      expect(harness.push).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("keeps today's behaviour for a candidate in the queue who is no longer pending", async () => {
      const user = userEvent.setup();
      board = board.map((c) => (c.id === "application-1" ? { ...c, stageId: "stage-2" } : c));
      harness.profile = profileInStage("stage-2");
      snapshot(["application-0", "application-1", "application-2"]);
      await renderInLayout();
      await screen.findByText("Applied · 2 of 3 · 2 left");

      await user.click(stageButton("Shortlist"));
      await user.click(screen.getByRole("button", { name: "Applied" }));

      await waitFor(() =>
        expect(harness.updateCandidate).toHaveBeenCalledWith("application-1", {
          stageId: "stage-1",
        }),
      );
      expect(harness.push).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("keeps today's behaviour when there is no queue", async () => {
      const user = userEvent.setup();
      harness.searchParams = new URLSearchParams("position=position-1&stages=stage-1");
      await renderInLayout();

      await moveToShortlist(user);

      await waitFor(() =>
        expect(harness.updateCandidate).toHaveBeenCalledWith("application-1", {
          stageId: "stage-2",
        }),
      );
      expect(harness.push).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });
});
