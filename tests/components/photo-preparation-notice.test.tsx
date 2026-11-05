import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhotoPreparationProgress } from "../../src/features/brochure/PhotoPreparationProgress";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.style.overflow = "";
  setLanguage("sq");
});
const campaign: Campaign = {
  id: "notice",
  name: "Offers",
  products: [{ code: "one", name: "TV", image: "/photo.png" }],
};

it("keeps the editor notice compact and puts progress/actions in a closable dialog while work continues", () => {
  const retry = vi.fn(),
    edit = vi.fn(),
    cancel = vi.fn();
  const view = render(
    <PhotoPreparationProgress
      variant="inline"
      campaign={campaign}
      items={[
        { key: "one", code: "one", name: "TV", state: "preparing" },
        { key: "waiting", code: "waiting", name: "Queued TV", state: "queued" },
      ]}
      onRetry={retry}
      onEdit={edit}
      onCancelWaiting={cancel}
    />,
  );
  const notice = view.getByRole("button", {
    name: "View photo preparation details",
  });
  expect(view.container.querySelectorAll("button")).toHaveLength(1);
  expect(view.queryByRole("progressbar")).toBeNull();
  expect(view.queryByText(/Your brochure stays editable/)).toBeNull();
  notice.focus();
  fireEvent.click(notice);
  const dialog = view.getByRole("dialog", {
    name: "Photo preparation details",
  });
  expect(dialog.parentElement).toBe(document.body);
  expect(document.body.style.overflow).toBe("hidden");
  expect(within(dialog).getByRole("progressbar")).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Stop waiting photos · 1" }),
  );
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(notice);
  expect(retry).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
  expect(view.getByText("Preparing product photos…")).toBeTruthy();
  fireEvent.click(notice);
  fireEvent(
    view.getByRole("dialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(view.queryByRole("dialog")).toBeNull();
  expect(cancel).toHaveBeenCalledOnce();
});

it("keeps missing-only photos visible and exposes every manual upload, including grouped members", () => {
  vi.useFakeTimers();
  const edit = vi.fn(),
    retry = vi.fn();
  const missing: Campaign = {
    id: "missing",
    name: "Missing photos",
    products: [
      ...Array.from({ length: 5 }, (_, i) => ({
        code: `missing-${i}`,
        name: `Missing product ${i}`,
      })),
      {
        code: "set",
        name: "Grouped offer",
        bundleProducts: [{ code: "member", name: "Missing grouped phone" }],
      },
    ],
  };
  const view = render(
    <PhotoPreparationProgress
      campaign={missing}
      items={[]}
      onRetry={retry}
      onEdit={edit}
    />,
  );
  act(() => vi.advanceTimersByTime(5000));
  fireEvent.click(
    view.getByRole("button", { name: "View photo preparation details" }),
  );
  const dialog = view.getByRole("dialog", {
    name: "Photo preparation details",
  });
  expect(within(dialog).queryByRole("progressbar")).toBeNull();
  expect(
    within(dialog).getAllByRole("button", { name: /^Upload \/ edit photo/ }),
  ).toHaveLength(6);
  expect(
    within(dialog).queryByRole("button", { name: "Retry failed photos" }),
  ).toBeNull();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Upload / edit photo · Missing grouped phone",
    }),
  );
  expect(edit).toHaveBeenCalledWith("set");
  expect(view.queryByRole("dialog")).toBeNull();
  expect(retry).not.toHaveBeenCalled();
});

it("keeps all failed rows actionable and updates saved/retry progress without closing the details", () => {
  const retry = vi.fn();
  const failures = Array.from({ length: 5 }, (_, i) => ({
    key: String(i),
    code: String(i),
    name: `Failed photo ${i}`,
    state: "failed" as const,
  }));
  const view = render(
    <PhotoPreparationProgress
      campaign={campaign}
      items={failures}
      onRetry={retry}
      onEdit={vi.fn()}
    />,
  );
  fireEvent.click(
    view.getByRole("button", { name: "View photo preparation details" }),
  );
  let dialog = view.getByRole("dialog", { name: "Photo preparation details" });
  expect(
    within(dialog).getAllByRole("button", { name: /^Upload \/ edit photo/ }),
  ).toHaveLength(5);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Retry failed photos" }),
  );
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(
    <PhotoPreparationProgress
      campaign={campaign}
      items={[
        { ...failures[0]!, state: "retrying", retryAttempt: 2, retryLimit: 3 },
        { ...failures[1]!, state: "saving" },
        ...failures
          .slice(2)
          .map((item) => ({ ...item, state: "ready" as const })),
      ]}
      onRetry={retry}
      onEdit={vi.fn()}
    />,
  );
  dialog = view.getByRole("dialog", { name: "Photo preparation details" });
  expect(within(dialog).getByText("Retrying photo · 2/3")).toBeTruthy();
  expect(within(dialog).getByText("Saving photo…")).toBeTruthy();
  expect(within(dialog).getByText("60%")).toBeTruthy();
  expect(
    (within(dialog).getByRole("progressbar") as HTMLProgressElement).value,
  ).toBe(3);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
});

