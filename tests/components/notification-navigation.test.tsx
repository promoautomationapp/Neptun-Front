import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import type { Campaign } from "../../src/domain/models";
import type { WorkspaceNotification } from "../../src/features/notifications/notifications.api";
import { setLanguage } from "../../src/features/brochure/i18n";
import { setCampaignSaveStatus } from "../../src/features/brochure/campaignSaveStatus";

// Presence is independent of navigation and normally writes a heartbeat.
vi.mock("../../src/features/brochure/CampaignActivityStatus", () => ({
  CampaignActivityStatus: () => <div data-testid="presence-stub" />,
}));

const notificationId = "00000000-0000-4000-8000-000000000501";
const campaign: Campaign = {
  id: "notification-navigation-campaign",
  name: "Notification review brochure",
  version: 3,
  status: "changes_requested",
  updatedAt: "2026-10-15T10:00:00Z",
  coverProductCodes: ["cover-offer"],
  layout: "grid4",
  autoProductLayout: false,
  includeStoresPage: false,
  includeStoresFooter: false,
  products: [
    "cover-offer",
    "offer-one",
    "offer-two",
    "offer-three",
    "offer-four",
  ].map((code) => ({
    code,
    name: code,
    image: "",
    skipAiCutout: true,
    cutoutStatus: "skipped",
    regular: 100,
    sale: 80,
  })),
  reviewComments: [
    {
      id: "cover-thread",
      pageIndex: 0,
      pageLabel: "Cover",
      position: { x: 25, y: 30 },
      text: "Please verify the cover heading.",
      authorEmail: "manager@example.test",
      createdAt: "2026-10-15T10:00:00Z",
      fixed: false,
      replies: [],
    },
    {
      id: "product-thread",
      pageIndex: 1,
      pageLabel: "Page 2",
      position: { x: 40, y: 40 },
      text: "Please verify this product price.",
      authorEmail: "manager@example.test",
      createdAt: "2026-10-15T10:05:00Z",
      fixed: false,
      replies: [],
    },
  ],
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockServer(
  getCampaign: () => Promise<Response> = async () => response({ campaign }),
  initialCampaign: Campaign = campaign,
) {
  let notification: WorkspaceNotification = {
    id: notificationId,
    type: "mention",
    campaignId: campaign.id,
    campaignName: campaign.name,
    pageIndex: 1,
    commentId: "product-thread",
    actorName: "Neptun PM",
    actorEmail: "manager@example.test",
    createdAt: "2026-10-15T10:05:00Z",
    readAt: null,
    message: "Please verify this product price.",
  };
  const api = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    if (
      init?.method === "POST" &&
      url.pathname === `/api/notifications/${notificationId}/read`
    ) {
      notification = { ...notification, readAt: "2026-10-15T11:00:00Z" };
      return response({ read: true });
    }
    if (init?.method && init.method !== "GET")
      throw new Error(
        `Unexpected write in notification navigation: ${init.method} ${url.pathname}`,
      );
    if (url.pathname === `/api/team/campaigns/${campaign.id}`)
      return getCampaign();
    if (url.pathname === "/api/notifications")
      return response({
        notifications:
          url.searchParams.get("filter") === "unread" && notification.readAt
            ? []
            : [notification],
        unreadCount: notification.readAt ? 0 : 1,
      });
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
      "/api/team/campaigns": { campaigns: [initialCampaign] },
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
    };
    if (!(url.pathname in responses))
      throw new Error(`Unexpected request: ${url.pathname}`);
    return response(responses[url.pathname]);
  });
  vi.stubGlobal("fetch", api);
  return api;
}

async function clickNotification(view: ReturnType<typeof render>) {
  fireEvent.click(
    await view.findByRole("button", {
      name: /^Notifications(?: · \d+ unread)?$/,
    }),
  );
  const popup = await view.findByRole("dialog", { name: "Notifications" });
  fireEvent.click(within(popup).getByText(campaign.name).closest("button")!);
}

