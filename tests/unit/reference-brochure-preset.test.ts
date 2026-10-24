import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import {
  coverProducts,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import { coverProductPlacement } from "../../src/features/brochure/coverElements";
import { productPageChunk } from "../../src/features/brochure/brochureLayout";
import { workspaceSettingsSchema } from "../../src/features/settings/settings.schema";

const appliance = (i: number): Product => ({
  code: `washer-${i}`,
  name: `Washing machine ${i}`,
  category: "Appliance",
});
const television = (i: number): Product => ({
  code: `tv-${i}`,
  name: `TV LED ${i}`,
  category: "TV",
});
it("snapshots the reference preset and packs TVs separately without losing or duplicating offers", () => {
  const products = [
    ...Array.from({ length: 6 }, (_, i) => appliance(i)),
    ...Array.from({ length: 9 }, (_, i) => television(i)),
    appliance(9),
  ];
  const campaign: Campaign = {
    ...campaignDefaults(workspaceSettingsSchema.parse({})),
    id: "preset",
    name: "Preset",
    products,
  };
  const pages = splitPages(campaign);
  expect(coverProducts(campaign)).toHaveLength(3);
  expect(pages.map((page) => [page.layout, page.products.length])).toEqual([
    ["feature3", 3],
    ["tv8", 8],
    ["tv8", 1],
    ["feature3", 1],
  ]);
  expect(
    [...coverProducts(campaign), ...pages.flatMap((page) => page.products)].map(
      (product) => product.code,
    ),
  ).toEqual(products.map((product) => product.code));
  expect(campaign.showFooterPageNumber).toBe(false);
  const top = coverProductPlacement(campaign, 0, 3);
  const left = coverProductPlacement(campaign, 1, 3);
  const right = coverProductPlacement(campaign, 2, 3);
  expect(top.width).toBeGreaterThan(left.width);
  expect(top.y + top.height).toBeLessThan(left.y);
  expect(left.y).toBe(right.y);
  expect(right.x).toBeGreaterThan(left.x + left.width);
  expect(left.y + left.height).toBeLessThan(95);
});
it("keeps an explicit page layout when the automatic preset encounters TVs", () => {
  const products = Array.from({ length: 8 }, (_, i) => television(i));
  expect(
    productPageChunk(
      {
        layout: "feature3",
        autoProductLayout: true,
        pages: { 0: { layout: "duo4" } },
      },
      products,
      0,
    ),
  ).toMatchObject({ layout: "duo4", products: products.slice(0, 4) });
});

it("starts another page when wide bundles cannot fit in the reference grid", () => {
  const products = Array.from({ length: 3 }, (_, i) => ({
    ...appliance(i),
    bundleProducts: [appliance(10), appliance(11), appliance(12)],
  }));
  const first = productPageChunk(
    { layout: "feature3", autoProductLayout: true },
    products,
    0,
  );
  expect(first.products).toHaveLength(2);
  const next = productPageChunk(
    { layout: "feature3", autoProductLayout: true },
    products.slice(first.products.length),
    1,
  );
  expect([...first.products, ...next.products]).toEqual(products);
});
