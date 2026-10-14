import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  bundleMemberByCode,
  updateBundleMember,
} from "../../src/features/brochure/bundleMemberUpdates";

const tv: Product = {
  code: "tv",
  name: "TV",
  sale: 599,
  screenAnnotationPlacement: { x: 1, scale: 0.8 },
};
const appliance: Product = { code: "appliance", name: "FURRË", sale: 199 };
const nested: Product = {
  code: "nested",
  name: "Nested set",
  bundleProducts: [tv],
};
const offer: Product = {
  code: "offer",
  name: "SET",
  regular: 1099,
  sale: 799,
  bundleProducts: [appliance, nested],
};

it("finds nested members and copies only the edited member path without changing the shared offer", () => {
  const before = structuredClone(offer);
  expect(bundleMemberByCode(offer, "tv")).toBe(tv);
  const next = updateBundleMember(offer, "tv", {
    screenAnnotationPlacement: { x: 2, y: 3, scale: 1.2 },
  })!;
  expect(next[0]).toBe(appliance);
  expect(next[1]).not.toBe(nested);
  expect(next[1]?.bundleProducts?.[0]).toEqual({
    ...tv,
    screenAnnotationPlacement: { x: 2, y: 3, scale: 1.2 },
  });
  expect(offer).toEqual(before);
  expect([
    offer.regular,
    offer.sale,
    next[1]?.bundleProducts?.[0]?.sale,
  ]).toEqual([1099, 799, 599]);
});

it("persists explicit label deletion on the member while retaining independent sibling settings", () => {
  const sibling = {
    ...tv,
    code: "other-tv",
    screenAnnotationPlacement: { x: -3, y: 4, scale: 0.9 },
  };
  const product = { ...offer, bundleProducts: [tv, sibling] };
  const next = updateBundleMember(product, "tv", {
    screenAnnotationPlacement: {
      ...tv.screenAnnotationPlacement,
      hidden: true,
    },
  })!;
  expect(next[0]?.screenAnnotationPlacement).toEqual({
    x: 1,
    scale: 0.8,
    hidden: true,
  });
  expect(next[1]).toBe(sibling);
});

it("retains the original array for unknown members and supports offers without member data", () => {
  expect(
    updateBundleMember(offer, "missing", {
      screenAnnotationPlacement: { hidden: true },
    }),
  ).toBe(offer.bundleProducts);
  expect(updateBundleMember(appliance, "tv", {})).toBeUndefined();
  expect(bundleMemberByCode(offer, "missing")).toBeNull();
});
