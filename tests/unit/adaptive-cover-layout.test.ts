import { describe, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  coverProducts,
  materializeProductPages,
  splitPages,
} from "../../src/features/brochure/campaignPages";
import {
  coverProductPlacement,
  repairCoverProductLayout,
} from "../../src/features/brochure/coverElements";

const designs = ["uuu", "october", "classic"] as const;
type Design = (typeof designs)[number];
const campaign = (design: Design, count: number): Campaign => ({
  id: `adaptive-${design}`,
  name: "Adaptive cover",
  brochureFooter: { style: "reference" },
  coverProductLayout: "hero",
  showCoverBand: design !== "classic",
  ...(design === "october"
    ? { brochureVisualStyle: "october", brochurePresetId: "neptun-october" }
    : {}),
  autoProductLayout: true,
  layout: "grid4",
  products: [
    ...Array.from({ length: count }, (_, index) => ({
      code: `cover-${index}`,
      name: `Cover offer ${index}`,
      brochurePage: 1,
    })),
    { code: "interior", name: "Interior offer", brochurePage: 2 },
  ],
});
const frames = (value: Campaign) => {
  const products = coverProducts(value);
  return products.map((_, index) =>
    coverProductPlacement(value, index, products.length),
  );
};

describe("adaptive cover layouts", () => {
  it.each(["uuu", "october"] as const)(
    "keeps three %s offers together in one row below the ribbon",
    (design) => {
      const cards = frames(campaign(design, 3));
      expect(new Set(cards.map((frame) => frame.y)).size).toBe(1);
      expect(new Set(cards.map((frame) => frame.height)).size).toBe(1);
      expect(cards[0]!.y).toBeGreaterThanOrEqual(54);
      expect(cards[0]!.x).toBeLessThan(cards[1]!.x);
      expect(cards[1]!.x).toBeLessThan(cards[2]!.x);
    },
  );

  it.each([3, 4])(
    "places one Classic hero above %i minus one secondary offers",
    (count) => {
      const [hero, ...secondary] = frames(campaign("classic", count));
      expect(new Set(secondary.map((frame) => frame.y)).size).toBe(1);
      expect(secondary).toHaveLength(count - 1);
      expect(hero!.y + hero!.height).toBeLessThan(secondary[0]!.y);
      for (const frame of secondary)
        expect(hero!.width).toBeGreaterThan(frame.width);
    },
  );

  it.each(
    designs.flatMap((design) =>
      Array.from({ length: 30 }, (_, index) => [design, index + 1] as const),
    ),
  )(
    "fits all %s page-one offers at count %i and retains them through materialization",
    (design, count) => {
      const value = campaign(design, count);
      const codes = value.products
        .slice(0, count)
        .map((product) => product.code);
      expect(coverProducts(value).map((product) => product.code)).toEqual(
        codes,
      );
      const cards = frames(value);
      for (const [index, card] of cards.entries()) {
        expect(Object.values(card).every(Number.isFinite)).toBe(true);
        expect(card.width).toBeGreaterThan(0);
        expect(card.height).toBeGreaterThan(0);
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.y).toBeGreaterThanOrEqual(design === "classic" ? 0 : 54);
        expect(card.x + card.width).toBeLessThanOrEqual(100 + 1e-8);
        expect(card.y + card.height).toBeLessThanOrEqual(92 + 1e-8);
        for (const previous of cards.slice(0, index)) {
          const overlapX =
            Math.min(card.x + card.width, previous.x + previous.width) -
            Math.max(card.x, previous.x);
          const overlapY =
            Math.min(card.y + card.height, previous.y + previous.height) -
            Math.max(card.y, previous.y);
          expect(overlapX > 1e-8 && overlapY > 1e-8).toBe(false);
        }
      }
      expect(repairCoverProductLayout(value)).toBe(value);
      materializeProductPages(value);
      const repaired = repairCoverProductLayout(value);
      expect(coverProducts(repaired).map((product) => product.code)).toEqual(
        codes,
      );
      expect(
        repaired.products
          .slice(0, count)
          .every((product) => product.brochurePage === 1),
      ).toBe(true);
      expect(
        splitPages(repaired).flatMap((page) =>
          page.products.map((product) => product.code),
        ),
      ).toEqual(["interior"]);
    },
  );

  it.each(designs)(
    "preserves a valid saved %s arrangement unchanged",
    (design) => {
      const value = campaign(design, 2);
      value.coverElementPlacements = {
        "product-cover-0": { x: 4, y: 56.8, width: 44, height: 30 },
        "product-cover-1": { x: 52, y: 56.8, width: 44, height: 30 },
      };
      const saved = structuredClone(value);
      expect(repairCoverProductLayout(value)).toBe(value);
      expect(value).toEqual(saved);
    },
  );
});
