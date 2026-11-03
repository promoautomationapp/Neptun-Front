import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  coverProducts,
  materializeProductPages,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import { placeProductOnPage } from "../../src/features/brochure/productPlacement";

it.each([3, 6])(
  "adds another cover product alongside all %i existing offers at either end",
  (count) => {
    const covers = Array.from(
      { length: count },
      (_, index) => `cover-${index}`,
    );
    for (const position of ["start", "end"]) {
      const campaign: Campaign = {
        id: "cover-placement",
        name: "Cover placement",
        showCoverBand: true,
        products: [...covers, "new", "interior"].map((code) => ({
          code,
          name: code,
        })),
        coverProductCodes: covers,
      };
      expect(placeProductOnPage(campaign, "new", -1, covers, position)).toBe(
        true,
      );
      expect(campaign.coverProductCodes).toEqual(
        position === "start" ? ["new", ...covers] : [...covers, "new"],
      );
      expect(coverProducts(campaign).map((product) => product.code)).toEqual(
        position === "start" ? ["new", ...covers] : [...covers, "new"],
      );
      expect(
        splitPages(campaign).flatMap((page) =>
          page.products.map((product) => product.code),
        ),
      ).toEqual(["interior"]);
    }
  },
);

it("keeps explicit cover selection order while ignoring duplicates and missing codes", () => {
  const campaign: Campaign = {
    id: "cover-order",
    name: "Cover order",
    products: ["one", "two", "three"].map((code) => ({ code, name: code })),
    coverProductCodes: ["two", "one", "two", "missing"],
  };
  expect(coverProducts(campaign).map((product) => product.code)).toEqual([
    "two",
    "one",
  ]);
});

it("preserves selected cover order through materialization and refresh without moving interior slots", () => {
  const campaign: Campaign = {
    id: "cover-materialization-order",
    name: "Cover materialization order",
    autoProductLayout: true,
    layout: "grid4",
    products: ["one", "interior-1", "two", "interior-2", "three"].map(
      (code) => ({ code, name: code }),
    ),
    coverProductCodes: ["three", "one", "two"],
  };
  materializeProductPages(campaign);
  expect(campaign.products.map((product) => product.code)).toEqual([
    "three",
    "interior-1",
    "one",
    "interior-2",
    "two",
  ]);
  const refreshed = JSON.parse(JSON.stringify(campaign)) as Campaign;
  expect(coverProducts(refreshed).map((product) => product.code)).toEqual([
    "three",
    "one",
    "two",
  ]);
  expect(
    splitPages(refreshed).flatMap((page) =>
      page.products.map((product) => product.code),
    ),
  ).toEqual(["interior-1", "interior-2"]);
});
