import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { switchBrochureDesign } from "../../src/features/brochure/switchBrochureDesign";
import { availableBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";

function fixture(): Campaign {
  return {
    id: "existing",
    name: "Campaign",
    startDate: "2026-11-09",
    products: [
      {
        code: "phone",
        name: "My phone",
        image: "/prepared-cutout.png",
        regular: 449,
        sale: 299,
        offerStyle: "card",
        brochurePage: 1,
        brochureOrder: 0,
        brochureImagePlacement: { x: 57, y: 54, scale: 1.2 },
        brochureContentPlacement: {
          saving: { x: 4, y: 3, width: 12 },
          price: { x: -2, y: 5 },
        },
        detailBlockPlacements: { memory: { x: 2, y: 1 } },
        productArtworks: [
          {
            id: "wifi",
            type: "image",
            image: "/wifi.svg",
            x: 1,
            y: 2,
            width: 5,
          },
        ],
      },
    ],
    coverProductLayoutManual: true,
    coverElementPlacements: {
      "product-phone": { x: 17, y: 51, width: 38, height: 36 },
      logo: { x: 25, y: 2, width: 40 },
    },
    pageArtworks: {
      cover: [
        {
          id: "headline",
          type: "text",
          text: "Campaign title",
          x: 10,
          y: 20,
          width: 70,
          fontSize: 5,
        },
      ],
    },
    campaignAssets: {
      "stores-logo": {
        image: "/custom-stores.svg",
        placement: { x: 3, y: 4, width: 15 },
      },
    },
    brandLogos: { SAMSUNG: "/our-samsung.png" },
    coverHeadline: "Our headline",
    tagline: "Our offer",
    coverBrandTagline: "Our slogan",
    paymentText: "Our terms",
    brochureFooter: {
      dateText: "5–16 November",
      bottom: 3,
      height: 6,
      from: "#aaaaaa",
      style: "bar",
    },
    storesSnapshot: {
      stores: [
        {
          id: "mine",
          city: "Prishtinë",
          name: "My location",
          address: "My street",
          phone: "123",
        },
      ],
      contact: { support: "456" },
    },
    selectedStoreIndexes: [0],
    storeOrder: [0],
    storePositions: { "0": { x: 4, y: 9 } },
    storesElementPlacements: { logo: { x: 25, y: 3, width: 20 } },
    storeFooterElementPlacements: { online: { x: 3, y: 5 } },
    pages: {
      "0": {
        layout: "duo2",
        headerText: "My page heading",
        spacing: { gap: 3 },
        backgroundColor: "#ff00ff",
        backgroundImage: "/old.png",
        backgroundGradient: { from: "#000000", to: "#ffffff", angle: 90 },
      },
    },
    pageAppearances: { cover: { textColor: "#ff0000", priceStyle: "card" } },
    coverBackgroundImage: "/old-cover.jpg",
    productBackgroundImage: "/old-inside.jpg",
    storesBackgroundImage: "/old-stores.jpg",
    aiBackgroundChanged: true,
  };
}

it.each(availableBrochurePresets(resolveSettings(null)))(
  "keeps all manual content and positions while switching to $id",
  (preset) => {
    const campaign = fixture();
    const original = structuredClone(campaign);
    switchBrochureDesign(campaign, preset);
    expect(campaign.brochurePresetId).toBe(preset.id);
    for (const key of [
      "products",
      "coverElementPlacements",
      "pageArtworks",
      "campaignAssets",
      "coverHeadline",
      "tagline",
      "coverBrandTagline",
      "paymentText",
      "storesSnapshot",
      "selectedStoreIndexes",
      "storeOrder",
      "storePositions",
      "storesElementPlacements",
      "storeFooterElementPlacements",
    ] as const)
      expect(campaign[key], key).toEqual(original[key]);
    expect(campaign.coverProductLayoutManual).toBe(true);
    expect(campaign.brandLogos?.SAMSUNG).toBe("/our-samsung.png");
    expect(campaign.brochureFooter).toMatchObject({
      dateText: "5–16 November",
      bottom: 3,
      height: 6,
    });
    expect(campaign.pages?.["0"]).toEqual({
      layout: "duo2",
      headerText: "My page heading",
      spacing: { gap: 3 },
    });
    for (const key of [
      "coverBackgroundColor",
      "coverBackgroundGradient",
      "coverBackgroundImage",
      "productBackgroundColor",
      "productBackgroundGradient",
      "productBackgroundImage",
      "storesBackgroundColor",
      "storesBackgroundGradient",
      "storesBackgroundImage",
    ] as const)
      expect(campaign[key], key).toEqual(preset.design[key]);
    expect(campaign.pageAppearances).toEqual(preset.design.pageAppearances);
    expect(campaign.aiBackgroundChanged).toBe(false);
  },
);

it("does not retain stale photos, gradients or ink overrides when choosing a partial saved design", () => {
  const campaign = fixture();
  campaign.brandLogoMode = "white";
  campaign.coverTextColorOverrides = { coverMessageColor: true };
  campaign.coverMessageColor = "#ffffff";
  switchBrochureDesign(campaign, {
    id: "partial",
    name: "Light",
    design: {
      theme: "light",
      offerStyle: "card",
      productBackgroundColor: "#eeeeee",
      pageAppearances: {
        product: { textColor: "#123456", priceStyle: "card" },
      },
    },
  });
  expect(campaign).not.toHaveProperty("coverBackgroundImage");
  expect(campaign).not.toHaveProperty("storesBackgroundImage");
  expect(campaign).not.toHaveProperty("productBackgroundImage");
  expect(campaign).not.toHaveProperty("brandLogoMode");
  expect(campaign).not.toHaveProperty("coverMessageColor");
  expect(campaign).not.toHaveProperty("coverTextColorOverrides");
  expect(campaign.pageAppearances).toEqual({
    product: { textColor: "#123456", priceStyle: "card" },
  });
});
