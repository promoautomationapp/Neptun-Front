import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  clearPostImagePreparation,
  createPost,
  outputDimensions,
  layoutSocialProducts,
  postDetailEntries,
  productForPost,
  reorderByCode,
} from "../../src/features/social/postModel";
it("copies a brochure product without losing structured detail keys, image preparation, or editable nested artwork", () => {
  const original: Product = {
    code: "set",
    name: "Set",
    brochureDetails: [" 72 L ", { key: "memory", text: " 128 GB " }],
    bundleProducts: [{ code: "oven", name: "Oven" }],
    productArtworks: [
      { id: "brand", image: "/brand.png", x: 10, y: 20, width: 30 },
    ],
    brandLogo: "/chosen-brand.png",
    hideBrandLogo: true,
    autoSpecsDisabled: true,
    detailBlockStyles: { memory: "filled" },
    aiOriginalImage: "/original.png",
    aiPreparationRevision: 4,
    screenArtwork: { image: "/screen.png", fit: "contain" },
    regular: "1008",
    sale: "629",
    image: "/set.png",
  };
  const copied = productForPost(original);
  expect(postDetailEntries(copied)).toEqual([
    ["0", "72 L"],
    ["memory", "128 GB"],
  ]);
  expect(copied).toMatchObject({
    regular: 1008,
    sale: 629,
    cutoutStatus: "done",
    aiPreparationRevision: 4,
    brandLogo: "/chosen-brand.png",
    hideBrandLogo: true,
    autoSpecsDisabled: true,
    detailBlockStyles: { memory: "filled" },
  });
  copied.bundleProducts![0]!.name = "Changed";
  copied.productArtworks![0]!.x = 50;
  copied.screenArtwork!.fit = "cover";
  expect(original.bundleProducts![0]!.name).toBe("Oven");
  expect(original.productArtworks![0]!.x).toBe(10);
  expect(original.screenArtwork!.fit).toBe("contain");
  clearPostImagePreparation(copied);
  expect(copied.aiOriginalImage).toBeUndefined();
  expect(copied.aiPreparationRevision).toBeUndefined();
  expect(copied.name).toBe("Set");
});
it("keeps safe format fallbacks, quality proportions, and bounded custom sizes", () => {
  const post = createPost([{ code: "tv", name: "TV" }]);
  expect(post.sourceCampaignId).toBeNull();
  expect(outputDimensions(post)).toEqual({ width: 1080, height: 1350 });
  expect(
    outputDimensions({ ...post, preset: "unknown", quality: "4k" }),
  ).toEqual({ width: 3072, height: 3840 });
  expect(
    outputDimensions({
      ...post,
      preset: "custom",
      customWidth: 1,
      customHeight: 90000,
      quality: "8k",
    }),
  ).toEqual({ width: 320, height: 8192 });
});
it("reorders existing product codes without mutating or removing offers", () => {
  const products = [
    { code: "a", name: "A" },
    { code: "b", name: "B" },
    { code: "c", name: "C" },
  ];
  expect(reorderByCode(products, "a", "c").map((x) => x.code)).toEqual([
    "b",
    "c",
    "a",
  ]);
  expect(products.map((x) => x.code)).toEqual(["a", "b", "c"]);
  expect(reorderByCode(products, null, "b")).toBe(products);
  expect(reorderByCode(products, "a", "a")).toBe(products);
});

it("lays out product grids without mutating original products or dropping overflow products", () => {
  const products = Array.from({ length: 6 }, (_, index) => ({
    code: String(index),
    name: `Product ${index}`,
    image: `/prepared-${index}.png`,
  }));
  const grid = layoutSocialProducts(products, { rows: 1, columns: 2, gap: 4 });
  expect(grid).toHaveLength(6);
  expect(grid.map((product) => product.y)).toEqual([31, 31, 49, 49, 67, 67]);
  expect(grid.map((product) => product.x)).toEqual([29, 71, 29, 71, 29, 71]);
  expect(products[0]).not.toHaveProperty("positioned");
  expect(
    grid.every((product) => product.positioned && product.scale === 22.5),
  ).toBe(true);
  expect(
    outputDimensions({
      ...createPost(),
      preset: "custom",
      customWidth: 1440,
      customHeight: 1920,
      products: grid,
    }),
  ).toEqual({ width: 1440, height: 1920 });
});
