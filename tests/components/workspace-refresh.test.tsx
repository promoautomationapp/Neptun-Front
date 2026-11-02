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
import { request } from "../../src/api/client";
import { z } from "zod";

vi.mock("../../src/features/settings/SettingsPage", () => ({
  SettingsPage: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void;
  }) => (
    <>
      <h1>Settings screen</h1>
      <button onClick={() => onDirtyChange?.(true)}>Change setting</button>
    </>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});
function server() {
  const user = {
    id: "staff",
    email: "staff@example.test",
    name: "Staff",
    role: "staff",
    permissions: "editor",
    organizationId: "00000000-0000-4000-8000-000000000000",
    mustChangePassword: false,
  };
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname;
      const data: Record<string, unknown> = {
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
        "/api/notifications": { notifications: [], unreadCount: 0 },
      };
      return new Response(JSON.stringify(data[path] || {}));
    }),
  );
  setLanguage("en");
}
it("loads the requested section before rendering, writes navigation and restores it after remount/back", async () => {
  server();
  window.history.replaceState({}, "", "/?section=catalog");
  let view = render(<App />);
  await view.findByRole("heading", { name: "Product catalog" });
  expect(window.location.search).toBe("?section=catalog");
  fireEvent.click(view.getByRole("button", { name: "Settings" }));
  await view.findByRole("heading", { name: "Settings screen" });
  await waitFor(() => expect(window.location.search).toBe("?section=stores"));
  view.unmount();
  view = render(<App />);
  await view.findByRole("heading", { name: "Settings screen" });
  await act(async () => {
    window.history.replaceState({}, "", "/?section=catalog");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await view.findByRole("heading", { name: "Product catalog" });
  expect(window.location.search).toBe("?section=catalog");
});
it("returns immediately to sign-in on an authenticated401 while retaining the current URL", async () => {
  server();
  window.history.replaceState({}, "", "/?section=catalog");
  const view = render(<App />);
  await view.findByRole("heading", { name: "Product catalog" });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Sign in to continue." }), {
          status: 401,
        }),
    ),
  );
  await act(async () => {
    await request("/api/team/campaigns", z.unknown()).catch(() => undefined);
  });
  await view.findByRole("button", { name: "Sign in to studio →" });
  expect(window.location.search).toBe("?section=catalog");
  expect(view.queryByRole("heading", { name: "Product catalog" })).toBeNull();
});

it("guards browser Back while Settings has unsaved changes", async () => {
  server();
  window.history.replaceState({}, "", "/?section=catalog");
  const view = render(<App />);
  await view.findByRole("heading", { name: "Product catalog" });
  fireEvent.click(view.getByRole("button", { name: "Settings" }));
  await view.findByRole("heading", { name: "Settings screen" });
  fireEvent.click(view.getByRole("button", { name: "Change setting" }));
  act(() => window.history.back());
  fireEvent.click(await view.findByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(window.location.search).toBe("?section=stores"));
  expect(view.getByRole("heading", { name: "Settings screen" })).toBeTruthy();
  act(() => window.history.back());
  fireEvent.click(await view.findByRole("button", { name: "Discard changes" }));
  await view.findByRole("heading", { name: "Product catalog" });
  expect(window.location.search).toBe("?section=catalog");
});
it("keeps an unavailable brochure URL and shows a clear result instead of loading forever", async () => {
  server();
  window.history.replaceState({}, "", "/?campaign=missing&tab=brochure");
  const view = render(<App />);
  await view.findByRole("heading", { name: "Brochure unavailable" });
  expect(new URLSearchParams(window.location.search).get("campaign")).toBe(
    "missing",
  );
});
