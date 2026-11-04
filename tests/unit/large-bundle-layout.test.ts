import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { defaultBundleImages } from "../../src/features/brochure/productBundles";
import {
  defaultLargeBundleImages,
  isLargeBundleOffer,
  largeBundleLayout,
  largeBundlePanelColors,
  reflowDefaultLargeBundleImages,
  measuredBundleSeparators,
} from "../../src/features/brochure/largeBundleLayout";
import { effectiveProductArtworks } from "../../src/features/brochure/productArtwork";
import { cardSize } from "../../src/features/brochure/brochureLayout";
import { splitPages } from "../../src/features/brochure/campaignPages";

const members: Product[] = [
  {
    code: "oven",
    name: "FURRË BBSE17320BD",
    image: "/oven.png",
    warranty: "5 vite",
  },
  {
    code: "hob",
    name: "PLLAKË BBSE17320BD",
    localImage: "/hob.png",
    warranty: "5 vite",
  },
  {
    code: "dishwasher",
    name: "ENËLARËSE BDIN18441",
    imageUrl: "/dishwasher.png",
    warranty: "5 vite",
  },
];

it("uses the new panel only for three or more members and preserves the two-product oven/hob positions", () => {
  expect(isLargeBundleOffer({ bundleProducts: members.slice(0, 2) })).toBe(
    false,
  );
  expect(isLargeBundleOffer({ bundleProducts: members })).toBe(true);
  expect(largeBundleLayout(2)).toBeNull();
  const two = defaultBundleImages({
    image: "/prepared-oven.png",
    bundleProducts: members.slice(0, 2),
  });
  expect(
    two.map(({ x, y, width, height }) => ({ x, y, width, height })),
  ).toEqual([
    { x: 7, y: 30, width: 61, height: 70 },
    { x: 36, y: 1, width: 61, height: 69 },
  ]);
  expect(two[0]?.usesPrimaryImage).toBe(true);
});

it("centers the plus in visible TV/phone gaps and follows saved image movement", () => {
  const layout = largeBundleLayout(3)!;
  const tv = { x: 3, y: 10, width: 20, height: 20 };
  const phone = { x: 30, y: 3, width: 12, height: 34 };
  const last = { x: 55, y: 6, width: 14, height: 30 };
  const bounds = [tv, phone, last];
  const before = structuredClone(bounds);
  const pluses = measuredBundleSeparators(layout, bounds);
  expect(pluses[0]).toEqual({ x: 26.5, y: 20 });
  expect(pluses[1]).toEqual({ x: 48.5, y: 21 });
  expect(
    measuredBundleSeparators(layout, [tv, { ...phone, x: 35, y: 13 }, last])[0],
  ).toEqual({ x: 29, y: 21.5 });
  expect(bounds).toEqual(before);
  expect(measuredBundleSeparators(layout, [null, null, null])).toEqual(
    layout.separators,
  );
});

it("places the wrap plus before the first visible photo in the new row", () => {
  const layout = largeBundleLayout(5)!;
  const bounds = layout.members.map((member) => member.image);
  bounds[3] = { x: 21, y: 57, width: 10, height: 18 };
  expect(measuredBundleSeparators(layout, bounds)[2]).toEqual({
    x: 18,
    y: 66,
    startsRow: true,
  });
});

it("uses readable member rows with aligned image/copy cells and keeps the summary rail clear", () => {
  for (const count of [3, 4, 5, 6, 7, 8, 12]) {
    const layout = largeBundleLayout(count);
    if (!layout) throw new Error("Missing large bundle layout");
    expect(layout.photoArea).toEqual({ x: 0, y: 0, width: 100, height: 68 });
    expect(layout.members).toHaveLength(count);
    expect(layout.separators).toHaveLength(count - 1);
    layout.members.forEach(({ image, copy }, index) => {
      expect(image.width).toBeGreaterThan(0);
      expect(image.width).toBeGreaterThanOrEqual(count >= 7 ? 14 : 20);
      expect(image.x).toBeGreaterThanOrEqual(3);
      expect(image.x + image.width).toBeLessThanOrEqual(73 + 0.000001);
      expect(image.y + image.height).toBeLessThanOrEqual(100);
      expect(copy.x).toBe(image.x);
      expect(copy.width).toBe(image.width);
      expect(copy.y).toBeGreaterThan(image.y + image.height);
      expect(copy.y + copy.height).toBeLessThanOrEqual(96.000001);
      for (const previous of layout.members.slice(0, index)) {
        const separated =
          image.x >= previous.image.x + previous.image.width ||
          previous.image.x >= image.x + image.width ||
          image.y >= previous.copy.y + previous.copy.height ||
          previous.image.y >= copy.y + copy.height;
        expect(separated).toBe(true);
      }
    });
    for (const separator of layout.separators)
      expect(
        layout.members.every(
          ({ image, copy }) =>
            separator.x < image.x ||
            separator.x > image.x + image.width ||
            separator.y < image.y ||
            separator.y > copy.y + copy.height,
        ),
      ).toBe(true);
    expect(layout.columns).toBe(count === 4 ? 2 : count >= 7 ? 4 : 3);
    expect(layout.rows).toBe(Math.ceil(count / layout.columns));
  }
});

