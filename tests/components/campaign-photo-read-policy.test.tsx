import React from "react";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { Campaign } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";
import { requestAi } from "../../src/features/ai/ai.api";
import { imageOrientation } from "../../src/features/ai/image-inspection";

vi.mock("../../src/features/ai/ai.api", () => ({
  requestAi: vi.fn(async () => ({
    image: "/mock-prepared.png",
    cutoutValidated: true,
    cutoutValidationVersion: 1,
  })),
}));
vi.mock("../../src/features/ai/image-inspection", () => ({
  imageOrientation: vi.fn(async () => "square"),
  inspectImage: vi.fn(async (source: string) => source),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

it("opens, switches tabs, and reopens a saved brochure without preparing its photos again", async () => {
  window.history.replaceState({}, "", "/");
  setLanguage("en");
  const campaign: Campaign = {
    id: "saved-photo-policy",
    name: "Saved photo policy",
    type: "Offers",
    theme: "blue",
    layout: "duo4",
    products: [
      {
        code: "original",
        name: "Saved original photo",
        image: "/catalog.png",
        regular: 199,
        sale: 149,
      },
      {
        code: "prepared",
        name: "Saved prepared photo",
        image: "/saved-cutout.png",
        aiOriginalImage: "/source.png",
        aiCutoutValidated: true,
        aiCutoutValidationVersion: 1,
        regular: 299,
        sale: 249,
      },
    ],
  };
  const user = {
    id: "staff",
    email: "staff@example.test",
    name: "Staff",
    role: "staff",
    permissions: "editor",
    organizationId: "00000000-0000-4000-8000-000000000000",
    mustChangePassword: false,
  };
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const responses: Record<string, unknown> = {
        "/api/team/session": { configured: true, user },
        "/api/team/members": { members: [] },
        "/api/team/campaigns":
          init?.method === "POST"
            ? { campaign: JSON.parse(String(init.body)).campaign }
            : { campaigns: [campaign] },
        [`/api/team/campaigns/${campaign.id}`]: { campaign },
        [`/api/team/campaigns/${campaign.id}/presence`]: { participants: [] },
        "/api/team/settings": { settings: null, version: 0, updatedAt: null },
        "/api/products": {
          products: [
            {
              code: "77777",
              name: "Imported speaker",
              image: "/imported-source.png",
              regular: 99,
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
          nextOffset: null,
        },
        "/api/products/facets": {
          categories: [],
          brands: [],
          paths: [],
          sourceCategories: [],
        },
        "/api/brand-logos": {},
        "/api/catalog/refresh": { status: "idle" },
        "/api/ai/cutouts/reuse": { items: [] },
      };
      return new Response(JSON.stringify(responses[path] || {}));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", {
      name: `Open campaign: ${campaign.name}`,
    }),
  );
  await view.findByRole("button", { name: /Brochure design/ });
  fireEvent.click(view.getByRole("button", { name: /Products & prices/ }));
  fireEvent.click(view.getByRole("button", { name: /Brochure design/ }));
  fireEvent.click(view.getByRole("button", { name: /← All campaigns/ }));
  fireEvent.click(
    await view.findByRole("button", {
      name: `Open campaign: ${campaign.name}`,
    }),
  );
  await view.findByRole("button", { name: /Brochure design/ });
  await act(async () => {
    await Promise.resolve();
  });
  expect(imageOrientation).not.toHaveBeenCalled();
  expect(requestAi).not.toHaveBeenCalled();
  expect(
    fetchMock.mock.calls.some(([input]) =>
      String(input).includes("/api/ai-remove-background"),
    ),
  ).toBe(false);
  expect(
    view.container.querySelector<HTMLImageElement>(
      'img[src="/saved-cutout.png"]',
    ),
  ).toBeTruthy();
  fireEvent.click(view.getByText("Fix product photos").closest("button")!);
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 1" }));
  await waitFor(() => expect(requestAi).toHaveBeenCalledOnce());
  expect(vi.mocked(requestAi).mock.calls[0]?.[1]).toMatchObject({
    image: "/catalog.png",
    name: "Saved original photo",
  });
  await waitFor(() =>
    expect(
      view.container.querySelector('img[src="/mock-prepared.png"]'),
    ).toBeTruthy(),
  );
  expect(
    view.container.querySelector('img[src="/saved-cutout.png"]'),
  ).toBeTruthy();
  let finish!: (result: {
    image: string;
    cutoutValidated: boolean;
    cutoutValidationVersion: number;
  }) => void;
  vi.mocked(requestAi).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(view.getByText("Fix product photos").closest("button")!);
  fireEvent.click(
    view.getByRole("checkbox", { name: "Saved prepared photo · prepared" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Remove backgrounds · 1" }));
  await waitFor(() => expect(requestAi).toHaveBeenCalledTimes(2));
  expect(vi.mocked(requestAi).mock.calls[1]?.[1]).toMatchObject({
    image: "/source.png",
    retry: true,
    regenerate: true,
    rejectedImage: "/saved-cutout.png",
  });
  expect(
    view.container.querySelector('img[src="/saved-cutout.png"]'),
  ).toBeNull();
  expect(view.container.querySelector('img[src="/source.png"]')).toBeTruthy();
  expect(view.getByText("Preparing product photos…")).toBeTruthy();
  const savedCampaigns = fetchMock.mock.calls
    .filter(([, options]) => options?.method === "POST")
    .map(([, options]) => JSON.parse(String(options?.body)).campaign)
    .filter(Boolean);
  const originalSaved = savedCampaigns.find((saved) =>
    saved.products.some(
      (product: { code: string; image: string }) =>
        product.code === "prepared" && product.image === "/source.png",
    ),
  );
  expect(originalSaved).toBeTruthy();
  expect(
    originalSaved.products.find(
      (product: { code: string }) => product.code === "prepared",
    ).aiCutoutValidated,
  ).toBeUndefined();
  await act(async () => {
    finish({
      image: "/fresh-cutout.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    });
  });
  await waitFor(() =>
    expect(
      view.container.querySelector('img[src="/fresh-cutout.png"]'),
    ).toBeTruthy(),
  );
  expect(requestAi).toHaveBeenCalledTimes(2);
  expect(
    fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/ai/cutouts/reuse"),
    ),
  ).toHaveLength(0);
  const context: { XLSX?: Window["XLSX"] } & Pick<
    typeof globalThis,
    "ArrayBuffer" | "Uint8Array"
  > = { ArrayBuffer, Uint8Array };
  runInNewContext(
    readFileSync(`${process.cwd()}/public/vendor/xlsx.js`, "utf8"),
    context,
  );
  vi.stubGlobal("XLSX", context.XLSX);
  async function importSpeaker() {
    fireEvent.click(view.getByRole("button", { name: "Upload products" }));
    const bytes = new TextEncoder().encode("Code,Sale price\n77777,79\n");
    const csv = new Uint8Array(new ArrayBuffer(bytes.length));
    csv.set(bytes);
    const file = new File([csv], "speaker.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => csv.buffer,
    });
    const input = view.container.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".csv,.xlsx,.xls"]',
    );
    if (!input) throw new Error("Import must provide its file input.");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(
      await view.findByRole("button", { name: /^Add 1 product/ }),
    );
  }
  await importSpeaker();
  await waitFor(() => expect(requestAi).toHaveBeenCalledTimes(3));
  expect(vi.mocked(requestAi).mock.calls[2]?.[1]).toMatchObject({
    image: "/imported-source.png",
    name: "Imported speaker",
  });
  await waitFor(() =>
    expect(view.queryByRole("button", { name: /^Add 1 product/ })).toBeNull(),
  );
  await waitFor(() =>
    expect(
      view.queryByRole("dialog", { name: "Preparing product photos…" }),
    ).toBeNull(),
  );
  await importSpeaker();
  await act(async () => {
    await Promise.resolve();
  });
  expect(requestAi).toHaveBeenCalledTimes(3);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

async function photoImportWorkspace(
  onSave?: (campaign: Campaign) => Promise<void>,
  options: {
    campaignId?: string;
    catalogProducts?: Campaign["products"];
    reuse?: (
      items: Array<{ key: string; image: string } & Record<string, unknown>>,
    ) => Response | Promise<Response>;
  } = {},
) {
  setLanguage("en");
  const campaign: Campaign = {
    id: options.campaignId || "blocking-photo-import",
    name: "Photo import",
    products: [],
  };
  const user = {
    id: "photo-import-staff",
    email: "photo-import@example.test",
    name: "Photo import staff",
    role: "staff",
    permissions: "editor",
    mustChangePassword: false,
    organizationId: "00000000-0000-4000-8000-000000000000",
  };
  let latest = campaign;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path === "/api/ai/cutouts/reuse") {
        const { items } = JSON.parse(String(init?.body));
        return options.reuse?.(items) ?? new Response('{"items":[]}');
      }
      if (path === "/api/team/campaigns" && init?.method === "POST") {
        latest = JSON.parse(String(init.body)).campaign;
        await onSave?.(latest);
        return new Response(JSON.stringify({ campaign: latest }));
      }
      const responses: Record<string, unknown> = {
        "/api/team/session": { configured: true, user },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: [latest] },
        [`/api/team/campaigns/${campaign.id}`]: { campaign: latest },
        [`/api/team/campaigns/${campaign.id}/presence`]: { participants: [] },
        "/api/team/settings": { settings: null, version: 0, updatedAt: null },
        "/api/products": {
          products: options.catalogProducts || [
            {
              code: "77777",
              name: "Imported speaker",
              image: "/imported-source.png",
              regular: 99,
            },
          ],
          total: options.catalogProducts?.length || 1,
          limit: 100,
          offset: 0,
          nextOffset: null,
        },
        "/api/products/facets": {
          categories: [],
          brands: [],
          paths: [],
          sourceCategories: [],
        },
        "/api/brand-logos": {},
        "/api/catalog/refresh": { status: "idle" },
      };
      return new Response(JSON.stringify(responses[path] || {}));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const context: { XLSX?: Window["XLSX"] } & Pick<
    typeof globalThis,
    "ArrayBuffer" | "Uint8Array"
  > = { ArrayBuffer, Uint8Array };
  runInNewContext(
    readFileSync(`${process.cwd()}/public/vendor/xlsx.js`, "utf8"),
    context,
  );
  vi.stubGlobal("XLSX", context.XLSX);
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", {
      name: `Open campaign: ${campaign.name}`,
    }),
  );
  await view.findByRole("button", { name: /Brochure design/ });
  async function importCsv(content: string, count: number) {
    fireEvent.click(view.getByRole("button", { name: "Upload products" }));
    const bytes = new TextEncoder().encode(content);
    const csv = new Uint8Array(new ArrayBuffer(bytes.length));
    csv.set(bytes);
    const file = new File([csv], "photos.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => csv.buffer,
    });
    const input = view.container.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".csv,.xlsx,.xls"]',
    );
    if (!input) throw new Error("Import must provide its file input.");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(
      await view.findByRole("button", {
        name: new RegExp(`^Add ${count} products?`),
      }),
    );
  }
  return { view, fetchMock, importCsv };
}

