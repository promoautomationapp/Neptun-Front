import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens the full authenticated studio and loads its catalog through the backend", async () => {
  setLanguage("en");
  const user = {
    id: "user",
    email: "staff@example.test",
    role: "staff",
    permissions: "editor",
    organizationId: "e951c95a-9e9a-48b2-986a-67c3c8a1d916",
    mustChangePassword: false,
  };
  const api = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
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
      "/api/brand-logos": {},
    };
    return new Response(JSON.stringify(responses[url.pathname] ?? {}), {
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", api);
  const view = render(<App />);
  const create = await view.findByRole("button", { name: "New campaign" });
  await waitFor(() =>
    expect(
      api.mock.calls.some(([input]) =>
        String(input).includes("/api/products?"),
      ),
    ).toBe(true),
  );
  expect(
    api.mock.calls.some(([input]) => String(input).includes("/catalog.json")),
  ).toBe(false);
  expect(view.queryByText(/editors are being ported/)).toBeNull();
  fireEvent.click(create);
  expect(view.getByRole("dialog", { name: "Create a campaign" })).toBeTruthy();
  expect(
    view.container.querySelector('input[type="file"][accept*=".csv"]'),
  ).toBeTruthy();
});

it("shows saved campaigns before the complete source catalog finishes loading", async () => {
  setLanguage("en");
  const user = {
    id: "user",
    email: "staff@example.test",
    role: "staff",
    permissions: "editor",
    organizationId: "e951c95a-9e9a-48b2-986a-67c3c8a1d916",
    mustChangePassword: false,
  };
  let completeCatalog!: () => void;
  const catalog = new Promise<Response>((resolve) => {
    completeCatalog = () =>
      resolve(
        new Response(
          JSON.stringify({
            products: [],
            total: 0,
            limit: 100,
            offset: 0,
            nextOffset: null,
          }),
        ),
      );
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path === "/api/products") return catalog;
      const data: Record<string, unknown> = {
        "/api/team/session": { configured: true, user },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": {
          campaigns: [
            {
              id: "saved-twelve",
              name: "Saved twelve-product campaign",
              products: [],
            },
          ],
        },
        "/api/team/settings": { settings: null, version: 0, updatedAt: null },
        "/api/brand-logos": {},
      };
      return new Response(JSON.stringify(data[path] ?? {}));
    }),
  );
  const view = render(<App />);
  await view.findByText("Saved twelve-product campaign", {
    selector: "strong",
  });
  expect(view.queryByText("Your first campaign starts here")).toBeNull();
  completeCatalog();
});
