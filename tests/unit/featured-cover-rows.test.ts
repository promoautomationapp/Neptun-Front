import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  applyCoverProductPlacement,
  collectionCoverHeaderPlacement,
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

it("keeps Hajde and the variable campaign title above the product rows", () => {
  const hajde = collectionCoverHeaderPlacement("hajde");
  const title = collectionCoverHeaderPlacement("message");
  expect(hajde.y).toBe(19);
  expect(title.y).toBe(hajde.y);
  expect(hajde.x + hajde.width).toBeLessThan(title.x);
  const hero = frames(campaign(3))[0]!;
  expect(Math.max(hajde.y + hajde.height, title.y + title.height)).toBeLessThan(
    hero.y,
  );
});

it("keeps a single offer in the featured row and leaves the lower row available", () => {
  const value = campaign(1);
  expect(resolvedCoverProductLayout(value, 1)).toBe("hero");
  expect(frames(value)[0]).toEqual(frames(campaign(3))[0]);
  expect(frames(value)[0]!.y + frames(value)[0]!.height).toBeLessThan(60);
  expect(isFeaturedCoverProduct(value, "offer-0", 0, 1)).toBe(true);
});

it.each(["neptun-current", "neptun-gradient-all"])(
  "reserves the top quarter for a campaign title in %s without enlarging the product rows",
  (brochurePresetId) => {
    for (const count of [2, 3, 4]) {
      const value = {
        ...campaign(count),
        brochurePresetId,
        tagline: "A different campaign title",
        showCoverHeadline: true,
      };
      const [top, ...bottom] = frames(value);
      expect(top).toEqual({ x: 5, y: 28, width: 90, height: 31 });
      expect(
        bottom.every((frame) => frame.y === 63 && frame.height === 31),
      ).toBe(true);
      expect(bottom.at(-1)!.y + bottom.at(-1)!.height).toBe(94);
    }
  },
);

it("migrates the previous automatic hero frames to the lower title-safe rows without resetting custom frames", () => {
  const value = campaign(3);
  value.coverElementPlacements = {
    "product-offer-0": { x: 3, y: 19, width: 94, height: 34.5 },
    "product-offer-1": { x: 3, y: 57.5, width: 45.75, height: 34.5 },
    "product-offer-2": { x: 51.25, y: 57.5, width: 45.75, height: 34.5 },
  };
  expect(repairCoverProductLayout(value).coverElementPlacements).toEqual({});
  value.coverElementPlacements["product-offer-2"] = {
    x: 70,
    y: 65,
    width: 25,
    height: 24,
  };
  const custom = repairCoverProductLayout(value);
  expect(custom.coverElementPlacements?.["product-offer-2"]).toEqual(
    value.coverElementPlacements["product-offer-2"],
  );
  expect(custom.coverElementPlacements?.["product-offer-0"]?.y).toBe(19);
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
      expect(card.y).toBeGreaterThanOrEqual(28);
      expect(card.y + card.height).toBeLessThanOrEqual(94 + 1e-8);
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
    const value = {
      ...campaign(3),
      coverProductLayout: layout,
      coverProductLayoutManual: true,
    };
    const cards = frames(value);
    expect(cards[0]!.y).toBe(cards[1]!.y);
    expect(isFeaturedCoverProduct(value, "offer-0", 0, 3)).toBe(false);
    if (layout === "row")
      expect(new Set(cards.map((card) => card.y)).size).toBe(1);
  },
);

