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

it("allows waiting photos in a large queue to be selected while disabling only actual active jobs", () => {
  setLanguage("en");
  const queuedCampaign = {
    ...campaign(),
    products: Array.from({ length: 98 }, (_, index) => ({
      code: String(index),
      name: `Product ${index}`,
      image: `/photo-${index}.jpg`,
    })),
  };
  const keys = queuedCampaign.products.map((product) =>
    JSON.stringify([product.code, ""]),
  );
  const prepare = vi.fn();
  const view = render(
    <ProductPhotoRepair
      campaign={queuedCampaign}
      busyTargetKeys={keys.slice(0, 2)}
      queuedTargetKeys={keys.slice(2)}
      onPrepare={prepare}
      onClose={vi.fn()}
    />,
  );
  expect(view.getByText("96 / 98 photos selected")).toBeTruthy();
  expect(view.getAllByText("Preparing photo…")).toHaveLength(2);
  expect(view.getAllByText("Waiting to prepare")).toHaveLength(96);
  expect(
    (view.getAllByRole("checkbox") as HTMLInputElement[]).filter(
      (input) => input.disabled,
    ),
  ).toHaveLength(2);
  fireEvent.change(
    view.getByRole("textbox", { name: /What should be fixed/ }),
    { target: { value: " Keep every product edge. " } },
  );
  fireEvent.click(
    view.getByRole("button", { name: "Remove backgrounds · 96" }),
  );
  expect(prepare).toHaveBeenCalledExactlyOnceWith({
    targetKeys: keys.slice(2),
    instructions: "Keep every product edge.",
  });
});

it("restores suggested selection when old queue locks clear while preserving an explicit deselection", () => {
  setLanguage("en");
  const keys = [
    JSON.stringify(["new", ""]),
    JSON.stringify(["skipped", ""]),
    JSON.stringify(["set", "new"]),
  ];
  const prepare = vi.fn();
  const props = { campaign: campaign(), onPrepare: prepare, onClose: vi.fn() };
  const view = render(<ProductPhotoRepair {...props} busyTargetKeys={keys} />);
  expect(view.getByText("0 / 5 photos selected")).toBeTruthy();
  view.rerender(
    <ProductPhotoRepair
      {...props}
      busyTargetKeys={keys.slice(0, 1)}
      queuedTargetKeys={keys.slice(1)}
    />,
  );
  expect(view.getByText("2 / 5 photos selected")).toBeTruthy();
  fireEvent.click(
    view.getByRole("checkbox", { name: "Unprepared mixer · skipped" }),
  );
  view.rerender(
    <ProductPhotoRepair
      {...props}
      busyTargetKeys={[]}
      queuedTargetKeys={keys}
    />,
  );
  expect(view.getByText("2 / 5 photos selected")).toBeTruthy();
  expect(
    (
      view.getByRole("checkbox", {
        name: "Unprepared mixer · skipped",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  expect(
    (view.getByRole("checkbox", { name: "New TV · new" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(prepare).not.toHaveBeenCalled();
});

it("does not disable photos from persisted preparation flags and respects Clear selection after queue updates", () => {
  setLanguage("en");
  const snapshot = {
    ...campaign(),
    products: [
      {
        code: "pending",
        name: "Old preparing flag",
        image: "/pending.jpg",
        cutoutStatus: "preparing",
      },
    ],
  };
  const key = JSON.stringify(["pending", ""]);
  const prepare = vi.fn();
  const props = { campaign: snapshot, onPrepare: prepare, onClose: vi.fn() };
  const view = render(<ProductPhotoRepair {...props} />);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Old preparing flag · pending",
      }) as HTMLInputElement
    ).disabled,
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Clear selection" }));
  view.rerender(<ProductPhotoRepair {...props} busyTargetKeys={[key]} />);
  view.rerender(
    <ProductPhotoRepair
      {...props}
      busyTargetKeys={[]}
      queuedTargetKeys={[key]}
    />,
  );
  expect(view.getByText("0 / 1 photos selected")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Select all" }));
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 1" }));
  expect(prepare).toHaveBeenCalledExactlyOnceWith({
    targetKeys: [key],
    instructions: "",
  });
});

it("offers to stop only waiting photos without submitting another preparation request", () => {
  setLanguage("en");
  const prepare = vi.fn(),
    cancel = vi.fn();
  const props = {
    campaign: campaign(),
    onPrepare: prepare,
    onClose: vi.fn(),
    onCancelQueued: cancel,
    busyTargetKeys: [JSON.stringify(["new", ""])],
  };
  const view = render(
    <ProductPhotoRepair
      {...props}
      queuedTargetKeys={[
        JSON.stringify(["skipped", ""]),
        JSON.stringify(["set", "new"]),
      ]}
    />,
  );
  expect(view.getByText("2 waiting")).toBeTruthy();
  expect(
    view.getByText(
      "Only photos already running will finish. Waiting photos have not been sent to AI.",
    ),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Stop waiting photos" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(prepare).not.toHaveBeenCalled();
  expect(
    (view.getByRole("checkbox", { name: "New TV · new" }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Unprepared mixer · skipped",
      }) as HTMLInputElement
    ).disabled,
  ).toBe(false);
  view.rerender(<ProductPhotoRepair {...props} queuedTargetKeys={[]} />);
  expect(
    view.queryByRole("button", { name: "Stop waiting photos" }),
  ).toBeNull();
});
