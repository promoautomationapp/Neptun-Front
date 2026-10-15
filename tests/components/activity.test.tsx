import React from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActivityPage } from "../../src/features/activity/ActivityPage";
import { setLanguage } from "../../src/features/brochure/i18n";
const actor = "aebcaec6-1a24-48a6-bb81-b12f6d415126";
const activity = {
  timeZone: "Europe/Belgrade",
  total: 26,
  page: 1,
  limit: 25,
  users: [
    { id: actor, name: "Neptun administrator", email: "admin@example.test" },
  ],
  actions: ["campaign.save", "account.login"],
  records: [
    {
      id: "event-1",
      actor: {
        id: actor,
        name: "Neptun administrator",
        email: "admin@example.test",
        role: "admin",
      },
      action: "campaign.save",
      targetType: "campaign",
      targetId: "black-friday",
      method: "POST",
      route: "/api/team/campaigns",
      ip: "192.0.2.1",
      statusCode: 201,
      outcome: "success",
      durationMs: 41,
      requestId: "request-1",
      createdAt: "2026-10-15T10:00:00Z",
      source: "activity",
    },
    {
      id: "event-2",
      actor: {
        id: actor,
        name: "Neptun administrator",
        email: "admin@example.test",
        role: "admin",
      },
      action: "password.changed",
      targetType: "user",
      targetId: actor,
      method: null,
      route: null,
      ip: null,
      statusCode: null,
      outcome: "success",
      durationMs: null,
      requestId: null,
      createdAt: "2026-10-14T10:00:00Z",
      source: "account-history",
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLanguage("sq");
});
it("hides administration activity from staff and PMs without requesting it", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const role of ["staff", "pm"] as const) {
    const view = render(<ActivityPage user={{ role }} />);
    expect(view.container.textContent).toBe("");
    view.unmount();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("shows Neptun admins readable activity, filters by date/user/action/outcome/search and paginates through read-only requests", async () => {
  setLanguage("en");
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _options?: RequestInit) =>
      new Response(JSON.stringify(activity)),
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(<ActivityPage user={{ role: "admin" }} />);
  await view.findByText("Campaign saved");
  expect(view.getByText("192.0.2.1")).toBeTruthy();
  expect(view.getByText("Unknown")).toBeTruthy();
  expect(view.getByText("Password changed")).toBeTruthy();
  fireEvent.click(view.getByText("Request details"));
  expect(view.getByText("POST /api/team/campaigns")).toBeTruthy();
  fireEvent.change(view.getByLabelText("Period"), {
    target: { value: "date" },
  });
  fireEvent.change(view.getByLabelText("Date"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(view.getByLabelText("User"), { target: { value: actor } });
  fireEvent.change(view.getByLabelText("Action"), {
    target: { value: "campaign.save" },
  });
  fireEvent.change(view.getByLabelText("Outcome"), {
    target: { value: "success" },
  });
  fireEvent.change(view.getByLabelText("Search activity"), {
    target: { value: "black friday" },
  });
  fireEvent.submit(
    view.getByRole("button", { name: "Search", exact: true }).closest("form")!,
  );
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([input]) => {
        const params = new URL(String(input), "http://localhost").searchParams;
        return (
          params.get("from") === "2026-10-05" &&
          params.get("to") === "2026-10-05" &&
          params.get("actor") === actor &&
          params.get("action") === "campaign.save" &&
          params.get("outcome") === "success" &&
          params.get("search") === "black friday"
        );
      }),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(
      (view.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(view.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([input]) =>
          new URL(String(input), "http://localhost").searchParams.get(
            "page",
          ) === "2",
      ),
    ).toBe(true),
  );
  expect(
    fetch.mock.calls.every(
      ([, options]) => !options || options.method === "GET",
    ),
  ).toBe(true);
});
it("uses Albanian for the superadmin activity page and does not invent missing historical IP addresses", async () => {
  setLanguage("sq");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(activity))),
  );
  const view = render(<ActivityPage user={{ role: "superadmin" }} />);
  await view.findByText("U ruajt fushata");
  expect(view.getByText("E panjohur")).toBeTruthy();
  expect(view.getByText("Historiku i llogarisë")).toBeTruthy();
});
