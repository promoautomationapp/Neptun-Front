import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { COVER_OPTIONS } from "../../src/features/settings/options";
import {
  COVER_TEMPLATES,
  CoverPage,
} from "../../src/features/brochure/Brochure";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { CreateCampaign } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const campaign: Campaign = {
  id: "cover",
  name: "Test brochure",
  products: [],
  theme: "blue",
};

it("offers only logo-free built-in background artwork and excludes Photo cover", () => {
  expect(COVER_OPTIONS.map((option) => option.id)).toEqual([
    "blueRibbon",
    "blueClean",
    "redBlue",
  ]);
  expect(COVER_TEMPLATES.map((option) => option.id)).toEqual(
    COVER_OPTIONS.map((option) => option.id),
  );
  for (const option of COVER_OPTIONS) {
    const source = readFileSync(`public${option.image}`, "utf8");
    expect(source).toContain("Gradient");
    expect(source).not.toMatch(
      /<(?:text|image|foreignObject)\b|NEPTUN|haPPy|hajde/i,
    );
  }
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={vi.fn()} />,
  );
  expect(view.queryByRole("button", { name: "Photo cover" })).toBeNull();
  fireEvent.click(view.getByRole("combobox", { name: "Default cover style" }));
  expect(view.queryByRole("option", { name: "Photo cover" })).toBeNull();
  expect(view.getAllByRole("option")).toHaveLength(3);
});

it("keeps the logo independently hideable for every built-in background", () => {
  for (const option of COVER_OPTIONS) {
    const visible = renderToStaticMarkup(
      <CoverPage
        campaign={{
          ...campaign,
          coverTemplate: option.id,
          showCoverLogo: true,
        }}
      />,
    );
    const hidden = renderToStaticMarkup(
      <CoverPage
        campaign={{
          ...campaign,
          coverTemplate: option.id,
          showCoverLogo: false,
        }}
      />,
    );
    expect(visible).toContain("cover-element-logo");
    expect(hidden).not.toContain("cover-element-logo");
    expect(hidden).toContain(`cover-template-${option.id}`);
  }
});

it("preserves existing legacy photo covers and uploaded backgrounds without making new photo covers", () => {
  const legacy = renderToStaticMarkup(
    <CoverPage
      campaign={{ ...campaign, coverTemplate: "photo", showCoverLogo: false }}
    />,
  );
  expect(legacy).toContain("cover-template-photo");
  expect(legacy).toContain("default-cover-hero.png");
  const image = "/api/assets/00000000-0000-4000-8000-000000000001";
  const uploaded = renderToStaticMarkup(
    <CoverPage
      campaign={{
        ...campaign,
        coverBackgroundImage: image,
        showCoverLogo: false,
      }}
    />,
  );
  expect(uploaded).toContain(image);
  const settings = resolveSettings(null);
  settings.brochure.coverTemplate = "photo";
  expect(campaignDefaults(settings).coverTemplate).toBe("blueRibbon");
  const create = vi.fn();
  const view = render(
    <CreateCampaign settings={settings} onCreate={create} onClose={vi.fn()} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create.mock.calls[0]?.[0].coverTemplate).toBe("blueRibbon");
});
