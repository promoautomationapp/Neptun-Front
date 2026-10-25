import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { defaultProductDetailPlacement } from "../../src/features/brochure/mobileDetails";
import { resolveSettings } from "../../src/features/settings/settings.schema";

const blue = (
  placement: "left" | "bottom",
  visualStyle = true,
): Partial<Campaign> => {
  const productDesign = resolveSettings(null).productDesign;
  productDesign.details.placement = placement;
  return {
    ...(visualStyle
      ? { brochureVisualStyle: "october" }
      : { brochurePresetId: "neptun-october" }),
    productDesign,
    offerStyle: "current",
  };
};

it.each([
  [
    { name: "Samsung Galaxy A57", brand: "Samsung", subcategory: "Smartphone" },
    "left",
  ],
  [{ name: "Redmi Note 17 Pro", brand: "Xiaomi" }, "left"],
  [
    { name: "iPhone 17 Pro", brand: "Apple", subcategory: "Smartphone" },
    "bottom",
  ],
  [{ name: "iPhone 16", subcategory: "Smartphone" }, "bottom"],
  [
    { name: "Soundbar S40T", brand: "LG", subcategory: "ZMËDHUES ZËRI" },
    "bottom",
  ],
  [{ name: "TV LED 65ABC", brand: "LG", subcategory: "TV" }, "bottom"],
  [
    { name: "Tablet Galaxy Tab", brand: "Samsung", subcategory: "Tablet" },
    "bottom",
  ],
  [{ name: "iPad Air M4", brand: "Apple", subcategory: "Tablet" }, "bottom"],
  [{ name: "MacBook Air", brand: "Apple", subcategory: "Laptop" }, "bottom"],
  [{ name: "Case for iPhone 17", category: "Accessories" }, "bottom"],
  [{ name: "Bluetooth speaker", brand: "JBL" }, "bottom"],
] satisfies Array<[Partial<Product>, string]>)(
  "uses category-based Blue defaults for %j, regardless of workspace placement or price design",
  (product, expected) => {
    for (const placement of ["left", "bottom"] as const)
      for (const offerStyle of ["current", "card"])
        expect(
          defaultProductDetailPlacement(product, {
            ...blue(placement),
            offerStyle,
          }),
        ).toBe(expected);
    expect(defaultProductDetailPlacement(product, blue("left", false))).toBe(
      expected,
    );
  },
);

it("preserves deliberate per-product placement and first-preset workspace defaults", () => {
  expect(
    defaultProductDetailPlacement(
      { name: "Samsung Galaxy A57", detailPlacement: "bottom" },
      blue("left"),
    ),
  ).toBe("bottom");
  expect(
    defaultProductDetailPlacement(
      { name: "Soundbar S40T", detailPlacement: "left" },
      blue("bottom"),
    ),
  ).toBe("left");
  const first = {
    ...blue("left"),
    brochureVisualStyle: undefined,
    brochurePresetId: "neptun-current",
  };
  expect(defaultProductDetailPlacement({ name: "Soundbar S40T" }, first)).toBe(
    "left",
  );
});
