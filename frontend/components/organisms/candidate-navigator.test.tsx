import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { emptyCandidateFilters } from "@/utilities/candidate-filters";
import { NO_NEIGHBOURS, type CandidateNavigationContext } from "@/utilities/candidate-navigation";
import { CandidateNavigator } from "./candidate-navigator";

const CONTEXT: CandidateNavigationContext = {
  positionId: "position-1",
  filters: { ...emptyCandidateFilters(), starredOnly: true },
};

describe("CandidateNavigator", () => {
  it("links to the candidate on either side of the filtered view", () => {
    render(
      <CandidateNavigator
        context={CONTEXT}
        neighbours={{ previousId: "application-1", nextId: "application-3" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Previous candidate" })).toHaveAttribute(
      "href",
      "/candidates/application-1?position=position-1&starred=1",
    );
    expect(screen.getByRole("link", { name: "Next candidate" })).toHaveAttribute(
      "href",
      "/candidates/application-3?position=position-1&starred=1",
    );
  });

  it("carries the board's filters forward, so the next step iterates the same set", () => {
    render(
      <CandidateNavigator context={CONTEXT} neighbours={{ previousId: null, nextId: "next-id" }} />,
    );

    expect(screen.getByRole("link", { name: "Next candidate" })).toHaveAttribute(
      "href",
      expect.stringContaining("starred=1"),
    );
  });

  it("disables the end of the set rather than wrapping round to the wrong candidate", () => {
    render(
      <CandidateNavigator
        context={CONTEXT}
        neighbours={{ previousId: "application-1", nextId: null }}
      />,
    );

    expect(screen.getByRole("link", { name: "Next candidate" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next candidate" })).not.toHaveAttribute("href");
  });

  it("shows no navigation at all when the profile was opened with no board context", () => {
    render(<CandidateNavigator context={null} neighbours={NO_NEIGHBOURS} />);

    expect(screen.queryByRole("link", { name: "Previous candidate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Next candidate" })).not.toBeInTheDocument();
  });

  it("offers neither direction when the context is stale and matches nobody", () => {
    render(<CandidateNavigator context={CONTEXT} neighbours={NO_NEIGHBOURS} />);

    for (const label of ["Previous candidate", "Next candidate"]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("shows how far through the column the recruiter is, next to the arrows", () => {
    render(
      <CandidateNavigator
        context={{ ...CONTEXT, queueStageId: "stage-1" }}
        neighbours={{ previousId: "application-1", nextId: "application-3" }}
        progressLabel="Applied · 3 of 7 · 5 left"
      />,
    );

    expect(screen.getByText("Applied · 3 of 7 · 5 left")).toBeInTheDocument();
  });

  it("keeps the column in the links, so the next profile walks the same snapshot", () => {
    render(
      <CandidateNavigator
        context={{ ...CONTEXT, queueStageId: "stage-1" }}
        neighbours={{ previousId: null, nextId: "application-3" }}
        progressLabel="Applied · 1 of 2 · 2 left"
      />,
    );

    expect(screen.getByRole("link", { name: "Next candidate" })).toHaveAttribute(
      "href",
      "/candidates/application-3?position=position-1&starred=1&queue=stage-1",
    );
  });

  it("shows no count when it walks the whole board", () => {
    render(
      <CandidateNavigator
        context={CONTEXT}
        neighbours={{ previousId: "application-1", nextId: "application-3" }}
      />,
    );

    expect(screen.queryByText(/ left$/)).not.toBeInTheDocument();
  });

  it("shows no count either when there is no board context", () => {
    render(
      <CandidateNavigator
        context={null}
        neighbours={NO_NEIGHBOURS}
        progressLabel="Applied · 1 of 2 · 2 left"
      />,
    );

    expect(screen.queryByText("Applied · 1 of 2 · 2 left")).not.toBeInTheDocument();
  });
});
