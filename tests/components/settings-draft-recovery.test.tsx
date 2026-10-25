import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import {
  resolveSettings,
  type WorkspaceSettings,
} from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

const draftKey = "neptun-settings-draft:organization-a:user-a";
const colorInput = (view: ReturnType<typeof render>) =>
  view.getByLabelText("Cover background color") as HTMLInputElement;

beforeEach(() => {
  sessionStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("recovers edits after remount without submitting them or installing a native leave prompt", () => {
  const initial = resolveSettings(null);
  const save = vi.fn();
  const events = vi.spyOn(window, "addEventListener");
  const first = render(
    <SettingsEditor
      initial={initial}
      onSave={save}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(first), { target: { value: "#123456" } });
  expect(
    JSON.parse(sessionStorage.getItem(draftKey)!).draft.brochure.coverBackground
      .color,
  ).toBe("#123456");
  first.unmount();

  const dirty = vi.fn();
  const restored = render(
    <SettingsEditor
      initial={initial}
      onSave={save}
      draftKey={draftKey}
      draftVersion={4}
      onDirtyChange={dirty}
    />,
  );
  expect(colorInput(restored).value).toBe("#123456");
  expect(
    restored.getByText("Unsaved settings restored on this browser."),
  ).toBeTruthy();
  expect(dirty).toHaveBeenLastCalledWith(true);
  expect(save).not.toHaveBeenCalled();
  expect(events.mock.calls.some(([type]) => type === "beforeunload")).toBe(
    false,
  );
});

it.each(["version", "saved settings"])(
  "does not apply or erase a stale draft when the server's %s changed",
  (change) => {
    const initial = resolveSettings(null);
    const first = render(
      <SettingsEditor
        initial={initial}
        onSave={vi.fn()}
        draftKey={draftKey}
        draftVersion={4}
      />,
    );
    fireEvent.change(colorInput(first), { target: { value: "#123456" } });
    first.unmount();
    const stored = sessionStorage.getItem(draftKey);
    const changed = structuredClone(initial);
    if (change === "saved settings")
      changed.brochure.coverBackground.color = "#778899";
    const save = vi.fn();
    const fresh = render(
      <SettingsEditor
        initial={changed}
        onSave={save}
        draftKey={draftKey}
        draftVersion={change === "version" ? 5 : 4}
      />,
    );
    expect(colorInput(fresh).value).toBe(
      changed.brochure.coverBackground.color || "#1c4075",
    );
    expect(
      fresh.queryByText("Unsaved settings restored on this browser."),
    ).toBeNull();
    expect(sessionStorage.getItem(draftKey)).toBe(stored);
    expect(save).not.toHaveBeenCalled();
  },
);

it("keeps account drafts isolated when the same editor changes user or organization", () => {
  const initial = resolveSettings(null);
  const otherKey = "neptun-settings-draft:organization-b:user-b";
  const view = render(
    <SettingsEditor
      initial={initial}
      onSave={vi.fn()}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(view), { target: { value: "#123456" } });
  const firstStored = sessionStorage.getItem(draftKey);
  view.rerender(
    <SettingsEditor
      initial={initial}
      onSave={vi.fn()}
      draftKey={otherKey}
      draftVersion={4}
    />,
  );
  expect(colorInput(view).value).toBe(
    initial.brochure.coverBackground.color || "#1c4075",
  );
  expect(sessionStorage.getItem(otherKey)).toBeNull();
  fireEvent.change(colorInput(view), { target: { value: "#abcdef" } });
  expect(sessionStorage.getItem(draftKey)).toBe(firstStored);
  view.rerender(
    <SettingsEditor
      initial={initial}
      onSave={vi.fn()}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  expect(colorInput(view).value).toBe("#123456");
});

it("clears the recovery copy only after a successful explicit save", async () => {
  const initial = resolveSettings(null);
  const save = vi
    .fn<(value: WorkspaceSettings) => Promise<WorkspaceSettings>>()
    .mockImplementation(async (value) => value);
  const view = render(
    <SettingsEditor
      initial={initial}
      onSave={save}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(view), { target: { value: "#123456" } });
  expect(sessionStorage.getItem(draftKey)).not.toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(
      view.getByText("Settings saved. New brochures will use these defaults."),
    ).toBeTruthy(),
  );
  expect(sessionStorage.getItem(draftKey)).toBeNull();
  expect(save).toHaveBeenCalledOnce();
});

it("retains the recovery copy when an explicit save has a version conflict", async () => {
  const initial = resolveSettings(null);
  const save = vi
    .fn()
    .mockRejectedValue(
      new Error("Someone else updated Settings. Reload before saving."),
    );
  const first = render(
    <SettingsEditor
      initial={initial}
      onSave={save}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(first), { target: { value: "#123456" } });
  fireEvent.click(first.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(first.getByRole("alert").textContent).toContain(
      "Someone else updated",
    ),
  );
  expect(colorInput(first).value).toBe("#123456");
  first.unmount();
  const restored = render(
    <SettingsEditor
      initial={initial}
      onSave={save}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  expect(colorInput(restored).value).toBe("#123456");
  expect(save).toHaveBeenCalledOnce();
});

it("discards the recovery copy when the user deliberately resets the draft", () => {
  const initial = resolveSettings(null);
  const first = render(
    <SettingsEditor
      initial={initial}
      onSave={vi.fn()}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(first), { target: { value: "#123456" } });
  fireEvent.click(first.getByRole("button", { name: "Discard changes" }));
  expect(sessionStorage.getItem(draftKey)).toBeNull();
  first.unmount();
  const fresh = render(
    <SettingsEditor
      initial={initial}
      onSave={vi.fn()}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  expect(colorInput(fresh).value).toBe(
    initial.brochure.coverBackground.color || "#1c4075",
  );
});

it("keeps the live draft editable when the browser's recovery storage is full", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage quota exceeded", "QuotaExceededError");
  });
  const view = render(
    <SettingsEditor
      initial={resolveSettings(null)}
      onSave={vi.fn()}
      draftKey={draftKey}
      draftVersion={4}
    />,
  );
  fireEvent.change(colorInput(view), { target: { value: "#123456" } });
  expect(colorInput(view).value).toBe("#123456");
  expect(
    (view.getByRole("button", { name: "Save settings" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(view.queryByRole("alert")).toBeNull();
});