it("keeps the brochure hidden until imported, searched and prepared photos have all been saved", async () => {
  const sourcePhoto = deferred<Awaited<ReturnType<typeof requestAi>>>();
  const search = deferred<Awaited<ReturnType<typeof requestAi>>>();
  const foundPhoto = deferred<Awaited<ReturnType<typeof requestAi>>>();
  const finalSave = deferred<void>();
  let finalSaveReached = false;
  vi.mocked(requestAi).mockImplementation((path, params) => {
    if (path === "ai-find-product-image") return search.promise;
    const image =
      typeof params === "object" && params !== null && "image" in params
        ? params.image
        : undefined;
    return image === "/found-source.png"
      ? foundPhoto.promise
      : sourcePhoto.promise;
  });
  const { view, fetchMock, importCsv } = await photoImportWorkspace(
    async (saved) => {
      if (
        saved.products.some(
          (product) => product.image === "/found-prepared.png",
        )
      ) {
        finalSaveReached = true;
        await finalSave.promise;
      }
    },
  );
  await importCsv(
    "Code,Product name,Sale price,Regular price,Brochure position\n77777,Imported speaker,79,99,1.1\n88888,Exact model ZX2,49,69,1.2\n",
    2,
  );
  const assertBlocked = () => {
    expect(
      view.getByRole("dialog", { name: "Preparing product photos…" }),
    ).toBeTruthy();
    expect(view.container.querySelector(".cs-canvas-dock")).toBeNull();
    expect(view.container.querySelector(".brochure-page")).toBeNull();
  };
  await waitFor(() => expect(requestAi).toHaveBeenCalledTimes(2));
  assertBlocked();
  await act(async () =>
    sourcePhoto.resolve({
      image: "/source-prepared.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    }),
  );
  assertBlocked();
  await act(async () =>
    search.resolve({
      found: true,
      image: "/found-source.png",
      sourceUrl: "https://example.test/ZX2",
      imageUrl: "https://example.test/ZX2.png",
      matchedName: "Exact model ZX2",
    }),
  );
  await waitFor(() => expect(requestAi).toHaveBeenCalledTimes(3));
  expect(vi.mocked(requestAi).mock.calls[2]?.[1]).toMatchObject({
    image: "/found-source.png",
  });
  assertBlocked();
  await act(async () =>
    foundPhoto.resolve({
      image: "/found-prepared.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    }),
  );
  await waitFor(() => expect(finalSaveReached).toBe(true));
  assertBlocked();
  await act(async () => finalSave.resolve());
  await waitFor(() =>
    expect(
      view.queryByRole("dialog", { name: "Preparing product photos…" }),
    ).toBeNull(),
  );
  await waitFor(() =>
    expect(view.container.querySelector(".cs-canvas-dock")).toBeTruthy(),
  );
  expect(
    view.container.querySelector('img[src="/source-prepared.png"]'),
  ).toBeTruthy();
  expect(
    view.container.querySelector('img[src="/found-prepared.png"]'),
  ).toBeTruthy();
  const saved = fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)).campaign as Campaign)
    .filter(Boolean);
  expect(
    saved.some((item) =>
      item.products.some(
        (product) =>
          product.code === "88888" &&
          product.image === "/found-prepared.png" &&
          product.aiCutoutValidated,
      ),
    ),
  ).toBe(true);
  expect(requestAi).toHaveBeenCalledTimes(3);
});

it("keeps failed photo preparation in the blocking stage and opens the brochure when dismissed", async () => {
  vi.mocked(requestAi).mockRejectedValue(new Error("Photo preparation failed"));
  const { view, fetchMock, importCsv } = await photoImportWorkspace();
  await importCsv("Code,Sale price\n77777,79\n", 1);
  await view.findByRole("dialog", {
    name: "Photo preparation needs attention",
  });
  expect(view.container.querySelector(".cs-canvas-dock")).toBeNull();
  expect(
    fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/ai/cutouts/reuse"),
    ),
  ).toHaveLength(1);
  fireEvent.click(view.getByRole("button", { name: "Retry failed photos" }));
  await waitFor(() => expect(requestAi).toHaveBeenCalledTimes(2));
  expect(
    fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/ai/cutouts/reuse"),
    ),
  ).toHaveLength(1);
  await view.findByRole("dialog", {
    name: "Photo preparation needs attention",
  });
  expect(view.container.querySelector(".cs-canvas-dock")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Close and upload photos" }),
  );
  await waitFor(() =>
    expect(
      view.queryByRole("dialog", { name: "Photo preparation needs attention" }),
    ).toBeNull(),
  );
  expect(view.container.querySelector(".cs-canvas-dock")).toBeTruthy();
  expect(
    view.getByRole("button", { name: /Brochure design/ }).className,
  ).toContain("active");
  expect(
    view.getByRole("button", { name: /Products & prices/ }).className,
  ).not.toContain("active");
  expect(requestAi).toHaveBeenCalledTimes(2);
});

