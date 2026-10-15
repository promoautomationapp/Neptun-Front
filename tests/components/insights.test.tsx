import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  InsightsPage,
  usageDateRange,
} from "../../src/features/insights/InsightsPage";
import { setLanguage } from "../../src/features/brochure/i18n";
const totals = {
  requests: 1,
  inputTokens: 100,
  outputTokens: 20,
  costUsd: 0.01,
  minimumUsd: 0.01,
  maximumUsd: 0.01,
  unknownCosts: 0,
  unknownTokens: 0,
  partialCosts: 0,
};
const ai = {
  timeZone: "Europe/Belgrade",
  currency: "USD",
  pricingUrl: "https://developers.openai.com/api/docs/pricing",
  pricingVersion: "test",
  summary: totals,
  operations: [],
  timeline: [],
  options: { operations: [], models: ["gpt-4o-mini"] },
  records: [],
  total: 1,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setLanguage("sq");
});
it("does not expose usage or issue a statistics request for a regular admin", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const view = render(<InsightsPage user={{ role: "admin" }} />);
  expect(view.container.textContent).toBe("");
  expect(fetch).not.toHaveBeenCalled();
});
it("filters superadmin usage by inclusive dates and operation, switches tabs and preserves unknown costs", async () => {
  setLanguage("en");
  const fetch = vi.fn(
    async (input: RequestInfo | URL, _options?: RequestInit) =>
      new Response(
        JSON.stringify(
          String(input).includes("/media")
            ? {
                driver: "r2",
                bucketName: "test",
                bucket: null,
                bucketError: true,
                registered: { objects: 3, bytes: 1024 },
                kinds: [],
                prepared: [],
                linked: {},
              }
            : ai,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(<InsightsPage user={{ role: "superadmin" }} />);
  await view.findByText("Estimated metered spending");
  fireEvent.click(view.getByRole("button", { name: "Period" }));
  fireEvent.click(view.getByRole("option", { name: "Specific date" }));
  fireEvent.change(view.getByLabelText("Date"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.click(view.getByRole("button", { name: "Operation" }));
  fireEvent.click(view.getByRole("option", { name: "TV artwork" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([input]) =>
          String(input).includes("operation=tv_artwork") &&
          String(input).includes("from=2026-10-05") &&
          String(input).includes("to=2026-10-05"),
      ),
    ).toBe(true),
  );
  fireEvent.click(view.getByRole("tab", { name: "Images & R2" }));
  await view.findByText("Registered media");
  expect(
    view.getByText(
      "R2 listing is temporarily unavailable. Registered media statistics are still shown.",
    ),
  ).toBeTruthy();
  expect(
    fetch.mock.calls.every(
      ([, options]) => !options || options.method === "GET",
    ),
  ).toBe(true);
});
it("month filtering includes leap days and all-time sends no date restriction", () => {
  expect(usageDateRange("month", "", "2024-02", "", "")).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(usageDateRange("all", "", "", "", "")).toEqual({});
});

it("separates charts, operation totals and detailed records without plotting unknown costs as free", async () => {
  setLanguage("en");
  const unknown = {
    ...totals,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    minimumUsd: 0,
    maximumUsd: 0,
    unknownCosts: 1,
    unknownTokens: 1,
  };
  const partial = {
    ...totals,
    minimumUsd: 0.02,
    maximumUsd: null,
    costUsd: 0,
    partialCosts: 1,
  };
  const usage = {
    ...ai,
    summary: {
      ...totals,
      requests: 3,
      inputTokens: 200,
      outputTokens: 40,
      minimumUsd: 0.03,
      maximumUsd: null,
      unknownCosts: 1,
      partialCosts: 1,
      unknownTokens: 1,
    },
    timeline: [
      { ...totals, date: "2026-10-13" },
      { ...partial, date: "2026-10-14" },
      { ...unknown, date: "2026-10-15" },
    ],
    operations: [
      { ...partial, operation: "cutout", model: "gpt-image-1" },
      { ...unknown, operation: "legacy_search", model: "unknown" },
    ],
    options: {
      operations: ["legacy_search"],
      models: ["gpt-image-1", "unknown"],
    },
    records: [
      {
        id: "one",
        operation: "cutout",
        model: "gpt-image-1",
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        minimumUsd: null,
        maximumUsd: null,
        costBasis: "unknown",
        createdAt: "2026-10-15T10:00:00Z",
        status: "uncertain",
        user: null,
        source: "unmetered",
        subject: "Saved tablet image",
        requestId: null,
      },
    ],
    total: 1,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(usage))),
  );
  const view = render(<InsightsPage user={{ role: "superadmin" }} />);
  const spending = await view.findByRole("figure", {
    name: "Recorded AI spending over time",
  });
  expect(
    spending.querySelector(
      '[aria-label="2026-10-15: Unknown; 1 unknown costs"]',
    ),
  ).toBeTruthy();
  expect(
    spending.querySelector('[aria-label="2026-10-14: ≥ $0.02"]'),
  ).toBeTruthy();
  expect(
    view
      .getByRole("figure", { name: "Recorded AI tokens over time" })
      .querySelector(
        '[aria-label="2026-10-15: Unknown; 1 have missing tokens"]',
      ),
  ).toBeTruthy();
  expect(view.queryByText("Saved tablet image")).toBeNull();
  fireEvent.click(view.getByRole("tab", { name: "Operations & models" }));
  expect(
    view.getByRole("figure", { name: "Recorded AI spending by operation" }),
  ).toBeTruthy();
  expect(
    view.queryByRole("figure", { name: "Recorded AI spending over time" }),
  ).toBeNull();
  fireEvent.click(view.getByRole("tab", { name: "Detailed AI records" }));
  expect(await view.findByText("Saved tablet image")).toBeTruthy();
  expect(view.getByText("Unmetered history")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Operation" }));
  expect(view.getByRole("option", { name: "legacy_search" })).toBeTruthy();
});

it("ignores late responses after a filter changes even when the API ignores abort", async () => {
  setLanguage("en");
  let finishOld!: (value: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValue(
      new Response(
        JSON.stringify({ ...ai, summary: { ...totals, requests: 7 } }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const view = render(<InsightsPage user={{ role: "superadmin" }} />);
  fireEvent.click(view.getByRole("button", { name: "Operation" }));
  fireEvent.click(view.getByRole("option", { name: "TV artwork" }));
  await view.findByText("AI records");
  expect(view.getByText("AI records").nextElementSibling?.textContent).toBe(
    "7",
  );
  await act(async () => {
    finishOld(
      new Response(
        JSON.stringify({ ...ai, summary: { ...totals, requests: 99 } }),
      ),
    );
  });
  expect(view.getByText("AI records").nextElementSibling?.textContent).toBe(
    "7",
  );
});

it("shows registered media immediately and polls only R2 while inventory is pending", async () => {
  setLanguage("en");
  let inventoryReady = false;
  const media = {
    driver: "r2",
    bucketName: "test-assets",
    bucket: null,
    bucketError: false,
    bucketPending: true,
    bucketStale: false,
    registered: { objects: 32483, bytes: 1024 },
    kinds: [],
    prepared: [],
    linked: {},
  };
  const fetch = vi.fn(
    async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          String(input).includes("/media")
            ? {
                ...media,
                bucketPending: !inventoryReady,
                bucket: inventoryReady
                  ? {
                      objects: 32000,
                      bytes: 1024,
                      checkedAt: "2026-10-15T10:00:00Z",
                    }
                  : null,
              }
            : ai,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(<InsightsPage user={{ role: "superadmin" }} />);
  await view.findByText("Estimated metered spending");
  vi.useFakeTimers();
  fireEvent.click(view.getByRole("tab", { name: "Images & R2" }));
  await act(async () => {});
  expect(view.getByText(/Checking R2 inventory/)).toBeTruthy();
  expect(
    view.getByText("Registered media").nextElementSibling?.textContent,
  ).toBe("32,483");
  const aiRequests = fetch.mock.calls.filter(([url]) =>
    String(url).includes("/ai?"),
  ).length;
  inventoryReady = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(view.queryByText(/Checking R2 inventory/)).toBeNull();
  expect(
    view.getByText("Stored project objects").nextElementSibling?.textContent,
  ).toBe("32,000");
  expect(
    fetch.mock.calls.filter(([url]) => String(url).includes("/ai?")).length,
  ).toBe(aiRequests);
  const mediaRequests = fetch.mock.calls.filter(([url]) =>
    String(url).includes("/media"),
  ).length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(
    fetch.mock.calls.filter(([url]) => String(url).includes("/media")).length,
  ).toBe(mediaRequests);
  vi.useRealTimers();
});

it("clears stale AI totals after a new query fails", async () => {
  setLanguage("en");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(ai)))
    .mockResolvedValue(
      new Response(JSON.stringify({ message: "Statistics unavailable" }), {
        status: 503,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const view = render(<InsightsPage user={{ role: "superadmin" }} />);
  await view.findByText("Estimated metered spending");
  fireEvent.click(view.getByRole("button", { name: "Operation" }));
  fireEvent.click(view.getByRole("option", { name: "TV artwork" }));
  await view.findByRole("alert");
  expect(view.queryByText("Estimated metered spending")).toBeNull();
});
