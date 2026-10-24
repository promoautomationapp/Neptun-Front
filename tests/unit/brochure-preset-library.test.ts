import { describe, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { campaignSchema } from "../../src/domain/schemas";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import {
  applyBrochurePreset,
  availableBrochurePresets,
  brochureDesignSnapshot,
} from "../../src/features/brochure/brochurePresets";

describe("independent brochure preset snapshots", () => {
  it("keeps the current default and provides the PDF design with an empty cover photograph", () => {
    const settings = resolveSettings(null);
    const presets = availableBrochurePresets(settings);
    expect(settings.defaultBrochurePresetId).toBe("neptun-current");
    expect(presets[1]!.name).toBe("Neptun Blue");
    expect(presets.map((preset) => preset.id)).toEqual([
      "neptun-current",
      "neptun-october",
    ]);
    expect(presets[0]!.design).toMatchObject({
      layout: "feature3",
      offerStyle: "current",
      showCoverBand: false,
    });
    expect(presets[1]!.design).toMatchObject({
      brochureVisualStyle: "october",
      layout: "duo4",
      autoProductLayout: true,
      productBackgroundColor: "#e3e3e3",
      offerStyle: "card",
      showCoverBand: true,
      showFooterPageNumber: true,
      coverImage: "",
      coverBrandTagline: "Jeto më mirë, çdo ditë.",
      coverLogoSource: "/brochure-presets/october/neptun-cover.svg",
      coverBackgroundImage: "",
      pricePalette: { blue: "#003870", blueBand: "#e6e8e8" },
    });
  });
  it("starts the blue reference with automatic detail placement and amount savings independent of other defaults", () => {
    const settings = resolveSettings(null);
    settings.productDesign.details.placement = "bottom";
    settings.savingMode = "percentage";
    settings.categoryPathSavingModes.TV = "percentage";
    const design = availableBrochurePresets(settings)[1]!.design;
    expect(design).toMatchObject({
      savingMode: "amount",
      automaticSavings: { enabled: false },
      categoryPathSavingModes: {},
      categorySavingModes: {},
      productDesign: {
        details: { placement: "automatic", fill: "outline" },
        typography: { font: "SkolaSans" },
      },
      brandAssets: {
        bestbuy: "/brochure-presets/october/bestbuy.png",
        qudal: "/brochure-presets/october/qudal.png",
        service: "/brochure-presets/october/service.svg",
      },
    });
  });
  it("applies design only and never overwrites content, review data or saved page changes", () => {
    const campaign: Campaign = {
      id: "keep-id",
      name: "Keep name",
      products: [{ code: "sku", name: "My product" }],
      startDate: "2026-11-01",
      reviewComments: [{ text: "Keep review" }],
      pages: { 0: { headerText: "My header", showFooterLine: false } },
    };
    const oldProducts = campaign.products;
    applyBrochurePreset(
      campaign,
      availableBrochurePresets(resolveSettings(null))[1]!,
    );
    expect(campaign).toMatchObject({
      id: "keep-id",
      name: "Keep name",
      startDate: "2026-11-01",
      reviewComments: [{ text: "Keep review" }],
      pages: { 0: { headerText: "My header", showFooterLine: false } },
      brochurePresetId: "neptun-october",
    });
    expect(campaign.products).toBe(oldProducts);
    expect(
      brochureDesignSnapshot({ ...campaign, version: 12 }),
    ).not.toHaveProperty("products");
    expect(brochureDesignSnapshot(campaign)).not.toHaveProperty(
      "reviewComments",
    );
  });
  it("supports built-in overrides and custom copies without consulting future settings", () => {
    const settings = resolveSettings(null);
    settings.brochurePresets = [
      {
        id: "neptun-october",
        name: "Blue edited",
        design: { productBackgroundColor: "#ddeeff" },
      },
      {
        id: "custom-a",
        name: "Team design",
        design: {
          brochureVisualStyle: "october",
          offerStyle: "card",
          productBackgroundColor: "#ccddee",
        },
      },
    ];
    const campaign: Campaign = { id: "saved", name: "Saved", products: [] };
    applyBrochurePreset(campaign, availableBrochurePresets(settings)[2]!);
    settings.brochurePresets[1]!.design.productBackgroundColor = "#ffffff";
    expect(campaign.productBackgroundColor).toBe("#ccddee");
    expect(campaign.brochureVisualStyle).toBe("october");
    expect(availableBrochurePresets(settings)[1]!.name).toBe("Blue edited");
    expect(
      availableBrochurePresets(settings)[1]!.design.productBackgroundColor,
    ).toBe("#ddeeff");
  });
  it("validates design content and decorations while migrating the old price choices", () => {
    expect(resolveSettings({ offerStyle: "minimal" }).offerStyle).toBe(
      "current",
    );
    expect(resolveSettings({ offerStyle: "compact" }).offerStyle).toBe("card");
    expect(
      workspaceSettingsSchema.safeParse({
        brochurePresets: [
          { id: "custom-a", name: "Bad", design: { products: [] } },
        ],
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        brochurePresets: [
          {
            id: "custom-a",
            name: "Bad",
            design: { productBackgroundColor: "red;display:none" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({ defaultBrochurePresetId: "missing" })
        .success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        brochure: {
          coverLogoSource: "/brochure-presets/october/neptun-cover.png",
        },
      }).success,
    ).toBe(true);
    expect(
      campaignSchema.safeParse({
        id: "c",
        name: "x",
        products: [],
        pages: {
          0: {
            headerText: "TELEVIZORË",
            footerNumber: "4",
            showHeader: false,
            footerLineColor: "#003870",
          },
        },
      }).success,
    ).toBe(true);
    expect(
      campaignSchema.safeParse({
        id: "c",
        name: "x",
        products: [],
        pages: { 0: { footerLineColor: "url(unsafe)" } },
      }).success,
    ).toBe(false);
  });
});
