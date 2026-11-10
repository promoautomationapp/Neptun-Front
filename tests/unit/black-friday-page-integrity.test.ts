import { describe, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { campaignSchema } from "../../src/domain/schemas";
import {
  BLACK_FRIDAY_ID,
  blackFridayDesignDefaults,
  blackFridayFrames,
  blackFridayPageArtworks,
  blackFridayProductArtworks,
  blackFridayReference,
  isBlackFridayBrochure,
} from "../../src/features/brochure/blackFridayDesign";
import {
  coverProducts,
  materializeProductPages,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import {
  layoutCapacity,
  productPageChunk,
} from "../../src/features/brochure/brochureLayout";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";

function sourceCampaign(): Campaign {
  return {
    id: "source-bf",
    name: "Black Friday source",
    brochurePresetId: BLACK_FRIDAY_ID,
    ...blackFridayDesignDefaults(),
    products: blackFridayReference.pages.flatMap((page) =>
      page.frames.map((frame) => ({
        code: `source-${page.number}-${frame.order}`,
        name: frame.model,
        brochurePage: page.number,
        brochureOrder: frame.order,
        brochureCardSize: { width: 1, height: 1 },
        productArtworks: blackFridayProductArtworks(frame),
      })),
    ),
  };
}

describe("Black Friday source composition integrity", () => {
  it("keeps the renderer in custom design copies and releases source art when switching to a regular design", () => {
    const presets = availableBrochurePresets(resolveSettings(null));
    const original = presets.find((preset) => preset.id === BLACK_FRIDAY_ID)!;
    const custom = {
      ...structuredClone(original),
      id: "custom-bf",
      name: "My Black Friday",
    };
    const campaign: Campaign = { id: "copy", name: "Copy", products: [] };
    applyBrochurePreset(campaign, custom);
    expect(campaign.brochureReferenceDesign).toBe("black-friday");
    expect(isBlackFridayBrochure(campaign)).toBe(true);
    expect(campaignSchema.parse(campaign).brochureReferenceDesign).toBe(
      "black-friday",
    );
    const personal = {
      id: "my-title",
      type: "text",
      x: 0,
      y: 5,
      width: 90,
      text: "Keep my title",
    };
    campaign.pageArtworks!.cover!.push(personal);
    applyBrochurePreset(
      campaign,
      presets.find((preset) => preset.id === "neptun-current")!,
    );
    expect(campaign.brochureReferenceDesign).toBeUndefined();
    expect(isBlackFridayBrochure(campaign)).toBe(false);
    expect(campaign.pageArtworks!.cover).toEqual([personal]);
    const settings = resolveSettings(null);
    settings.brochure.brochureReferenceDesign = "black-friday";
    expect(
      availableBrochurePresets(settings).find(
        (preset) => preset.id === "neptun-current",
      )!.design.brochureReferenceDesign,
    ).toBeUndefined();
  });

  it("keeps all 77 source offers plus a separate stores page, including 11 offers together on page 11", () => {
    const campaign = sourceCampaign();
    const pages = splitPages(campaign);
    expect(campaign.products).toHaveLength(77);
    expect(coverProducts(campaign)).toHaveLength(2);
    expect(pages.map((page) => page.products.length)).toEqual([
      6, 6, 6, 6, 6, 6, 9, 6, 4, 11, 9,
    ]);
    expect(1 + pages.length + Number(campaign.includeStoresPage)).toBe(13);
    expect(pages[9]).toMatchObject({ index: 9, layout: "grid12" });
    expect(
      pages.flatMap((page) => page.products).length +
        coverProducts(campaign).length,
    ).toBe(77);
    const before = campaign.products.map((product) => [
      product.brochurePage,
      product.brochureOrder,
    ]);
    campaign.autoProductLayout = true;
    materializeProductPages(campaign);
    expect(
      campaign.products.map((product) => [
        product.brochurePage,
        product.brochureOrder,
      ]),
    ).toEqual(before);
    expect(splitPages(campaign)).toHaveLength(11);
  });

  it("persists native banners/shapes/person metadata and custom product regions without losing fields", () => {
    const campaign = sourceCampaign();
    const product = campaign.products[0]!;
    product.brochureContentPlacement = {
      frame: { x: 12, y: 42, width: 44, height: 30 },
      price: { x: 3, y: 4, width: 35 },
    };
    campaign.pageArtworks = blackFridayPageArtworks();
    const parsed = campaignSchema.parse(campaign);
    expect(parsed.pageArtworks).toEqual(campaign.pageArtworks);
    expect(parsed.products[0]!.brochureContentPlacement).toEqual(
      product.brochureContentPlacement,
    );
    expect(Object.keys(parsed.pageArtworks!)).toHaveLength(13);
    expect(
      parsed.products.flatMap((product) => product.productArtworks || [])
        .length,
    ).toBeGreaterThan(0);
  });

  it("uses source geometry for matching groups and supplies a frame for every added offer", () => {
    const campaign = sourceCampaign();
    const page = splitPages(campaign)[9]!;
    const native = blackFridayReference.pages.find((page) => page.number === 11)!.frames;
    const matching = blackFridayFrames(11, page.products);
    expect(matching.slice(0, 9)).toEqual(native.slice(0, 9));
    expect(matching.slice(-2).every((frame, index) => frame.width > native[index + 9]!.width)).toBe(true);
    expect(matching.map((frame) => frame.code)).toEqual(native.map((frame) => frame.code));
    const extra = [...page.products, { code: "added", name: "Added offer" }];
    const frames = blackFridayFrames(11, extra);
    expect(frames).toHaveLength(12);
    expect(
      frames.every(
        (frame) =>
          frame.width > 0 &&
          frame.height > 0 &&
          frame.y + frame.height <= 98.000001,
      ),
    ).toBe(true);
    expect(layoutCapacity("grid12")).toBe(12);
    expect(
      productPageChunk({ layout: "grid12", autoProductLayout: false }, extra, 0)
        .products,
    ).toHaveLength(12);
    const settings = resolveSettings(null);
    settings.brochure.layout = "grid12";
    expect(workspaceSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it("snapshots source photo sizing and bottom details independently of inherited workspace defaults", () => {
    const campaign: Campaign = { id: "bf", name: "New BF", products: [] };
    applyBrochurePreset(
      campaign,
      availableBrochurePresets(resolveSettings(null)).find(
        (preset) => preset.id === BLACK_FRIDAY_ID,
      )!,
    );
    expect(campaign.productDesign).toMatchObject({
      photo: {
        mode: "automatic",
        x: 50,
        y: 50,
        scale: 1,
        automaticTvSizing: false,
      },
      details: { placement: "bottom", fill: "automatic" },
      typography: { font: "automatic" },
    });
  });
});
