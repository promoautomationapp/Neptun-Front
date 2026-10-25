import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import {
  defaultWorkspaceAccess,
  type WorkspaceAccess,
} from "../../src/features/auth/workspaceAccess";
import { setLanguage } from "../../src/features/brochure/i18n";

vi.mock("../../src/features/brochure/CampaignActivityStatus", () => ({
  CampaignActivityStatus: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const disabledAccess = {
  ...defaultWorkspaceAccess(),
  mode: "custom" as const,
  canDisableBrochures: false,
  canViewCatalog: false,
  canViewSocialPosts: false,
};
function server(access: WorkspaceAccess = disabledAccess) {
  let user = {
    id: "permission-staff",
    name: "Staff",
    email: "staff@example.test",
    role: "staff",
    permissions: "editor",
    organizationId: "00000000-0000-4000-8000-000000000000",
    mustChangePassword: false,
    access,
  };
  const allowed = {
    code: "allowed",
    name: "Allowed laptop",
    category: "IT",
    subcategory: "Computers",
    categoryPath: "IT > Computers > Laptops",
    image: "",
    sale: 100,
  };
  const outside = {
    code: "outside",
    name: "Hidden television",
    category: "TV",
    subcategory: "OLED",
    categoryPath: "TV > OLED",
    image: "",
    sale: 100,
    skipAiCutout: true,
  };
  const api = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method && init.method !== "GET")
      throw new Error("No writes expected");
    const path = new URL(String(input), "http://localhost").pathname;
    const responses: Record<string, unknown> = {
      "/api/team/session": { configured: true, user },
      "/api/team/members": { members: [] },
      "/api/team/campaigns": {
        campaigns: [
          {
            id: "shared",
            name: "Shared brochure",
            version: 1,
            products: [outside],
            includeStoresPage: false,
            includeStoresFooter: false,
          },
        ],
      },
      "/api/team/settings": { settings: null, version: 0, updatedAt: null },
      "/api/products": {
        products: [allowed],
        total: 1,
        limit: 100,
        offset: 0,
        nextOffset: null,
      },
      "/api/products/facets": {
        categories: ["IT"],
        brands: [],
        paths: [],
        sourceCategories: [],
      },
      "/api/brand-logos": {},
      "/api/catalog/refresh": { status: "idle" },
      "/api/notifications": { notifications: [], unreadCount: 0 },
    };
    return new Response(JSON.stringify(responses[path] || {}));
  });
  vi.stubGlobal("fetch", api);
  return {
    api,
    updateAccess: (next: typeof access) => {
      user = { ...user, access: next };
    },
  };
}
it("hides forbidden areas and disable actions without making forbidden catalog requests", async () => {
  setLanguage("en");
  const { api } = server();
  const view = render(<App />);
  await view.findByRole("button", { name: "Open campaign: Shared brochure" });
  const nav = within(view.container.querySelector("nav")!);
  expect(nav.queryByRole("button", { name: "Product catalog" })).toBeNull();
  expect(nav.queryByRole("button", { name: "Social posts" })).toBeNull();
  expect(view.queryByRole("button", { name: /Delete campaign:/ })).toBeNull();
  expect(view.queryByRole("button", { name: /Catalog details/ })).toBeNull();
  expect(
    api.mock.calls.some(([input]) =>
      /\/api\/(products|catalog)(?:\/|\?|$)/.test(String(input)),
    ),
  ).toBe(false);
  expect(
    api.mock.calls.filter(([input]) =>
      String(input).includes("/api/team/session"),
    ),
  ).toHaveLength(1);
  fireEvent.click(
    view.getByRole("button", { name: "Open campaign: Shared brochure" }),
  );
  await view.findByRole("button", { name: "Upload products" });
  expect(view.queryByRole("button", { name: /Create social post/ })).toBeNull();
  const actions = view.container.querySelector(
    "details.cs-brochure-actions-menu",
  ) as HTMLDetailsElement;
  actions.open = true;
  fireEvent(actions, new Event("toggle"));
  expect(view.queryByRole("button", { name: /Add products/ })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "02 Products & prices" }));
  expect(view.queryByRole("button", { name: /Add manually/ })).toBeNull();
  expect(view.queryByRole("button", { name: /Make social post/ })).toBeNull();
  expect(
    api.mock.calls.some(([input]) =>
      /\/api\/(products|catalog)(?:\/|\?|$)/.test(String(input)),
    ),
  ).toBe(false);
});

it("filters catalog supplements from shared brochures and removes revoked access without replacing the shell", async () => {
  setLanguage("en");
  const allowed = {
    ...disabledAccess,
    canViewCatalog: true,
    catalogCategoryPaths: ["IT > Computers"],
  };
  const { updateAccess } = server(allowed);
  const view = render(<App />);
  fireEvent.click(await view.findByRole("button", { name: "Product catalog" }));
  await view.findByText("Allowed laptop");
  expect(view.queryByText("Hidden television")).toBeNull();
  const sidebar = view.container.querySelector(".cs-sidebar"),
    header = view.container.querySelector(".cs-topbar");
  updateAccess(disabledAccess);
  fireEvent(window, new Event("focus"));
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Product catalog" })).toBeNull(),
  );
  expect(view.queryByText("Allowed laptop")).toBeNull();
  expect(view.container.querySelector(".cs-sidebar")).toBe(sidebar);
  expect(view.container.querySelector(".cs-topbar")).toBe(header);
  expect(
    await view.findByRole("button", { name: "New campaign" }),
  ).toBeTruthy();
});
