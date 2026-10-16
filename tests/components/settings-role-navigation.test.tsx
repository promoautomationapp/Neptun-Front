import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["superadmin", "admin", "pm", "staff"])(
  "opens complete Settings for %s while brochure loading is stalled",
  async (role) => {
    setLanguage("en");
    vi.stubGlobal("scrollTo", vi.fn());
    const restricted = role === "pm" || role === "staff";
    const user = {
      id: "test-" + role,
      email: role + "@example.test",
      name: "Settings user",
      role,
      permissions: restricted ? "editor" : "admin",
      organizationId: "00000000-0000-4000-8000-000000000000",
      mustChangePassword: false,
      access: {
        mode: restricted ? "custom" : "default",
        canViewCatalog: !restricted,
        canViewSocialPosts: true,
        canDisableBrochures: true,
        catalogCategoryPaths: null,
      },
    };
    const api = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        const path = new URL(String(input), "http://localhost").pathname;
        if (path === "/api/team/campaigns")
          return new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        const data: Record<string, unknown> = {
          "/api/team/session": { configured: true, user },
          "/api/team/settings": {
            settings: resolveSettings(null),
            version: 4,
            updatedAt: null,
          },
          "/api/team/members": { members: [] },
          "/api/notifications": { notifications: [], unreadCount: 0 },
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
        return new Response(JSON.stringify(data[path] || {}));
      },
    );
    vi.stubGlobal("fetch", api);
    const view = render(<App />);
    fireEvent.click(
      await view.findByRole("button", { name: /^Settings$/ }),
    );
    await view.findByRole("tab", { name: "Reusable images" });
    expect(
      view.getByRole("combobox", { name: "Default cover style" }),
    ).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Orange top / blue" }));
    await waitFor(() =>
      expect(
        (
          view.getByRole("button", {
            name: "Save settings",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(view.getByRole("tab", { name: "Logos & icons" }));
    expect(view.getByRole("button", { name: "Add logo" })).toBeTruthy();
    expect(view.queryByRole("alert")).toBeNull();
    if (restricted)
      expect(
        api.mock.calls.some(([input]) =>
          String(input).includes("/api/products"),
        ),
      ).toBe(false);
    expect(
      api.mock.calls.filter(([input]) =>
        String(input).includes("/api/team/settings"),
      ),
    ).toHaveLength(1);
  },
);
