import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogRefreshControl } from "../../src/features/products/CatalogRefreshControl";
import { apiFetch } from "../../src/api/client";
vi.mock("../../src/api/client", () => ({ apiFetch: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
const response = (value: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
it("starts asynchronously, shows background progress and reloads once a completed update is available", async () => {
  let state = {
    status: "idle",
    lastSuccessfulAt: "2026-10-01T10:00:00Z",
    runId: null as string | null,
    processed: 0,
    total: 0,
  };
  vi.mocked(apiFetch).mockImplementation((_url, options) => {
    if (options?.method === "POST")
      state = {
        ...state,
        status: "running",
        runId: "RUN",
        processed: 15,
        total: 100,
      };
    return response(state);
  });
  const updated = vi.fn();
  const view = render(<CatalogRefreshControl onUpdated={updated} />);
  await waitFor(() =>
    expect(view.getByText(/Last updated:/).textContent).not.toContain(
      "Not synced",
    ),
  );
  vi.useFakeTimers();
  fireEvent.click(view.getByRole("button", { name: /Fetch products again/ }));
  await act(async () => {});
  expect(
    view
      .getByRole("button", { name: /Updating catalog/ })
      .getAttribute("disabled"),
  ).not.toBeNull();
  expect(view.getByRole("status").textContent).toContain("15/100");
  state = {
    ...state,
    status: "completed",
    processed: 100,
    lastSuccessfulAt: "2026-10-02T10:00:00Z",
  };
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2600);
  });
  expect(updated).toHaveBeenCalledOnce();
  expect(
    view
      .getByRole("button", { name: /Fetch products again/ })
      .getAttribute("disabled"),
  ).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(updated).toHaveBeenCalledOnce();
});
it("hides update time in the local Campaign version and reports launch failures without locking the button", async () => {
  vi.mocked(apiFetch).mockImplementation((_url, options) =>
    options?.method === "POST"
      ? Promise.resolve(
          new Response(JSON.stringify({ error: "Retry later" }), {
            status: 503,
          }),
        )
      : response({ status: "idle" }),
  );
  const view = render(
    <CatalogRefreshControl showLastUpdated={false} onUpdated={vi.fn()} />,
  );
  await act(async () => {});
  fireEvent.click(view.getByRole("button", { name: /Fetch products again/ }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe("Retry later"),
  );
  expect(view.queryByText(/Last updated:/)).toBeNull();
  expect(
    view
      .getByRole("button", { name: /Fetch products again/ })
      .getAttribute("disabled"),
  ).toBeNull();
});