it("opens the brochure after a missing-photo search and allows manual image upload without restarting AI", async () => {
  vi.mocked(requestAi).mockResolvedValue({
    found: false,
    reason: "No exact product photo",
  });
  const { view, fetchMock, importCsv } = await photoImportWorkspace();
  await importCsv(
    "Code,Product name,Sale price,Regular price,Brochure position\n88888,Exact model ZX2,49,69,1.1\n",
    1,
  );
  await view.findByRole("dialog", {
    name: "Photo preparation needs attention",
  });
  expect(requestAi).toHaveBeenCalledOnce();
  expect(vi.mocked(requestAi).mock.calls[0]?.[0]).toBe("ai-find-product-image");
  expect(view.container.querySelector(".cs-canvas-dock")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(
      view.queryByRole("dialog", { name: "Photo preparation needs attention" }),
    ).toBeNull(),
  );
  expect(
    view.getByRole("button", { name: /Brochure design/ }).className,
  ).toContain("active");
  expect(view.container.querySelector(".cs-canvas-dock")).toBeTruthy();
  expect(requestAi).toHaveBeenCalledOnce();
  fireEvent.click(view.getByRole("button", { name: /Products & prices/ }));
  expect(view.getByRole("heading", { name: "Exact model ZX2" })).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", {
      name: "Change image: Exact model ZX2",
    }),
  );
  await view.findByRole("dialog", { name: "Change product image" });
  expect(view.getByRole("button", { name: "Upload own image" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Upload image" })).toBeTruthy();
  expect(
    [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].some(
      (input) => input.accept.includes("image/"),
    ),
  ).toBe(true);
  const saved = fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)).campaign as Campaign)
    .filter(Boolean);
  expect(saved.at(-1)?.products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "88888",
        name: "Exact model ZX2",
        imageSearch: expect.objectContaining({ status: "not_found" }),
      }),
    ]),
  );
  expect(requestAi).toHaveBeenCalledOnce();
});

