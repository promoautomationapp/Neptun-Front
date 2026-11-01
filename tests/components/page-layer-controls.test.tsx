import React, { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, CampaignMutator } from "../../src/domain/models";
import { PageLayersControls } from "../../src/features/brochure/PageLayersControls";
import { setLanguage } from "../../src/features/brochure/i18n";

vi.mock("../../src/features/brochure/utils", () => ({
  readImage: vi.fn(async (file: File) => `/uploaded/${file.name}`),
}));

const initial: Campaign = {
  id: "layers",
  name: "Layers",
  products: [{ code: "P1", name: "Product", image: "/primary.png" }],
  pageArtworks: {
    cover: [
      {
        id: "background",
        name: "Backdrop",
        type: "image",
        image: "/backdrop.png",
        x: 5,
        y: 12,
        width: 70,
        zIndex: 1,
      },
      {
        id: "logo",
        name: "Campaign mark",
        type: "image",
        image: "/mark.png",
        x: 60,
        y: 20,
        width: 20,
        zIndex: 6,
      },
    ],
  },
};

function Workspace({
  onSave = vi.fn(),
  onToast = vi.fn(),
  empty = false,
}: {
  onSave?: (campaign: Campaign) => void;
  onToast?: (message: string) => void;
  empty?: boolean;
}) {
  const [campaign, setCampaign] = useState(() => ({
    ...structuredClone(initial),
    ...(empty ? { pageArtworks: {} } : {}),
  }));
  return (
    <PageLayersControls
      campaign={campaign}
      pageKey="cover"
      onToast={onToast}
      onUpdate={(mutate: CampaignMutator) => {
        const next = structuredClone(campaign);
        mutate(next);
        onSave(next);
        setCampaign(next);
      }}
    />
  );
}

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("sq");
  vi.clearAllMocks();
});

