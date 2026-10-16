import { describe, expect, it } from "vitest";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { defaultProductDetailPlacement } from "../../src/features/brochure/mobileDetails";
import {
  defaultPhotoPlacement,
  defaultRegionScale,
  productDesignFor,
  productGridStyle,
} from "../../src/features/settings/product-design-defaults";

describe("snapshotted product design defaults", () => {
  const television = {
    code: "TV65",
    name: "TV QLED 65ABC",
    subcategory: "TV",
    specs: { Përmasat: "65 inch" },
  };
  it("retains reference behavior for old campaigns and missing settings", () => {
    const defaults = productDesignFor({});
    expect(defaults.photo.mode).toBe("automatic");
    expect(defaultPhotoPlacement(television, {}, "bottom")).toEqual({
      x: 50,
      y: 50,
      scale: 0.93,
    });
    expect(defaultRegionScale({}, "price")).toEqual({});
    expect(productGridStyle({})).toEqual({});
    expect(
      defaultProductDetailPlacement(
        { name: "SMARTPHONE SAMSUNG", subcategory: "SMARTPHONE" },
        { offerStyle: "card" },
      ),
    ).toBe("left");
  });
  it("copies settings into new brochures without restyling earlier snapshots", () => {
    const settings = resolveSettings(null);
    settings.productDesign.photo = {
      mode: "custom",
      x: 45,
      y: 55,
      scale: 1.2,
      automaticTvSizing: false,
    };
    settings.productDesign.typography.font = "Arial";
    settings.brochure.automaticProductLayout = false;
    const saved = campaignDefaults(settings);
    settings.productDesign.photo.x = 30;
    settings.productDesign.typography.font = "TSTAR";
    expect(saved.autoProductLayout).toBe(false);
    expect(productDesignFor(saved).photo.x).toBe(45);
    expect(productDesignFor(saved).typography.font).toBe("Arial");
    expect(defaultPhotoPlacement(television, saved, "bottom")).toEqual({
      x: 45,
      y: 55,
      scale: 1.2,
    });
    expect(productDesignFor({ storesSnapshot: settings }).photo.mode).toBe(
      "automatic",
    );
  });
  it("preserves individual detail and region edits and merges per-page gap choices", () => {
    const settings = resolveSettings(null);
    settings.productDesign.details.placement = "bottom";
    settings.productDesign.priceScale = 1.2;
    settings.productDesign.grid = {
      mode: "custom",
      horizontal: 2,
      vertical: 4,
      content: 0.5,
    };
    const campaign = campaignDefaults(settings);
    expect(
      defaultProductDetailPlacement({ detailPlacement: "left" }, campaign),
    ).toBe("left");
    expect(defaultProductDetailPlacement({}, campaign)).toBe("bottom");
    expect(defaultRegionScale(campaign, "price", { x: 2, scale: 0.8 })).toEqual(
      {},
    );
    expect(defaultRegionScale(campaign, "price").scale).toBe(1.2);
    expect(productGridStyle(campaign, { horizontal: 5 })).toMatchObject({
      columnGap: "5cqw",
      rowGap: "4cqw",
      "--brochure-content-gap": "0.5cqw",
    });
  });
  it("can disable TV size cues without changing the prepared image", () => {
    const settings = resolveSettings(null);
    settings.productDesign.photo.automaticTvSizing = false;
    expect(
      defaultPhotoPlacement(
        television,
        campaignDefaults(settings),
        "bottom",
        true,
      ),
    ).toEqual({ x: 50, y: 50, scale: 1 });
    expect(television.specs.Përmasat).toBe("65 inch");
  });
  it("rejects unsafe or out-of-range defaults and supplies partial legacy defaults", () => {
    expect(
      workspaceSettingsSchema.safeParse({
        productDesign: { typography: { font: "url(javascript:bad)" } },
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        productDesign: { photo: { scale: 9 } },
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        productDesign: { divider: { color: "red;display:none" } },
      }).success,
    ).toBe(false);
    expect(
      resolveSettings({ productDesign: { details: { fill: "outline" } } })
        .productDesign,
    ).toMatchObject({
      details: { fill: "outline", placement: "automatic" },
      photo: { mode: "automatic" },
      divider: { thickness: null },
    });
  });
});