const reuseCatalog: Campaign["products"] = [
  {
    code: "77777",
    name: "Imported speaker",
    image: "/imported-source.png",
    regular: 99,
  },
  {
    code: "88888",
    name: "Imported headphones",
    image: "/headphones-source.png",
    regular: 69,
  },
];
const reuseCsv =
  "Code,Product name,Sale price,Regular price,Brochure position\n77777,Imported speaker,79,99,1.1\n88888,Imported headphones,49,69,1.2\n";

function cachedPhoto(key: string, image: string, index = 1) {
  return {
    key,
    resultId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    result: {
      image,
      cutoutValidated: true,
      cutoutValidationVersion: 1,
      annotationCleanup: true,
      annotationHandling: "editable-overlays",
      provider: "openai",
    },
  };
}

it("reuses all validated photos for a new campaign importing the same spreadsheet without orientation checks or AI work", async () => {
  vi.mocked(requestAi).mockResolvedValue({
    image: "/unexpected-paid-result.png",
    cutoutValidated: true,
    cutoutValidationVersion: 1,
  });
  const { view, fetchMock, importCsv } = await photoImportWorkspace(undefined, {
    campaignId: "new-campaign-same-spreadsheet",
    catalogProducts: reuseCatalog,
    reuse: (items) =>
      new Response(
        JSON.stringify({
          items: items.map((item, index) =>
            cachedPhoto(
              item.key,
              item.image === "/imported-source.png"
                ? "/reused-speaker.png"
                : "/reused-headphones.png",
              index + 1,
            ),
          ),
        }),
      ),
  });
  await importCsv(reuseCsv, 2);
  await waitFor(() =>
    expect(
      view.container.querySelector('img[src="/reused-headphones.png"]'),
    ).toBeTruthy(),
  );
  expect(
    view.queryByRole("dialog", { name: "Preparing product photos…" }),
  ).toBeNull();
  expect(
    view.container.querySelector('img[src="/reused-speaker.png"]'),
  ).toBeTruthy();
  expect(imageOrientation).not.toHaveBeenCalled();
  expect(requestAi).not.toHaveBeenCalled();
  const lookups = fetchMock.mock.calls.filter(([input]) =>
    String(input).includes("/api/ai/cutouts/reuse"),
  );
  expect(lookups).toHaveLength(1);
  expect(lookups[0]?.[1]?.method).toBe("POST");
  expect(JSON.parse(String(lookups[0]?.[1]?.body)).items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ image: "/imported-source.png" }),
      expect.objectContaining({ image: "/headphones-source.png" }),
    ]),
  );
  const savesWithCachedPhotos = fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input).endsWith("/api/team/campaigns") &&
        init?.method === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)).campaign as Campaign)
    .filter((saved) =>
      saved.products.some((product) => product.image?.startsWith("/reused-")),
    );
  expect(savesWithCachedPhotos).toHaveLength(1);
  expect(savesWithCachedPhotos[0]?.products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "77777",
        image: "/reused-speaker.png",
        aiOriginalImage: "/imported-source.png",
        aiCutoutValidated: true,
        aiCutoutValidationVersion: 1,
        aiAnnotationCleanup: true,
      }),
      expect.objectContaining({
        code: "88888",
        image: "/reused-headphones.png",
        aiOriginalImage: "/headphones-source.png",
        aiCutoutValidated: true,
      }),
    ]),
  );
});

