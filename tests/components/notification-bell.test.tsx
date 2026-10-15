import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotificationBell } from "../../src/features/notifications/NotificationBell";
import type { WorkspaceNotification } from "../../src/features/notifications/notifications.api";
import { setLanguage } from "../../src/features/brochure/i18n";
const one = "00000000-0000-4000-8000-000000000001";
const two = "00000000-0000-4000-8000-000000000002";
let rows: WorkspaceNotification[];
let visibility: DocumentVisibilityState;
function server() {
  return vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    if (options?.method === "POST") {
      rows = rows.map((item) =>
        url.pathname.endsWith("/read-all") || url.pathname.includes(item.id)
          ? { ...item, readAt: "2026-10-15T12:00:00Z" }
          : item,
      );
      return new Response(JSON.stringify({ read: true }));
    }
    return new Response(
      JSON.stringify({
        notifications:
          url.searchParams.get("filter") === "unread"
            ? rows.filter((item) => !item.readAt)
            : rows,
        unreadCount: rows.filter((item) => !item.readAt).length,
      }),
    );
  });
}
beforeEach(() => {
  setLanguage("en");
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  rows = [
    {
      id: one,
      type: "mention",
      campaignId: "campaign-one",
      campaignName: "Black Friday",
      pageIndex: 2,
      commentId: "thread-one",
      actorName: "Neptun PM",
      actorEmail: "pm@example.test",
      createdAt: "2026-10-15T10:00:00Z",
      readAt: null,
      message: "Please review this product image.",
    },
    {
      id: two,
      type: "review_submitted",
      campaignId: "campaign-two",
      campaignName: "Happy Hour",
      pageIndex: null,
      commentId: null,
      actorName: "Neptun staff",
      actorEmail: null,
      createdAt: "2026-10-14T10:00:00Z",
      readAt: "2026-10-14T12:00:00Z",
      message: "The brochure is ready for review.",
    },
  ];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setLanguage("sq");
});
it("checks notifications without writes, skips hidden tabs, and deduplicates focus/update polling", async () => {
  vi.useFakeTimers();
  const fetch = server();
  vi.stubGlobal("fetch", fetch);
  const view = render(<NotificationBell onOpen={vi.fn()} />);
  await act(async () => {});
  expect(
    view.getByRole("button", { name: "Notifications · 1 unread" }),
  ).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
  visibility = "hidden";
  fireEvent(document, new Event("visibilitychange"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(90000);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  visibility = "visible";
  await act(async () => {
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("neptun:notifications-updated"));
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    fetch.mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
  expect(
    fetch.mock.calls.every(([, options]) => options?.credentials === "include"),
  ).toBe(true);
});
it("opens a notification with its exact campaign/page/thread and marks only that item read after the click", async () => {
  const fetch = server();
  vi.stubGlobal("fetch", fetch);
  const open = vi.fn();
  const view = render(<NotificationBell onOpen={open} />);
  fireEvent.click(
    await view.findByRole("button", { name: "Notifications · 1 unread" }),
  );
  expect(
    await view.findByRole("dialog", { name: "Notifications" }),
  ).toBeTruthy();
  expect(view.queryByText("pm@example.test")).toBeNull();
  fireEvent.click(view.getByText("Black Friday").closest("button")!);
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({
      id: one,
      campaignId: "campaign-one",
      pageIndex: 2,
      commentId: "thread-one",
    }),
  );
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, options]) =>
          String(url).endsWith(`/${one}/read`) && options?.method === "POST",
      ),
    ).toBe(true),
  );
  await view.findByRole("button", { name: "Notifications" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(
    fetch.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toHaveLength(1);
});
it("requests the unread feed, marks all read only on command, and shows the empty state", async () => {
  const fetch = server();
  vi.stubGlobal("fetch", fetch);
  const view = render(<NotificationBell onOpen={vi.fn()} />);
  fireEvent.click(
    await view.findByRole("button", { name: "Notifications · 1 unread" }),
  );
  await view.findByText("Black Friday");
  fireEvent.click(view.getByRole("tab", { name: "Unread" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("filter=unread")),
    ).toBe(true),
  );
  await waitFor(() => expect(view.queryByText("Happy Hour")).toBeNull());
  fireEvent.click(view.getByRole("button", { name: "Mark all read" }));
  expect(await view.findByText("You're all caught up.")).toBeTruthy();
  expect(
    fetch.mock.calls
      .filter(([, options]) => options?.method === "POST")
      .map(([url]) => String(url)),
  ).toEqual([expect.stringContaining("/api/notifications/read-all")]);
});
it("keeps its portal within a mobile viewport, focuses it, and closes on Escape or outside click", async () => {
  vi.stubGlobal("fetch", server());
  vi.stubGlobal("innerWidth", 360);
  vi.stubGlobal("innerHeight", 640);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 310, y: 10, width: 38, height: 38 }),
  );
  const view = render(<NotificationBell onOpen={vi.fn()} />);
  const bell = await view.findByRole("button", {
    name: "Notifications · 1 unread",
  });
  fireEvent.click(bell);
  const panel = view.getByRole("dialog", { name: "Notifications" });
  expect(view.container.contains(panel)).toBe(false);
  expect(document.activeElement).toBe(panel);
  expect(
    parseFloat(panel.style.left) + parseFloat(panel.style.width),
  ).toBeLessThanOrEqual(348);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(bell);
  fireEvent.click(bell);
  fireEvent.pointerDown(document.body);
  expect(view.queryByRole("dialog")).toBeNull();
});
it("retains existing notifications on refresh failure and retries without marking anything read", async () => {
  const fetch = server();
  vi.stubGlobal("fetch", fetch);
  const view = render(<NotificationBell onOpen={vi.fn()} />);
  fireEvent.click(
    await view.findByRole("button", { name: "Notifications · 1 unread" }),
  );
  await view.findByText("Black Friday");
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Temporarily unavailable" }), {
      status: 503,
    }),
  );
  fireEvent(window, new Event("neptun:notifications-updated"));
  await view.findByRole("alert");
  expect(view.getByText("Black Friday")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(view.queryByRole("alert")).toBeNull());
  expect(
    fetch.mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
});
it("does not fetch or show a bell when disabled", () => {
  const fetch = server();
  vi.stubGlobal("fetch", fetch);
  const view = render(<NotificationBell enabled={false} onOpen={vi.fn()} />);
  expect(view.container.textContent).toBe("");
  expect(fetch).not.toHaveBeenCalled();
});
