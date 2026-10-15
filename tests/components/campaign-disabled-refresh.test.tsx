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
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(confirm: () => Promise<Response>) {
  setLanguage("en");
  localStorage.removeItem("neptun-campaign-filters");
  let hidden = false;
  const campaign = {
    id: "refresh-disabled",
    name: "Saved brochure",
    products: [],
    version: 2,
    status: "in_progress",
    updatedAt: "2026-10-15T10:00:00Z",
  };
  const api = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "http://localhost").pathname;
    if (path === `/api/team/campaigns/${campaign.id}`) return confirm();
    const responses: Record<string, unknown> = {
      "/api/team/session": {
        configured: true,
        user: {
          id: "staff",
          name: "Staff",
          email: "staff@example.test",
          role: "staff",
          permissions: "editor",
          organizationId: "00000000-0000-4000-8000-000000000000",
          mustChangePassword: false,
        },
      },
      "/api/team/campaigns": { campaigns: hidden ? [] : [campaign] },
      "/api/team/settings": { settings: null, version: 0, updatedAt: null },
      "/api/team/members": { members: [] },
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
      [`/api/team/campaigns/${campaign.id}/presence`]: { participants: [] },
    };
    return new Response(JSON.stringify(responses[path] || {}));
  });
  vi.stubGlobal("fetch", api);
  return {
    api,
    hide: () => {
      hidden = true;
    },
    campaign,
  };
}

it("leaves a disabled editor only after its persisted ID returns a confirmed404", async () => {
  const source = fixture(
    async () =>
      new Response('{"error":"Document not found."}', { status: 404 }),
  );
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", { name: "Open campaign: Saved brochure" }),
  );
  await view.findAllByRole("heading", { name: "Saved brochure" });
  source.hide();
  fireEvent.focus(window);
  await view.findByRole("heading", { name: "Campaigns" });
  expect(
    source.api.mock.calls.some(
      ([input]) =>
        new URL(String(input), "http://localhost").pathname ===
        `/api/team/campaigns/${source.campaign.id}`,
    ),
  ).toBe(true);
  expect(
    view.queryAllByRole("heading", { name: "Saved brochure" }),
  ).toHaveLength(0);
  expect(
    view.queryByRole("button", { name: "Open campaign: Saved brochure" }),
  ).toBeNull();
});

it("aborts stale confirmation when the user navigates elsewhere", async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const source = fixture(() => pending);
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", { name: "Open campaign: Saved brochure" }),
  );
  await view.findAllByRole("heading", { name: "Saved brochure" });
  source.hide();
  fireEvent.focus(window);
  await waitFor(() =>
    expect(
      source.api.mock.calls.some(
        ([input]) =>
          new URL(String(input), "http://localhost").pathname ===
          `/api/team/campaigns/${source.campaign.id}`,
      ),
    ).toBe(true),
  );
  fireEvent.click(view.getByRole("button", { name: "Product catalog" }));
  await view.findByRole("heading", { name: "Product catalog" });
  await act(async () => {
    finish(new Response('{"error":"Document not found."}', { status: 404 }));
    await pending;
  });
  expect(view.getByRole("heading", { name: "Product catalog" })).toBeTruthy();
  expect(view.queryByText("This campaign is no longer available.")).toBeNull();
});

it("keeps the editor draft when the missing-list confirmation has a network failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const source = fixture(
    async () =>
      new Response('{"error":"Temporarily offline"}', { status: 503 }),
  );
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", { name: "Open campaign: Saved brochure" }),
  );
  await view.findAllByRole("heading", { name: "Saved brochure" });
  source.hide();
  fireEvent.focus(window);
  await waitFor(() => expect(console.error).toHaveBeenCalled());
  expect(
    view.getAllByRole("heading", { name: "Saved brochure" }).length,
  ).toBeGreaterThan(0);
});
