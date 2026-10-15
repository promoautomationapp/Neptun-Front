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

const socialModule = vi.hoisted(() => {
  let fail!: (reason: Error) => void;
  const pending = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  return { pending, fail: (reason: Error) => fail(reason) };
});
vi.mock("../../src/features/social/SocialStudio", () => socialModule.pending);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains the authenticated shell during a delayed or failed page load and resets navigation scroll", async () => {
  setLanguage("en");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const user = {
    id: "local-user",
    email: "staff@example.test",
    name: "Local staff",
    role: "staff",
    permissions: "editor",
    organizationId: "00000000-0000-4000-8000-000000000000",
    mustChangePassword: false,
  };
  const api = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const responses: Record<string, unknown> = {
      "/api/team/session": { configured: true, user },
      "/api/team/members": { members: [] },
      "/api/team/campaigns": { campaigns: [] },
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
  });
  vi.stubGlobal("fetch", api);
  const scroll = vi.fn(() => vi.stubGlobal("scrollY", 0));
  vi.stubGlobal("scrollTo", scroll);
  const view = render(<App />);
  await view.findByRole("button", { name: "New campaign" });
  const sidebar = view.container.querySelector(".cs-sidebar");
  const header = view.container.querySelector(".cs-topbar");
  expect(
    api.mock.calls.filter(([input]) =>
      String(input).includes("/api/team/session"),
    ),
  ).toHaveLength(1);
  vi.stubGlobal("scrollY", 180);
  fireEvent.click(view.getByRole("button", { name: "Social posts" }));
  await view.findByText("Loading social posts…");
  expect(scroll).toHaveBeenCalledWith(0, 0);
  expect(view.container.querySelector(".cs-sidebar")).toBe(sidebar);
  expect(view.container.querySelector(".cs-topbar")).toBe(header);
  await act(async () =>
    socialModule.fail(new Error("The page module is temporarily unavailable")),
  );
  await view.findByRole("button", { name: "Back to campaigns" });
  expect(view.container.querySelector(".cs-sidebar")).toBe(sidebar);
  expect(view.container.querySelector(".cs-topbar")).toBe(header);
  fireEvent.click(view.getByRole("button", { name: "Product catalog" }));
  await waitFor(() =>
    expect(
      view.queryByRole("button", { name: "Back to campaigns" }),
    ).toBeNull(),
  );
  expect(view.container.querySelector(".cs-sidebar")).toBe(sidebar);
  expect(view.container.querySelector(".cs-topbar")).toBe(header);
  expect(view.queryByText("Checking session…")).toBeNull();
});
