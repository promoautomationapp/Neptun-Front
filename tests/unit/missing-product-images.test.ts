import { beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { requestAi } from "../../src/features/ai/ai.api";
import {
  missingImageTargets,
  startMissingImageSearch,
  finishMissingImageSearch,
  findMissingProductImages,
  productImageSearchKey,
  productImageSearchParams,
  productImageSearchIsCoolingDown,
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

it("keeps a checked missing photo missing and avoids another lookup during its 14-day cooldown", () => {
  const draft = campaign();
  const target = missingImageTargets(draft.products)[0]!;
  startMissingImageSearch(draft, target);
  const cooldownUntil = new Date(Date.now() + 14 * 86_400_000).toISOString();
  finishMissingImageSearch(draft, target, {
    found: false,
    reason: "No exact photo found.",
    negativeCached: true,
    cooldownUntil,
    searchOutcome: "not_found",
  });
  expect(draft.products[0]!.imageSearch).toMatchObject({
    status: "not_found",
    negativeCached: true,
    cooldownUntil,
  });
  const next = missingImageTargets(draft.products, true)[0]!;
  expect(startMissingImageSearch(draft, next)).toBe(false);
  expect(requestAi).not.toHaveBeenCalled();
  expect(draft.products[0]!.image).toBeUndefined();
  expect(draft.products[0]!.imageSearch?.status).toBe("not_found");
  expect(
    productImageSearchIsCoolingDown(
      draft.products[0]!,
      Date.parse(cooldownUntil),
    ),
  ).toBe(false);
});

it("allows a corrected model or an expired missing-photo result to be searched", () => {
  for (const change of ["model", "expired"] as const) {
    const draft = campaign();
    const target = missingImageTargets(draft.products)[0]!;
    startMissingImageSearch(draft, target);
    finishMissingImageSearch(draft, target, {
      found: false,
      cooldownUntil: new Date(
        Date.now() + (change === "expired" ? -1 : 14) * 86_400_000,
      ).toISOString(),
    });
    if (change === "model") draft.products[0]!.name = "Beko oven BBIE456";
    expect(
      startMissingImageSearch(
        draft,
        missingImageTargets(draft.products, true)[0]!,
      ),
    ).toBe(true);
  }
});

it("does not treat temporary photo verification trouble as a cached missing model", () => {
  const draft = campaign();
  const target = missingImageTargets(draft.products)[0]!;
  startMissingImageSearch(draft, target);
  finishMissingImageSearch(draft, target, {
    found: false,
    retryable: true,
    searchOutcome: "verification_unavailable",
    cooldownUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  });
  expect(draft.products[0]!.imageSearch).toMatchObject({
    status: "failed",
    retryable: true,
    searchOutcome: "verification_unavailable",
  });
  expect(draft.products[0]!.imageSearch).not.toHaveProperty("cooldownUntil");
  expect(
    startMissingImageSearch(
      draft,
      missingImageTargets(draft.products, true)[0]!,
    ),
  ).toBe(true);
});

it("includes supplied model, selected color, category and imported identity facts without prices", () => {
  const product = {
    ...missing,
    model: "F999",
    ean: "1234567890123",
    subcategory: "Soundbars",
    url: "https://www.neptun-ks.com/F999",
    color: "Black",
    specs: { Model: "F999", Color: "Black", Power: "120 W" },
    excelSource: {
      row: 1,
      cells: {
        Model: "F999",
        Ngjyra: "Black",
        Price: "299",
        "Market Price": "399",
      },
    },
  };
  const params = productImageSearchParams(product);
  expect(params).toMatchObject({
    model: "F999",
    ean: "1234567890123",
    subcategory: "Soundbars",
    sourceUrl: product.url,
    variants: ["Black"],
  });
  expect(params.details).toContain("Model: F999");
  expect(params.details).toContain("Ngjyra: Black");
  expect(params.details.join(" ")).not.toMatch(/299|399|Price/);
  const recolored = { ...product, color: "White" };
  expect(productImageSearchKey(product)).not.toBe(
    productImageSearchKey(recolored),
  );
});
it("does not interpret stock columns mentioning models as the product model", () => {
  const product = {
    ...missing,
    code: "84066872",
    name: 'TABLET HUAWEI MATE PAD SE 11.5" 8/256GB SPACE GREY (DEMO)',
    specs: {
      Power: "20 W",
      "Supplier name": "Internal supplier",
      "Model availability": "9",
      Warranty: "2 years",
      "Model price": "299",
      Quantity: "10",
    },
    excelSource: {
      row: 1,
      cells: {
        "Stock In the moment that models are proposed": "9",
        "Stock In The System 1 Day Before Leaflet Starts": "10",
        "Model availability": "9",
        "Model warranty": "2 years",
        Description:
          'TABLET HUAWEI MATE PAD SE 11.5" 8/256GB SPACE GREY (DEMO)',
      },
    },
  };
  const params = productImageSearchParams(product);
  expect(params).not.toHaveProperty("model");
  expect(params.details.join(" ")).not.toMatch(
    /stock|models are proposed|supplier|availability|warranty|price|quantity/i,
  );
  expect(params.details).toContain("Power: 20 W");
  expect(
    productImageSearchParams({
      ...product,
      excelSource: {
        ...product.excelSource,
        cells: { ...product.excelSource.cells, "Product model": "AGS6-W09" },
      },
    }),
  ).toMatchObject({ model: "AGS6-W09" });
});
it("shares one exact lookup for the same offer in different categories while applying each request separately", async () => {
  const duplicate = {
    ...missing,
    code: "duplicate",
    category: "Other placement",
  };
  const draft: Campaign = {
    id: "duplicate-photos",
    name: "Duplicates",
    products: [
      { ...missing, code: "first", bundleProducts: [structuredClone(missing)] },
      {
        ...duplicate,
        bundleProducts: [{ ...missing, category: "Other placement" }],
      },
    ],
  };
  const targets = missingImageTargets(draft.products);
  targets.forEach((target) => startMissingImageSearch(draft, target));
  vi.mocked(requestAi).mockResolvedValue(found);
  await findMissingProductImages(targets, (target, result) =>
    finishMissingImageSearch(draft, target, result),
  );
  expect(requestAi).toHaveBeenCalledTimes(1);
  expect(
    draft.products.map((product) => product.bundleProducts?.[0]?.image),
  ).toEqual([found.image, found.image]);
});

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
    skipAiCutout: false,
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
    aiCutoutValidated: true,
    aiCutoutValidationVersion: 1,
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
  expect(
    draft.products[0]!.bundleProducts![1]!.aiCutoutValidated,
  ).toBeUndefined();
  expect(
    draft.products[0]!.bundleProducts![1]!.aiCutoutValidationVersion,
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
