import { describe, it, expect } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { needsImagePreparation } from "../../src/features/brochure/imageReview";
import {
  buildProofreadItems,
  dirtyProofreadItems,
  recordTextReview,
} from "../../src/features/brochure/reviewText";
import {
  brandLogoFor,
  rememberPreparedBrandLogo,
} from "../../src/features/brochure/brandLogos";
const product: Product = {
  code: "1",
  name: "Televizor Samsung",
  image: "/api/assets/prepared",
  aiOriginalImage: "/api/assets/original",
};
const campaign = (): Campaign => ({
  id: "review",
  name: "October",
  products: [structuredClone(product)],
  type: "Black Friday",
  tagline: "Oferta speciale",
  includeStoresPage: false,
});
const items = (draft: Campaign) =>
  buildProofreadItems(draft, new Set(["1"]), {
    cover: true,
    name: true,
    description: true,
    specs: true,
  }).items;
describe("invisible persisted AI reuse", () => {
  it("keeps approved legacy cutouts, including after serialization and a background change", () => {
    const restored = JSON.parse(JSON.stringify(product)) as Product;
    expect(
      needsImagePreparation(restored, { kind: "solid", color: "#112233" }),
    ).toBe(false);
    expect(
      needsImagePreparation(
        restored,
        { kind: "solid", color: "#ffffff" },
        { force: true },
      ),
    ).toBe(true);
  });
  it("only marks unchecked source images for preparation", () => {
    expect(
      needsImagePreparation({ ...product, aiOriginalImage: undefined }),
    ).toBe(true);
    expect(needsImagePreparation({ ...product, skipAiCutout: true })).toBe(
      false,
    );
  });
  it("reuses checked modern images after background, provider and display revision changes", () => {
    const checked = {...product, aiPreparationRevision: 2, aiBackgroundSignature: "previous-background", aiCutoutProvider: "openai", aiAnnotationStyle: "external-tv-corner"};
    expect(needsImagePreparation(checked, {kind: "solid", color: "#ffffff"})).toBe(false);
    expect(needsImagePreparation(checked, undefined, {force:true})).toBe(true);
  });
  it("persists checked text with no corrections and only rechecks changed fields", () => {
    const draft = campaign();
    recordTextReview(draft);
    const restored = JSON.parse(JSON.stringify(draft)) as Campaign;
    expect(dirtyProofreadItems(restored, items(restored))).toEqual([]);
    restored.products[0]!.name = "Changed product name";
    expect(
      dirtyProofreadItems(restored, items(restored)).map((item) => item.text),
    ).toEqual(["Changed product name"]);
    restored.products[0]!.name = product.name;
    expect(dirtyProofreadItems(restored, items(restored))).toEqual([]);
  });
  it("keeps declined suggestions and the original text in review history", () => {
    const draft = campaign();
    const field = items(draft).find((item) => item.text === product.name);
    if (!field) throw new Error("Field missing");
    recordTextReview(draft, [
      {
        type: "text",
        fieldKey: field.key,
        original: product.name,
        suggested: "Alternative wording",
      },
    ]);
    expect(dirtyProofreadItems(draft, items(draft))).toEqual([]);
    draft.products[0]!.name = "Alternative wording";
    expect(dirtyProofreadItems(draft, items(draft))).toEqual([]);
  });
  it("uses database asset URLs for a shared prepared brand", () => {
    const url = "/api/assets/00000000-0000-4000-8000-000000000001";
    rememberPreparedBrandLogo("Test Brand", url);
    expect(brandLogoFor({}, "TEST BRAND")).toBe(url);
  });
  it("text edited while AI is running is not recorded as checked", () => {
    const draft = campaign();
    const submitted = items(draft);
    draft.products[0]!.name = "New copy written while checking";
    recordTextReview(draft, [], submitted);
    expect(
      dirtyProofreadItems(draft, items(draft)).map((item) => item.text),
    ).toEqual(["New copy written while checking"]);
    expect(draft.aiReviewedTextSnapshot).toBeUndefined();
    draft.products[0]!.name = product.name;
    expect(dirtyProofreadItems(draft, items(draft))).toEqual([]);
  });
});
