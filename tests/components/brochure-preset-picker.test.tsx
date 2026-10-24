import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { CreateCampaign } from "../../src/features/brochure/Modals";
import { settingsPreviewCampaign } from "../../src/features/settings/SettingsPreview";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import { BrochurePresetsTab } from "../../src/features/settings/BrochurePresetsTab";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(cleanup);

it("preselects the current design and snapshots the chosen second design without a baked cover photo", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  expect(
    view
      .getByRole("button", { name: "Neptun Classic" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Neptun Blue" }));
  expect(
    view.getByText(
      "Upload the first cover photograph. The NEPTUN logo and blue campaign band stay separate and editable.",
    ),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create.mock.calls[0]![0]).toMatchObject({
    brochurePresetId: "neptun-october",
    brochureVisualStyle: "october",
    offerStyle: "card",
    coverImage: "",
    coverBackgroundImage: "",
    showCoverBand: true,
    tagline: "Çmimet flasin vetë!",
    productBackgroundColor: "#e3e3e3",
  });
});

it("opens the image preview without choosing it until Use this design is clicked", () => {
  setLanguage("en");
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    view.getByRole("button", { name: "Preview design Neptun Blue" }),
  );
  const preview = view.getByRole("dialog", {
    name: "Brochure preview · Neptun Blue",
  });
  fireEvent.click(
    within(preview).getByRole("button", { name: "Product page" }),
  );
  expect(preview.querySelector(".brochure-output-page")).toBeTruthy();
  fireEvent.click(
    within(preview).getByRole("button", { name: "Use this design" }),
  );
  expect(
    view
      .getByRole("button", { name: "Neptun Blue" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("saves an edited built-in as the team default using the existing settings save flow", async () => {
  setLanguage("en");
  const save = vi.fn(async (settings: WorkspaceSettings) => settings);
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Brochure designs" }));
  fireEvent.click(view.getByRole("button", { name: "Neptun Blue" }));
  fireEvent.change(view.getByLabelText("Brochure preset name"), {
    target: { value: "Team Blue" },
  });
  fireEvent.blur(view.getByLabelText("Brochure preset name"));
  fireEvent.click(
    view.getByRole("checkbox", {
      name: "Automatically select this design for new brochures",
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.calls[0]![0];
  expect(saved.defaultBrochurePresetId).toBe("neptun-october");
  expect(
    saved.brochurePresets.find((preset) => preset.id === "neptun-october"),
  ).toMatchObject({
    name: "Team Blue",
    design: {
      offerStyle: "card",
      brochureVisualStyle: "october",
      brochureFooter: { visible: false },
      pageDecorationDefaults: { footerLineColor: "#003870" },
    },
  });
  cleanup();
  const create = vi.fn();
  const next = render(
    <CreateCampaign settings={saved} onCreate={create} onClose={vi.fn()} />,
  );
  expect(
    next
      .getByRole("button", { name: "Team Blue" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("duplicates, renames, deletes and creates independent designs from scratch", () => {
  setLanguage("en");
  let observed = resolveSettings(null);
  function Library() {
    const [draft, setDraft] = useState(observed);
    const [selectedId, onSelect] = useState("neptun-current");
    observed = draft;
    return (
      <BrochurePresetsTab
        draft={draft}
        selectedId={selectedId}
        onSelect={onSelect}
        update={(change) =>
          setDraft((current) => {
            const next = structuredClone(current);
            change(next);
            return next;
          })
        }
      />
    );
  }
  const view = render(<Library />);
  fireEvent.click(view.getByRole("button", { name: "Duplicate design" }));
  const custom = observed.brochurePresets.find((preset) =>
    preset.id.startsWith("custom-"),
  )!;
  expect(custom.design.offerStyle).toBe("current");
  fireEvent.change(view.getByLabelText("Brochure preset name"), {
    target: { value: "Weekend" },
  });
  fireEvent.blur(view.getByLabelText("Brochure preset name"));
  expect(
    observed.brochurePresets.find((preset) => preset.id === custom.id)!.name,
  ).toBe("Weekend");
  fireEvent.click(view.getByRole("button", { name: "Delete design" }));
  fireEvent.click(view.getByRole("button", { name: "Delete this design" }));
  expect(
    observed.brochurePresets.some((preset) => preset.id === custom.id),
  ).toBe(false);
  fireEvent.click(
    view.getByRole("button", { name: "New design from scratch" }),
  );
  expect(observed.brochure.productBackground).toMatchObject({
    color: "#ffffff",
    gradient: null,
  });
  expect(observed.brochure.showCoverBand).toBe(false);
});

it("reuses the blue design for Happy Hour in November and keeps preview dates current", () => {
  setLanguage("en");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  try {
    const settings = resolveSettings(null);
    const create = vi.fn();
    const view = render(
      <CreateCampaign
        settings={settings}
        onCreate={create}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Neptun Blue" }));
    fireEvent.click(view.getByRole("button", { name: "Campaign type" }));
    fireEvent.click(view.getByRole("option", { name: "Happy Hour" }));
    fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
    expect(create.mock.calls[0]![0]).toMatchObject({
      name: "Happy Hour 2026",
      type: "Happy Hour",
      startDate: "2026-11-02",
      endDate: "2026-11-02",
      brochurePresetId: "neptun-october",
      offerStyle: "card",
    });
    expect(settingsPreviewCampaign(settings)).toMatchObject({
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
  } finally {
    vi.useRealTimers();
  }
});