it.each(["neptun-current", "neptun-gradient-all"])(
  "upgrades the inherited pair setting in %s to the requested cover rows",
  (brochurePresetId) => {
    for (const count of [2, 3, 4]) {
      const value = {
        ...campaign(count),
        brochurePresetId,
        coverProductLayout: "pair",
      };
      const legacy = { ...value, coverProductLayoutManual: true };
      value.coverElementPlacements = Object.fromEntries(
        value.products.map((product, index) => [
          `product-${product.code}`,
          coverProductPlacement(legacy, index, count),
        ]),
      );
      const original = structuredClone(value);
      const repaired = repairCoverProductLayout(value);
      expect(repaired).not.toBe(value);
      expect(repaired.coverProductLayout).toBe("hero");
      expect(repaired.coverElementPlacements).toEqual({});
      expect(value).toEqual(original);
      const [top, ...bottom] = frames(repaired);
      expect(top!.width).toBe(90);
      expect(new Set(bottom.map((frame) => frame.y)).size).toBe(1);
      for (const frame of bottom)
        expect(frame.y).toBeGreaterThan(top!.y + top!.height);
      if (count === 2) expect(bottom[0]!.width).toBe(top!.width);
      expect(frames(JSON.parse(JSON.stringify(repaired)) as Campaign)).toEqual([
        top,
        ...bottom,
      ]);
    }
  },
);

it("keeps a genuinely custom collection arrangement while upgrading only untouched defaults", () => {
  const value = { ...campaign(2), coverProductLayout: "pair" };
  const custom = { x: 6, y: 60, width: 40, height: 25 };
  value.coverElementPlacements = { "product-offer-0": custom };
  const repaired = repairCoverProductLayout(value);
  expect(repaired.coverProductLayout).toBe("pair");
  expect(repaired.coverProductLayoutManual).toBe(true);
  expect(repaired.coverElementPlacements?.["product-offer-0"]).toEqual(custom);
  expect(value.coverElementPlacements["product-offer-0"]).toEqual(custom);
});

it.each(["neptun-current", "neptun-gradient-all"])(
  "reflows two survivors from the historical three-offer lower row in %s",
  (brochurePresetId) => {
    const value: Campaign = {
      ...campaign(2),
      brochurePresetId,
      coverProductLayout: "hero",
    };
    value.coverElementPlacements = {
      "product-offer-0": { x: 3, y: 58, width: 45, height: 34 },
      "product-offer-1": { x: 52, y: 58, width: 45, height: 34 },
    };
    const repaired = repairCoverProductLayout(value);
    expect(repaired.coverElementPlacements).toEqual({});
    const [top, bottom] = frames(repaired);
    expect(top!.y).toBe(28);
    expect(bottom!.y).toBeGreaterThan(top!.y + top!.height);
    expect(bottom!.width).toBe(top!.width);
  },
);

it("retains an explicit side-by-side layout on other Hajde cover designs", () => {
  const value = {
    ...campaign(3),
    brochurePresetId: "custom-blue",
    coverProductLayout: "pair",
  };
  const cards = frames(value);
  expect(cards[0]!.y).toBe(cards[1]!.y);
  expect(cards[0]!.x).toBeLessThan(cards[1]!.x);
  expect(isFeaturedCoverProduct(value, "offer-0", 0, 3)).toBe(false);
});

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

it.each(["#1b4075", "#e3e3e3"])(
  "uses the same automatic featured rows on %s covers without a preset marker",
  (coverBackgroundColor) => {
    const values = [1, 2, 3, 4].map((count) => ({
      ...campaign(count),
      brochurePresetId: undefined,
      brochureFooter: undefined,
      coverBandVariant: undefined,
      showCoverHeadline: false,
      coverBackgroundColor,
    }));
    const first = frames(values[0]!)[0]!;
    for (const value of values) {
      const [top, ...bottom] = frames(value);
      expect(resolvedCoverProductLayout(value, value.products.length)).toBe(
        "hero",
      );
      expect(top).toEqual(first);
      expect(
        isFeaturedCoverProduct(value, "offer-0", 0, value.products.length),
      ).toBe(true);
      expect(top!.width).toBe(92);
      for (const secondary of bottom)
        expect(secondary.y).toBeGreaterThan(top!.y + top!.height);
      if (bottom.length)
        expect(new Set(bottom.map((frame) => frame.y)).size).toBe(1);
      if (bottom.length === 1) expect(bottom[0]!.width).toBe(top!.width);
    }
  },
);
