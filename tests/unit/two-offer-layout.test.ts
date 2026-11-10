import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { builtInBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { splitPages } from "../../src/features/brochure/campaignPages";
import {
  cardSize,
  layoutGrid,
} from "../../src/features/brochure/brochureLayout";

it("stacks a two-product composition in every default design and legacy global layout", () => {
  for (const preset of builtInBrochurePresets) {
    for (const layout of [
      "duo4",
      "grid6",
      "grid6portrait",
      "classic8",
      "tv8",
    ]) {
      const campaign: Campaign = {
        ...preset.design,
        id: `${preset.id}-${layout}`,
        name: "Two offers",
        layout,
        autoProductLayout: false,
        products: [
          { code: "a", name: "Product A", brochurePage: 2 },
          { code: "b", name: "Product B", brochurePage: 2 },
        ],
      };
      const [page] = splitPages(campaign);
      expect(page!.layout).toBe("pair2");
      expect(page!.products.map((product) => product.code)).toEqual(["a", "b"]);
      expect(layoutGrid(page!.layout)).toEqual({ columns: 1, rows: 2 });
      expect(
        page!.products.map((product, index) =>
          cardSize(product, page!.layout, index),
        ),
      ).toEqual([
        { width: 1, height: 1 },
        { width: 1, height: 1 },
      ]);
    }
  }
});

it("keeps a deliberate later per-page layout choice and the eight-TV 3–2–3 grid", () => {
  const base: Campaign = {
    id: "manual",
    name: "Manual",
    autoProductLayout: true,
    products: [
      { code: "a", name: "Offer A", brochurePage: 2 },
      { code: "b", name: "Offer B", brochurePage: 2 },
    ],
    pages: { 0: { layout: "duo4" } },
  };
  expect(splitPages(base)[0]!.layout).toBe("duo4");
  const tvs: Campaign = {
    ...base,
    pages: {},
    products: Array.from({ length: 8 }, (_, index) => ({
      code: String(index),
      name: `TV LED ${index}`,
      category: "TV",
      brochurePage: 2,
    })),
  };
  const [page] = splitPages(tvs);
  expect(page!.layout).toBe("tv8");
  expect(
    page!.products.map(
      (product, index) => cardSize(product, page!.layout, index).width,
    ),
  ).toEqual([2, 2, 2, 3, 3, 2, 2, 2]);
});
