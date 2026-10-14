import { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandsTab } from "../../src/features/settings/BrandsTab";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
import type * as ApiClientModule from "../../src/api/client";
vi.mock("../../src/api/client", async (original) => ({
  ...(await original<typeof ApiClientModule>()),
  uploadImage: vi.fn(),
}));
import { uploadImage } from "../../src/api/client";
const ownedImage = "/api/assets/12345678-1234-4234-8234-123456789012";
const savedImage = "/api/assets/22345678-1234-4234-8234-123456789012";
const sourceBrands = [
  {
    id: 1,
    name: " Samsung ",
    sourceImageUrl: "https://www.neptun-ks.com/images/samsung.png",
    image: ownedImage,
  },
  {
    id: 2,
    name: "LG",
    sourceImageUrl: "https://www.neptun-ks.com/images/lg.png",
    image: "",
  },
];
function response(brands: unknown = sourceBrands, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200 ? { brands } : { error: "Brand images are unavailable." },
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(initial: WorkspaceSettings = resolveSettings(null)) {
  let current = initial;
  function Harness() {
    const [draft, setDraft] = useState(initial);
    return (
      <BrandsTab
        brands={["SAMSUNG", "LG"]}
        draft={draft}
        update={(change) =>
          setDraft((previous) => {
            const next = structuredClone(previous);
            change(next);
            current = next;
            return next;
          })
        }
      />
    );
  }
  return { view: render(<Harness />), current: () => current };
}

it("previews website brand images while preserving brochure logos until explicitly selected", async () => {
  const api = vi.fn(async () => response());
  vi.stubGlobal("fetch", api);
  const { view, current } = setup();
  await waitFor(() => expect(view.queryByText("Loading brands…")).toBeNull());
  fireEvent.change(view.getByLabelText("Search brands"), {
    target: { value: "Samsung" },
  });
  expect(
    view
      .getAllByRole("img", { name: "SAMSUNG website logo" })[0]
      ?.getAttribute("src"),
  ).toBe(ownedImage);
  expect(current().brandLogos).toEqual({});
  expect(
    view
      .getByRole("img", { name: "SAMSUNG brochure logo" })
      .getAttribute("src"),
  ).not.toBe(ownedImage);
  fireEvent.click(
    view.getByRole("button", { name: "Use website image for SAMSUNG" }),
  );
  expect(current().brandLogos.SAMSUNG).toBe(ownedImage);
  expect(
    view
      .getByRole("img", { name: "SAMSUNG brochure logo" })
      .getAttribute("src"),
  ).toBe(ownedImage);
  expect(api).toHaveBeenCalledTimes(1);
});

it("keeps saved overrides through source refresh and allows hiding and restoring", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  const settings = resolveSettings(null);
  settings.brandLogos.SAMSUNG = savedImage;
  const { view, current } = setup(settings);
  await waitFor(() => expect(view.queryByText("Loading brands…")).toBeNull());
  fireEvent.change(view.getByLabelText("Search brands"), {
    target: { value: "Samsung" },
  });
  fireEvent.click(view.getByRole("button", { name: "Refresh brand images" }));
  await waitFor(() => expect(view.queryByText("Loading brands…")).toBeNull());
  expect(current().brandLogos.SAMSUNG).toBe(savedImage);
  fireEvent.click(view.getByRole("checkbox", { name: "Hide SAMSUNG logo" }));
  expect(Object.hasOwn(current().brandLogos, "SAMSUNG")).toBe(true);
  expect(current().brandLogos.SAMSUNG).toBe("");
  fireEvent.click(
    view.getByRole("button", { name: "Restore current SAMSUNG logo" }),
  );
  expect(Object.hasOwn(current().brandLogos, "SAMSUNG")).toBe(false);
});

it("uses remote images only as read-only previews until backend ingestion finishes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  const { view, current } = setup();
  await waitFor(() => expect(view.queryByText("Loading brands…")).toBeNull());
  fireEvent.change(view.getByLabelText("Search brands"), {
    target: { value: "LG" },
  });
  expect(
    view
      .getAllByRole("img", { name: "LG website logo" })[0]
      ?.getAttribute("src"),
  ).toBe("https://www.neptun-ks.com/images/lg.png");
  expect(
    view.queryByRole("button", { name: "Use website image for LG" }),
  ).toBeNull();
  expect(view.getByText(/website image is being saved/)).toBeTruthy();
  expect(current().brandLogos).toEqual({});
});

it("keeps current brands editable after a source failure and stores uploads in the library", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response([], 503)),
  );
  vi.mocked(uploadImage).mockResolvedValue(savedImage);
  const { view, current } = setup();
  await view.findByRole("alert");
  fireEvent.change(view.getByLabelText("Search brands"), {
    target: { value: "Samsung" },
  });
  fireEvent.change(view.getByLabelText("Upload SAMSUNG logo"), {
    target: {
      files: [new File(["image"], "Samsung.png", { type: "image/png" })],
    },
  });
  await waitFor(() => expect(current().brandLogos.SAMSUNG).toBe(savedImage));
  expect(current().logoLibrary).toEqual([
    expect.objectContaining({ url: savedImage, name: "Samsung.png" }),
  ]);
});

it("limits gallery rows and falls back to a wordmark when an image cannot load", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      response(
        Array.from({ length: 40 }, (_, index) => ({
          id: index,
          name: "Example " + index,
          image: ownedImage,
          sourceImageUrl: "",
        })),
      ),
    ),
  );
  const { view } = setup();
  await waitFor(() => expect(view.queryByText("Loading brands…")).toBeNull());
  expect(
    view.getAllByRole("button", { name: /^Choose .* brand$/ }),
  ).toHaveLength(24);
  fireEvent.change(view.getByLabelText("Search brands"), {
    target: { value: "Example 39" },
  });
  const image = view.getAllByRole("img", {
    name: "EXAMPLE 39 website logo",
  })[0]!;
  fireEvent.error(image);
  expect(image.isConnected).toBe(false);
  expect(view.getAllByText("EXAMPLE 39").length).toBeGreaterThan(0);
});
