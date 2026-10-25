import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { setLanguage } from "../../src/features/brochure/i18n";

const removalCopy = "This brochure will be removed from your campaigns.";
const recoveryCopy =
  "You can restore this brochure from Deleted brochures if it was removed by mistake.";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem("neptun-campaign-filters");
  setLanguage("en");
});

function openFixture(
  role: "staff" | "superadmin",
  language: "en" | "sq" = "en",
) {
  setLanguage(language);
  localStorage.removeItem("neptun-campaign-filters");
  const user = {
    id: "copy-reviewer",
    email: "reviewer@example.test",
    name: "Reviewer",
    role,
    permissions: role === "superadmin" ? "admin" : "editor",
    organizationId: "00000000-0000-4000-8000-000000000000",
    mustChangePassword: false,
  };
  const campaign = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Sample",
    products: [],
    version: 1,
    status: "in_progress",
  };
  const api = vi.fn(
    async (input: RequestInfo | URL, _options?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const responses: Record<string, unknown> = {
        "/api/team/session": { configured: true, user },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: [campaign] },
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
        "/api/notifications": { notifications: [], unreadCount: 0 },
      };
      return new Response(JSON.stringify(responses[path] || {}));
    },
  );
  vi.stubGlobal("fetch", api);
  vi.stubGlobal("scrollTo", vi.fn());
  return { api, view: render(<App />) };
}

it("shows ordinary staff a Delete action and a concise confirmation without recovery details", async () => {
  const { api, view } = openFixture("staff");
  const remove = await view.findByRole("button", {
    name: "Delete campaign: Sample",
  });
  expect(remove.textContent).toBe("Delete");
  expect(view.queryByRole("button", { name: /Disable campaign/ })).toBeNull();
  fireEvent.click(remove);
  const dialog = view.getByRole("dialog", { name: "Delete campaign" });
  expect(
    [...dialog.querySelectorAll("p")].map((item) => item.textContent),
  ).toEqual([removalCopy]);
  expect(
    within(dialog).getByRole("button", { name: "Delete campaign" }),
  ).toBeTruthy();
  expect(dialog.textContent).not.toMatch(/superadmin|restore|mistake|support/i);
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
});

it("includes recovery guidance for superadmins only", async () => {
  const { api, view } = openFixture("superadmin");
  fireEvent.click(
    await view.findByRole("button", { name: "Delete campaign: Sample" }),
  );
  const dialog = view.getByRole("dialog", { name: "Delete campaign" });
  expect(
    [...dialog.querySelectorAll("p")].map((item) => item.textContent),
  ).toEqual([removalCopy, recoveryCopy]);
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
});

it("labels the Albanian action Fshij and keeps client confirmation free of internal recovery copy", async () => {
  const { api, view } = openFixture("staff", "sq");
  const remove = await view.findByRole("button", {
    name: "Fshij fushatën: Sample",
  });
  expect(remove.textContent).toBe("Fshij");
  expect(
    view.queryByRole("button", { name: /Çaktivizo|Disable campaign/ }),
  ).toBeNull();
  fireEvent.click(remove);
  const dialog = view.getByRole("dialog", { name: "Fshij fushatën" });
  expect(
    [...dialog.querySelectorAll("p")].map((item) => item.textContent),
  ).toEqual(["Kjo broshurë do të hiqet nga fushatat tuaja."]);
  expect(
    within(dialog).getByRole("button", { name: "Fshij fushatën" }),
  ).toBeTruthy();
  expect(dialog.textContent).not.toMatch(/superadmin|rikth|gabim/i);
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
});