async function expectFocusedThread(
  view: ReturnType<typeof render>,
  id: string,
) {
  await waitFor(() => {
    const region = view.getByRole("region", { name: "Page review comments" });
    expect(
      region.querySelector(
        `[data-review-comment-id="${id}"][data-focused="true"]`,
      ),
    ).toBeTruthy();
    expect(view.container.querySelector(".cs-comment-pin.active")).toBeTruthy();
    expect(view.container.querySelector(".cs-comment-popover")).toBeTruthy();
    expect(
      view.container.querySelector(".cs-page-preview.comment-view"),
    ).toBeTruthy();
  });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.removeItem("neptun-campaign-filters");
  setLanguage("en");
  setCampaignSaveStatus(campaign.id, { state: "saved" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
  setLanguage("sq");
  setCampaignSaveStatus(campaign.id, { state: "saved" });
});

it("opens and reopens the exact notification page and thread without replacing the workspace shell or saving the brochure", async () => {
  const api = mockServer();
  const view = render(<App />);
  await view.findByRole("button", { name: `Open campaign: ${campaign.name}` });
  const sidebar = view.container.querySelector(".cs-sidebar");
  const topbar = view.container.querySelector(".cs-topbar");
  await clickNotification(view);
  await expectFocusedThread(view, "product-thread");
  expect(view.container.querySelector(".cs-sidebar")).toBe(sidebar);
  expect(view.container.querySelector(".cs-topbar")).toBe(topbar);

  fireEvent.click(view.getByRole("button", { name: "Cover" }));
  await waitFor(() =>
    expect(
      view.container.querySelector('[data-review-comment-id="product-thread"]'),
    ).toBeNull(),
  );
  await clickNotification(view);
  await expectFocusedThread(view, "product-thread");
  fireEvent.click(view.getByRole("button", { name: "Close comments" }));
  expect(view.container.querySelector(".cs-comment-popover")).toBeNull();
  await clickNotification(view);
  await expectFocusedThread(view, "product-thread");

  const writes = api.mock.calls.filter(([, init]) => init?.method !== "GET");
  expect(writes).toHaveLength(1);
  expect(String(writes[0]?.[0])).toContain(
    `/api/notifications/${notificationId}/read`,
  );
  expect(
    api.mock.calls.some(([input]) => String(input).includes("/api/ai")),
  ).toBe(false);
});

it("opens a cover comment from an email deep link through the authenticated campaign endpoint", async () => {
  const api = mockServer();
  window.history.replaceState(
    {},
    "",
    `/?campaign=${campaign.id}&page=0&comment=cover-thread`,
  );
  const view = render(<App />);
  await expectFocusedThread(view, "cover-thread");
  expect(
    view.container.querySelector(".cs-pages-sidebar button.active")
      ?.textContent,
  ).toContain("Cover");
  expect(
    api.mock.calls.some(([input]) =>
      String(input).endsWith(`/api/team/campaigns/${campaign.id}`),
    ),
  ).toBe(true);
  expect(api.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
});

it("clamps an old email page reference to an included brochure page", async () => {
  mockServer();
  window.history.replaceState({}, "", `/?campaign=${campaign.id}&page=200`);
  const view = render(<App />);
  await view.findByRole("region", { name: "Page review comments" });
  expect(
    view.container.querySelector(".cs-pages-sidebar button.active")
      ?.textContent,
  ).toContain("Page 2");
  expect(
    view.getByRole("heading", { name: "Comments for Page 2" }),
  ).toBeTruthy();
  expect(
    view.container.querySelector(".cs-page-preview.comment-view"),
  ).toBeTruthy();
});

it("shows a new notification thread while retaining a conflicted local design", async () => {
  const draft: Campaign = {
    ...campaign,
    name: "Local editor draft",
    reviewComments: campaign.reviewComments?.filter(
      (item) => item.id !== "product-thread",
    ),
    products: campaign.products.map((product) =>
      product.code === "offer-one"
        ? { ...product, name: "Local edited offer" }
        : product,
    ),
  };
  const fresh = { ...campaign, version: 4, name: "Another editor's brochure" };
  const api = mockServer(async () => response({ campaign: fresh }), draft);
  const view = render(<App />);
  fireEvent.click(
    await view.findByRole("button", { name: `Open campaign: ${draft.name}` }),
  );
  await view.findAllByRole("heading", { name: draft.name });
  act(() => setCampaignSaveStatus(draft.id, { state: "conflict" }));
  await clickNotification(view);
  await expectFocusedThread(view, "product-thread");
  expect(
    view.getAllByRole("heading", { name: draft.name }).length,
  ).toBeGreaterThan(0);
  expect(view.getAllByText("Local edited offer").length).toBeGreaterThan(0);
  expect(view.queryByRole("heading", { name: fresh.name })).toBeNull();
  expect(
    api.mock.calls.filter(([, init]) => init?.method !== "GET"),
  ).toHaveLength(1);
});

it("does not navigate back when a notification campaign response arrives after the user leaves", async () => {
  let finish!: (result: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const api = mockServer(() => pending);
  const view = render(<App />);
  await view.findByRole("button", { name: `Open campaign: ${campaign.name}` });
  await clickNotification(view);
  await waitFor(() =>
    expect(
      api.mock.calls.some(([input]) =>
        String(input).endsWith(`/api/team/campaigns/${campaign.id}`),
      ),
    ).toBe(true),
  );
  fireEvent.click(view.getByRole("button", { name: "Product catalog" }));
  await view.findByRole("heading", { name: "Product catalog" });
  await act(async () => {
    finish(response({ campaign }));
    await pending;
  });
  expect(view.getByRole("heading", { name: "Product catalog" })).toBeTruthy();
  expect(
    view.queryByRole("region", { name: "Page review comments" }),
  ).toBeNull();
});

it("keeps the current workspace when notification access is rejected", async () => {
  mockServer(async () =>
    response({ error: "You cannot access this brochure." }, 403),
  );
  const view = render(<App />);
  await view.findByRole("button", { name: `Open campaign: ${campaign.name}` });
  await clickNotification(view);
  await view.findByText(/You cannot access this brochure\./);
  expect(view.getByRole("heading", { name: "Campaigns" })).toBeTruthy();
  expect(
    view.queryByRole("region", { name: "Page review comments" }),
  ).toBeNull();
});
