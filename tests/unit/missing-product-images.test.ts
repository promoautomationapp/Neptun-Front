import { beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { requestAi } from "../../src/features/ai/ai.api";
import {
  missingImageTargets,
  startMissingImageSearch,
  finishMissingImageSearch,
  findMissingProductImages,
  productImageSearchKey,
} from "../../src/features/ai/missing-product-images";
import {
  catalogWithExcelProducts,
  hasExcelOfferPrice,
} from "../../src/features/brochure/missingCatalog";

vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
const missing: Product = {
  code: "99001",
  name: "Beko oven BBIE123",
  brand: "BEKO",
  regular: null,
  sale: 299,
  catalogMissing: true,
  source: "import",
  brochureDetails: ["72 L", "Grill"],
  specs: { Power: "2400 W" },
};
const found = {
  found: true as const,
  image: "/api/assets/found",
  sourceUrl: "https://manufacturer.example/BBIE123",
  imageUrl: "https://manufacturer.example/BBIE123.png",
  matchedName: "Beko BBIE123",
  matchedModel: "BBIE123",
};
function campaign(product = missing): Campaign {
  return {
    id: "campaign-1",
    name: "Excel offers",
    products: [structuredClone(product)],
  };
}
beforeEach(() => vi.clearAllMocks());

it("searches missing photos once after a command, records owned photo and leaves Excel facts/prices editable", async () => {
  const draft = campaign();
  const targets = missingImageTargets(draft.products);
  const target = targets[0]!;
  expect(requestAi).not.toHaveBeenCalled();
  expect(startMissingImageSearch(draft, target)).toBe(true);
  vi.mocked(requestAi).mockResolvedValue(found);
  await findMissingProductImages(targets, (item, result) =>
    finishMissingImageSearch(draft, item, result),
  );
  expect(requestAi).toHaveBeenCalledWith("ai-find-product-image", {
    code: "99001",
    name: missing.name,
    brand: "BEKO",
    category: "",
    details: ["72 L", "Grill", "Power: 2400 W"],
  });
  expect(draft.products[0]).toMatchObject({
    ...missing,
    image: found.image,
    skipAiCutout: true,
    imageSearch: { status: "found", sourceUrl: found.sourceUrl },
  });
  expect(missingImageTargets(draft.products)).toEqual([]);
  draft.products[0]!.sale = 279;
  draft.products[0]!.brochureDetails = ["Changed detail"];
  expect(draft.products[0]!.image).toBe(found.image);
});

it.each(["uploaded", "identity", "undo", "removed", "new-search"])(
  "ignores late results after %s",
  (edit) => {
    const draft = campaign();
    const target = missingImageTargets(draft.products)[0]!;
    startMissingImageSearch(draft, target);
    if (edit === "uploaded") draft.products[0]!.image = "/api/assets/my-photo";
    if (edit === "identity") draft.products[0]!.name = "Another oven";
    if (edit === "undo") delete draft.products[0]!.imageSearch;
    if (edit === "removed") draft.products = [];
    if (edit === "new-search")
      startMissingImageSearch(draft, { ...target, requestId: "new-request" });
    const before = structuredClone(draft);
    if (edit === "uploaded" || edit === "identity")
      delete before.products[0]!.imageSearch;
    expect(finishMissingImageSearch(draft, target, found)).toBe(false);
    expect(draft).toEqual(before);
  },
);

it("supports mixed sets with one unchanged shared price and missing member placeholders", async () => {
  const known: Product = {
    code: "known",
    name: "Hob",
    image: "/api/assets/hob",
  };
  const offer: Product = {
    code: "set",
    name: "Kitchen set",
    regular: 499,
    sale: 399,
    catalogMissing: true,
    missingCatalogCodes: [missing.code],
    bundleProducts: [known, missing],
  };
  const draft = campaign(offer);
  const targets = missingImageTargets(draft.products);
  expect(targets).toHaveLength(1);
  expect(targets[0]!.memberCode).toBe(missing.code);
  startMissingImageSearch(draft, targets[0]!);
  vi.mocked(requestAi).mockResolvedValue({
    found: false,
    reason: "No exact model found.",
  });
  await findMissingProductImages(targets, (target, result) =>
    finishMissingImageSearch(draft, target, result),
  );
  expect(draft.products[0]).toMatchObject({
    regular: 499,
    sale: 399,
    bundleProducts: [
      { image: known.image },
      { catalogMissing: true, imageSearch: { status: "not_found" } },
    ],
  });
  expect(draft.products[0]!.bundleProducts![1]!.image).toBeUndefined();
});

it("search identity ignores price/layout edits and failures retain original Excel facts", async () => {
  const draft = campaign();
  const target = missingImageTargets(draft.products)[0]!;
  startMissingImageSearch(draft, target);
  draft.products[0]!.sale = 249;
  draft.products[0]!.brochureImagePlacement = { x: 30, y: 60 };
  expect(productImageSearchKey(draft.products[0]!)).toBe(target.requestKey);
  vi.mocked(requestAi).mockRejectedValue(
    new Error("Search service unavailable"),
  );
  await findMissingProductImages([target], (item, result) =>
    finishMissingImageSearch(draft, item, result),
  );
  expect(draft.products[0]).toMatchObject({
    sale: 249,
    brochureDetails: missing.brochureDetails,
    imageSearch: { status: "failed" },
  });
});

it("replaces a found member photo atomically with its saved artwork and refreshes wallpaper fit without moving it", () => {
  const member: Product = {
    ...missing,
    image: "/api/assets/previous",
    aiOriginalImage: "/api/assets/pre-cutout",
    aiInchesEmbedded: true,
    screenArtwork: {
      image: "/api/assets/wallpaper",
      box: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 },
      detectedFor: "/api/assets/previous",
    },
  };
  const offer: Product = {
    code: "set",
    name: "Set",
    sale: 499,
    bundleProducts: [{ code: "known", name: "Known" }, member],
    productArtworks: [
      {
        id: "member-image",
        type: "bundle-product",
        memberCode: member.code,
        image: member.image,
        x: 30,
        y: 22,
        width: 25,
        height: 40,
      },
    ],
  };
  const draft = campaign(offer);
  const target = missingImageTargets(draft.products, true)[0]!;
  startMissingImageSearch(draft, target);
  expect(finishMissingImageSearch(draft, target, found)).toBe(true);
  expect(draft.products[0]!.productArtworks![0]).toEqual({
    ...offer.productArtworks![0],
    image: found.image,
  });
  expect(draft.products[0]!.bundleProducts![1]!.screenArtwork).toEqual({
    image: "/api/assets/wallpaper",
  });
  expect(
    draft.products[0]!.bundleProducts![1]!.aiOriginalImage,
  ).toBeUndefined();
  expect(
    draft.products[0]!.bundleProducts![1]!.aiInchesEmbedded,
  ).toBeUndefined();
  expect(draft.products[0]!.sale).toBe(499);
});

it("adds distinct missing Excel items to catalog search without overwriting actual catalog products", () => {
  const actual: Product = {
    code: "catalog",
    name: "Actual catalog",
    regular: 99,
  };
  const older = { ...campaign(), updatedAt: "2026-10-01" };
  const newer = {
    ...campaign({ ...missing, name: "Edited Excel name" }),
    updatedAt: "2026-10-08",
  };
  const merged = catalogWithExcelProducts(
    [actual],
    [
      older,
      newer,
      campaign({ ...actual, name: "Incorrect", catalogMissing: true }),
    ],
  );
  expect(merged).toEqual([
    actual,
    expect.objectContaining({
      name: "Edited Excel name",
      catalogMissing: true,
    }),
  ]);
  expect(hasExcelOfferPrice(missing)).toBe(true);
  expect(hasExcelOfferPrice({ ...missing, regular: 299 })).toBe(true);
  expect(hasExcelOfferPrice({ ...missing, regular: 199 })).toBe(false);
  expect(
    hasExcelOfferPrice({ ...missing, sale: Number.POSITIVE_INFINITY }),
  ).toBe(false);
});
