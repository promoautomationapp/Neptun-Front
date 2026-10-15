import { openSettingsSections } from "../helpers/settings-sections";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
import { BrochureFormatPicker } from "../../src/features/brochure/BrochureFormatPicker";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => cleanup());
it("adds and edits a named size, chooses it as the default and safely hides it", async () => {
  const save = vi.fn(async (value: WorkspaceSettings) => value);
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Format & layout" }));
  openSettingsSections(view.container);
  fireEvent.click(
    view.getByRole("button", { name: "+ Add custom dimensions" }),
  );
  openSettingsSections(view.container);
  fireEvent.change(view.getByLabelText("Custom size 1 name"), {
    target: { value: "Counter display" },
  });
  fireEvent.change(view.getByLabelText("Custom size 1 width (px)"), {
    target: { value: "1400" },
  });
  fireEvent.change(view.getByLabelText("Custom size 1 height (px)"), {
    target: { value: "800" },
  });
  fireEvent.click(
    view.getByRole("button", { name: "Use Counter display as default" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.calls[0]?.[0];
  expect(saved?.customFormats).toEqual([
    expect.objectContaining({
      name: "Counter display",
      width: 1400,
      height: 800,
      visible: true,
    }),
  ]);
  expect(saved?.brochure.format).toBe(saved?.customFormats[0]?.id);
  fireEvent.click(
    view.getByRole("checkbox", {
      name: "Show Counter display when choosing brochure size",
    }),
  );
  expect(
    (view.getByLabelText("Default brochure format") as HTMLSelectElement).value,
  ).toBe("neptun1080x1350");
});
it("keeps the brochure's saved size selectable after its workspace definition changes", () => {
  setLanguage("en");
  const changed = {
    id: "custom-counter",
    name: "New counter",
    width: 2000,
    height: 1000,
    visible: true,
  };
  const view = render(
    <BrochureFormatPicker
      value={{
        brochureFormat: changed.id,
        brochureFormatSnapshot: {
          ...changed,
          name: "Counter",
          width: 1400,
          height: 800,
        },
      }}
      customFormats={[changed]}
      onChange={vi.fn()}
    />,
  );
  expect(
    view.getByRole("option", { name: "Counter · 1400 × 800 px" }),
  ).toBeTruthy();
  expect(
    view.queryByRole("option", { name: "New counter · 2000 × 1000 px" }),
  ).toBeNull();
});
