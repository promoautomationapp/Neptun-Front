import { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ManufacturerLogos } from "../../src/features/settings/ManufacturerLogos";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
import type * as ApiClientModule from "../../src/api/client";
import type * as BrandLogosModule from "../../src/features/brochure/brandLogos";

vi.mock("../../src/api/client", async (original) => ({
  ...(await original<typeof ApiClientModule>()),
  uploadImage: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../../src/features/brochure/brandLogos", async (original) => {
  const actual = await original<typeof BrandLogosModule>();
  return {
    ...actual,
    brandLogoFor: vi.fn(actual.brandLogoFor),
    loadPreparedBrandLogos: vi.fn(),
  };
});
import { request, uploadImage } from "../../src/api/client";
import {
  brandLogoFor,
  loadPreparedBrandLogos,
} from "../../src/features/brochure/brandLogos";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(
  brands: string[] = [" samsung ", "SAMSUNG", "lg"],
  initial = resolveSettings(null),
) {
  let current = initial;
  function Harness() {
    const [draft, setDraft] = useState(initial);
    return (
      <ManufacturerLogos
        brands={brands}
        draft={draft}
        update={(change) => {
          setDraft((previous) => {
            const next = structuredClone(previous);
            change(next);
            current = next;
            return next;
          });
        }}
      />
    );
  }
  const view = render(<Harness />);
  async function open() {
    fireEvent.click(view.getByText(/Product brand logos/));
    await waitFor(() =>
      expect(view.getByLabelText("Search product brands")).toBeTruthy(),
    );
  }
  return { view, open, current: () => current };
}

it("mounts rows only after opening and searches normalized brand names without fetching or invoking AI", async () => {
  const { view, open } = setup();
  expect(view.queryAllByRole("img")).toHaveLength(0);
  expect(brandLogoFor).not.toHaveBeenCalled();
  await open();
  fireEvent.change(view.getByLabelText("Search product brands"), {
    target: { value: " Samsung " },
  });
  expect(view.getAllByLabelText("SAMSUNG logo")).toHaveLength(1);
  expect(view.queryByLabelText("LG logo")).toBeNull();
  expect(brandLogoFor).toHaveBeenCalledWith(undefined, "SAMSUNG");
  expect(loadPreparedBrandLogos).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(uploadImage).not.toHaveBeenCalled();
});

it("hides using an explicit empty override and restores the existing logo by removing it", async () => {
  const { view, open, current } = setup();
  await open();
  fireEvent.change(view.getByLabelText("Search product brands"), {
    target: { value: "LG" },
  });
  fireEvent.click(view.getByRole("checkbox", { name: "Hide LG logo" }));
  expect(Object.hasOwn(current().brandLogos, "LG")).toBe(true);
  expect(current().brandLogos.LG).toBe("");
  expect(view.queryByRole("img", { name: "LG logo preview" })).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Restore current LG logo" }),
  );
  expect(Object.hasOwn(current().brandLogos, "LG")).toBe(false);
  expect(
    view.getByRole("img", { name: "LG logo preview" }).getAttribute("src"),
  ).toBe(brandLogoFor(undefined, "LG"));
});

it("uploads a private image into the library and selects it as the normalized brand default", async () => {
  const url = "/api/assets/12345678-1234-4234-8234-123456789012";
  vi.mocked(uploadImage).mockResolvedValue(url);
  const { view, open, current } = setup();
  await open();
  fireEvent.change(view.getByLabelText("Search product brands"), {
    target: { value: "Samsung" },
  });
  const file = new File(["image"], "Samsung custom.png", { type: "image/png" });
  fireEvent.change(view.getByLabelText("Upload SAMSUNG logo"), {
    target: { files: [file] },
  });
  await waitFor(() => expect(current().brandLogos.SAMSUNG).toBe(url));
  expect(current().logoLibrary).toEqual([
    expect.objectContaining({ name: file.name, url }),
  ]);
  expect(uploadImage).toHaveBeenCalledOnce();
  expect(loadPreparedBrandLogos).not.toHaveBeenCalled();
  fireEvent.change(view.getByLabelText("SAMSUNG logo"), {
    target: { value: "" },
  });
  expect(Object.hasOwn(current().brandLogos, "SAMSUNG")).toBe(false);
  expect(current().logoLibrary).toHaveLength(1);
});

it("includes saved brands missing from the catalog and limits the initial row count", async () => {
  const initial: WorkspaceSettings = resolveSettings(null);
  initial.brandLogos["SAVED BRAND"] = "";
  const { view, open } = setup(
    Array.from({ length: 30 }, (_, index) => `Brand ${index + 1}`),
    initial,
  );
  await open();
  expect(view.getAllByRole("checkbox")).toHaveLength(12);
  fireEvent.click(view.getByRole("button", { name: "Show more brands" }));
  expect(view.getAllByRole("checkbox")).toHaveLength(24);
  fireEvent.change(view.getByLabelText("Search product brands"), {
    target: { value: "saved brand" },
  });
  expect(
    view.getByRole("checkbox", { name: "Hide SAVED BRAND logo" }),
  ).toBeTruthy();
});