it("prepares only the cache miss after applying and saving a validated cache hit", async () => {
  const missedPhoto = deferred<Awaited<ReturnType<typeof requestAi>>>();
  vi.mocked(requestAi).mockImplementation(() => missedPhoto.promise);
  const { view, fetchMock, importCsv } = await photoImportWorkspace(undefined, {
    catalogProducts: reuseCatalog,
    reuse: (items) =>
      new Response(
        JSON.stringify({
          items: items
            .filter((item) => item.image === "/imported-source.png")
            .map((item) => cachedPhoto(item.key, "/reused-speaker.png")),
        }),
      ),
  });
  await importCsv(reuseCsv, 2);
  await waitFor(() => expect(requestAi).toHaveBeenCalledOnce());
  expect(vi.mocked(requestAi).mock.calls[0]?.[0]).toBe("ai-remove-background");
  expect(vi.mocked(requestAi).mock.calls[0]?.[1]).toMatchObject({
    image: "/headphones-source.png",
    name: "Imported headphones",
  });
  expect(imageOrientation).toHaveBeenCalledExactlyOnceWith(
    "/headphones-source.png",
    expect.any(Function),
  );
  expect(
    view.getByRole("dialog", { name: "Preparing product photos…" }),
  ).toBeTruthy();
  const cachedSave = fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input).endsWith("/api/team/campaigns") &&
        init?.method === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)).campaign as Campaign)
    .find((saved) =>
      saved.products.some((product) => product.image === "/reused-speaker.png"),
    );
  expect(cachedSave?.products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "77777",
        image: "/reused-speaker.png",
        aiCutoutValidated: true,
      }),
      expect.objectContaining({
        code: "88888",
        image: "/headphones-source.png",
      }),
    ]),
  );
  await act(async () =>
    missedPhoto.resolve({
      image: "/newly-prepared-headphones.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    }),
  );
  await waitFor(() =>
    expect(
      view.container.querySelector('img[src="/newly-prepared-headphones.png"]'),
    ).toBeTruthy(),
  );
  expect(
    view.container.querySelector('img[src="/reused-speaker.png"]'),
  ).toBeTruthy();
  expect(requestAi).toHaveBeenCalledOnce();
  expect(imageOrientation).toHaveBeenCalledOnce();
});