it("keeps the primary replacement source, member identity and fallback images without changing numeric offers", () => {
  const product: Product = {
    code: "set",
    name: "Set",
    image: "/prepared-oven.png",
    regular: 1008,
    sale: 629,
    bundleProducts: structuredClone(members),
  };
  const before = structuredClone(product);
  const images = defaultLargeBundleImages(product);
  expect(images.map((image) => image.image)).toEqual([
    "/prepared-oven.png",
    "/hob.png",
    "/dishwasher.png",
  ]);
  expect(images.map((image) => image.memberCode)).toEqual([
    "oven",
    "hob",
    "dishwasher",
  ]);
  expect(images.every((image) => image.relativeTo === "product")).toBe(true);
  expect(defaultBundleImages(product)).toEqual(images);
  expect(product).toEqual(before);
  expect(
    defaultLargeBundleImages({ bundleProducts: members.slice(0, 2) }),
  ).toEqual([]);
});

it("uses inch-based sizing for automatic bundle TVs without altering saved member artwork", () => {
  const tvs = [55, 65, 66].map((inches) => ({
    code: String(inches),
    name: `TV LED ${inches}ABC`,
    subcategory: "TV",
    specs: { Përmasat: `${inches} inch` },
  }));
  const offer = {
    code: "TVs",
    name: "TVs",
    image: "/tv.png",
    bundleProducts: tvs,
  };
  const defaults = effectiveProductArtworks(offer);
  const saved = defaultLargeBundleImages(offer);
  expect(defaults.map((artwork) => Number(artwork.width))).toEqual([
    Number(saved[0]!.width) * 0.86,
    Number(saved[1]!.width) * 0.93,
    Number(saved[2]!.width) * 0.9323,
  ]);
  expect(
    effectiveProductArtworks({ ...offer, productArtworks: saved }),
  ).toEqual(saved);
});

it("updates only untouched legacy image placements while preserving custom transforms, replacements and deleted layers", () => {
  const bundleMembers = Array.from({ length: 5 }, (_, index) => ({
    code: `member-${index}`,
    name: `Member ${index}`,
    image: `/member-${index}.png`,
  }));
  const oldWidth = (76 / 5) * 0.82;
  const oldStep = (76 - oldWidth) / 4;
  const legacy = bundleMembers.map((member, index) => ({
    id: `bundle-image-${member.code}`,
    type: "bundle-product",
    memberCode: member.code,
    x: 2 + index * oldStep,
    y: 17,
    width: oldWidth,
    height: 81,
    relativeTo: "photo-area",
    image: member.image,
  }));
  legacy[1] = { ...legacy[1]!, relativeTo: "product", x: 30, y: 23, width: 35 };
  legacy[2] = { ...legacy[2]!, width: 14, image: "/replacement.png" };
  const product = {
    code: "set",
    name: "Set",
    bundleProducts: bundleMembers,
    productArtworks: legacy.slice(0, 4),
  };
  const before = structuredClone(product);
  const updated = effectiveProductArtworks(product);
  expect(updated).toHaveLength(4);
  expect(updated[0]).toMatchObject({
    ...largeBundleLayout(5)!.members[0]!.image,
    relativeTo: "product",
  });
  expect(updated[1]).toEqual(legacy[1]);
  expect(updated[2]).toEqual(legacy[2]);
  expect(updated[3]).toMatchObject({
    ...largeBundleLayout(5)!.members[3]!.image,
    relativeTo: "product",
  });
  expect(product).toEqual(before);
  expect(effectiveProductArtworks({ ...product, productArtworks: [] })).toEqual(
    [],
  );
  expect(
    reflowDefaultLargeBundleImages({ bundleProducts: bundleMembers }, updated),
  ).toEqual(updated);
});

it("gives multi-row groups enough grid height while respecting explicit sizing and Excel page membership", () => {
  const bundleMembers = Array.from({ length: 8 }, (_, index) => ({
    code: String(index),
    name: String(index),
  }));
  expect(
    cardSize({ bundleProducts: bundleMembers.slice(0, 3) }, "classic8"),
  ).toEqual({ width: 3, height: 1 });
  expect(
    cardSize({ bundleProducts: bundleMembers.slice(0, 5) }, "classic8"),
  ).toEqual({ width: 3, height: 2 });
  expect(cardSize({ bundleProducts: bundleMembers }, "classic8")).toEqual({
    width: 3,
    height: 2,
  });
  expect(
    cardSize(
      {
        bundleProducts: bundleMembers,
        brochureCardSize: { width: 1, height: 1 },
      },
      "classic8",
    ),
  ).toEqual({ width: 1, height: 1 });
  const group = {
    code: "set",
    name: "Set",
    bundleProducts: bundleMembers.slice(0, 5),
    brochurePage: 2,
    brochureOrder: 1,
  };
  const samePage = {
    code: "other",
    name: "Other",
    brochurePage: 2,
    brochureOrder: 2,
  };
  const nextPage = {
    code: "next",
    name: "Next",
    brochurePage: 3,
    brochureOrder: 1,
  };
  const pages = splitPages({
    id: "excel",
    name: "Excel",
    products: [group, samePage, nextPage],
    autoProductLayout: false,
    layout: "classic8",
  });
  expect(
    pages.map((page) => page.products.map((product) => product.code)),
  ).toEqual([["set", "other"], ["next"]]);
  expect(group.bundleProducts).toHaveLength(5);
});

it("darkens the actual page color slightly and honors an explicit panel override with readable copy", () => {
  expect(largeBundlePanelColors("#245b89")).toEqual({
    background: "#205079",
    foreground: "#ffffff",
  });
  expect(largeBundlePanelColors("#f1f2f4")).toEqual({
    background: "#d4d5d7",
    foreground: "#1c4075",
  });
  expect(largeBundlePanelColors("#245b89", "#ffffff")).toEqual({
    background: "#ffffff",
    foreground: "#1c4075",
  });
  expect(largeBundlePanelColors("invalid", "invalid")).toEqual(
    largeBundlePanelColors(),
  );
});
