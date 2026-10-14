import { expect, it } from "vitest";
import {
  hasApplePhotos,
  isApplePhotoArtwork,
} from "../../src/features/brochure/productTypes";
import type { Product } from "../../src/domain/models";

const phone: Product = {
  code: "iphone",
  name: "iPhone 17 Pro Max",
  brand: "APPLE",
};
const samsung: Product = {
  code: "samsung",
  name: "Galaxy S26 Ultra",
  brand: "SAMSUNG",
};
const nested: Product = {
  code: "nested",
  name: "Phone offer",
  brand: "APPLE / SAMSUNG",
  bundleProducts: [samsung, phone],
};
const mixed: Product = {
  code: "offer",
  name: "Devices offer",
  brand: "APPLE / SAMSUNG",
  bundleProducts: [samsung, nested],
};

it("protects Apple primary images without treating compatible accessories as Apple", () => {
  expect(hasApplePhotos(phone)).toBe(true);
  expect(hasApplePhotos({ name: "MacBook Air" })).toBe(true);
  expect(
    hasApplePhotos({
      name: "LAPTOP APPLE MACBOOK AIR",
      subcategory: "MacBook",
    }),
  ).toBe(true);
  expect(hasApplePhotos({ name: "SMARTPHONE APPLE IPHONE 17" })).toBe(true);
  expect(hasApplePhotos({ name: "MacBook Air case" })).toBe(false);
  expect(hasApplePhotos({ name: "iPhone charger" })).toBe(false);
  expect(hasApplePhotos({ brand: "BELKIN", name: "iPhone case" })).toBe(false);
  expect(hasApplePhotos(samsung)).toBe(false);
});

it("protects additional or combined photos in recursively mixed-brand Apple offers", () => {
  expect(hasApplePhotos(mixed)).toBe(true);
  expect(isApplePhotoArtwork(mixed, "image")).toBe(true);
  expect(isApplePhotoArtwork(mixed, "bundle-product", nested)).toBe(true);
  expect(isApplePhotoArtwork(mixed, "bundle-product", phone)).toBe(true);
});

it("uses resolved member identity and conservatively protects an unresolved mixed-offer photo", () => {
  expect(isApplePhotoArtwork(mixed, "bundle-product", samsung)).toBe(false);
  expect(isApplePhotoArtwork(mixed, "bundle-product", null)).toBe(true);
  expect(isApplePhotoArtwork(samsung, "image")).toBe(false);
});

it("keeps feature icons independent of the product-photo clearance rule", () => {
  for (const type of ["wifi", "inverter", "energy"])
    expect(isApplePhotoArtwork(mixed, type)).toBe(false);
});
