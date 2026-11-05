import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  applyCoverProductPlacement,
  coverProductPlacement,
  repairCoverProductLayout,
} from "../../src/features/brochure/coverElements";
import {
  isFeaturedCoverProduct,
  resolvedCoverProductLayout,
} from "../../src/features/brochure/coverPresentation";
import { coverProducts } from "../../src/features/brochure/campaignPages";

function campaign(count: number): Campaign {
  return {
    id: "featured-rows",
    name: "Featured collection",
    brochurePresetId: "neptun-current",
    brochureVisualStyle: "current",
    coverBandVariant: "hajde",
    showCoverBand: false,
    brochureFooter: { style: "reference" },
    products: Array.from({ length: count }, (_, index) => ({
      code: `offer-${index}`,
      name: `Offer ${index}`,
      brochurePage: 1,
    })),
  };
}
const frames = (value: Campaign) =>
  coverProducts(value).map((_, index, products) =>
    coverProductPlacement(value, index, products.length),
  );

it("keeps a single offer in the featured row and leaves the lower row available", () => {
  const value = campaign(1);
  expect(resolvedCoverProductLayout(value, 1)).toBe("hero");
  expect(frames(value)[0]).toEqual(frames(campaign(3))[0]);
  expect(frames(value)[0]!.y + frames(value)[0]!.height).toBeLessThan(58);
  expect(isFeaturedCoverProduct(value, "offer-0", 0, 1)).toBe(true);
});

it.each([2, 3, 4])(
  "places %i offers in one featured slot above the remaining row",
  (count) => {
    const value = campaign(count);
    const [hero, ...lower] = frames(value);
    expect(lower).toHaveLength(count - 1);
    expect(new Set(lower.map((frame) => frame.y)).size).toBe(1);
    expect(hero!.y + hero!.height).toBeLessThan(lower[0]!.y);
    expect(hero).toEqual(frames(campaign(1))[0]);
    expect(
      value.products.filter((product, index) =>
        isFeaturedCoverProduct(value, product.code, index, count),
      ),
    ).toHaveLength(1);
  },
);

it.each([5, 7, 12, 30])(
  "keeps all %i assigned offers visible in smart lower rows",
  (count) => {
    const value = campaign(count);
    const cards = frames(value);
    expect(cards).toHaveLength(count);
    expect(cards.filter((card) => card.y === cards[0]!.y)).toHaveLength(1);
    for (const [index, card] of cards.entries()) {
      expect(card.width).toBeGreaterThan(0);
      expect(card.height).toBeGreaterThan(0);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(100 + 1e-8);
      expect(card.y).toBeGreaterThanOrEqual(19);
      expect(card.y + card.height).toBeLessThanOrEqual(92 + 1e-8);
      for (const previous of cards.slice(0, index)) {
        const overlaps =
          card.x < previous.x + previous.width &&
          card.x + card.width > previous.x &&
          card.y < previous.y + previous.height &&
          card.y + card.height > previous.y;
        expect(overlaps).toBe(false);
      }
    }
    expect(repairCoverProductLayout(value)).toBe(value);
  },
);

it("lets a single offer move into the lower row and retains that saved placement", () => {
  const value = campaign(1);
  const lowerRow = { x: 6, y: 60, width: 88, height: 30 };
  expect(applyCoverProductPlacement(value, "product-offer-0", lowerRow)).toBe(
    true,
  );
  expect(value.coverElementPlacements?.["product-offer-0"]).toEqual(lowerRow);
  const reopened = JSON.parse(JSON.stringify(value)) as Campaign;
  expect(repairCoverProductLayout(reopened)).toBe(reopened);
  expect(reopened.coverElementPlacements?.["product-offer-0"]).toEqual(
    lowerRow,
  );
  expect(coverProducts(reopened).map((product) => product.code)).toEqual([
    "offer-0",
  ]);
});

it.each(["pair", "row"])(
  "honors the explicit %s layout instead of forcing a featured row",
  (layout) => {
    const value = { ...campaign(3), coverProductLayout: layout };
    const cards = frames(value);
    expect(cards[0]!.y).toBe(cards[1]!.y);
    expect(isFeaturedCoverProduct(value, "offer-0", 0, 3)).toBe(false);
    if (layout === "row")
      expect(new Set(cards.map((card) => card.y)).size).toBe(1);
  },
);

it("retains a manually chosen featured product", () => {
  const value = { ...campaign(3), coverBannerProductCode: "offer-1" };
  const cards = frames(value);
  expect(cards[1]!.y).toBeLessThan(cards[0]!.y);
  expect(cards[1]!.y).toBeLessThan(cards[2]!.y);
  expect(isFeaturedCoverProduct(value, "offer-1", 1, 3)).toBe(true);
  expect(isFeaturedCoverProduct(value, "offer-0", 0, 3)).toBe(false);
});

it("keeps the three-offer UUU cover horizontal", () => {
  const value: Campaign = {
    ...campaign(3),
    showCoverBand: true,
    coverBandVariant: "uuu",
  };
  const cards = frames(value);
  expect(new Set(cards.map((card) => card.y)).size).toBe(1);
  expect(cards.every((card) => card.y >= 54)).toBe(true);
});
