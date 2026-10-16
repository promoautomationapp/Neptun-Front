import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SettingsPage } from "../../src/features/settings/SettingsPage";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";
import {
  loadSettings,
  persistSettings,
} from "../../src/features/settings/settings.api";
import { catalogFacets } from "../../src/features/products/products.api";
import type { SettingsTabProps } from "../../src/features/settings/SettingsEditor";

vi.mock("../../src/features/settings/settings.api", () => ({
  loadSettings: vi.fn(),
  persistSettings: vi.fn(),
}));
vi.mock("../../src/features/products/products.api", () => ({
  catalogFacets: vi.fn(async () => ({
    paths: [],
    brands: [],
    sourceCategories: [],
  })),
}));
vi.mock("../../src/features/settings/SettingsEditor", () => ({
  SettingsEditor: ({
    initial,
    onReload,
    onSave,
    facets,
  }: {
    initial: SettingsTabProps["draft"];
    facets: { categoryPath?: string }[];
    onReload: () => void;
    onSave: (settings: SettingsTabProps["draft"]) => Promise<unknown>;
  }) => (
    <>
      <h1>Workspace settings</h1>
      <span>{initial.contact.website}</span>
      <output aria-label="Available category paths">
        {facets.map((item) => item.categoryPath).join("; ")}
      </output>
      <button onClick={onReload}>Reload latest settings</button>
      <button onClick={() => void onSave(initial)}>Save settings</button>
    </>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  setLanguage("en");
});
afterEach(cleanup);
const saved = () => ({
  settings: resolveSettings(null),
  version: 7,
  updatedAt: null,
});

it("opens immediately from the workspace snapshot and retains its version when saving", async () => {
  const snapshot = saved();
  vi.mocked(persistSettings).mockResolvedValue({
    ...snapshot,
    saved: true,
    version: 8,
  });
  const changed = vi.fn();
  const view = render(
    <SettingsPage initialSnapshot={snapshot} onSnapshotChange={changed} />,
  );
  expect(
    view.getByRole("heading", { name: "Workspace settings" }),
  ).toBeTruthy();
  expect(loadSettings).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(persistSettings).toHaveBeenCalledWith(snapshot.settings, 7),
  );
  await waitFor(() =>
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ version: 8 }),
    ),
  );
});

it("uses a late workspace response to release a stalled page read and cancels the duplicate", async () => {
  vi.mocked(loadSettings).mockReturnValue(new Promise(() => {}));
  const view = render(<SettingsPage />);
  expect(view.getByRole("status").textContent).toBe("Loading Settings…");
  const signal = vi.mocked(loadSettings).mock.calls[0]?.[0];
  view.rerender(<SettingsPage initialSnapshot={saved()} />);
  await waitFor(() =>
    expect(
      view.getByRole("heading", { name: "Workspace settings" }),
    ).toBeTruthy(),
  );
  expect(signal?.aborted).toBe(true);
  expect(loadSettings).toHaveBeenCalledTimes(1);
});

it("can reload newer server defaults and save against the refreshed version", async () => {
  const next = { ...saved(), version: 9 };
  vi.mocked(loadSettings).mockResolvedValue(next);
  vi.mocked(persistSettings).mockResolvedValue({
    ...next,
    saved: true,
    version: 10,
  });
  const view = render(<SettingsPage initialSnapshot={saved()} />);
  fireEvent.click(view.getByRole("button", { name: "Reload latest settings" }));
  await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(persistSettings).toHaveBeenCalledWith(next.settings, 9),
  );
});

it("offers recovery after a failed read, including a workspace with no saved defaults yet", async () => {
  vi.mocked(loadSettings).mockRejectedValueOnce(
    new Error("Connection interrupted"),
  );
  const view = render(<SettingsPage />);
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe("Connection interrupted"),
  );
  vi.mocked(loadSettings).mockResolvedValueOnce({
    settings: null,
    version: 0,
    updatedAt: null,
  });
  fireEvent.click(view.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(
      view.getByRole("heading", { name: "Workspace settings" }),
    ).toBeTruthy(),
  );
});

it("includes the full source hierarchy even when a branch currently has no products", async () => {
  vi.mocked(catalogFacets).mockResolvedValueOnce({
    brands: [],
    categories: [],
    paths: [],
    sourceCategories: [
      {
        id: 3,
        parentId: 2,
        name: "AKSESORË",
        path: ["IT", "KOMPJUTERË", "AKSESORË"],
        categoryPath: "IT > KOMPJUTERË > AKSESORË",
        url: "https://neptun-ks.com/",
        lastSeenAt: "2026-10-16T00:00:00Z",
      },
    ],
  });
  const view = render(<SettingsPage initialSnapshot={saved()} />);
  await waitFor(() =>
    expect(
      view.getByLabelText("Available category paths").textContent,
    ).toContain("IT > KOMPJUTERË > AKSESORË"),
  );
});
