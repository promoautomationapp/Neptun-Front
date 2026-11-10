import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { applyBrandLogoToMatchingProducts } from "../../src/features/brochure/campaignBrandLogos";
import {
  brandLogoFor,
  normalizeBrandLogoName,
} from "../../src/features/brochure/brandLogos";
import { campaignSchema } from "../../src/domain/schemas";

it("updates imported source logos across pages, nested sets and color metadata without changing other brands or styling", () => {
  const color = { name: "Black", hex: "#231f20" };
  const campaign: Campaign = {
    id: "bf",
    name: "BF",
    brandLogoColor: "#ff8800",
    brandLogoMode: "auto",
    brandLogos: { " lg ": "/old-library.svg", BEKO: "/beko.svg" },
    pageAppearances: { "product-1": { brandColor: "#112233" } },
    products: [
      {
        code: "cover",
        name: "TV",
        brand: "LG",
        brandLogo: "/brochure-presets/black-friday/brands/p01-01.svg",
        brochurePage: 1,
        detailBlockPlacements: { __brand: { x: 2, width: 9 } },
        brochureVariants: [
          { code: "black", color, brandLogo: "/old-color.svg" },
          { code: "other", brand: "Beko", color, brandLogo: "/beko-color.svg" },
        ],
      },
      {
        code: "inside",
        name: "TV",
        brand: "  lG  ",
        brandLogo: "/brochure-presets/black-friday/brands/p03-04.svg",
        brochurePage: 4,
        hideBrandLogo: true,
      },
      {
        code: "set",
        name: "Mixed set",
        brand: "LG / Beko",
        brandLogo: "/mixed-composite.svg",
        bundleProducts: [
          {
            code: "leaf",
            name: "LG device",
            brand: "ＬＧ",
            brandLogo: "/old-member.svg",
          },
          {
            code: "nested",
            name: "Nested set",
            bundleProducts: [
              {
                code: "deep",
                name: "TV",
                brand: "lg",
                brandLogo: "/old-nested.svg",
              },
              {
                code: "beko",
                name: "Beko device",
                brand: "Beko",
                brandLogo: "/beko-source.svg",
              },
            ],
          },
        ],
      },
    ],
  };
  const before = structuredClone(campaign);
  expect(
    applyBrandLogoToMatchingProducts(campaign, " lg ", "/new-logo.svg"),
  ).toBe(4);
  expect(campaign.brandLogos).toEqual({
    LG: "/new-logo.svg",
    BEKO: "/beko.svg",
  });
  expect(campaign.products![0]!.brandLogo).toBe("/new-logo.svg");
  expect(campaign.products![1]!.brandLogo).toBe("/new-logo.svg");
  expect(campaign.products![2]!.bundleProducts![0]!.brandLogo).toBe(
    "/new-logo.svg",
  );
  expect(
    campaign.products![2]!.bundleProducts![1]!.bundleProducts![0]!.brandLogo,
  ).toBe("/new-logo.svg");
  expect(campaign.products![0]!.brochureVariants![0]).toMatchObject({
    color,
    brandLogo: "/new-logo.svg",
  });
  expect(campaign.products![0]!.brochureVariants![1]).toEqual(
    before.products![0]!.brochureVariants![1],
  );
  expect(campaign.products![2]!.brandLogo).toBe("/mixed-composite.svg");
  expect(campaign.products![2]!.bundleProducts![1]!.bundleProducts![1]).toEqual(
    before.products![2]!.bundleProducts![1]!.bundleProducts![1],
  );
  expect(campaign.brandLogoColor).toBe(before.brandLogoColor);
  expect(campaign.pageAppearances).toEqual(before.pageAppearances);
  expect(campaign.products![0]!.detailBlockPlacements).toEqual(
    before.products![0]!.detailBlockPlacements,
  );
  expect(campaign.products![1]!.hideBrandLogo).toBe(true);
  expect(
    campaignSchema.parse(JSON.parse(JSON.stringify(campaign))).products[0]!
      .brandLogo,
  ).toBe("/new-logo.svg");
});

it("normalizes manufacturer names consistently and can apply a brand-name fallback", () => {
  expect(normalizeBrandLogoName("  black  +  decker  ")).toBe("BLACK+DECKER");
  const campaign: Campaign = {
    id: "logo",
    name: "Logo",
    products: [
      { code: "a", name: "A", brand: "Black + Decker", brandLogo: "/old.svg" },
    ],
  };
  applyBrandLogoToMatchingProducts(campaign, "BLACK+DECKER", "");
  expect(campaign.products![0]!.brandLogo).toBe("");
  expect(brandLogoFor(campaign, " black + decker ")).toBe("");
});
