import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  brochureColorVariantCampaign,
  brochureColorVariantProducts,
  materializeCampaignColorVariants,
} from "../../src/features/brochure/campaignColorVariants";
import {
  coverProducts,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import { productColors } from "../../src/features/brochure/colors";

const phone = (
  code: string,
  color: string,
  changes: Partial<Product> = {},
): Product => ({
  code,
  name: `A37 5G 6/128 ${color}`,
  brand: "SAMSUNG",
  regular: 449,
  sale: 299,
  brochurePage: 1,
  brochureOrder: 1,
  image: `/${code}.png`,
  brochureDetails: ["Android 16", "128GB / 6GB"],
  brochureImagePlacement: { x: 2, y: -1, scale: 1.1 },
  ...changes,
});

it("displays legacy same-slot colors as one first-SKU offer on cover and interior without changing the source", () => {
  const products = [phone("green", "GREEN"), phone("grey", "GREY")];
  const campaign: Campaign = {
    id: "legacy",
    name: "Legacy",
    products,
    coverProductCodes: ["grey", "green"],
    coverBannerProductCode: "grey",
  };
  const before = structuredClone(campaign);
  const display = brochureColorVariantCampaign(campaign);
  expect(display.products).toHaveLength(1);
  expect(display.products[0]).toMatchObject({
    code: "green",
    name: "A37 5G 6/128",
    image: "/green.png",
    sale: 299,
    regular: 449,
    brochureImagePlacement: products[0]!.brochureImagePlacement,
  });
  expect(productColors(display.products[0]!)).toHaveLength(2);
  expect(display.coverProductCodes).toEqual(["green"]);
  expect(display.coverBannerProductCode).toBe("green");
  expect(coverProducts(campaign)).toHaveLength(1);
  expect(
    splitPages({
      ...campaign,
      products: products.map((product) => ({ ...product, brochurePage: 2 })),
    })[0]?.products,
  ).toHaveLength(1);
  expect(campaign).toEqual(before);
  materializeCampaignColorVariants(campaign);
  expect(campaign).toEqual(display);
});

it("keeps different slots, capacities, prices, facts and genuine bundles separate", () => {
  const green = phone("green", "GREEN");
  for (const changes of [
    { brochurePage: 2 },
    { brochureOrder: 2 },
    { sale: 279 },
    { regular: 499 },
    { name: "A37 5G 8/256 GREY" },
    { specs: { RAM: "8GB" } },
    { bundleProducts: [phone("part1", "GREY"), phone("part2", "WHITE")] },
  ] satisfies Partial<Product>[]) {
    const first = { ...green, specs: { RAM: "6GB" } };
    expect(
      brochureColorVariantProducts([first, phone("grey", "GREY", changes)]),
    ).toHaveLength(2);
  }
  expect(
    brochureColorVariantProducts([
      green,
      phone("grey", "GREY", {
        brochurePage: undefined,
        brochureOrder: undefined,
      }),
    ]),
  ).toHaveLength(2);
});
