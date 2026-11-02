import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetCollapsedPreferencesInMemory } from "@/hooks/use-collapsed-preference";
import { emptyCandidateFilters } from "@/utilities/candidate-filters";
import type { CandidateNavigationContext } from "@/utilities/candidate-navigation";
import type { ScreeningQueueRow } from "@/utilities/screening-queue";
import { SCREENING_PANEL_COLLAPSED_KEY, ScreeningQueuePanel } from "./screening-queue-panel";

const CONTEXT: CandidateNavigationContext = {
  positionId: "position-1",
  filters: emptyCandidateFilters(),
  queueStageId: "stage-1",
};

function row(
  overrides: Partial<ScreeningQueueRow> & { id: string; name: string },
): ScreeningQueueRow {
  return {
    starred: false,
    archived: false,
    stageName: "Applied",
    pending: true,
    current: false,
    ...overrides,
  };
}

const ROWS: ScreeningQueueRow[] = [
  row({ id: "application-1", name: "Ada Lovelace", starred: true }),
  row({ id: "application-2", name: "Grace Hopper", current: true }),
  row({ id: "application-3", name: "Alan Turing", pending: false, stageName: "Shortlist" }),
  row({ id: "application-4", name: "Edsger Dijkstra", pending: false, archived: true }),
];

function renderPanel(rows: ScreeningQueueRow[] = ROWS) {
  return render(<ScreeningQueuePanel stageName="Applied" rows={rows} left={2} context={CONTEXT} />);
}

function panel() {
  return screen.getByRole("navigation", { name: "Screening list" });
}

function rowLink(name: string) {
  return within(panel()).getByRole("link", { name: new RegExp(name) });
}

beforeEach(() => {
  localStorage.clear();
  forgetCollapsedPreferencesInMemory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScreeningQueuePanel", () => {
  it("names the column and how many are left in it", () => {
    renderPanel();

    expect(within(panel()).getByText("Applied")).toBeInTheDocument();
    expect(within(panel()).getByText("2 left")).toBeInTheDocument();
  });

  it("lists every candidate from the snapshot, in order", () => {
    renderPanel();

    const names = within(panel())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual([
      expect.stringContaining("Ada Lovelace"),
      expect.stringContaining("Grace Hopper"),
      expect.stringContaining("Alan Turing"),
      expect.stringContaining("Edsger Dijkstra"),
    ]);
  });

  it("marks starred candidates", () => {
    renderPanel();

    expect(within(rowLink("Ada Lovelace")).getByText("Starred")).toBeInTheDocument();
    expect(within(rowLink("Grace Hopper")).queryByText("Starred")).toBeNull();
  });

  it("highlights the candidate on screen as the current page", () => {
    renderPanel();

    expect(rowLink("Grace Hopper")).toHaveAttribute("aria-current", "page");
    expect(rowLink("Ada Lovelace")).not.toHaveAttribute("aria-current");
  });

  it("scrolls the current candidate into view", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderPanel();
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts[0]).toBe(rowLink("Grace Hopper"));
  });

  it("keeps handled candidates listed, greyed, with where they went", () => {
    renderPanel();

    expect(within(rowLink("Alan Turing")).getByText("→ Shortlist")).toBeInTheDocument();
    expect(within(rowLink("Alan Turing")).getByText("Alan Turing")).toHaveClass("text-slate-400");
    expect(within(rowLink("Edsger Dijkstra")).getByText("→ Archived")).toBeInTheDocument();
    expect(within(rowLink("Ada Lovelace")).queryByText(/→/)).toBeNull();
    expect(within(rowLink("Ada Lovelace")).getByText("Ada Lovelace")).not.toHaveClass(
      "text-slate-400",
    );
  });

  it("links each candidate with the queue kept in the URL", () => {
    renderPanel();

    expect(rowLink("Alan Turing")).toHaveAttribute(
      "href",
      "/candidates/application-3?position=position-1&queue=stage-1",
    );
  });

  it("is open by default", () => {
    renderPanel();

    expect(rowLink("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse screening list" })).toBeInTheDocument();
  });

  it("collapses to a strip and remembers it the next time it opens", async () => {
    const user = userEvent.setup();
    const first = renderPanel();

    await user.click(screen.getByRole("button", { name: "Collapse screening list" }));

    expect(within(panel()).queryByRole("link")).toBeNull();
    expect(localStorage.getItem(SCREENING_PANEL_COLLAPSED_KEY)).toBe("true");

    first.unmount();
    forgetCollapsedPreferencesInMemory();
    renderPanel();

    expect(within(panel()).queryByRole("link")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Expand screening list" }));
    expect(rowLink("Ada Lovelace")).toBeInTheDocument();
    expect(localStorage.getItem(SCREENING_PANEL_COLLAPSED_KEY)).toBeNull();
  });

  it("opens when storage cannot be read", () => {
    localStorage.setItem(SCREENING_PANEL_COLLAPSED_KEY, "true");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    renderPanel();

    expect(rowLink("Ada Lovelace")).toBeInTheDocument();
  });

  it("still collapses for this visit when storage cannot be written", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Collapse screening list" }));

    expect(within(panel()).queryByRole("link")).toBeNull();
  });

  describe("on a medium screen", () => {
    async function openCollapsedOverlay(user: ReturnType<typeof userEvent.setup>) {
      localStorage.setItem(SCREENING_PANEL_COLLAPSED_KEY, "true");
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Show screening list" }));
      expect(rowLink("Ada Lovelace")).toBeInTheDocument();
    }

    it("opens the list over the page without changing the saved preference", async () => {
      const user = userEvent.setup();
      await openCollapsedOverlay(user);

      expect(screen.getByRole("button", { name: "Show screening list" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(localStorage.getItem(SCREENING_PANEL_COLLAPSED_KEY)).toBe("true");
    });

    it("closes the overlay on Escape", async () => {
      const user = userEvent.setup();
      await openCollapsedOverlay(user);

      await user.keyboard("{Escape}");

      expect(within(panel()).queryByRole("link")).toBeNull();
    });

    it("closes the overlay on a click outside it", async () => {
      const user = userEvent.setup();
      await openCollapsedOverlay(user);

      await user.click(document.body);

      expect(within(panel()).queryByRole("link")).toBeNull();
    });

    it("closes the overlay when a candidate is picked", async () => {
      const user = userEvent.setup();
      await openCollapsedOverlay(user);
      const stayOnThisDocument = (event: MouseEvent) => event.preventDefault();
      document.addEventListener("click", stayOnThisDocument);

      await user.click(rowLink("Alan Turing"));
      document.removeEventListener("click", stayOnThisDocument);

      expect(within(panel()).queryByRole("link")).toBeNull();
    });
  });
});
