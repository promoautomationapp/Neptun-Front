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
  brochurePresetFromSettings,
  applyPresetToSettings,
} from "../../src/features/brochure/brochurePresets";
import { resolvedSavingsMode } from "../../src/features/settings/savingsPolicy";
import { coverProductPlacement } from "../../src/features/brochure/coverElements";

describe("independent brochure preset snapshots", () => {
  it("keeps collection rows independent of inherited workspace pair defaults and retains marked manual choices", () => {
    const settings = resolveSettings(null);
    settings.brochure.coverProductLayout = "pair";
    settings.brochurePresets = [
      {
        id: "neptun-gradient-all",
        name: "Saved collection",
        design: { coverProductLayout: "pair" },
      },
    ];
    for (const id of ["neptun-current", "neptun-gradient-all"]) {
      const preset = availableBrochurePresets(settings).find(
        (item) => item.id === id,
      )!;
      expect(preset.design.coverProductLayout).toBe("hero");
    }
    settings.brochurePresets[0]!.design.coverProductLayoutManual = true;
    expect(
      availableBrochurePresets(settings).find(
        (item) => item.id === "neptun-gradient-all",
      )!.design,
    ).toMatchObject({
      coverProductLayout: "pair",
      coverProductLayoutManual: true,
    });
    const snapshot = brochureDesignSnapshot({
      coverProductLayout: "pair",
      coverProductLayoutManual: true,
    });
    expect(snapshot.coverProductLayoutManual).toBe(true);
    expect(workspaceSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it("releases previous automatic cover frames on a design change and preserves custom frames", () => {
    const campaign: Campaign = {
      id: "cover-layout-change",
      name: "Saved cover",
      coverProductLayout: "pair",
      products: [
        { code: "one", name: "First offer", brochurePage: 1 },
        { code: "two", name: "Second offer", brochurePage: 1 },
        { code: "three", name: "Third offer", brochurePage: 1 },
      ],
    };
    const custom = { x: 6, y: 65, width: 38, height: 23 };
    campaign.coverElementPlacements = {
      "product-one": coverProductPlacement(campaign, 0, 3),
      "product-two": custom,
      "product-three": {
        ...coverProductPlacement(campaign, 2, 3),
        hidden: true,
      },
      logo: { x: 30, y: 2, width: 40 },
    };
    applyBrochurePreset(
      campaign,
      availableBrochurePresets(resolveSettings(null))[0]!,
    );
    expect(campaign.coverProductLayout).toBe("hero");
    expect(campaign.coverElementPlacements?.["product-one"]).toBeUndefined();
    expect(campaign.coverElementPlacements?.["product-two"]).toEqual(custom);
    expect(campaign.coverElementPlacements?.["product-three"]?.hidden).toBe(
      true,
    );
    expect(campaign.coverElementPlacements?.logo).toEqual({
      x: 30,
      y: 2,
      width: 40,
    });
  });

  it("keeps the current default and provides the PDF design with an empty cover photograph", () => {
    const settings = resolveSettings(null);
    const presets = availableBrochurePresets(settings);
    expect(settings.defaultBrochurePresetId).toBe("neptun-current");
    expect(presets.find((preset) => preset.id === "neptun-october")!.name).toBe(
      "UUU · Brand Edition",
    );
    expect(presets.map((preset) => preset.id)).toEqual([
      "neptun-current",
      "neptun-uuu-gray",
      "neptun-gradient-all",
      "neptun-online",
      "neptun-october",
    ]);
    expect(presets[0]!.design).toMatchObject({
      layout: "feature3",
      offerStyle: "current",
      showCoverBand: false,
    });
    expect(
      presets.find((preset) => preset.id === "neptun-october")!.design,
    ).toMatchObject({
      brochureVisualStyle: "october",
      layout: "duo4",
      autoProductLayout: true,
      productBackgroundColor: "#1b4075",
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
  it("starts the blue reference with automatic detail placement and the standard price-based savings rule independent of other defaults", () => {
    const settings = resolveSettings(null);
    settings.productDesign.details.placement = "bottom";
    settings.savingMode = "percentage";
    settings.categoryPathSavingModes.TV = "percentage";
    const design = availableBrochurePresets(settings).find(
      (preset) => preset.id === "neptun-october",
    )!.design;
    expect(design).toMatchObject({
      savingMode: "amount",
      automaticSavings: {
        enabled: true,
        amountThreshold: 30,
        basis: "offer-price",
      },
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
  it("applies the below €30 rule in all five ready designs without replacing explicit preset or product choices", () => {
    const settings = resolveSettings(null);
    const presets = availableBrochurePresets(settings);
    expect(presets).toHaveLength(5);
    for (const preset of presets) {
      const campaign: Campaign = { id: preset.id, name: "Offer", products: [] };
      applyBrochurePreset(campaign, preset);
      expect(
        resolvedSavingsMode(campaign, { regular: 40, sale: 29.99 }),
        preset.id,
      ).toBe("percentage");
      expect(
        resolvedSavingsMode(campaign, { regular: 40, sale: 30 }),
        preset.id,
      ).toBe("amount");
      expect(
        resolvedSavingsMode(campaign, {
          name: "Vacuum cleaner",
          regular: 40,
          sale: 29.99,
        }),
        preset.id,
      ).toBe("amount");
      expect(
        resolvedSavingsMode(campaign, {
          regular: 40,
          sale: 19.99,
          savingMode: "amount",
        }),
        preset.id,
      ).toBe("amount");
    }
    settings.brochurePresets = [
      {
        id: "neptun-october",
        name: "Team rule",
        design: { automaticSavings: { enabled: false, amountThreshold: 12 } },
      },
    ];
    expect(
      availableBrochurePresets(settings).find(
        (preset) => preset.id === "neptun-october",
      )!.design.automaticSavings,
    ).toEqual({
      enabled: false,
      amountThreshold: 12,
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
      availableBrochurePresets(resolveSettings(null)).find(
        (preset) => preset.id === "neptun-october",
      )!,
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
    applyBrochurePreset(
      campaign,
      availableBrochurePresets(settings).find(
        (item) => item.id === "custom-a",
      )!,
    );
    settings.brochurePresets[1]!.design.productBackgroundColor = "#ffffff";
    expect(campaign.productBackgroundColor).toBe("#ccddee");
    expect(campaign.brochureVisualStyle).toBe("october");
    expect(
      availableBrochurePresets(settings).find(
        (preset) => preset.id === "neptun-october",
      )!.name,
    ).toBe("Blue edited");
    expect(
      availableBrochurePresets(settings).find(
        (preset) => preset.id === "neptun-october",
      )!.design.productBackgroundColor,
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

it("captures minimal independent stores and rejects recursive workspace data in a design", () => {
  const settings = resolveSettings(null);
  settings.stores = [
    {
      id: "own",
      name: "Own store",
      city: "City",
      address: "Street",
      phone: "100",
      visible: true,
    },
  ];
  const design = brochurePresetFromSettings(
    settings,
    "custom-stores",
    "Store design",
  );
  settings.brochurePresets.push(
    design as (typeof settings.brochurePresets)[number],
  );
  const captured = brochurePresetFromSettings(
    settings,
    "custom-second",
    "Second design",
  );
  expect(captured.design.storesSnapshot).toEqual(design.design.storesSnapshot);
  expect(Object.keys(captured.design.storesSnapshot!).sort()).toEqual([
    "contact",
    "stores",
  ]);
  expect(workspaceSettingsSchema.safeParse(settings).success).toBe(true);
  expect(
    workspaceSettingsSchema.safeParse({
      ...settings,
      brochurePresets: [
        {
          ...design,
          design: {
            ...design.design,
            storesSnapshot: {
              ...design.design.storesSnapshot,
              brochurePresets: settings.brochurePresets,
            },
          },
        },
      ],
    }).success,
  ).toBe(false);
  const target = resolveSettings(null);
  const originalStores = structuredClone(target.stores);
  applyPresetToSettings(target, design, { includeStores: false });
  expect(target.stores).toEqual(originalStores);
  applyPresetToSettings(target, design);
  expect(target.stores).toEqual(settings.stores);
  target.stores[0]!.name = "Changed copy";
  expect(design.design.storesSnapshot?.stores[0]?.name).toBe("Own store");
});