it("selects a layer by its thumbnail and changes only that layer's stacking order", () => {
  const save = vi.fn();
  const view = render(<Workspace onSave={save} />);
  const backdrop = view.getByRole("button", { name: "Select layer: Backdrop" });
  expect(within(backdrop).getByRole("presentation").getAttribute("src")).toBe(
    "/backdrop.png",
  );
  fireEvent.click(backdrop);
  expect(backdrop.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(view.getByRole("combobox", { name: "Page layer order" }));
  fireEvent.click(
    view.getByRole("option", { name: "Over products · under logo" }),
  );
  const saved = save.mock.lastCall?.[0] as Campaign;
  expect(saved.pageArtworks?.cover?.[0]).toEqual({
    ...initial.pageArtworks?.cover?.[0],
    zIndex: 4,
  });
  expect(saved.pageArtworks?.cover?.[1]).toEqual(
    initial.pageArtworks?.cover?.[1],
  );
  expect(saved.products).toEqual(initial.products);
});

it("adds a visible image above products while preserving the primary photo and existing layer orders", async () => {
  const save = vi.fn();
  const view = render(<Workspace onSave={save} />);
  fireEvent.change(view.getByLabelText("Add multiple page images"), {
    target: {
      files: [new File(["image"], "badge.png", { type: "image/png" })],
    },
  });
  await waitFor(() =>
    expect(
      view
        .getByRole("button", { name: "Select layer: badge.png" })
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
  const saved = save.mock.lastCall?.[0] as Campaign;
  expect(saved.products).toEqual(initial.products);
  expect(saved.pageArtworks?.cover?.slice(0, 2)).toEqual(
    initial.pageArtworks?.cover,
  );
  expect(saved.pageArtworks?.cover?.[2]).toMatchObject({
    image: "/uploaded/badge.png",
    zIndex: 6,
  });
  expect(
    view.getByRole("combobox", { name: "Page layer order" }).textContent,
  ).toContain("Over page content");
});

it("replaces only the selected layer image, retaining its placement and the other layers", async () => {
  const save = vi.fn();
  const view = render(<Workspace onSave={save} />);
  fireEvent.click(view.getByRole("button", { name: "Select layer: Backdrop" }));
  fireEvent.change(view.getByLabelText("Replace page layer image"), {
    target: {
      files: [
        new File(["replacement"], "new-backdrop.png", { type: "image/png" }),
      ],
    },
  });
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.lastCall?.[0] as Campaign;
  expect(saved.pageArtworks?.cover).toHaveLength(2);
  expect(saved.pageArtworks?.cover?.[0]).toEqual({
    ...initial.pageArtworks?.cover?.[0],
    image: "/uploaded/new-backdrop.png",
    name: "new-backdrop.png",
  });
  expect(saved.pageArtworks?.cover?.[1]).toEqual(
    initial.pageArtworks?.cover?.[1],
  );
});

it("shows the layer controls, empty guidance and upload errors in Albanian", async () => {
  setLanguage("sq");
  const toast = vi.fn();
  const view = render(<Workspace empty onToast={toast} />);
  expect(
    view.getByText(
      "Ende nuk ka shtresa të shtuara. Shtoni një imazh më lart për ta vendosur mbi faqe.",
    ),
  ).toBeTruthy();
  fireEvent.change(view.getByLabelText("Shto disa imazhe në faqe"), {
    target: {
      files: [new File(["text"], "notes.txt", { type: "text/plain" })],
    },
  });
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith("Zgjidhni imazhe më të vogla se 12 MB."),
  );
  fireEvent.click(view.getByRole("button", { name: "Shto shtresë ngjyre" }));
  expect(
    view.getByRole("button", {
      name: "Zgjidh shtresën: Shtresë ngjyre",
    }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("combobox", { name: "Renditja e shtresës së faqes" }),
  );
  expect(
    view.getByRole("option", { name: "Mbi përmbajtjen e faqes" }),
  ).toBeTruthy();
  expect(view.queryByText("Over page content")).toBeNull();
  expect(
    view.getByRole("button", { name: "Hiq shtresën e zgjedhur" }),
  ).toBeTruthy();
});

it("adds a color layer over page content and keeps its 0%, 50% and 100% opacity changes without affecting products", () => {
  const save = vi.fn();
  const view = render(<Workspace onSave={save} />);
  fireEvent.click(view.getByRole("button", { name: "Add color layer" }));
  const added = (save.mock.lastCall?.[0] as Campaign).pageArtworks?.cover?.[2];
  expect(added).toMatchObject({
    type: "overlay",
    opacity: 0.5,
    fade: "solid",
    zIndex: 6,
  });
  for (const percent of [0, 100, 50]) {
    fireEvent.click(
      view.getByRole("button", { name: `Set opacity: ${percent}%` }),
    );
    const saved = save.mock.lastCall?.[0] as Campaign;
    expect(saved.pageArtworks?.cover?.[2]?.opacity).toBe(percent / 100);
    expect(saved.products).toEqual(initial.products);
    expect(saved.pageArtworks?.cover?.slice(0, 2)).toEqual(
      initial.pageArtworks?.cover,
    );
    expect(
      (
        view.getByRole("slider", {
          name: "Page layer opacity",
        }) as HTMLInputElement
      ).value,
    ).toBe(String(percent));
    expect(
      (
        view.getByRole("spinbutton", {
          name: "Page layer opacity (%)",
        }) as HTMLInputElement
      ).value,
    ).toBe(String(percent));
  }
  fireEvent.change(
    view.getByRole("spinbutton", { name: "Page layer opacity (%)" }),
    { target: { value: "37" } },
  );
  expect(
    (save.mock.lastCall?.[0] as Campaign).pageArtworks?.cover?.[2]?.opacity,
  ).toBe(0.37);
});

it("updates a color layer from a custom hex or swatch without saving incomplete or invalid color input", () => {
  const save = vi.fn();
  const view = render(<Workspace empty onSave={save} />);
  fireEvent.click(view.getByRole("button", { name: "Add color layer" }));
  const hex = view.getByRole("textbox", { name: "Page layer color code" });
  save.mockClear();
  for (const value of ["#", "#2", "#23", "#234", "#2341", "#23417"]) {
    fireEvent.change(hex, { target: { value } });
    expect((hex as HTMLInputElement).value).toBe(value);
  }
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(hex, { target: { value: "#234173" } });
  expect(
    (save.mock.lastCall?.[0] as Campaign).pageArtworks?.cover?.[0]?.color,
  ).toBe("#234173");
  expect(
    (view.getByLabelText("Page layer color") as HTMLInputElement).value,
  ).toBe("#234173");
  save.mockClear();
  fireEvent.change(hex, { target: { value: "#ZZZZZZ" } });
  expect(hex.getAttribute("aria-invalid")).toBe("true");
  fireEvent.blur(hex);
  expect((hex as HTMLInputElement).value).toBe("#234173");
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(view.getByLabelText("Page layer color"), {
    target: { value: "#e64e3a" },
  });
  expect(
    (save.mock.lastCall?.[0] as Campaign).pageArtworks?.cover?.[0]?.color,
  ).toBe("#e64e3a");
  expect((hex as HTMLInputElement).value).toBe("#e64e3a");
});
