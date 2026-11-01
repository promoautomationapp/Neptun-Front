import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Campaign, CampaignMutator } from "../../src/domain/models";
import { campaignSchema } from "../../src/domain/schemas";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { CoverDesignControls } from "../../src/features/brochure/CoverDesignControls";
import {
  applyBrochurePreset,
  availableBrochurePresets,
  applyPresetToSettings,
  brochureDesignSnapshot,
} from "../../src/features/brochure/brochurePresets";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { DesignTab } from "../../src/features/settings/DesignTab";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(cleanup);

it.each(["neptun-october", "neptun-uuu-gray"])(
  "keeps %s ribbon horizontal and independent of the page paint",
  (id) => {
    const campaign: Campaign = { id: "ribbon", name: "Offer", products: [] };
    applyBrochurePreset(
      campaign,
      availableBrochurePresets(resolveSettings(null)).find((p) => p.id === id)!,
    );
    campaign.coverBackgroundGradient = {
      from: "#000000",
      to: "#ffffff",
      angle: 180,
    };
    const view = render(<CoverPage campaign={campaign} />);
    const ribbon = view.container.querySelector(
      ".october-cover-ribbon linearGradient",
    )!;
    expect(["x1", "y1", "x2", "y2"].map((a) => ribbon.getAttribute(a))).toEqual(
      ["35%", "0%", "100%", "0%"],
    );
    expect(
      Array.from(ribbon.querySelectorAll("stop"), (s) =>
        s.getAttribute("stop-color"),
      ),
    ).toEqual(["#144c83", "#70acdc"]);
    expect(
      view.container.querySelector(".october-cover-photo-default"),
    ).not.toBeNull();
  },
);

it("previews ribbon colors immediately and preserves them through campaign, design and workspace saves", () => {
  setLanguage("en");
  function Editor() {
    const [campaign, setCampaign] = useState<Campaign>({
      id: "color",
      name: "Offer",
      brochureVisualStyle: "october",
      products: [],
    });
    const update = (mutate: CampaignMutator) =>
      setCampaign((c) => {
        const next = structuredClone(c);
        mutate(next);
        return next;
      });
    return (
      <>
        <CoverDesignControls campaign={campaign} onUpdate={update} />
        <CoverPage campaign={campaign} />
      </>
    );
  }
  const view = render(<Editor />);
  fireEvent.change(view.getByLabelText("Ribbon start color"), {
    target: { value: "#123456" },
  });
  fireEvent.change(view.getByLabelText("Ribbon end color"), {
    target: { value: "#abcdef" },
  });
  expect(
    Array.from(
      view.container.querySelectorAll(".october-cover-ribbon stop"),
      (s) => s.getAttribute("stop-color"),
    ),
  ).toEqual(["#123456", "#abcdef"]);
  const colors = { from: "#123456", to: "#abcdef" };
  const saved = campaignSchema.parse({
    id: "ribbon",
    name: "Offer",
    products: [],
    coverRibbonColors: colors,
  });
  const design = brochureDesignSnapshot(saved);
  const settings = resolveSettings(null);
  applyPresetToSettings(settings, {
    id: "custom-ribbon",
    name: "Ribbon",
    design,
  });
  const restored = campaignDefaults(workspaceSettingsSchema.parse(settings));
  expect(restored.coverRibbonColors).toEqual(colors);
  expect(
    campaignSchema.safeParse({
      ...saved,
      coverRibbonColors: { ...colors, from: "url(javascript:bad)" },
    }).success,
  ).toBe(false);
});

it("preserves custom photograph and ribbon placements", () => {
  const view = render(
    <CoverPage
      campaign={{
        id: "custom",
        name: "Offer",
        products: [],
        brochureVisualStyle: "october",
        coverElementPlacements: {
          "campaign-photo": { x: 2, y: 3, width: 96, height: 40 },
          "campaign-ribbon": { x: 0, y: 44, width: 100, height: 14 },
        },
      }}
    />,
  );
  const photo = view.container.querySelector<HTMLElement>(
    ".october-cover-photo",
  )!;
  expect(photo.classList.contains("october-cover-photo-default")).toBe(false);
  expect([
    photo.style.left,
    photo.style.top,
    photo.style.width,
    photo.style.height,
  ]).toEqual(["2%", "3%", "96%", "40%"]);
});

it("updates the preset ribbon colors in the same preview without changing the page gradient", () => {
  setLanguage("en");
  function PresetEditor() {
    const [settings, setSettings] = useState(() =>
      resolveSettings({ brochure: { brochureVisualStyle: "october" } }),
    );
    return (
      <>
        <DesignTab
          draft={settings}
          update={(mutate) =>
            setSettings((current) => {
              const next = structuredClone(current);
              mutate(next);
              return next;
            })
          }
        />
        <CoverPage
          campaign={{
            id: "preview",
            name: "Offer",
            products: [],
            ...campaignDefaults(settings),
          }}
        />
      </>
    );
  }
  const view = render(<PresetEditor />);
  const background =
    view.container.querySelector<HTMLElement>(".brochure-cover")!.style
      .background;
  fireEvent.change(view.getByLabelText("Ribbon end color"), {
    target: { value: "#aabbcc" },
  });
  expect(
    view.container
      .querySelector(".october-cover-ribbon stop[offset='1']")!
      .getAttribute("stop-color"),
  ).toBe("#aabbcc");
  expect(
    view.container.querySelector<HTMLElement>(".brochure-cover")!.style
      .background,
  ).toBe(background);
});
