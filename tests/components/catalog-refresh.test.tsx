import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogRefreshControl } from "../../src/features/products/CatalogRefreshControl";
import { apiFetch } from "../../src/api/client";
import { setLanguage } from "../../src/features/brochure/i18n";
vi.mock("../../src/api/client", () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  setLanguage("sq");
});
it("only reads status on mount and during idle polling, without reloading for unrelated image revisions", async () => {
  vi.useFakeTimers();
  let revision = "one";
  vi.mocked(apiFetch).mockImplementation(() =>
    response({
      status: "completed",
      lastSuccessfulAt: "2026-10-01T10:00:00Z",
      revision,
    }),
  );
  const updated = vi.fn();
  render(<CatalogRefreshControl onUpdated={updated} />);
  await act(async () => {});
  revision = "two";
  await act(async () => {
    await vi.advanceTimersByTimeAsync(180000);
  });
  expect(apiFetch).toHaveBeenCalledTimes(4);
  expect(
    vi
      .mocked(apiFetch)
      .mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
  expect(updated).not.toHaveBeenCalled();
});
it("keeps refresh available while cached photos finish and reloads once without extra status rows", async () => {
  vi.useFakeTimers();
  let pending = 3;
  vi.mocked(apiFetch).mockImplementation(() =>
    response({
      status: "completed",
      lastSuccessfulAt: "2026-10-01T10:00:00Z",
      imagesPending: pending,
    }),
  );
  const updated = vi.fn();
  const view = render(<CatalogRefreshControl onUpdated={updated} />);
  await act(async () => {});
  fireEvent.click(
    view.getByRole("button", { name: "View catalog update details" }),
  );
  expect(
    view
      .getByRole("button", { name: /Fetch products again/ })
      .hasAttribute("disabled"),
  ).toBe(false);
  expect(
    view.queryByText(/Preparing product photos|Working in the background/),
  ).toBeNull();
  expect(view.getAllByRole("status")).toHaveLength(1);
  pending = 0;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(updated).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(updated).toHaveBeenCalledOnce();
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
  fireEvent.click(
    view.getByRole("button", { name: "View catalog update details" }),
  );
  await waitFor(() =>
    expect(
      view.container.ownerDocument.querySelector(".cs-catalog-last-update dd")
        ?.textContent,
    ).not.toBe("Not synced yet"),
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
  fireEvent.click(
    view.getByRole("button", { name: "View catalog update details" }),
  );
  fireEvent.click(view.getByRole("button", { name: /Fetch products again/ }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe("Retry later"),
  );
  expect(view.queryByText("Last updated")).toBeNull();
  expect(
    view
      .getByRole("button", { name: /Fetch products again/ })
      .getAttribute("disabled"),
  ).toBeNull();
});

it("opening details never starts an update and a running update stays accessible", async () => {
  vi.mocked(apiFetch).mockImplementation(() =>
    response({ status: "running", processed: 15, total: 100 }),
  );
  const view = render(<CatalogRefreshControl onUpdated={vi.fn()} />);
  await act(async () => {});
  const trigger = view.getByRole("button", {
    name: "View catalog update details",
  });
  expect(trigger.hasAttribute("disabled")).toBe(false);
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.click(trigger);
  expect(view.getByRole("dialog", { name: "Catalog update" })).toBeTruthy();
  expect(view.getByRole("progressbar").getAttribute("value")).toBe("15");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(
    vi
      .mocked(apiFetch)
      .mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
});