it.each([false, true])(
  "blocks billable work after a failed saved-photo lookup and rechecks the cache on Retry (closed first: %s)",
  async (closeFirst) => {
    vi.mocked(requestAi).mockResolvedValue({
      image: "/unexpected-paid-result.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    });
    let lookupFailed = true;
    const { view, fetchMock, importCsv } = await photoImportWorkspace(
      undefined,
      {
        reuse: (items) => {
          if (lookupFailed) {
            lookupFailed = false;
            return new Response(
              JSON.stringify({
                error: "Saved product photos are unavailable.",
              }),
              { status: 503 },
            );
          }
          return new Response(
            JSON.stringify({
              items: items.map((item) =>
                cachedPhoto(item.key, "/recovered-saved-photo.png"),
              ),
            }),
          );
        },
      },
    );
    await importCsv("Code,Sale price\n77777,79\n", 1);
    await view.findByRole("dialog", {
      name: "Photo preparation needs attention",
    });
    expect(view.container.querySelector(".cs-canvas-dock")).toBeNull();
    expect(requestAi).not.toHaveBeenCalled();
    expect(imageOrientation).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/api/ai/cutouts/reuse"),
      ),
    ).toHaveLength(1);
    expect(
      view.getByText(
        "Saved photos could not be checked. Try again before preparing new versions.",
      ),
    ).toBeTruthy();
    if (closeFirst) {
      fireEvent.click(view.getByRole("button", { name: "Close" }));
      fireEvent.click(
        view.getByRole("button", { name: "View photo preparation details" }),
      );
    }
    fireEvent.click(view.getByRole("button", { name: "Retry failed photos" }));
    await waitFor(() =>
      expect(
        view.container.querySelector('img[src="/recovered-saved-photo.png"]'),
      ).toBeTruthy(),
    );
    expect(
      view.queryByRole("dialog", { name: "Photo preparation needs attention" }),
    ).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/api/ai/cutouts/reuse"),
      ),
    ).toHaveLength(2);
    expect(requestAi).not.toHaveBeenCalled();
    expect(imageOrientation).not.toHaveBeenCalled();
  },
);
