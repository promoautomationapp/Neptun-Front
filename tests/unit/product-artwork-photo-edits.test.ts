import { expect, it } from "vitest";
import type { Artwork, Product } from "../../src/domain/models";
import { patchProductArtwork } from "../../src/features/brochure/productArtworkEdits";

const box = { x: 0.2, y: 0.1, width: 0.6, height: 0.5 };
const tv: Product = {
  code: "tv",
  name: "TV LED",
  subcategory: "TV",
  image: "/tv-original.png",
  screenArtwork: {
    image: "/wallpaper.jpg",
    box,
    detectedFor: "/custom-member.png",
  },
  screenAnnotationPlacement: { x: 0, y: 0, scale: 1.3 },
};
const oven: Product = {
  code: "oven",
  name: "Oven",
  image: "/oven.png",
  sale: 299,
};
const artworks: Artwork[] = [
  {
    id: "member-tv",
    type: "bundle-product",
    memberCode: "tv",
    image: "/custom-member.png",
    usesPrimaryImage: false,
    x: 35,
    y: 10,
    width: 60,
    height: 40,
  },
  { id: "badge", type: "wifi", image: "/wifi.svg", x: 70, y: 5, width: 8 },
];
const bundle: Product = {
  code: "set",
  name: "Bundle",
  sale: 899,
  regular: 1099,
  bundleProducts: [
    oven,
    { code: "inner", name: "Nested bundle", bundleProducts: [tv] },
  ],
  productArtworks: artworks,
};

it("updates a secondary custom bundle photo and invalidates its old wallpaper geometry atomically", () => {
  const changes = patchProductArtwork(bundle, artworks, "member-tv", {
    image: "/new-crop.jpg",
    usesPrimaryImage: false,
  });
  expect(changes.productArtworks?.[0]).toMatchObject({
    image: "/new-crop.jpg",
    usesPrimaryImage: false,
    x: 35,
    y: 10,
    width: 60,
    height: 40,
  });
  const member = changes.bundleProducts?.[1]?.bundleProducts?.[0];
  expect(member).toMatchObject({
    image: "/new-crop.jpg",
    screenArtwork: { image: "/wallpaper.jpg" },
    screenAnnotationPlacement: tv.screenAnnotationPlacement,
  });
  expect(member?.screenArtwork?.box).toBeUndefined();
  expect(member?.screenArtwork?.detectedFor).toBeUndefined();
  expect(changes.bundleProducts?.[0]).toBe(oven);
  expect(changes.productArtworks?.[1]).toBe(artworks[1]);
  expect(bundle.sale).toBe(899);
  expect(bundle.regular).toBe(1099);
  expect(tv.image).toBe("/tv-original.png");
  expect(tv.screenArtwork?.box).toBe(box);
});

it("invalidates a legacy member fit when its corresponding picture is explicitly replaced", () => {
  const legacy: Product = {
    ...tv,
    screenArtwork: { image: "/wallpaper.jpg", box },
  };
  const changes = patchProductArtwork(
    { ...bundle, bundleProducts: [legacy, oven] },
    artworks,
    "member-tv",
    { image: "/new-crop.jpg" },
  );
  expect(changes.bundleProducts?.[0]?.screenArtwork).toEqual({
    image: "/wallpaper.jpg",
  });
  expect(legacy.screenArtwork?.box).toBe(box);
});

it("keeps a member's manually fitted geometry for the same rendered photo", () => {
  const source = new URL("/custom-member.png", document.baseURI).href;
  const changes = patchProductArtwork(bundle, artworks, "member-tv", {
    image: source,
  });
  expect(changes.bundleProducts?.[1]?.bundleProducts?.[0]?.screenArtwork).toBe(
    tv.screenArtwork,
  );
});

it("moves or resizes an artwork without replacing member photos and keeps proportional height", () => {
  const changes = patchProductArtwork(bundle, artworks, "member-tv", {
    width: 30,
    x: 45,
  });
  expect(changes.productArtworks?.[0]).toMatchObject({
    width: 30,
    height: 20,
    x: 45,
    image: "/custom-member.png",
  });
  expect(changes).not.toHaveProperty("bundleProducts");
  const badge = patchProductArtwork(bundle, artworks, "badge", {
    image: "/new-wifi.svg",
  });
  expect(badge).not.toHaveProperty("bundleProducts");
});
