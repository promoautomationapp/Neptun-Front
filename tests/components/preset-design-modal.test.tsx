import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import {
  resolveSettings,
  type WorkspaceSettings,
} from "../../src/features/settings/settings.schema";
import {
  applyBrochurePreset,
  availableBrochurePresets,
  brochurePresetFromSettings,
} from "../../src/features/brochure/brochurePresets";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
function setup() {
  const initial = resolveSettings(null);
  initial.stores = [
    {
      id: "global",
      name: "Global store",
      city: "Global city",
      address: "Global street",
      phone: "100",
      visible: true,
    },
  ];
  const privateSettings = structuredClone(initial);
  privateSettings.stores = [
    {
      id: "design-store",
      name: "Design store",
      city: "Design city",
      address: "Design street",
      phone: "200",
      visible: true,
    },
  ];
  privateSettings.brochure.coverBackground = {
    color: "#123456",
    gradient: null,
    image: "",
  };
  initial.brochurePresets.push(
    brochurePresetFromSettings(
      privateSettings,
      "custom-private",
      "Private design",
    ) as WorkspaceSettings["brochurePresets"][number],
  );
  const save = vi.fn(async (value: WorkspaceSettings) => value);
  const view = render(<SettingsEditor initial={initial} onSave={save} />);
  fireEvent.click(view.getByRole("tab", { name: "Brochure designs" }));
  fireEvent.click(view.getByRole("button", { name: "Private design" }));
  fireEvent.click(view.getByRole("button", { name: "Edit design" }));
  return {
    initial,
    save,
    view,
    dialog: view.getByRole("dialog", { name: "Edit design" }),
  };
}
it("saves one preset's colors, name and added store through the parent save without changing global locations or other designs", async () => {
  const { initial, save, view, dialog } = setup();
  const oldOther = availableBrochurePresets(initial)[1]!.design;
  const existing: Campaign = {
    id: "already-created",
    name: "Existing",
    products: [],
  };
  applyBrochurePreset(
    existing,
    availableBrochurePresets(initial).find((p) => p.id === "custom-private")!,
  );
  const oldCampaign = structuredClone(existing);
  const d = within(dialog);
  expect(d.queryByRole("tab", { name: "Brochure designs" })).toBeNull();
  expect(d.queryByRole("tab", { name: "Campaign types" })).toBeNull();
  expect(
    (d.getByLabelText("Cover background color") as HTMLInputElement).value,
  ).toBe("#123456");
  fireEvent.change(d.getByLabelText("Design name"), {
    target: { value: "Private revised" },
  });
  fireEvent.change(d.getByLabelText("Cover background color"), {
    target: { value: "#aabbcc" },
  });
  fireEvent.click(d.getByRole("tab", { name: "Stores page" }));
  fireEvent.click(d.getByRole("tab", { name: "Stores & contacts" }));
  expect(
    d.getAllByText("Design store", { exact: true }).length,
  ).toBeGreaterThan(0);
  expect(d.queryByText("Global store", { exact: true })).toBeNull();
  fireEvent.click(d.getByRole("button", { name: "Add location" }));
  fireEvent.change(d.getByLabelText("Store name"), {
    target: { value: "New design-only store" },
  });
  fireEvent.change(d.getByLabelText("City"), { target: { value: "New city" } });
  expect(dialog.querySelector(".ns-preview-page")?.textContent).toContain(
    "New design-only store",
  );
  fireEvent.click(d.getByRole("button", { name: "Save design" }));
  await waitFor(() =>
    expect(view.queryByRole("dialog", { name: "Edit design" })).toBeNull(),
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.calls[0]![0];
  const preset = saved.brochurePresets.find((p) => p.id === "custom-private")!;
  expect(preset.name).toBe("Private revised");
  expect(preset.design.coverBackgroundColor).toBe("#aabbcc");
  expect(preset.design.storesSnapshot).toMatchObject({
    stores: [{ name: "Design store" }, { name: "New design-only store" }],
  });
  expect(Object.keys(preset.design.storesSnapshot as object).sort()).toEqual([
    "contact",
    "stores",
  ]);
  expect(preset.design.selectedStoreIndexes).toEqual([0, 1]);
  expect(saved.stores).toEqual(initial.stores);
  expect(saved.contact).toEqual(initial.contact);
  expect(availableBrochurePresets(saved)[1]!.design).toEqual(oldOther);
  expect(existing).toEqual(oldCampaign);
  cleanup();
  const reload = render(<SettingsEditor initial={saved} onSave={save} />);
  fireEvent.click(reload.getByRole("tab", { name: "Brochure designs" }));
  fireEvent.click(reload.getByRole("button", { name: "Private revised" }));
  fireEvent.click(reload.getByRole("button", { name: "Edit design" }));
  const reopened = within(reload.getByRole("dialog", { name: "Edit design" }));
  expect(
    (reopened.getByLabelText("Cover background color") as HTMLInputElement)
      .value,
  ).toBe("#aabbcc");
  fireEvent.click(reopened.getByRole("tab", { name: "Stores page" }));
  fireEvent.click(reopened.getByRole("tab", { name: "Stores & contacts" }));
  expect(
    reopened.getAllByText("New design-only store", { exact: true }),
  ).toBeTruthy();
});
it("can save a name-only change and cancel further edits without mutating the library", async () => {
  const { view, dialog, save } = setup();
  const d = within(dialog);
  fireEvent.change(d.getByLabelText("Design name"), {
    target: { value: "Name only" },
  });
  expect(
    (d.getByRole("button", { name: "Save design" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(d.getByRole("button", { name: "Cancel" }));
  expect(view.queryByRole("dialog")).toBeNull();
  expect(view.getByRole("button", { name: "Private design" })).toBeTruthy();
  expect(
    (view.getByRole("button", { name: "Save settings" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
