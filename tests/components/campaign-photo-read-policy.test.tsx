import React from "react";
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
  requestAi: vi.fn(async () => ({ image: "/mock-prepared.png" })),
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
          products: [],
          total: 0,
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
});
