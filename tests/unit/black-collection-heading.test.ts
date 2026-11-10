import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  blackCollectionPageArtworks,
  blackFridayFrames,
  blackFridayReference,
  materializeBlackCollectionPageArtworks,
} from "../../src/features/brochure/blackFridayDesign";
import { fitCoverBelowBanners } from "../../src/features/brochure/pageBanners";

const campaign = (): Campaign => ({
  id: "heading",
  name: "Black collection",
  brochureReferenceDesign: "black-collection",
  brochureFormat: "a3",
  products: [{ code: "offer", name: "Offer" }],
});
it("gives an existing clean interior the small native tilted editable heading without changing saved data", () => {
  const value = campaign();
  const before = structuredClone(value);
  const header = blackCollectionPageArtworks(value, "product-0");
  expect(header).toHaveLength(1);
  expect(header.some((layer) => layer.type === "shape")).toBe(false);
  expect(header.find((layer) => layer.type === "text")).toMatchObject({
    text: "BLACK\n\u2003FRIDAY",
    color: "#ffffff",
    fontFamily: "Cera Pro",
    fontWeight: 900,
  });
  const frames = blackFridayFrames(2, value.products, value);
  expect(frames[0]!.y).toBeGreaterThan(5.7);
  expect(frames[0]!.y).toBeLessThan(6.5);
  expect(value).toEqual(before);
  expect(
    blackCollectionPageArtworks(value, "cover").some(
      (layer) => layer.id === "black-collection-payment",
    ),
  ).toBe(true);
});
it("materializes the heading for an edit and respects a saved edit, hidden layer or removal", () => {
  const value = campaign();
  materializeBlackCollectionPageArtworks(value, "product-0");
  const saved = value.pageArtworks!["product-0"]!;
  saved[0]!.hidden = true;
  saved[0]!.text = "MY PROMOTION";
  expect(blackCollectionPageArtworks(value, "product-0")).toBe(saved);
  value.pageArtworks!["product-0"] = [];
  expect(blackCollectionPageArtworks(value, "product-0")).toHaveLength(1);
  value.pageArtworks!["product-0"] = [{ ...saved[0]!, hidden: true }];
  expect(blackCollectionPageArtworks(value, "product-0")[0]!.hidden).toBe(true);
  expect(blackFridayFrames(2, value.products, value)[0]!.y).toBe(2);
});

it("adds the missing heading beside older saved banners without discarding their artwork", () => {
  const value = campaign();
  const banner = {
    id: "saved-banner",
    type: "text",
    layoutRole: "banner" as const,
    text: "My offer",
    x: 1,
    y: 7,
    width: 98,
    height: 7,
  };
  value.pageArtworks = { "product-0": [banner] };
  const layers = blackCollectionPageArtworks(value, "product-0");
  expect(layers.some((layer) => layer.id === "black-collection-heading")).toBe(
    true,
  );
  expect(layers.find((layer) => layer.id === banner.id)).toBe(banner);
  materializeBlackCollectionPageArtworks(value, "product-0");
  value.pageArtworks["product-0"]!.find(
    (layer) => layer.id === "black-collection-heading",
  )!.rotation = -17;
  expect(
    blackCollectionPageArtworks(value, "product-0").find(
      (layer) => layer.id === "black-collection-heading",
    )!.rotation,
  ).toBe(-17);
});

it("keeps cover payment dates current until its text is explicitly edited", () => {
  const value = {
    ...campaign(),
    startDate: "2026-11-20",
    endDate: "2026-11-30",
  };
  materializeBlackCollectionPageArtworks(value, "cover");
  const payment = value.pageArtworks!["cover"]!.find(
    (layer) => layer.id === "black-collection-payment",
  )!;
  expect(payment.text).toContain("30");
  expect(payment.text).not.toContain("2025");
  value.endDate = "2026-12-02";
  expect(
    blackCollectionPageArtworks(value, "cover").find(
      (layer) => layer.id === payment.id,
    )!.text,
  ).not.toContain("30");
  payment.text = "Custom payment message";
  expect(
    blackCollectionPageArtworks(value, "cover").find(
      (layer) => layer.id === payment.id,
    )!.text,
  ).toBe("Custom payment message");
});
it("uses actual visible banner clearance and leaves custom product frames to their saved overrides", () => {
  const value = campaign();
  value.pageArtworks = {
    "product-0": [
      {
        id: "banner",
        type: "text",
        layoutRole: "banner",
        text: "My banner",
        x: 0,
        y: 0,
        width: 100,
        height: 20,
      },
    ],
  };
  const frames = blackFridayFrames(2, value.products, value);
  const fitted = fitCoverBelowBanners(
    frames[0]!,
    value,
    "product-0",
    frames[0]!.y,
    98,
  );
  expect(fitted.y).toBeCloseTo(21.2);
  expect(fitted.y + fitted.height).toBeCloseTo(98);
  value.pageArtworks["product-0"]![0]!.hidden = true;
  expect(
    fitCoverBelowBanners(frames[0]!, value, "product-0", frames[0]!.y, 98),
  ).toEqual(frames[0]);
});
it("keeps the native Black Friday source headings and product frames unchanged", () => {
  const value = {
    ...campaign(),
    brochureReferenceDesign: "black-friday" as const,
  };
  const native = blackFridayReference.pages.find((page) => page.number === 2)!;
  const products = native.frames.map((frame, index) => ({
    code: String(index),
    name: frame.model,
  }));
  expect(blackFridayFrames(2, products, value)).toBe(native.frames);
  expect(blackCollectionPageArtworks(value, "product-0")).toEqual([]);
});
