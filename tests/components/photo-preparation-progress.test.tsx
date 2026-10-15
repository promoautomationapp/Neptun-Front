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
