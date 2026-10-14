import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { defaultBundleImages } from "../../src/features/brochure/productBundles";
import {
  defaultLargeBundleImages,
  isLargeBundleOffer,
  largeBundleLayout,
  largeBundlePanelColors,
} from "../../src/features/brochure/largeBundleLayout";

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

it("places every member side by side within the left 78 percent and keeps photo and copy columns aligned", () => {
  for (const count of [3, 4, 6, 12]) {
    const layout = largeBundleLayout(count);
    if (!layout) throw new Error("Missing large bundle layout");
    expect(layout.photoArea).toEqual({ x: 0, y: 0, width: 100, height: 68 });
    expect(layout.members).toHaveLength(count);
    expect(layout.separators).toHaveLength(count - 1);
    layout.members.forEach(({ image, copy }, index) => {
      expect(image.width).toBeGreaterThan(0);
      expect(image.x).toBeGreaterThanOrEqual(2);
      expect(image.x + image.width).toBeLessThanOrEqual(78 + 0.000001);
      expect(image.y + image.height).toBeLessThanOrEqual(100);
      expect(copy.x).toBe(image.x);
      expect(copy.width).toBe(image.width);
      expect(copy.y).toBeGreaterThan(
        ((image.y + image.height) * layout.photoArea.height) / 100,
      );
      if (index > 0) {
        const previous = layout.members[index - 1];
        const plus = layout.separators[index - 1];
        if (!previous || !plus) throw new Error("Missing adjacent member");
        expect(previous.image.x + previous.image.width).toBeLessThan(image.x);
        expect(plus.x).toBeGreaterThan(previous.image.x + previous.image.width);
        expect(plus.x).toBeLessThan(image.x);
      }
    });
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
  expect(images.every((image) => image.relativeTo === "photo-area")).toBe(true);
  expect(defaultBundleImages(product)).toEqual(images);
  expect(product).toEqual(before);
  expect(
    defaultLargeBundleImages({ bundleProducts: members.slice(0, 2) }),
  ).toEqual([]);
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
