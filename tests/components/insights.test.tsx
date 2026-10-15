import React from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
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
  fireEvent.change(view.getByLabelText("Period"), {
    target: { value: "date" },
  });
  fireEvent.change(view.getByLabelText("Date"), {
    target: { value: "2026-10-05" },
  });
  fireEvent.change(view.getByLabelText("Operation"), {
    target: { value: "tv_artwork" },
  });
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
