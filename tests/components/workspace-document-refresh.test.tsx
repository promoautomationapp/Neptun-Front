import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { Campaign } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";

vi.mock("../../src/features/brochure/CampaignActivityStatus", () => ({
  CampaignActivityStatus: () => <div />,
}));

const campaign: Campaign = {
  id: "refresh-page-tab",
  name: "Refresh review brochure",
  version: 3,
  status: "in_progress",
  coverProductCodes: ["cover"],
  layout: "grid4",
  autoProductLayout: false,
  includeStoresPage: false,
  includeStoresFooter: false,
  products: ["cover", "one", "two", "three", "four"].map((code) => ({
    code,
    name: code,
    image: "",
    skipAiCutout: true,
    cutoutStatus: "skipped",
    regular: 100,
    sale: 80,
  })),
};
const response = (value: unknown) => new Response(JSON.stringify(value));
function server(
  detail: () => Promise<Response> = async () => response({ campaign }),
) {
  const api = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://localhost").pathname;
    if (init?.method && init.method !== "GET")
      throw new Error(`Unexpected write ${path}`);
    if (path === `/api/team/campaigns/${campaign.id}`) return detail();
    const data: Record<string, unknown> = {
      "/api/team/session": {
        configured: true,
        user: {
          id: "refresh-staff",
          name: "Staff",
          email: "staff@example.test",
          role: "staff",
          permissions: "editor",
          organizationId: "00000000-0000-4000-8000-000000000000",
          mustChangePassword: false,
        },
      },
      "/api/team/campaigns": { campaigns: [campaign] },
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
    return response(data[path] || {});
  });
  vi.stubGlobal("fetch", api);
  return api;
}
beforeEach(() => {
  setLanguage("en");
  localStorage.removeItem("neptun-campaign-filters");
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

it.each(["page", "tab"])(
  "keeps a newer %s selection when the refresh document check finishes late",
  async (selection) => {
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    let checkFinished = false;
    const api = server(() =>
      checkFinished ? Promise.resolve(response({ campaign })) : pending,
    );
    window.history.replaceState(
      {},
      "",
      `/?campaign=${campaign.id}&page=1&tab=brochure`,
    );
    let view = render(<App />);
    await waitFor(() =>
      expect(
        view
          .getByRole("button", { name: "Page 2" })
          .getAttribute("aria-current"),
      ).toBe("page"),
    );
    await waitFor(() =>
      expect(
        api.mock.calls.some(([input]) =>
          String(input).endsWith(`/api/team/campaigns/${campaign.id}`),
        ),
      ).toBe(true),
    );
    if (selection === "page") {
      fireEvent.click(view.getByRole("button", { name: "Cover" }));
      await waitFor(() =>
        expect(new URLSearchParams(window.location.search).has("page")).toBe(
          false,
        ),
      );
    } else {
      fireEvent.click(
        view.getByRole("button", { name: /02 Products & prices/ }),
      );
      await waitFor(() =>
        expect(new URLSearchParams(window.location.search).get("tab")).toBe(
          "products",
        ),
      );
    }
    await act(async () => {
      finish(response({ campaign }));
      await pending;
    });
    checkFinished = true;
    if (selection === "page") {
      expect(
        view
          .getByRole("button", { name: "Cover" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(new URLSearchParams(window.location.search).has("page")).toBe(
        false,
      );
    } else {
      expect(
        view
          .getByRole("button", { name: /02 Products & prices/ })
          .classList.contains("active"),
      ).toBe(true);
      expect(new URLSearchParams(window.location.search).get("tab")).toBe(
        "products",
      );
    }
    view.unmount();
    view = render(<App />);
    await waitFor(() => {
      if (selection === "page")
        expect(
          view
            .getByRole("button", { name: "Cover" })
            .getAttribute("aria-current"),
        ).toBe("page");
      else
        expect(
          view
            .getByRole("button", { name: /02 Products & prices/ })
            .classList.contains("active"),
        ).toBe(true);
    });
    expect(
      api.mock.calls.every(
        ([, init]) => !init?.method || init.method === "GET",
      ),
    ).toBe(true);
  },
);

it("restores the chosen Settings area and nested tab through complete workspace remounts", async () => {
  server();
  window.history.replaceState(
    {},
    "",
    "/?section=stores&settingsArea=inside&settingsTab=categories",
  );
  let view = render(<App />);
  await waitFor(() =>
    expect(
      view
        .getByRole("tab", { name: "Inside pages" })
        .getAttribute("aria-selected"),
    ).toBe("true"),
  );
  expect(
    view
      .getByRole("tab", { name: "Category defaults" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(view.getByRole("tab", { name: "Stores footer" }));
  fireEvent.click(view.getByRole("tab", { name: "Logos & icons" }));
  await waitFor(() =>
    expect(new URLSearchParams(window.location.search).get("settingsTab")).toBe(
      "logos",
    ),
  );
  expect(new URLSearchParams(window.location.search).get("settingsArea")).toBe(
    "footer",
  );
  view.unmount();
  view = render(<App />);
  await waitFor(() =>
    expect(
      view
        .getByRole("tab", { name: "Stores footer" })
        .getAttribute("aria-selected"),
    ).toBe("true"),
  );
  expect(
    view
      .getByRole("tab", { name: "Logos & icons" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(new URLSearchParams(window.location.search).get("settingsArea")).toBe(
    "footer",
  );
  expect(new URLSearchParams(window.location.search).get("settingsTab")).toBe(
    "logos",
  );
});
