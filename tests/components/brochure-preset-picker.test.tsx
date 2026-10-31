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
  expect(view.getByText("Featured Product Collection")).toBeTruthy();
  expect(
    view.queryByRole("button", { name: "UUU · Brand Edition" }),
  ).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  fireEvent.click(view.getByRole("button", { name: "UUU · Brand Edition" }));
  expect(
    view.queryByRole("dialog", { name: "Choose a brochure design" }),
  ).toBeNull();
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
    productBackgroundColor: "#1b4075",
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
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  fireEvent.click(
    view.getByRole("button", { name: "Preview design UUU · Brand Edition" }),
  );
  expect(
    view.queryByRole("dialog", { name: "Choose a brochure design" }),
  ).toBeNull();
  expect(view.getByText("Featured Product Collection")).toBeTruthy();
  const preview = view.getByRole("dialog", {
    name: "Brochure preview · UUU · Brand Edition",
  });
  fireEvent.click(
    within(preview).getByRole("button", { name: "Product page" }),
  );
  expect(preview.querySelector(".brochure-output-page")).toBeTruthy();
  fireEvent.click(
    within(preview).getByRole("button", { name: "Use this design" }),
  );
  expect(view.getByText("UUU · Brand Edition")).toBeTruthy();
});

it("saves an edited built-in as the team default using the existing settings save flow", async () => {
  setLanguage("en");
  const save = vi.fn(async (settings: WorkspaceSettings) => settings);
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Brochure designs" }));
  fireEvent.click(view.getByRole("button", { name: "UUU · Brand Edition" }));
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
      pageDecorationDefaults: { footerLineColor: "#ffffff" },
    },
  });
  cleanup();
  const create = vi.fn();
  const next = render(
    <CreateCampaign settings={saved} onCreate={create} onClose={vi.fn()} />,
  );
  expect(next.getByText("Team Blue")).toBeTruthy();
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
  const blank = observed.brochurePresets.find(
    (preset) => preset.name === "Untitled design",
  )!;
  expect(blank.design).toMatchObject({
    productBackgroundColor: "#ffffff",
    productBackgroundGradient: null,
    showCoverBand: false,
  });
  // Creating a design no longer overwrites unrelated workspace defaults.
  expect(observed.brochure.productBackground).toEqual(
    resolveSettings(null).brochure.productBackground,
  );
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
    fireEvent.click(view.getByRole("button", { name: "Change design" }));
    fireEvent.click(view.getByRole("button", { name: "UUU · Brand Edition" }));
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

it("creates a brochure with the preselected design without opening design options", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create.mock.calls[0]![0].brochurePresetId).toBe("neptun-current");
});

it("localizes the compact choice, all five names and the separate details in Albanian", () => {
  setLanguage("sq");
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(view.getByText("Koleksioni me produkt të veçuar")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Ndrysho dizajnin" }));
  const choices = view.getByRole("dialog", {
    name: "Zgjidh dizajnin e broshurës",
  });
  for (const name of [
    "Koleksioni me produkt të veçuar",
    "UUU · Edicioni i markës",
    "UUU · Edicioni i katalogut",
    "Koleksioni i unifikuar",
    "Hajde! · Oferta online",
  ])
    expect(within(choices).getByRole("button", { name })).toBeTruthy();
  fireEvent.click(
    within(choices).getByRole("button", {
      name: "Shiko dizajnin UUU · Edicioni i markës",
    }),
  );
  expect(
    view.getByRole("dialog", {
      name: "Parapamja e broshurës · UUU · Edicioni i markës",
    }),
  ).toBeTruthy();
});
