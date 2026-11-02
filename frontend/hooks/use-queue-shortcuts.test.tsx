import type { HTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCandidateFilters } from "@/utilities/candidate-filters";
import type { CandidateNavigationContext } from "@/utilities/candidate-navigation";

const harness = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push }),
}));

const { useQueueShortcuts } = await import("./use-queue-shortcuts");

const CONTEXT: CandidateNavigationContext = {
  positionId: "position-1",
  filters: emptyCandidateFilters(),
  queueStageId: "stage-1",
};

const NEXT_HREF = "/candidates/application-3?position=position-1&queue=stage-1";
const PREVIOUS_HREF = "/candidates/application-1?position=position-1&queue=stage-1";

type Neighbours = { previousId: string | null; nextId: string | null };

function Harness({ neighbours, active = true }: { neighbours: Neighbours; active?: boolean }) {
  useQueueShortcuts(active ? { neighbours, context: CONTEXT } : null);
  return (
    <div>
      <button type="button">Somewhere</button>
      <input aria-label="Search" />
      <textarea aria-label="Note" />
      <div contentEditable suppressContentEditableWarning aria-label="Editor" tabIndex={0}>
        Draft
      </div>
      <div role="textbox" aria-label="Rich text" tabIndex={0} />
    </div>
  );
}

const BOTH: Neighbours = { previousId: "application-1", nextId: "application-3" };

beforeEach(() => {
  harness.push.mockReset();
});

describe("useQueueShortcuts", () => {
  it.each([
    ["j", NEXT_HREF],
    ["{ArrowRight}", NEXT_HREF],
    ["k", PREVIOUS_HREF],
    ["{ArrowLeft}", PREVIOUS_HREF],
  ])("%s opens the neighbouring candidate, keeping the queue", async (key, href) => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);

    await user.keyboard(key);

    expect(harness.push).toHaveBeenCalledTimes(1);
    expect(harness.push).toHaveBeenCalledWith(href);
  });

  it("ignores further presses until the next candidate is on screen", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);

    await user.keyboard("jj{ArrowRight}k");

    expect(harness.push).toHaveBeenCalledTimes(1);
    expect(harness.push).toHaveBeenCalledWith(NEXT_HREF);
  });

  it("listens again once the current candidate has changed", async () => {
    const user = userEvent.setup();
    const view = render(<Harness neighbours={BOTH} />);
    await user.keyboard("j");

    view.rerender(
      <Harness neighbours={{ previousId: "application-2", nextId: "application-4" }} />,
    );
    await user.keyboard("j");

    expect(harness.push).toHaveBeenCalledTimes(2);
    expect(harness.push).toHaveBeenLastCalledWith(
      "/candidates/application-4?position=position-1&queue=stage-1",
    );
  });

  it("listens again on a candidate it left by shortcut and came back to another way", async () => {
    const user = userEvent.setup();
    const view = render(<Harness neighbours={BOTH} />);
    await user.keyboard("j");

    view.rerender(
      <Harness neighbours={{ previousId: "application-2", nextId: "application-4" }} />,
    );
    view.rerender(<Harness neighbours={BOTH} />);
    await user.keyboard("j");

    expect(harness.push).toHaveBeenCalledTimes(2);
    expect(harness.push).toHaveBeenLastCalledWith(NEXT_HREF);
  });

  it("does nothing at either end of the column", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={{ previousId: null, nextId: null }} />);

    await user.keyboard("jk{ArrowRight}{ArrowLeft}");

    expect(harness.push).not.toHaveBeenCalled();
  });

  it("works while a button has focus", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);
    screen.getByRole("button", { name: "Somewhere" }).focus();

    await user.keyboard("j");

    expect(harness.push).toHaveBeenCalledWith(NEXT_HREF);
  });

  it.each(["Search", "Note", "Rich text"])("is ignored while typing in %s", async (label) => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);
    screen.getByLabelText(label).focus();

    await user.keyboard("jk{ArrowRight}{ArrowLeft}");

    expect(harness.push).not.toHaveBeenCalled();
  });

  it("is ignored while editing rich text", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);
    screen.getByLabelText("Editor").focus();

    await user.keyboard("jk");

    expect(harness.push).not.toHaveBeenCalled();
  });

  it.each([
    "{Shift>}j{/Shift}",
    "{Control>}j{/Control}",
    "{Meta>}{ArrowRight}{/Meta}",
    "{Alt>}k{/Alt}",
  ])("is ignored with a modifier held: %s", async (keys) => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);

    await user.keyboard(keys);

    expect(harness.push).not.toHaveBeenCalled();
  });

  it("leaves a key another handler already claimed", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} />);
    const claim = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener("keydown", claim, { capture: true });

    try {
      await user.keyboard("j");
    } finally {
      window.removeEventListener("keydown", claim, { capture: true });
    }

    expect(harness.push).not.toHaveBeenCalled();
  });

  it.each<[string, HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>]>([
    ["a dialog", { role: "dialog" }],
    ["a modal", { "aria-modal": true }],
    ["a menu", { role: "menu" }],
    ["a listbox", { role: "listbox" }],
    ["a floating menu", { "data-floating-menu": "" }],
  ])("is ignored while %s is open", async (_name, attributes) => {
    const user = userEvent.setup();
    render(
      <>
        <Harness neighbours={BOTH} />
        <div {...attributes}>Open layer</div>
      </>,
    );

    await user.keyboard("j{ArrowLeft}");

    expect(harness.push).not.toHaveBeenCalled();
  });

  it("is inactive without a screening session", async () => {
    const user = userEvent.setup();
    render(<Harness neighbours={BOTH} active={false} />);

    await user.keyboard("jk{ArrowRight}{ArrowLeft}");

    expect(harness.push).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", async () => {
    const user = userEvent.setup();
    const view = render(<Harness neighbours={BOTH} />);
    view.unmount();

    await user.keyboard("j");

    expect(harness.push).not.toHaveBeenCalled();
  });
});
