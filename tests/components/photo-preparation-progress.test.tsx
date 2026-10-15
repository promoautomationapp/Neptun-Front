import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PhotoPreparationProgress } from "../../src/features/brochure/PhotoPreparationProgress";
import type { Campaign } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(() => {
  cleanup();
  setLanguage("sq");
});
it("shows real completed, waiting and failed work while keeping upload and retry actions meaningful", () => {
  setLanguage("en");
  const retry = vi.fn(),
    edit = vi.fn();
  const campaign = {
    products: [
      { code: "one", name: "TV", image: "/ready.png" },
      { code: "two", name: "Oven" },
    ],
  } as Campaign;
  const items = [
    { key: "a", code: "one", name: "TV", state: "ready" as const },
    { key: "b", code: "two", name: "Oven", state: "preparing" as const },
    { key: "c", code: "three", name: "Fridge", state: "queued" as const },
    { key: "d", code: "four", name: "Mixer", state: "failed" as const },
  ];
  const view = render(
    <PhotoPreparationProgress
      items={items}
      campaign={campaign}
      onRetry={retry}
      onEdit={edit}
    />,
  );
  const progress = view.getByRole("progressbar") as HTMLProgressElement;
  expect(progress.value).toBe(2);
  expect(progress.max).toBe(4);
  expect(view.getByText("50%")).toBeTruthy();
  expect(view.getByText(/1 \/ 4 ready/)).toBeTruthy();
  expect(
    (
      view.getByRole("button", {
        name: "Retry failed photos",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    view.getByRole("button", { name: "Upload / edit photo · Mixer" }),
  );
  expect(edit).toHaveBeenCalledWith("four");
  view.rerender(
    <PhotoPreparationProgress
      items={items.map((x) =>
        x.state === "failed" ? x : { ...x, state: "ready" },
      )}
      campaign={campaign}
      onRetry={retry}
      onEdit={edit}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Retry failed photos" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(view.getByText("Photo preparation needs attention")).toBeTruthy();
});

it("finishes with an original photo when preparation is unavailable, without inviting another paid retry", () => {
  setLanguage("en");
  const edit = vi.fn();
  const view = render(
    <PhotoPreparationProgress
      items={[
        { key: "prepared", code: "one", name: "TV", state: "ready" },
        { key: "fallback", code: "two", name: "Tablet", state: "original" },
      ]}
      campaign={
        {
          products: [
            { code: "one", name: "TV", image: "/prepared.png" },
            { code: "two", name: "Tablet", image: "/original.png" },
          ],
        } as Campaign
      }
      onRetry={vi.fn()}
      onEdit={edit}
    />,
  );
  expect(view.getByText("100%")).toBeTruthy();
  expect(view.getByText(/1 \/ 2 ready · 1 Using original photo/)).toBeTruthy();
  expect(view.getByText("Product photos are ready")).toBeTruthy();
  expect(
    view.queryByRole("button", { name: "Retry failed photos" }),
  ).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Upload / edit photo · Tablet" }),
  );
  expect(edit).toHaveBeenCalledWith("two");
});

it("shows saving separately from AI preparation", () => {
  setLanguage("en");
  const view = render(
    <PhotoPreparationProgress
      items={[{ key: "saved", code: "one", name: "TV", state: "saving" }]}
      campaign={{ products: [] } as unknown as Campaign}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  expect(view.getByText("Saving photo…")).toBeTruthy();
  expect(view.queryByText("Preparing / waiting for AI")).toBeNull();
});
