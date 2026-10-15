import { describe, expect, it } from "vitest";
import {
  availableBrochureFormats,
  brochureExportGeometry,
  brochureFormatContentGeometry,
  brochureFormatFrameStyle,
  brochureFormatSelection,
  resolveBrochureFormat,
} from "../../src/features/brochure/brochureFormat";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";

describe("saved custom brochure dimensions", () => {
  const custom = {
    id: "custom-shop-window",
    name: "Shop window",
    width: 1600,
    height: 900,
    visible: true,
  };
  it("uses one saved format for preview, fitted artwork, raster output and PDF", () => {
    const settings = resolveSettings(null);
    settings.customFormats = [custom];
    settings.brochure.format = custom.id;
    const campaign = campaignDefaults(settings);
    expect(campaign.brochureFormatSnapshot).toEqual({
      id: custom.id,
      name: custom.name,
      width: 1600,
      height: 900,
    });
    const format = resolveBrochureFormat(campaign);
    expect(format).toMatchObject({
      id: custom.id,
      width: 1600,
      height: 900,
      aspectRatio: "1600 / 900",
    });
    const exported = brochureExportGeometry(campaign, 800);
    expect(exported).toMatchObject({
      width: 1600,
      height: 900,
      previewWidth: 800,
      previewHeight: 450,
      orientation: "landscape",
    });
    expect(exported.pdfWidthMm / exported.pdfHeightMm).toBeCloseTo(1600 / 900);
    // Passing the resolved registry item through the shared resolver must retain dimensions.
    expect(brochureFormatContentGeometry(format, 800)).toMatchObject({
      width: 800,
      height: 450,
    });
    expect(brochureFormatFrameStyle(campaign)["--brochure-page-aspect"]).toBe(
      "1600 / 900",
    );
  });
  it("preserves existing brochures when a default is edited, hidden or removed", () => {
    const formats = [{ ...custom }];
    const campaign = brochureFormatSelection(custom.id, formats);
    formats[0]!.width = 2048;
    formats[0]!.name = "Updated size";
    expect(resolveBrochureFormat(campaign, formats)).toMatchObject({
      width: 1600,
      height: 900,
    });
    expect(
      brochureFormatSelection(custom.id, formats).brochureFormatSnapshot?.width,
    ).toBe(2048);
    formats[0]!.visible = false;
    expect(
      availableBrochureFormats(formats).some((item) => item.id === custom.id),
    ).toBe(false);
    expect(resolveBrochureFormat(campaign, [])).toMatchObject({
      width: 1600,
      height: 900,
    });
    expect(brochureFormatSelection("a4", formats, campaign)).toMatchObject({
      brochureFormat: "a4",
      brochureFormatSnapshot: undefined,
    });
  });
  it("rejects unknown, duplicate, hidden and unsafe format defaults", () => {
    const base = resolveSettings(null);
    const settings = {
      ...base,
      customFormats: [custom],
      brochure: { ...base.brochure, format: custom.id },
    };
    expect(workspaceSettingsSchema.safeParse(settings).success).toBe(true);
    for (const invalid of [
      { ...settings, customFormats: [{ ...custom, width: 63 }] },
      { ...settings, customFormats: [{ ...custom, width: 8193 }] },
      {
        ...settings,
        customFormats: [{ ...custom, width: 8192, height: 8192 }],
      },
      { ...settings, customFormats: [{ ...custom, visible: false }] },
      { ...settings, customFormats: [custom, custom] },
      {
        ...settings,
        customFormats: [
          custom,
          { ...custom, id: "custom-copy", name: custom.name.toUpperCase() },
        ],
      },
      {
        ...settings,
        brochure: { ...settings.brochure, format: "custom-missing" },
      },
    ])
      expect(workspaceSettingsSchema.safeParse(invalid).success).toBe(false);
    expect(
      resolveBrochureFormat({
        brochureFormat: custom.id,
        brochureFormatSnapshot: { ...custom, width: -1 },
      }).id,
    ).toBe("neptun1080x1350");
  });
});