it("identifies a running missing-photo search without calling it a terminal failure", () => {
  const searching: Campaign = {
    id: "searching",
    name: "Offers",
    products: [
      {
        code: "phone",
        name: "Phone",
        imageSearch: {
          status: "searching",
          requestKey: "phone",
          requestId: "search-phone",
        },
      },
    ],
  };
  const view = render(
    <PhotoPreparationProgress
      campaign={searching}
      items={[]}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  expect(view.getByText("Searching for the exact product photo…")).toBeTruthy();
  expect(view.queryByText("Photo preparation needs attention")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "View photo preparation details" }),
  );
  const dialog = view.getByRole("dialog", {
    name: "Photo preparation details",
  });
  expect(
    within(dialog).getByText(
      "1 Searching for product photos · Missing photos: 1",
    ),
  ).toBeTruthy();
  expect(
    within(dialog).getByRole("button", { name: "Upload / edit photo · Phone" }),
  ).toBeTruthy();
  expect(
    within(dialog).queryByRole("button", { name: "Retry failed photos" }),
  ).toBeNull();
});

it("separates prepared/original/missing counts and explains each missing-photo status without claiming an unattempted search", () => {
  const onRetry = vi.fn(),
    onEdit = vi.fn();
  const missingProducts = Array.from({ length: 9 }, (_, index) => ({
    code: `missing-${index}`,
    name: `Missing item ${index}`,
    ...(index < 3
      ? {
          imageSearch: {
            status: ["not_found", "failed", "searching"][index] as
              "not_found" | "failed" | "searching",
            requestId: `search-${index}`,
            requestKey: `query-${index}`,
          },
        }
      : {}),
  }));
  const sourceProducts = Array.from({ length: 5 }, (_, index) => ({
    code: `source-${index}`,
    name: `Source item ${index}`,
    image: `/source-${index}.png`,
  }));
  const view = render(
    <PhotoPreparationProgress
      campaign={{
        id: "mixed-summary",
        name: "Offers",
        products: [...sourceProducts, ...missingProducts],
      }}
      items={sourceProducts.map((product, index) => ({
        key: product.code,
        code: product.code,
        name: product.name,
        state: index < 2 ? ("ready" as const) : ("original" as const),
      }))}
      onRetry={onRetry}
      onEdit={onEdit}
    />,
  );
  const notice = view.getByRole("button", {
    name: "View photo preparation details",
  });
  expect(notice.textContent).toContain("Prepared photos: 2");
  expect(notice.textContent).toContain("Original photos: 3");
  expect(notice.textContent).toContain("Missing photos: 9");
  expect(notice.textContent).not.toContain("2 / 5");
  expect(view.queryByRole("progressbar")).toBeNull();
  fireEvent.click(notice);
  const dialog = view.getByRole("dialog", {
    name: "Photo preparation details",
  });
  const details = within(dialog);
  expect(
    details.getByText("Photos selected for preparation: 2 / 5 ready"),
  ).toBeTruthy();
  const progress = details.getByRole("progressbar") as HTMLProgressElement;
  expect([progress.value, progress.max]).toEqual([2, 5]);
  expect(
    details.getByText(
      "Missing photos are counted separately from background-removal progress.",
    ),
  ).toBeTruthy();
  expect(
    details.getByText(
      "Original photos are still in use; their backgrounds have not been removed completely.",
    ),
  ).toBeTruthy();
  expect(
    details.getByText(
      "Finished photos have been saved. You can upload the missing photos or correct the product name and model in Products & prices.",
    ),
  ).toBeTruthy();
  const row = (index: number) =>
    within(details.getByText(`Missing item ${index}`).closest("li")!);
  expect(row(0).getByText("Exact product photo not found")).toBeTruthy();
  expect(row(1).getByText("Photo search could not finish")).toBeTruthy();
  expect(
    row(2).getByText("Searching for the exact product photo…"),
  ).toBeTruthy();
  expect(row(3).getByText("No photo has been added yet")).toBeTruthy();
  expect(row(3).queryByText("Exact product photo not found")).toBeNull();
  expect(row(3).queryByText("Photo search could not finish")).toBeNull();
  expect(
    details.getByText(
      "Upload a photo with Upload / edit photo, or complete the exact product name and model in Products & prices.",
    ),
  ).toBeTruthy();
  expect(
    details.getAllByRole("button", { name: /^Upload \/ edit photo/ }),
  ).toHaveLength(12);
  expect(onRetry).not.toHaveBeenCalled();
  expect(onEdit).not.toHaveBeenCalled();
  fireEvent.click(
    row(8).getByRole("button", {
      name: "Upload / edit photo · Missing item 8",
    }),
  );
  expect(onEdit).toHaveBeenCalledWith("missing-8");
});
