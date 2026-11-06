import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { screenArtworkFit } from "../../src/features/brochure/screenArtworkFit";
import { applyTvWallpaper } from "../../src/features/brochure/tvWallpaper";

it("fills every TV size and old default-contain wallpaper while retaining an explicit whole-image choice", () => {
  for (const inches of [24, 32, 55, 65, 75, 85, 98]) {
    const product: Product = {
      code: String(inches),
      name: `TV LED ${inches} inch`,
      subcategory: "TV",
    };
    expect(screenArtworkFit(product)).toBe("cover");
    expect(screenArtworkFit(product, { fit: "contain" })).toBe("cover");
    expect(
      screenArtworkFit(product, { fit: "contain", fitExplicit: true }),
    ).toBe("contain");
  }
  expect(screenArtworkFit({ code: "laptop", name: "Laptop" })).toBe("contain");
});

it("applies cover to each measured panel without changing its bezel-safe geometry or the source photo", () => {
  const products: Product[] = [32, 75].map((inches) => ({
    code: String(inches),
    name: `TV LED ${inches} inch`,
    subcategory: "TV",
    image: `/tv-${inches}.png`,
  }));
  const boxes = [
    { x: 0.1, y: 0.12, width: 0.8, height: 0.52 },
    { x: 0.2, y: 0.2, width: 0.6, height: 0.4 },
  ];
  const fits = products.map((product, index) => ({
    code: product.code,
    detectedFor: product.image!,
    box: boxes[index]!,
  }));
  applyTvWallpaper(
    { products },
    products[0]!.code,
    { image: "/portrait.jpg", fit: "contain" },
    "all",
    { fits, unfittedCodes: [] },
  );
  products.forEach((product, index) => {
    expect(product.screenArtwork).toMatchObject({
      image: "/portrait.jpg",
      fit: "cover",
      box: boxes[index],
    });
    expect(product.image).toBe(`/tv-${product.code}.png`);
  });
  applyTvWallpaper(
    { products },
    products[0]!.code,
    { image: "/portrait.jpg", fit: "contain", fitExplicit: true },
    "all",
    { fits, unfittedCodes: [] },
  );
  expect(
    products.every(
      (product) =>
        product.screenArtwork?.fit === "contain" &&
        product.screenArtwork.fitExplicit,
    ),
  ).toBe(true);
});
