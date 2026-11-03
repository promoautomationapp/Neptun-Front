import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { ProductPhotoRepair } from "../../src/features/brochure/ProductPhotoRepair";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  setLanguage("sq");
});

function campaign(): Campaign {
  return {
    id: "photo-repair",
    name: "Repair photos",
    products: [
      { code: "new", name: "New TV", image: "/original-tv.jpg" },
      {
        code: "prepared",
        name: "Prepared fridge",
        image: "/fridge.png",
        aiOriginalImage: "/fridge.jpg",
      },
      {
        code: "skipped",
        name: "Unprepared mixer",
        image: "/mixer.jpg",
        skipAiCutout: true,
      },
      { code: "missing", name: "Missing photo" },
      {
        code: "set",
        name: "TV and phone",
        bundleProducts: [
          { code: "new", name: "Set TV", image: "/set-tv.jpg" },
          {
            code: "phone",
            name: "Set phone",
            image: "/phone.png",
            aiOriginalImage: "/phone.jpg",
          },
        ],
      },
    ],
  } as Campaign;
}

it("opens without starting work and suggests only unprepared photos, including bundle members", () => {
  setLanguage("en");
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={campaign()}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  expect(prepare).not.toHaveBeenCalled();
  expect(view.getByText("3 / 5 photos selected")).toBeTruthy();
  expect(
    (view.getByRole("checkbox", { name: "New TV · new" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Unprepared mixer · skipped",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(
    (view.getByRole("checkbox", { name: "Set TV · new" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Prepared fridge · prepared",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  expect(view.queryByRole("checkbox", { name: /Missing photo/ })).toBeNull();
});

it("sends precisely the selected identities and trimmed instructions, even for a prepared photo", () => {
  setLanguage("en");
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={campaign()}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Clear selection" }));
  expect(
    (
      view.getByRole("button", {
        name: "Remove backgrounds · 0",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(view.getByRole("checkbox", { name: "Set phone · phone" }));
  fireEvent.change(
    view.getByRole("textbox", { name: /What should be fixed/ }),
    {
      target: { value: "  Remove the white border; keep all buttons.  " },
    },
  );
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 1" }));
  expect(prepare).toHaveBeenCalledExactlyOnceWith({
    targetKeys: [JSON.stringify(["set", "phone"])],
    instructions: "Remove the white border; keep all buttons.",
  });
});

it("keeps selection when searching and permits an explicit selection of all photos", () => {
  setLanguage("en");
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={campaign()}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(view.getByRole("searchbox", { name: "Search products" }), {
    target: { value: "phone" },
  });
  expect(view.getAllByRole("checkbox")).toHaveLength(1);
  expect(view.getByText("3 / 5 photos selected")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Select all" }));
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 5" }));
  expect(prepare.mock.calls[0]?.[0].targetKeys).toEqual([
    JSON.stringify(["new", ""]),
    JSON.stringify(["prepared", ""]),
    JSON.stringify(["skipped", ""]),
    JSON.stringify(["set", "new"]),
    JSON.stringify(["set", "phone"]),
  ]);
});

it("selects an explicitly failed prepared image for retry and disables work for missing photos", () => {
  setLanguage("en");
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={campaign()}
      failedTargetKeys={[JSON.stringify(["prepared", ""])]}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  expect(
    (
      view.getByRole("checkbox", {
        name: "Prepared fridge · prepared",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(view.getByText("Needs attention")).toBeTruthy();
  view.rerender(
    <ProductPhotoRepair
      campaign={{
        ...campaign(),
        products: [{ code: "empty", name: "No photo" }],
      }}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  expect(
    view.getByText("Upload product photos first to remove their backgrounds."),
  ).toBeTruthy();
  expect(
    (
      view.getByRole("button", {
        name: "Remove backgrounds · 0",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

it("excludes in-progress photos from both suggested and select-all work", () => {
  setLanguage("en");
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={campaign()}
      busyTargetKeys={[JSON.stringify(["new", ""])]}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  const busy = view.getByRole("checkbox", {
    name: "New TV · new",
  }) as HTMLInputElement;
  expect(busy.checked).toBe(false);
  expect(busy.disabled).toBe(true);
  expect(view.getByText("Preparing photo…")).toBeTruthy();
  expect(view.getByText("2 / 5 photos selected")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Select all" }));
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 4" }));
  expect(prepare.mock.calls[0]?.[0].targetKeys).not.toContain(
    JSON.stringify(["new", ""]),
  );
});
